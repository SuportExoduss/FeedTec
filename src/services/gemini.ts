// Gemini direto do app com a chave do próprio gestor (AI Studio). Decisão do dono: sem servidor.
import { fetch as buscarStream } from 'expo/fetch';
import { FORMATO_TRANSCRICAO, INSTRUCAO, lerTranscricao, transcricao } from '../lib/prompt';
import type { Fala } from '../types';

const BASE = 'https://generativelanguage.googleapis.com';
// ponytail: aliases que o Google atualiza sozinho; fixar versões se a saída mudar demais.
// O Flash vive sobrecarregado (503) por segundos: tenta de novo antes de cair no lite, que erra mais palavras.
const MODELOS = ['gemini-flash-latest', 'gemini-flash-latest', 'gemini-flash-lite-latest'];
// Até aqui vai junto no pedido (base64); acima sobe antes pela Files API (gravações longas de outros apps).
const LIMITE_INLINE = 15_000_000;

export async function gerarTexto(chave: string, pedido: string): Promise<string> {
  const texto = await chamar(chave, {
    systemInstruction: { parts: [{ text: INSTRUCAO }] },
    contents: [{ role: 'user', parts: [{ text: pedido }] }],
  }, 20_000);
  if (!texto) throw new Error('O Gemini não devolveu texto. Tente reescrever as anotações.');
  return texto;
}

export type Progresso = { fase: 'enviando' } | { fase: 'transcrevendo'; falas: number };

/** Áudio da conversa → falas já separadas entre o gestor e o técnico. */
export async function transcrever(chave: string, audio: Blob, mimeType: string, tecnico: string,
  aoProgredir: (p: Progresso) => void): Promise<Fala[]> {
  aoProgredir({ fase: 'enviando' });
  const parte = audio.size <= LIMITE_INLINE
    ? { inlineData: { mimeType, data: await base64(audio) } }
    : { fileData: { mimeType, fileUri: await enviarArquivo(chave, audio, mimeType) } };
  aoProgredir({ fase: 'transcrevendo', falas: 0 });
  const texto = await chamar(chave, {
    systemInstruction: { parts: [{ text: transcricao(tecnico) }] },
    contents: [{ role: 'user', parts: [parte] }],
    generationConfig: {
      responseMimeType: 'application/json',
      responseSchema: FORMATO_TRANSCRICAO,
      // Conversa de 1 h passa fácil de 8 mil tokens; sem isto o JSON vinha cortado e a transcrição "sumia".
      maxOutputTokens: 65536,
      // "low" ainda deixa separar as vozes com cuidado sem a espera longa do padrão ("minimal" não existe no 3.8 Flash).
      thinkingConfig: { thinkingLevel: 'low' },
    },
  }, 90_000, parcial => aoProgredir({ fase: 'transcrevendo', falas: parcial.split('"texto"').length - 1 }));
  const falas = lerTranscricao(texto);
  if (!falas.length) throw new Error('O Gemini não devolveu nenhuma fala desta gravação.');
  return falas;
}

export function base64(blob: Blob): Promise<string> {
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
  if (!ini.ok || !destino) throw erro(ini.status);
  const r = await fetch(destino, {
    method: 'POST', headers: { 'X-Goog-Upload-Offset': '0', 'X-Goog-Upload-Command': 'upload, finalize' }, body: audio,
  });
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
function erro(status: number): Error {
  const e = new Error(
    status === 400 || status === 401 || status === 403 ? 'Chave do Gemini inválida. Confira no Perfil.'
    : status === 413 ? 'Áudio grande demais para o Gemini.'
    : status === 429 ? 'Limite do Gemini atingido. Espere um pouco e tente de novo.'
    : 'O Gemini não respondeu. Tente de novo.');
  e.name = 'Gemini';
  return e;
}

const textoDe = (j: any): string =>
  (j?.candidates?.[0]?.content?.parts ?? []).filter((p: { thought?: boolean }) => !p.thought)
    .map((p: { text?: string }) => p.text ?? '').join('');

/**
 * `espera` é o tempo máximo sem receber nada. Com `aoParcial` a resposta vem aos poucos (SSE),
 * então conversa longa não estoura o prazo e o gestor vê o andamento.
 */
async function chamar(chave: string, corpo: object, espera: number, aoParcial?: (texto: string) => void): Promise<string> {
  let sobrecarga = false, semRede = false;
  for (const modelo of MODELOS) {
    if (sobrecarga) await new Promise(ok => setTimeout(ok, 3000));
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
      // Cota do Flash acabou: o lite tem cota própria.
      if (r.status === 429 && modelo !== MODELOS[MODELOS.length - 1]) continue;
      if (!r.ok) throw erro(r.status);
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
