// Etiqueta / seletor dos 3 tons de feedback.
import { Pressable, Text, View } from 'react-native';
import { TONS } from '../lib/dados';
import { ROTULO_TOM } from '../lib/prompt';
import { colors, radius, space } from '../theme';
import type { Tom } from '../types';

export const Etiqueta = ({ tom }: { tom: Tom }) => (
  <Text style={{ color: colors[tom], fontSize: 13, fontWeight: '700' }}>{ROTULO_TOM[tom]}</Text>
);

export function SeletorTom({ valor, onMudar }: { valor: Tom; onMudar: (t: Tom) => void }) {
  return (
    <View accessibilityRole="radiogroup" style={{ flexDirection: 'row', gap: space(2) }}>
      {TONS.map(t => {
        const ativo = t === valor;
        return (
          <Pressable key={t} onPress={() => onMudar(t)} accessibilityRole="radio" accessibilityState={{ checked: ativo }}
            style={{ flex: 1, minHeight: 44, borderRadius: radius.input, borderWidth: 1, alignItems: 'center', justifyContent: 'center',
              borderColor: ativo ? colors[t] : colors.border, backgroundColor: ativo ? colors.surface : 'transparent' }}>
            <Text style={{ color: ativo ? colors[t] : colors.textMuted, fontWeight: '600' }}>{ROTULO_TOM[t]}</Text>
          </Pressable>
        );
      })}
    </View>
  );
}
