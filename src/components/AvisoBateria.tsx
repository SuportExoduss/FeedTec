// Faixa em Tarefas/Reuniões/Perfil só enquanto a bateria ou o alarme exato seguram os lembretes; some quando liberado.
import { useEffect, useState } from 'react';
import { AppState, Pressable, Text } from 'react-native';
import { router } from 'expo-router';
import { avisosLiberados } from '../lib/bateria';
import { colors, radius, space } from '../theme';

/** Confere ao abrir e sempre que o app volta (ex.: dos ajustes do Android). */
export function useLiberado<T>(conferir: () => Promise<T>): T | null {
  const [v, setV] = useState<T | null>(null);
  useEffect(() => {
    const ir = () => { conferir().then(setV).catch(() => undefined); };
    ir();
    const sub = AppState.addEventListener('change', e => { if (e === 'active') ir(); });
    return () => sub.remove();
  }, []); // eslint-disable-line react-hooks/exhaustive-deps
  return v;
}

export function AvisoBateria() {
  if (useLiberado(avisosLiberados) !== false) return null;
  return (
    <Pressable accessibilityRole="button" onPress={() => router.push('/bateria')}
      style={{ marginHorizontal: space(4), marginTop: space(2), padding: space(3), borderRadius: radius.input, borderWidth: 1, borderColor: colors.melhorar }}>
      <Text style={{ color: colors.text, fontSize: 14 }}>Os lembretes podem não tocar com o app fechado. Toque para liberar.</Text>
    </Pressable>
  );
}
