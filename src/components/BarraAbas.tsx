// Barra inferior: Início, Técnicos, Tarefas, Reuniões, Mais. Só aparece nas telas-aba.
import { Pressable, Text, View } from 'react-native';
import { router, useSegments } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import Ionicons from '@expo/vector-icons/Ionicons';
import { colors, fonte } from '../theme';

const ABAS = [
  { rota: '', titulo: 'Início', icone: 'home' },
  { rota: 'tecnicos', titulo: 'Técnicos', icone: 'people' },
  { rota: 'tarefas', titulo: 'Tarefas', icone: 'checkbox' },
  { rota: 'reunioes', titulo: 'Reuniões', icone: 'calendar' },
  { rota: 'mais', titulo: 'Mais', icone: 'ellipsis-horizontal' },
] as const;

export function BarraAbas() {
  const [rota = ''] = useSegments() as string[];
  const { bottom } = useSafeAreaInsets();
  if (!ABAS.some(a => a.rota === rota)) return null;
  return (
    <View accessibilityRole="tablist" style={{ flexDirection: 'row', backgroundColor: colors.surface, borderTopWidth: 1,
      borderColor: colors.border, paddingBottom: bottom, paddingTop: 6 }}>
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
  );
}
