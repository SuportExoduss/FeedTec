// Gemini direto do app com a chave do próprio gestor (AI Studio). Decisão do dono: sem servidor.
import { INSTRUCAO, TRANSCRICAO, lerTranscricao, type Trecho } from '../lib/prompt';

// ponytail: aliases que o Google atualiza sozinho; fixar versões se a saída mudar demais.
// O lite só entra quando o principal está sobrecarregado (503/500).
const MODELOS = ['gemini-flash-latest', 'gemini-flash-lite-latest'];

export async function gerarTexto(chave: string, pedido: string): Promise<string> {
  const texto = await chamar(chave, {
    systemInstruction: { parts: [{ text: INSTRUCAO }] },
    contents: [{ role: 'user', parts: [{ text: pedido }] }],
  }, 20_000);
  if (!texto) throw new Error('O Gemini não devolveu texto. Tente reescrever as anotações.');
  return texto;
}

/** Áudio da conversa → falas separadas por voz (A/B). Base64 inline: até ~20 MB (≈ 1 h a 32 kbps). */
// ponytail: inline em vez da Files API; trocar pelo upload resumable se as gravações passarem de 1 h.
export async function transcrever(chave: string, base64: string, mimeType: string): Promise<Trecho[]> {
  const texto = await chamar(chave, {
    systemInstruction: { parts: [{ text: TRANSCRICAO }] },
    contents: [{ role: 'user', parts: [{ inlineData: { mimeType, data: base64 } }] }],
    generationConfig: { responseMimeType: 'application/json' },
  }, 120_000);
  const falas = lerTranscricao(texto);
  if (!falas.length) throw new Error('Não deu para entender a gravação. Tente gravar mais perto do celular.');
  return falas;
}

async function chamar(chave: string, corpo: object, espera: number): Promise<string> {
  let r: Response | undefined;
  for (const modelo of MODELOS) {
    // Sobrecarregado às vezes o Google nem responde: espera e passa para o próximo modelo.
    const ctl = new AbortController();
    const t = setTimeout(() => ctl.abort(), espera);
    try { r = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/${modelo}:generateContent`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'x-goog-api-key': chave },
      body: JSON.stringify(corpo),
      signal: ctl.signal,
    }); } catch { r = undefined; continue; } finally { clearTimeout(t); }
    if (r.status !== 503 && r.status !== 500) break;
  }
  if (!r) throw new Error('O Gemini demorou demais. Tente de novo.');
  if (r.status === 400 || r.status === 401 || r.status === 403) throw new Error('Chave do Gemini inválida. Confira no Perfil.');
  if (r.status === 429) throw new Error('Limite do Gemini atingido. Espere um pouco e tente de novo.');
  if (r.status === 503 || r.status === 500) throw new Error('O Gemini está sobrecarregado agora. Tente de novo em alguns minutos.');
  if (!r.ok) throw new Error('O Gemini não respondeu. Tente de novo.');
  const j = await r.json();
  return (j.candidates?.[0]?.content?.parts ?? []).map((p: { text?: string }) => p.text ?? '').join('').trim();
}
