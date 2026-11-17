// Gemini direto do app com a chave do próprio gestor (AI Studio). Decisão do dono: sem servidor.
import { fetch as buscarStream } from 'expo/fetch';
import { File } from 'expo-file-system';
import { NativeModules } from 'react-native';
import { FORMATO_TIPO, FORMATO_TRANSCRICAO, INSTRUCAO_RESUMO, INSTRUCAO_TIPO, escolherTipo, instrucaoComGestor, lerTranscricao, pedidoResumo, pedidoTipo, transcricao } from '../lib/prompt';
import type { Fala } from '../types';

const BASE = 'https://generativelanguage.googleapis.com';
// ponytail: aliases que o Google atualiza sozinho; fixar versões se a saída mudar demais.
// Lite primeiro: respondeu em 2–25 s e separou as vozes certo nos testes; o Flash dava 503 ou travava até o prazo.
const MODELOS = ['gemini-flash-lite-latest', 'gemini-flash-lite-latest', 'gemini-flash-latest'];
// Até aqui vai junto no pedido (base64); acima sobe antes pela Files API (gravações longas de outros apps).
const LIMITE_INLINE = 15_000_000;

/** `instrucoes`: o jeito de escrever que o gestor salvou no Perfil. */
export async function gerarTexto(chave: string, pedido: string, instrucoes?: string): Promise<string> {
  const texto = await chamar(chave, {
    systemInstruction: { parts: [{ text: instrucaoComGestor(instrucoes) }] },
    contents: [{ role: 'user', parts: [{ text: pedido }] }],
  }, 20_000);
  if (!texto) throw new Error('O Gemini não devolveu texto. Tente reescrever as anotações.');
  return texto;
}

/** Ocorrência → tipo (existente ou novo). */
export async function classificarOcorrencia(chave: string, o: Parameters<typeof pedidoTipo>[0], tipos: Parameters<typeof pedidoTipo>[1]): Promise<string> {
  const texto = await chamar(chave, {
    systemInstruction: { parts: [{ text: INSTRUCAO_TIPO }] },
    contents: [{ role: 'user', parts: [{ text: pedidoTipo(o, tipos) }] }],
    generationConfig: { responseMimeType: 'application/json', responseSchema: FORMATO_TIPO },
  }, 20_000);
  let tipo = '';
  try { tipo = String(JSON.parse(texto).tipo ?? ''); } catch { tipo = texto; }
  return escolherTipo(tipo, tipos.map(t => t.tipo));
}

/** Ocorrências de um assunto → resumo curto (o que se repete, tendência, sugestão). */
export async function resumirAssunto(chave: string, tipo: string, os: Parameters<typeof pedidoResumo>[1]): Promise<string> {
  const texto = (await chamar(chave, {
    systemInstruction: { parts: [{ text: INSTRUCAO_RESUMO }] },
    contents: [{ role: 'user', parts: [{ text: pedidoResumo(tipo, os) }] }],
  }, 30_000)).trim();
  if (!texto) throw new Error('O Gemini não devolveu o resumo.');
  return texto;
}

export type Progresso = { fase: 'enviando' } | { fase: 'transcrevendo'; falas: number };

