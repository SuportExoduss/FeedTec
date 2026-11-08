// Android: login Google nativo com o escopo do Drive. O idToken vira credencial do Firebase;
// o accessToken do Drive é renovado pela própria biblioteca (getTokens), sem pedir nada ao usuário.
import { GoogleSignin, isErrorWithCode, isSuccessResponse, statusCodes } from '@react-native-google-signin/google-signin';
import { GoogleAuthProvider, signInWithCredential, signOut } from 'firebase/auth';
import { auth, ESCOPO_DRIVE } from './firebase';

let configurado = false;
function configurar() {
  if (configurado) return;
  GoogleSignin.configure({ webClientId: process.env.EXPO_PUBLIC_GOOGLE_WEB_CLIENT_ID, scopes: [ESCOPO_DRIVE] });
  configurado = true;
}

export async function entrarComGoogle(): Promise<void> {
  configurar();
  try {
    await GoogleSignin.hasPlayServices({ showPlayServicesUpdateDialog: true });
    const res = await GoogleSignin.signIn();
    if (!isSuccessResponse(res)) return; // cancelou
    const idToken = res.data.idToken;
    if (!idToken) throw new Error('O Google não devolveu o idToken. Confira o EXPO_PUBLIC_GOOGLE_WEB_CLIENT_ID.');
    await signInWithCredential(auth, GoogleAuthProvider.credential(idToken));
  } catch (e) {
    if (isErrorWithCode(e) && e.code === statusCodes.IN_PROGRESS) return;
    throw e;
  }
}

/** No Android o acesso não vence para o usuário; mantido para a mesma interface da web. */
export async function reconectarDrive(): Promise<void> {
  configurar();
  await GoogleSignin.signIn();
}

export async function tokenDrive(): Promise<string | null> {
  configurar();
  try {
    if (!GoogleSignin.getCurrentUser()) await GoogleSignin.signInSilently();
    return (await GoogleSignin.getTokens()).accessToken;
  } catch {
    return null;
  }
}

export async function sairDoGoogle(): Promise<void> {
  configurar();
  await GoogleSignin.signOut().catch(() => undefined);
  await signOut(auth);
}
