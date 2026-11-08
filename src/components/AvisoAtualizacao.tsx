// Só no Android: compara a versão do app (app.json) com https://feedtec.web.app/versao.json e mostra o link do APK novo.
import { useEffect, useState } from 'react';
import { Linking, Platform, Pressable, Text } from 'react-native';
import Constants from 'expo-constants';
import { maisNova } from '../lib/dados';
import { colors, radius, space } from '../theme';

type Versao = { versao: string; link: string };

export function AvisoAtualizacao() {
  const [nova, setNova] = useState<Versao | null>(null);
  useEffect(() => {
    if (Platform.OS !== 'android') return;
    const atual = Constants.expoConfig?.version ?? '0';
    fetch('https://feedtec.web.app/versao.json', { cache: 'no-store' }).then(r => r.json())
      .then((v: Versao) => { if (typeof v?.link === 'string' && maisNova(String(v.versao), atual)) setNova(v); })
      .catch(() => {}); // sem internet: tenta na próxima abertura
  }, []);
  if (!nova) return null;
  return (
    <Pressable accessibilityRole="link" onPress={() => Linking.openURL(nova.link)}
      style={{ marginHorizontal: space(4), padding: space(3), borderRadius: radius.input, borderWidth: 1, borderColor: colors.accent }}>
      <Text style={{ color: colors.text, fontSize: 14 }}>Nova versão {nova.versao} disponível. Toque para baixar e instalar.</Text>
    </Pressable>
  );
}
