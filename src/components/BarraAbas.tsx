// Barra inferior: Início, Técnicos, Tarefas, Reuniões, Mais. Só aparece nas telas-aba.
// No PC (web com tela larga) vira menu lateral fixo, com os itens do Mais à mostra.
import { Platform, Pressable, Text, useWindowDimensions, View } from 'react-native';
import { router, useSegments } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import Ionicons from '@expo/vector-icons/Ionicons';
import { colors, fonte, radius, space } from '../theme';
import { COLUNA } from './ui';

const ABAS = [
  { rota: '', titulo: 'Início', icone: 'home' },
  { rota: 'tecnicos', titulo: 'Técnicos', icone: 'people' },
  { rota: 'tarefas', titulo: 'Tarefas', icone: 'checkbox' },
  { rota: 'reunioes', titulo: 'Reuniões', icone: 'calendar' },
  { rota: 'ocorrencias', titulo: 'Ocorrências', icone: 'alert-circle' },
] as const;

const LATERAL = [
  ...ABAS,
  { rota: 'historico', titulo: 'Histórico', icone: 'time' },
  { rota: 'perfil', titulo: 'Perfil', icone: 'person-circle' },
] as const;

export const usePc = () => Platform.OS === 'web' && useWindowDimensions().width >= 1024;

export function BarraLateral() {
  const [rota = ''] = useSegments() as string[];
  if (!usePc() || rota === 'entrar') return null;
  return (
    <View accessibilityRole="tablist" style={{ width: 220, backgroundColor: colors.surface, borderRightWidth: 1, borderColor: colors.border,
      paddingVertical: space(6), paddingHorizontal: space(3), gap: space(1) }}>
      <Text style={{ fontFamily: fonte.negrito, fontSize: 22, color: colors.text, paddingHorizontal: space(3), marginBottom: space(4) }}>FeedTec</Text>
      {LATERAL.map(a => {
        const sel = a.rota === rota;
        const cor = sel ? colors.amarelo : colors.textMuted;
        return (
          <Pressable key={a.rota} accessibilityRole="tab" accessibilityState={{ selected: sel }} onPress={() => !sel && router.replace(`/${a.rota}`)}
            style={({ pressed, hovered }: { pressed: boolean; hovered?: boolean }) => ({ flexDirection: 'row', alignItems: 'center', gap: space(3),
              paddingVertical: space(3), paddingHorizontal: space(3), borderRadius: radius.input,
              backgroundColor: sel ? colors.amarelo + '1A' : hovered ? colors.border : 'transparent', opacity: pressed ? 0.6 : 1 })}>
            <Ionicons name={sel ? a.icone : (`${a.icone}-outline` as typeof a.icone)} size={20} color={cor} />
            <Text style={{ fontSize: 15, fontFamily: sel ? fonte.semi : fonte.media, color: sel ? colors.text : colors.textMuted }}>{a.titulo}</Text>
          </Pressable>
        );
      })}
    </View>
  );
}

export function BarraAbas() {
  const [rota = ''] = useSegments() as string[];
  const { bottom } = useSafeAreaInsets();
  const pc = usePc();
  if (pc || !ABAS.some(a => a.rota === rota)) return null;
  return (
    <View style={{ backgroundColor: colors.surface, borderTopWidth: 1, borderColor: colors.border, paddingBottom: bottom, paddingTop: 6 }}>
    <View accessibilityRole="tablist" style={{ flexDirection: 'row', ...COLUNA }}>
      {ABAS.map(a => {
        const sel = a.rota === rota;
        const cor = sel ? colors.amarelo : colors.textMuted;
        return (
          <Pressable key={a.rota} accessibilityRole="tab" accessibilityState={{ selected: sel }} accessibilityLabel={a.titulo}
            onPress={() => !sel && router.replace(`/${a.rota}`)}
            style={({ pressed }) => ({ flex: 1, alignItems: 'center', gap: 2, paddingVertical: 6, opacity: pressed ? 0.6 : 1 })}>
            <Ionicons name={sel ? a.icone : (`${a.icone}-outline` as typeof a.icone)} size={22} color={cor} />
            <Text style={{ fontSize: 11, fontFamily: sel ? fonte.semi : fonte.media, color: cor }}>{a.titulo}</Text>
          </Pressable>
        );
      })}
    </View>
    </View>
  );
}