/** Áudio da conversa → falas já separadas entre o gestor e o técnico. */
export async function transcrever(chave: string, audio: Blob, mimeType: string, tecnico: string,
  aoProgredir: (p: Progresso) => void): Promise<Fala[]> {
  aoProgredir({ fase: 'enviando' });
  // Áudio longo num pedido só: o Gemini parava por volta dos 10 min. Então vai em pedaços de ~10 min,
  // cortados num silêncio (entre palavras), e cada um leva o fim do anterior para seguir o raciocínio.
  const pedacos = (await cortar(audio)) ?? [audio];
  const falas: Fala[] = [], vazios: string[] = [];
  for (let i = 0; i < pedacos.length; i++) {
    const p = pedacos[i]!, mime = p === audio ? mimeType : 'audio/wav';
    const parte = p.size <= LIMITE_INLINE
      ? { inlineData: { mimeType: mime, data: await base64(p) } }
      : { fileData: { mimeType: mime, fileUri: await enviarArquivo(chave, p, mime) } };
    if (!i) aoProgredir({ fase: 'transcrevendo', falas: 0 });
    const pedido = pedacos.length === 1 ? [] : [{ text: `Este é o pedaço ${i + 1} de ${pedacos.length} de uma gravação longa, cortado num silêncio.`
      + (falas.length ? ` O pedaço anterior terminou assim (continue o raciocínio com as mesmas pessoas; não repita): ${JSON.stringify(falas.slice(-3))}` : '') }];
    motivo = '';
    const texto = await chamar(chave, {
      systemInstruction: { parts: [{ text: transcricao(tecnico) }] },
      contents: [{ role: 'user', parts: [parte, ...pedido] }],
      generationConfig: {
        responseMimeType: 'application/json',
        responseSchema: FORMATO_TRANSCRICAO,
        // Conversa de 1 h passa fácil de 8 mil tokens; sem isto o JSON vinha cortado e a transcrição "sumia".
        maxOutputTokens: 65536,
        // "low" ainda deixa separar as vozes com cuidado sem a espera longa do padrão ("minimal" não existe no 3.8 Flash).
        thinkingConfig: { thinkingLevel: 'low' },
      },
    }, 45_000, parcial => aoProgredir({ fase: 'transcrevendo', falas: falas.length + parcial.split('"texto"').length - 1 }));
    const lidas = lerTranscricao(texto);
    if (!lidas.length) vazios.push(`pedaço ${i + 1}/${pedacos.length}: ${motivo || '?'}, ${texto.length} letras`);
    falas.push(...lidas);
  }
  if (!falas.length) throw new Error(`O Gemini não devolveu nenhuma fala desta gravação (${vazios.join('; ')}).`);
  return falas;
}

const TAXA = 16_000; // o Gemini reduz o áudio a 16 kHz de qualquer jeito
const JANELA = 10 * 60 * TAXA;

/**
 * Só no navegador: decodifica, corta perto de cada 10 min no trecho mais quieto (pausa entre palavras)
 * e devolve WAVs 16 kHz mono. null = não precisa ou não deu (vai o arquivo inteiro).
 */
export async function cortar(audio: Blob): Promise<Blob[] | null> {
  // Android: o áudio é File do expo-file-system; corta no nativo (AudioPackage.kt), que devolve os WAVs no cache.
  if ('base64' in audio) {
    const nativo = NativeModules.FeedTecAudio as { cortar(uri: string): Promise<string[] | null> } | undefined;
    const uris = await nativo?.cortar((audio as unknown as File).uri);
    return uris ? uris.map(u => new File(u) as unknown as Blob) : null;
  }
  if (typeof AudioContext === 'undefined') return null;
  const ctx = new AudioContext({ sampleRate: TAXA });
  try {
    const buf = await ctx.decodeAudioData(await audio.arrayBuffer());
    if (buf.duration <= 12 * 60) return null;
    // Mistura os canais: gravação de ligação pode ter cada pessoa de um lado.
    const som = new Float32Array(buf.length);
    for (let c = 0; c < buf.numberOfChannels; c++) {
      const d = buf.getChannelData(c);
      for (let i = 0; i < d.length; i++) som[i]! += d[i]! / buf.numberOfChannels;
    }
    const cortes = [0];
    // Sobra menor que 2 min vai junto no último pedaço.
    while (cortes.at(-1)! + JANELA < som.length - 2 * 60 * TAXA) cortes.push(silencio(som, cortes.at(-1)! + JANELA));
    cortes.push(som.length);
    return cortes.slice(1).map((fim, i) => wav(som.subarray(cortes[i], fim)));
  } catch { return null; } finally { ctx.close(); }
}

