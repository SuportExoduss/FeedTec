// Web: login Google num pop-up que passa pelo Worker feedtec-drive (worker/index.js). O Worker troca o código
// do Google por acesso ao Drive (1 h) + chave de renovação; vencido o acesso, o site renova pelo Worker sem
// pedir nada. A chave fica neste navegador (localStorage) até Sair. Firebase entra com o id_token do mesmo login.
// No Android o Metro usa googleSignIn.native.ts.
import { GoogleAuthProvider, signInWithCredential, signOut } from 'firebase/auth';
import { auth, ESCOPO_DRIVE } from './firebase';

const WORKER = 'https://feedtec-drive.navalha-worker.workers.dev';
const CHAVE = 'feedtec.drive';
const MARGEM = 5 * 60_000;
type Acesso = { token: string; expira: number; refresh?: string };
type Resposta = { access_token?: string; expires_in?: number; refresh_token?: string; id_token?: string; erro?: string };

let memoria: Acesso | null = null;
let renovando: Promise<string | null> | null = null;

function ler(): Acesso | null {
  if (!memoria) { try { memoria = JSON.parse(localStorage.getItem(CHAVE) ?? 'null'); } catch { memoria = null; } }
  return memoria;
}
function guardar(r: Resposta) {
  if (!r.access_token) throw new Error('O Google não liberou o acesso ao Drive. Tente de novo e marque a permissão.');
  memoria = { token: r.access_token, expira: Date.now() + (r.expires_in ?? 3600) * 1000, refresh: r.refresh_token ?? ler()?.refresh };
  try { localStorage.setItem(CHAVE, JSON.stringify(memoria)); } catch { /* aba privada: vale só nesta sessão */ }
}

/** Abre o Google num pop-up (chamar direto do toque, senão o navegador bloqueia) e espera o Worker responder. */
function popupGoogle(email?: string | null): Promise<Resposta> {
  const nonce = crypto.randomUUID();
  const q = new URLSearchParams({
    client_id: process.env.EXPO_PUBLIC_GOOGLE_WEB_CLIENT_ID ?? '', redirect_uri: `${WORKER}/retorno`, response_type: 'code',
    scope: `openid email profile ${ESCOPO_DRIVE}`, access_type: 'offline', prompt: 'consent', state: `${location.origin}|${nonce}`,
    ...(email ? { login_hint: email } : {}),
  });
  const janela = window.open(`https://accounts.google.com/o/oauth2/v2/auth?${q}`, 'feedtec-google', 'width=500,height=650');
  if (!janela) return Promise.reject(new Error('O navegador bloqueou a janela do Google. Libere pop-ups para o FeedTec.'));
  return new Promise((ok, falha) => {
    const fim = () => { removeEventListener('message', aoReceber); clearInterval(vigia); };
    function aoReceber(e: MessageEvent) {
      if (e.origin !== WORKER || e.data?.nonce !== nonce) return;
      fim();
      e.data.erro ? falha(new Error(`O Google recusou: ${e.data.erro}`)) : ok(e.data);
    }
    // Fechou sem responder: dá 1 s para a mensagem chegar (ela vem logo antes do close).
    const vigia = setInterval(() => { if (janela.closed) setTimeout(() => { fim(); falha(new Error('Login cancelado.')); }, 1000); }, 500);
    addEventListener('message', aoReceber);
  });
}

export async function entrarComGoogle(): Promise<void> {
  const r = await popupGoogle();
  if (!r.id_token) throw new Error('O Google não devolveu a identidade. Tente de novo.');
  guardar(r);
  await signInWithCredential(auth, GoogleAuthProvider.credential(r.id_token, r.access_token));
}

/** Pede de novo (chave de renovação revogada). Chamar a partir de um toque. */
export async function reconectarDrive(): Promise<void> {
  if (!auth.currentUser) throw new Error('Entre na sua conta primeiro.');
  guardar(await popupGoogle(auth.currentUser.email));
}

/** Token do Drive; vencido, renova pelo Worker. null = precisa reconectar. */
export function tokenDrive(): Promise<string | null> {
  const a = ler();
  if (a && a.expira - MARGEM > Date.now()) return Promise.resolve(a.token);
  if (!a?.refresh) return Promise.resolve(null);
  renovando ??= fetch(`${WORKER}/renovar`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ refresh: a.refresh }) })
    .then(async res => {
      const r: Resposta = await res.json();
      if (!res.ok) { if (res.status === 401) esquecer(); return null; } // chave revogada: login de novo
      guardar(r);
      return r.access_token ?? null;
    })
    .catch(() => null) // sem rede: tenta de novo na próxima
    .finally(() => { renovando = null; });
  return renovando;
}

function esquecer() {
  memoria = null;
  try { localStorage.removeItem(CHAVE); localStorage.removeItem('feedtec.tokenDrive'); } catch { /* ok */ }
}

export async function sairDoGoogle(): Promise<void> {
  esquecer();
  await signOut(auth);
}
