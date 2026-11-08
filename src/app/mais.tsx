// Aba Mais: o que não cabe na barra.
import { Pressable, Text, View } from 'react-native';
import { router, type Href } from 'expo-router';
import Ionicons from '@expo/vector-icons/Ionicons';
import { Tela } from '../components/ui';
import { colors, fonte, radius, space } from '../theme';

const ITENS: { titulo: string; icone: keyof typeof Ionicons.glyphMap; rota: Href }[] = [
  { titulo: 'Histórico', icone: 'time-outline', rota: '/historico' },
  { titulo: 'Perfil', icone: 'person-circle-outline', rota: '/perfil' },
];

export default function Mais() {
  return (
    <Tela titulo="Mais">
      <View style={{ padding: space(4), gap: space(2) }}>
        {ITENS.map(i => (
          <Pressable key={i.titulo} accessibilityRole="button" onPress={() => router.push(i.rota)}
            style={({ pressed }) => ({ flexDirection: 'row', alignItems: 'center', gap: space(3), padding: space(4), borderRadius: radius.card,
              backgroundColor: colors.surface, borderWidth: 1, borderColor: colors.border, opacity: pressed ? 0.75 : 1 })}>
            <Ionicons name={i.icone} size={22} color={colors.accent} />
            <Text style={{ flex: 1, fontFamily: fonte.media, fontSize: 16, color: colors.text }}>{i.titulo}</Text>
            <Ionicons name="chevron-forward" size={18} color={colors.textMuted} />
          </Pressable>
        ))}
      </View>
    </Tela>
  );
}
