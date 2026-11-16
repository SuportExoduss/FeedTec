// Foto do usuário no topo do Início, com aro que se acende em 360° (do topo, sentido horário) ao abrir a tela.
// Azul para masculino, vermelho para feminino (Perfil › Gênero); cinza se ainda não escolheu.
import { useEffect, useState } from 'react';
import { Animated, Easing, Image, Pressable } from 'react-native';
import Svg, { Circle } from 'react-native-svg';
import { router } from 'expo-router';
import { Avatar } from './ui';
import { useEstado } from '../Estado';
import { colors } from '../theme';

const TAM = 44, FOTO = 34, TRACO = 3;
const R = (TAM - TRACO) / 2, VOLTA = 2 * Math.PI * R;

export function FotoPerfil() {
  const { user, dados } = useEstado();
  // Anima por estado: Animated direto no <circle> vaza `collapsable` para o DOM no site.
  const [giro, setGiro] = useState(VOLTA);
  useEffect(() => {
    const v = new Animated.Value(VOLTA);
    const id = v.addListener(({ value }) => setGiro(value));
    Animated.timing(v, { toValue: 0, duration: 900, easing: Easing.out(Easing.cubic), useNativeDriver: false }).start();
    return () => v.removeListener(id);
  }, []);
  const cor = dados.genero === 'feminino' ? '#E5383B' : dados.genero === 'masculino' ? '#2F6BFF' : colors.textMuted;
  return (
    <Pressable accessibilityRole="button" accessibilityLabel="Perfil" hitSlop={4} onPress={() => router.push('/perfil')}
      style={{ width: TAM, height: TAM, alignItems: 'center', justifyContent: 'center' }}>
      <Svg width={TAM} height={TAM} style={{ position: 'absolute' }}>
        <Circle cx={TAM / 2} cy={TAM / 2} r={R} stroke={cor} strokeWidth={TRACO} fill="none" strokeLinecap="round"
          strokeDasharray={VOLTA} strokeDashoffset={giro} transform={`rotate(-90 ${TAM / 2} ${TAM / 2})`} />
      </Svg>
      {user?.photoURL ? <Image source={{ uri: user.photoURL }} style={{ width: FOTO, height: FOTO, borderRadius: FOTO / 2 }} accessibilityIgnoresInvertColors />
        : <Avatar nome={user?.displayName ?? '?'} tamanho={FOTO} />}
    </Pressable>
  );
}
