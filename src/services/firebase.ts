// Firebase só para o login Google (perfil). Os dados vão para o Drive do próprio usuário (services/drive.ts).
import { Platform } from 'react-native';
import { initializeApp, getApps, getApp } from 'firebase/app';
import * as FirebaseAuth from 'firebase/auth';
import AsyncStorage from '@react-native-async-storage/async-storage';

// Acesso direto a process.env.EXPO_PUBLIC_*: o Expo só embute no build essa forma exata.
export const firebaseConfig = {
  apiKey: process.env.EXPO_PUBLIC_FIREBASE_API_KEY ?? 'demo-key',
  authDomain: process.env.EXPO_PUBLIC_FIREBASE_AUTH_DOMAIN ?? 'demo-feedtec.firebaseapp.com',
  projectId: process.env.EXPO_PUBLIC_FIREBASE_PROJECT_ID ?? 'demo-feedtec',
  appId: process.env.EXPO_PUBLIC_FIREBASE_APP_ID ?? 'demo-app',
};

export const app = getApps().length ? getApp() : initializeApp(firebaseConfig);

function criarAuth(): FirebaseAuth.Auth {
  if (Platform.OS === 'web') return FirebaseAuth.getAuth(app);
  // O Metro resolve o build RN do Firebase, que expõe getReactNativePersistence (ausente dos tipos padrão).
  const { getReactNativePersistence } = FirebaseAuth as unknown as {
    getReactNativePersistence: (s: typeof AsyncStorage) => FirebaseAuth.Persistence;
  };
  try {
    return FirebaseAuth.initializeAuth(app, { persistence: getReactNativePersistence(AsyncStorage) });
  } catch {
    return FirebaseAuth.getAuth(app); // hot reload: já inicializado
  }
}

export const auth = criarAuth();

/** Só arquivos criados pelo próprio app: o FeedTec não enxerga o resto do Drive. */
export const ESCOPO_DRIVE = 'https://www.googleapis.com/auth/drive.file';
