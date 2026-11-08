// Abertura com o nome FeedTec: emenda na splash nativa (mesmo fundo e nome), some sozinha ou com um toque em qualquer lugar.
import { useEffect, useRef, useState } from 'react';
import { Animated, Image, Pressable, StyleSheet } from 'react-native';

const FUNDO = '#101827';
const DURACAO = 700; // ms parada na tela (metade da abertura antiga)

export function Abertura() {
  const [visivel, setVisivel] = useState(true);
  const opacidade = useRef(new Animated.Value(1)).current;
  const fechar = useRef(() => {
    Animated.timing(opacidade, { toValue: 0, duration: 200, useNativeDriver: true }).start(() => setVisivel(false));
  }).current;
  useEffect(() => { const t = setTimeout(fechar, DURACAO); return () => clearTimeout(t); }, [fechar]);
  if (!visivel) return null;
  return (
    <Animated.View style={[StyleSheet.absoluteFill, { opacity: opacidade, zIndex: 10 }]}>
      <Pressable accessibilityLabel="Pular abertura" onPress={fechar}
        style={{ flex: 1, backgroundColor: FUNDO, alignItems: 'center', justifyContent: 'center' }}>
        <Image source={require('../../assets/nome-feedtec.png')} accessibilityLabel="FeedTec"
          style={{ width: 170, height: 35 }} resizeMode="contain" />
      </Pressable>
    </Animated.View>
  );
}
