// Web: login Google por pop-up do Firebase, já pedindo acesso ao Drive.
// O token do Drive vale ~1 h e o pop-up não dá refresh: guardamos na aba (sessionStorage) e,
// vencido, o app pede "Reconectar Drive" (precisa de um toque do usuário por causa do bloqueio de pop-up).
// No Android o Metro usa googleSignIn.native.ts.
import { GoogleAuthProvider, reauthenticateWithPopup, signInWithPopup, signOut, type UserCredential } from 'firebase/auth';
import { auth, ESCOPO_DRIVE } from './firebase';

const CHAVE = 'feedtec.tokenDrive';
const MARGEM = 5 * 60_000;

function provedor() {
  const p = new GoogleAuthProvider();
  p.addScope(ESCOPO_DRIVE);
  p.setCustomParameters({ prompt: 'select_account' });
  return p;
}

function guardar(res: UserCredential) {
  const token = GoogleAuthProvider.credentialFromResult(res)?.accessToken;
  if (!token) throw new Error('O Google não liberou o acesso ao Drive. Tente de novo e marque a permissão.');
  try { sessionStorage.setItem(CHAVE, JSON.stringify({ token, expira: Date.now() + 55 * 60_000 })); } catch { /* aba privada */ }
  memoria = { token, expira: Date.now() + 55 * 60_000 };
}

let memoria: { token: string; expira: number } | null = null;

export async function entrarComGoogle(): Promise<void> {
  guardar(await signInWithPopup(auth, provedor()));
}

/** Pede de novo o acesso ao Drive (token vencido). Chamar a partir de um toque. */
export async function reconectarDrive(): Promise<void> {
  if (!auth.currentUser) throw new Error('Entre na sua conta primeiro.');
  guardar(await reauthenticateWithPopup(auth.currentUser, provedor()));
}

/** Token do Drive ou null se precisar reconectar. */
export async function tokenDrive(): Promise<string | null> {
  if (!memoria) {
    try { memoria = JSON.parse(sessionStorage.getItem(CHAVE) ?? 'null'); } catch { memoria = null; }
  }
  return memoria && memoria.expira - MARGEM > Date.now() ? memoria.token : null;
}

export async function sairDoGoogle(): Promise<void> {
  memoria = null;
  try { sessionStorage.removeItem(CHAVE); } catch { /* ok */ }
  await signOut(auth);
}
