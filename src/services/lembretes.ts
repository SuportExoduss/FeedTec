// Web: avisos do navegador enquanto o site estiver aberto em alguma aba (mesmo em segundo plano).
// Sem servidor: a cada 30 s confere se algum aviso da agenda venceu desde a última conferida e mostra pelo
// service worker (public/avisos-sw.js). Com a aba ou o navegador fechado, não toca (web push exigiria servidor).
import { avisosDaAgenda, type Alvo } from '../lib/agenda';
import { DADOS_VAZIOS, type Dados } from '../types';

export type EstadoAvisos = 'ligado' | 'desligado' | 'negado' | 'sem-suporte';

const CHAVE = 'feedtec.avisosWeb'; // '1' = o gestor ligou neste navegador
let dados: Dados = DADOS_VAZIOS;
let conferido = Date.now();
let relogio: ReturnType<typeof setInterval> | undefined;

const ligadoAqui = () => { try { return localStorage.getItem(CHAVE) === '1'; } catch { return false; } };
const suporta = () => typeof Notification !== 'undefined' && 'serviceWorker' in navigator;

export async function estadoAvisos(): Promise<EstadoAvisos> {
  if (!suporta()) return 'sem-suporte';
  if (Notification.permission === 'denied') return 'negado';
  return Notification.permission === 'granted' && ligadoAqui() ? 'ligado' : 'desligado';
}

async function conferir() {
  const agora = Date.now();
  // Avisos depois da última conferida (semanal já vem na próxima ocorrência) que já venceram.
  const vencidos = avisosDaAgenda(dados, conferido).filter(a => a.quando <= agora && agora - a.quando < 30 * 60000);
  conferido = agora;
  if (!vencidos.length || Notification.permission !== 'granted') return;
  const reg = await navigator.serviceWorker.ready;
  // actions/requireInteraction: Chrome e Edge mostram o botão Feito; quem não suporta mostra só o aviso.
  for (const a of vencidos) await reg.showNotification(a.titulo, { body: a.corpo, icon: '/favicon.png', tag: a.id, data: { alvo: a.alvo },
    requireInteraction: true, actions: [{ action: 'feito', title: 'Feito' }] } as NotificationOptions);
}

function ligarRelogio() {
  if (relogio || !ligadoAqui() || !suporta()) return;
  navigator.serviceWorker.register('/avisos-sw.js').catch(e => console.warn('avisos', e));
  conferido = Date.now();
  relogio = setInterval(() => { conferir().catch(e => console.warn('avisos', e)); }, 30000);
}

/** No clique do gestor (o navegador só pede permissão a partir de um clique). */
export async function ativarAvisos(_d: Dados): Promise<EstadoAvisos> {
  const antes = await estadoAvisos();
  if (antes === 'sem-suporte' || antes === 'negado') return antes;
  if ((await Notification.requestPermission()) !== 'granted') return 'negado';
  localStorage.setItem(CHAVE, '1');
  ligarRelogio();
  return 'ligado';
}

/** Ao sair da conta: a próxima conta precisa ligar de novo neste navegador. */
export async function desligarAvisos() {
  try { localStorage.removeItem(CHAVE); } catch {}
  clearInterval(relogio);
  relogio = undefined;
}

/** Chamar sempre que os dados mudam. */
export function agendarLembretes(d: Dados) {
  dados = d;
  ligarRelogio();
}

/** Feito no aviso do navegador: o service worker manda o alvo para a aba aberta. */
export function ouvirFeito(fn: (alvo: Alvo) => void): () => void {
  if (!suporta()) return () => {};
  const ouvir = (e: MessageEvent) => { if (e.data?.feito) fn(e.data.feito as Alvo); };
  navigator.serviceWorker.addEventListener('message', ouvir);
  return () => navigator.serviceWorker.removeEventListener('message', ouvir);
}
