import AsyncStorage from '@react-native-async-storage/async-storage';

// Visual do FeedTec (fase 3): azul + amarelo sobre azul-noite (escuro) ou claro.
// `colors` e `type` são mutáveis: aplicarTema() troca os valores e o _layout remonta a árvore.
const comum = {
  accent: '#2457E7',
  accentText: '#FFFFFF',
  amarelo: '#F5C842',
  amareloText: '#101827',
  sucesso: '#19A58B',
  danger: '#E5675B',
  // Tons do feedback (F2): a melhorar / neutro / positivo.
  melhorar: '#E5A04B',
  neutro: '#8FA3B8',
  positivo: '#19A58B',
};

const escuro = { ...comum, bg: '#101827', surface: '#182338', border: '#25324B', text: '#F5F7FC', textMuted: '#94A0B8' };
const claro = { ...comum, amarelo: '#C99A0E', bg: '#F5F7FC', surface: '#FFFFFF', border: '#E1E6F0', text: '#101827', textMuted: '#5B6478' };

export const colors = { ...escuro };

export const fonte = { regular: 'Inter_400Regular', media: 'Inter_500Medium', semi: 'Inter_600SemiBold', negrito: 'Inter_700Bold' };

export const space = (n: number) => n * 4;
export const radius = { card: 16, input: 12 } as const;

const tipos = () => ({
  title: { color: colors.text, fontSize: 24, fontFamily: fonte.negrito },
  body: { color: colors.text, fontSize: 16, fontFamily: fonte.regular },
  caption: { color: colors.textMuted, fontSize: 13, fontFamily: fonte.regular },
});
export const type = tipos();

export let temaEscuro = true;
export function aplicarTema(escuroLigado: boolean) {
  temaEscuro = escuroLigado;
  Object.assign(colors, escuroLigado ? escuro : claro);
  Object.assign(type, tipos());
}

// Escolha do tema no Perfil: Sistema / Claro / Escuro, guardada só no aparelho.
export type ModoTema = 'sistema' | 'claro' | 'escuro';
let modo: ModoTema = 'sistema';
const ouvintes = new Set<() => void>();
const CHAVE_MODO = 'feedtec.tema';
AsyncStorage.getItem(CHAVE_MODO).then(v => { if (v === 'claro' || v === 'escuro') definirModo(v, false); }).catch(() => undefined);
export const lerModo = () => modo;
export function ouvirModo(f: () => void) { ouvintes.add(f); return () => { ouvintes.delete(f); }; }
export function definirModo(m: ModoTema, guardar = true) {
  modo = m;
  if (guardar) AsyncStorage.setItem(CHAVE_MODO, m).catch(() => undefined);
  ouvintes.forEach(f => f());
}
