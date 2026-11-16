// Site aberto num Android (navegador, não pela Tela de Início): oferece o APK. Fechou no X, some por 7 dias.
// iPhone e computador não veem nada. A versão do app instalado está em AvisoAtualizacao.native.tsx.
import { useEffect, useState } from 'react';
import { Linking, Pressable, Text, View } from 'react-native';
import Ionicons from '@expo/vector-icons/Ionicons';
import { colors, radius, space, type } from '../theme';

// Release pública (sem token): o repo de APKs do app é privado e o site não pode levar o token.
export const LINK_APK = 'https://github.com/SuportExoduss/FeedTec/releases/latest/download/FeedTec.apk';
const CHAVE = 'feedtec.avisoApk.fechadoEm';
const SETE_DIAS = 7 * 86_400_000;
// Intent do Chrome: abre esta mesma tela no app instalado; sem o app, o Chrome vai para o APK.
// Esquema feedtec:// (todas as versões do app têm); o https só existe a partir da 0.1.6.
const abrirNoApp = () => `intent://${location.pathname.slice(1)}${location.search}#Intent;scheme=feedtec;`
  + `package=com.trevotec.feedtec;S.browser_fallback_url=${encodeURIComponent(LINK_APK)};end`;

export function AvisoAtualizacao() {
  const [visivel, setVisivel] = useState(false);
  useEffect(() => {
    try {
      const comoApp = window.matchMedia?.('(display-mode: standalone)').matches ?? false;
      const fechado = Number(localStorage.getItem(CHAVE)) || 0;
      setVisivel(/Android/i.test(navigator.userAgent) && !comoApp && Date.now() - fechado > SETE_DIAS);
    } catch { /* modo privado sem localStorage: sem aviso */ }
  }, []);

  if (!visivel) return null;
  function fechar() {
    try { localStorage.setItem(CHAVE, String(Date.now())); } catch { /* ignora */ }
    setVisivel(false);
  }
  return (
    <View accessibilityRole="alert" style={{ flexDirection: 'row', alignItems: 'center', gap: space(3), marginHorizontal: space(4),
      paddingHorizontal: space(3), paddingVertical: space(2), borderRadius: radius.input, borderWidth: 1, borderColor: colors.border,
      backgroundColor: colors.surface }}>
      <Ionicons name="logo-android" size={24} color={colors.accent} />
      <Text style={[type.caption, { flex: 1, color: colors.text }]} numberOfLines={3}>Use o FeedTec como app. Se ainda não tiver, baixa o APK.</Text>
      <Pressable onPress={() => Linking.openURL(abrirNoApp())} accessibilityRole="link" accessibilityLabel="Abrir no app FeedTec ou baixar o APK"
        style={{ backgroundColor: colors.accent, borderRadius: radius.input, paddingHorizontal: space(3), minHeight: 36, justifyContent: 'center' }}>
        <Text style={[type.caption, { color: colors.accentText, fontWeight: '700' }]}>Abrir no app</Text>
      </Pressable>
      <Pressable onPress={fechar} hitSlop={10} accessibilityRole="button" accessibilityLabel="Fechar aviso">
        <Ionicons name="close" size={20} color={colors.textMuted} />
      </Pressable>
    </View>
  );
}