/** Meio da janela de 0,3 s mais quieta em ±15 s do alvo (0,3 s para não cair no silêncio de dentro de uma palavra). */
function silencio(som: Float32Array, alvo: number): number {
  const q = Math.round(TAXA * 0.3), passo = TAXA / 20;
  let melhor = alvo, menor = Infinity;
  for (let ini = alvo - 15 * TAXA; ini < alvo + 15 * TAXA; ini += passo) {
    let e = 0;
    for (let i = ini; i < ini + q; i++) e += som[i]! * som[i]!;
    if (e < menor) { menor = e; melhor = ini + q / 2; }
  }
  return melhor;
}

function wav(s: Float32Array): Blob {
  const v = new DataView(new ArrayBuffer(44 + s.length * 2));
  const txt = (o: number, t: string) => { for (let i = 0; i < t.length; i++) v.setUint8(o + i, t.charCodeAt(i)); };
  txt(0, 'RIFF'); v.setUint32(4, 36 + s.length * 2, true); txt(8, 'WAVE'); txt(12, 'fmt ');
  v.setUint32(16, 16, true); v.setUint16(20, 1, true); v.setUint16(22, 1, true); v.setUint32(24, TAXA, true);
  v.setUint32(28, TAXA * 2, true); v.setUint16(32, 2, true); v.setUint16(34, 16, true);
  txt(36, 'data'); v.setUint32(40, s.length * 2, true);
  for (let i = 0; i < s.length; i++) v.setInt16(44 + i * 2, Math.max(-1, Math.min(1, s[i]!)) * 0x7fff, true);
  return new Blob([v], { type: 'audio/wav' });
}

// No Android o áudio gravado vem como File do expo-file-system: lê direto do disco
// (fetch(file://).blob() + FileReader chegava vazio e o Gemini respondia 400).
type Nativo = { base64(): Promise<string>; bytes(): Promise<Uint8Array<ArrayBuffer>> };

export function base64(blob: Blob): Promise<string> {
  if ('base64' in blob) return (blob as unknown as Nativo).base64();
  return new Promise((ok, falha) => {
    const r = new FileReader();
    r.onload = () => ok(String(r.result).split(',')[1] ?? '');
    r.onerror = () => falha(new Error('Não deu para ler o áudio.'));
    r.readAsDataURL(blob);
  });
}

/** Upload resumable da Files API (arquivo fica 48 h no Google) → uri para usar no pedido. */
async function enviarArquivo(chave: string, audio: Blob, mimeType: string): Promise<string> {
  const ini = await fetch(`${BASE}/upload/v1beta/files`, {
    method: 'POST',
    headers: {
      'x-goog-api-key': chave, 'Content-Type': 'application/json',
      'X-Goog-Upload-Protocol': 'resumable', 'X-Goog-Upload-Command': 'start',
      'X-Goog-Upload-Header-Content-Length': String(audio.size), 'X-Goog-Upload-Header-Content-Type': mimeType,
    },
    body: JSON.stringify({ file: { display_name: 'conversa' } }),
  });
  const destino = ini.headers.get('x-goog-upload-url');
  if (!ini.ok || !destino) throw erro(ini.status, await ini.text().catch(() => ''));
  const cab = { 'X-Goog-Upload-Offset': '0', 'X-Goog-Upload-Command': 'upload, finalize' };
  // Bytes crus só passam pelo expo/fetch; o fetch do RN só manda Blob.
  const r = 'bytes' in audio
    ? await buscarStream(destino, { method: 'POST', headers: cab, body: await (audio as unknown as Nativo).bytes() })
    : await fetch(destino, { method: 'POST', headers: cab, body: audio });
  let arq = r.ok ? (await r.json()).file : undefined;
  if (!arq?.uri) throw new Error('Não deu para enviar o áudio ao Gemini. Tente de novo.');
  // Normalmente já vem pronto; se ainda estiver processando, espera um pouco.
  for (let i = 0; arq.state === 'PROCESSING' && i < 30; i++) {
    await new Promise(ok => setTimeout(ok, 2000));
    arq = await (await fetch(`${BASE}/v1beta/${arq.name}`, { headers: { 'x-goog-api-key': chave } })).json();
  }
  if (arq.state === 'FAILED') throw new Error('O Gemini não conseguiu abrir este áudio. Tente outro formato (m4a, mp3).');
  return arq.uri;
}

