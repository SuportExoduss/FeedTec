// Google Drive REST v3 por fetch (sem SDK pesado). Pasta visível "FeedTec" com o feedtec.json;
// os áudios (F3) entram na mesma pasta. Escopo drive.file: o app só enxerga o que ele mesmo criou.
import type { Dados } from '../types';
import { lerDadosJson } from '../lib/dados';

const API = 'https://www.googleapis.com/drive/v3/files';
const UPLOAD = 'https://www.googleapis.com/upload/drive/v3/files';
const PASTA = 'FeedTec';
const ARQUIVO = 'feedtec.json';

export class DriveSemAcesso extends Error {}

async function chamar(token: string, url: string, init: RequestInit = {}): Promise<Response> {
  const r = await fetch(url, { ...init, headers: { Authorization: `Bearer ${token}`, ...init.headers } });
  if (r.status === 401 || r.status === 403) throw new DriveSemAcesso('Acesso ao Drive expirou.');
  if (!r.ok) throw new Error(`Drive respondeu ${r.status}`);
  return r;
}

async function buscar(token: string, q: string): Promise<string | null> {
  const r = await chamar(token, `${API}?q=${encodeURIComponent(q + ' and trashed=false')}&fields=files(id)&spaces=drive`);
  return ((await r.json()).files?.[0]?.id as string | undefined) ?? null;
}

// Ids guardados na memória: uma busca por abertura do app.
let ids: { pasta?: string; arquivo?: string | null } = {};

async function pasta(token: string): Promise<string> {
  if (ids.pasta) return ids.pasta;
  const achada = await buscar(token, `name='${PASTA}' and mimeType='application/vnd.google-apps.folder'`);
  if (achada) return (ids.pasta = achada);
  const r = await chamar(token, `${API}?fields=id`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ name: PASTA, mimeType: 'application/vnd.google-apps.folder' }),
  });
  return (ids.pasta = (await r.json()).id as string);
}

async function arquivo(token: string): Promise<string | null> {
  if (ids.arquivo !== undefined) return ids.arquivo;
  return (ids.arquivo = await buscar(token, `name='${ARQUIVO}' and '${await pasta(token)}' in parents`));
}

export async function lerDoDrive(token: string): Promise<Dados | null> {
  const id = await arquivo(token);
  if (!id) return null;
  return lerDadosJson(await (await chamar(token, `${API}/${id}?alt=media`)).text());
}

export async function salvarNoDrive(token: string, d: Dados): Promise<void> {
  const corpo = JSON.stringify(d);
  const id = await arquivo(token);
  if (id) {
    await chamar(token, `${UPLOAD}/${id}?uploadType=media`, { method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: corpo });
    return;
  }
  // Primeiro salvamento: multipart com metadados (nome + pasta) e conteúdo.
  const sep = 'feedtec' + Date.now();
  const meta = JSON.stringify({ name: ARQUIVO, parents: [await pasta(token)], mimeType: 'application/json' });
  const body = `--${sep}\r\nContent-Type: application/json\r\n\r\n${meta}\r\n--${sep}\r\nContent-Type: application/json\r\n\r\n${corpo}\r\n--${sep}--`;
  const r = await chamar(token, `${UPLOAD}?uploadType=multipart&fields=id`, {
    method: 'POST', headers: { 'Content-Type': `multipart/related; boundary=${sep}` }, body,
  });
  ids.arquivo = (await r.json()).id as string;
}

/** Áudio da conversa na pasta FeedTec. Duas chamadas (conteúdo, depois nome/pasta): multipart binário não roda igual na web e no RN. */
export async function salvarAudioNoDrive(token: string, audio: Blob, nome: string): Promise<string> {
  const r = await chamar(token, `${UPLOAD}?uploadType=media&fields=id`, {
    method: 'POST', headers: { 'Content-Type': audio.type || 'audio/mp4' }, body: audio,
  });
  const id = (await r.json()).id as string;
  await chamar(token, `${API}/${id}?addParents=${await pasta(token)}&fields=id`, {
    method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ name: nome }),
  });
  return id;
}

/** Endereço do conteúdo do áudio (precisa do token no cabeçalho). */
export const urlAudio = (id: string) => `${API}/${id}?alt=media`;

/** Web: o <audio> não manda cabeçalho, então baixa o arquivo inteiro. */
export async function baixarAudio(token: string, id: string): Promise<Blob> {
  return (await chamar(token, urlAudio(id))).blob();
}

/** Ao sair da conta: outra conta tem outra pasta. */
export const esquecerIdsDrive = () => { ids = {}; };