/** Erros que não adianta repetir com o outro modelo. */
// 400 também vem de pedido recusado (áudio, parâmetro): só é chave quando o Google diz API_KEY_INVALID.
function erro(status: number, corpo = ''): Error {
  let motivo = '';
  try { motivo = String(JSON.parse(corpo)?.error?.message ?? ''); } catch {}
  const e = new Error(
    status === 401 || status === 403 || corpo.includes('API_KEY_INVALID') ? 'Chave do Gemini inválida. Confira no Perfil.'
    : status === 400 ? `O Gemini recusou o pedido: ${motivo || 'sem detalhes'}`
    : status === 413 ? 'Áudio grande demais para o Gemini.'
    : status === 429 ? 'Limite do Gemini atingido. Espere um pouco e tente de novo.'
    : 'O Gemini não respondeu. Tente de novo.');
  e.name = 'Gemini';
  return e;
}

// Por que o Gemini parou (STOP, MAX_TOKENS, SAFETY…): vai na mensagem quando não vem fala nenhuma.
let motivo = '';
const textoDe = (j: any): string => (motivo = j?.candidates?.[0]?.finishReason ?? j?.promptFeedback?.blockReason ?? motivo,
  (j?.candidates?.[0]?.content?.parts ?? []).filter((p: { thought?: boolean }) => !p.thought)
    .map((p: { text?: string }) => p.text ?? '').join(''));

/**
 * `espera` é o tempo máximo sem receber nada. Com `aoParcial` a resposta vem aos poucos (SSE),
 * então conversa longa não estoura o prazo e o gestor vê o andamento.
 */
async function chamar(chave: string, corpo: object, espera: number, aoParcial?: (texto: string) => void): Promise<string> {
  let sobrecarga = false, semRede = false;
  for (const modelo of MODELOS) {
    const ctl = new AbortController();
    let t = setTimeout(() => ctl.abort(), espera);
    const vivo = () => { clearTimeout(t); t = setTimeout(() => ctl.abort(), espera); };
    try {
      const metodo = aoParcial ? 'streamGenerateContent?alt=sse' : 'generateContent';
      // expo/fetch lê a resposta aos poucos também no Android (o fetch do React Native não).
      const r = await (aoParcial ? buscarStream : fetch)(`${BASE}/v1beta/models/${modelo}:${metodo}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'x-goog-api-key': chave },
        body: JSON.stringify(corpo),
        signal: ctl.signal,
      });
      if (r.status === 503 || r.status === 500) { sobrecarga = true; continue; }
      // Cota de um modelo acabou: o outro tem cota própria.
      if (r.status === 429 && modelo !== MODELOS[MODELOS.length - 1]) continue;
      if (!r.ok) throw erro(r.status, await r.text().catch(() => ''));
      if (!aoParcial || !r.body) return textoDe(await r.json()).trim();
      const leitor = r.body.getReader();
      const dec = new TextDecoder();
      let texto = '', resto = '';
      for (;;) {
        const { done, value } = await leitor.read();
        if (done) break;
        vivo();
        const linhas = (resto + dec.decode(value, { stream: true })).split('\n');
        resto = linhas.pop() ?? '';
        for (const l of linhas) if (l.startsWith('data:')) texto += textoDe(JSON.parse(l.slice(5)));
        aoParcial(texto);
      }
      if (resto.startsWith('data:')) texto += textoDe(JSON.parse(resto.slice(5)));
      return texto.trim();
    } catch (e) {
      if ((e as Error).name === 'Gemini') throw e;
      // Sem resposta (rede ou prazo): tenta o próximo modelo.
      if ((e as Error).name !== 'AbortError') semRede = true;
    } finally { clearTimeout(t); }
  }
  throw new Error(sobrecarga ? 'O Gemini está sobrecarregado agora. Tente de novo em alguns minutos.'
    : semRede ? 'Sem conexão com a internet.' : 'O Gemini demorou demais. Tente de novo.');
}
