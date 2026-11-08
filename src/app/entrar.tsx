import { useState } from 'react';
import { Text, View } from 'react-native';
import { Redirect } from 'expo-router';
import { SafeAreaView } from 'react-native-safe-area-context';
import Ionicons from '@expo/vector-icons/Ionicons';
import { Botao, Erro, mensagem } from '../components/ui';
import { useEstado } from '../Estado';
import { colors, space, type } from '../theme';

export default function Entrar() {
  const { user, entrar: entrarNoGoogle } = useEstado();
  const [carregando, setCarregando] = useState(false);
  const [erro, setErro] = useState<string | null>(null);
  if (user) return <Redirect href="/" />;

  async function entrar() {
    setErro(null);
    setCarregando(true);
    try { await entrarNoGoogle(); }
    catch (e) { setErro(mensagem(e)); }
    finally { setCarregando(false); }
  }

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: colors.bg, justifyContent: 'center', padding: space(6) }}>
      <View style={{ width: '100%', maxWidth: 400, alignSelf: 'center', gap: space(5) }}>
        <View style={{ gap: space(2) }}>
          <Text style={[type.caption, { letterSpacing: 4 }]}>FEEDTEC</Text>
          <Text accessibilityRole="header" style={type.title}>Feedbacks da sua equipe, prontos em minutos.</Text>
          <Text style={type.caption}>Seus dados ficam no seu Google Drive, numa pasta FeedTec.</Text>
        </View>
        <Botao titulo="Continuar com Google" onPress={entrar} carregando={carregando}
          icone={<Ionicons name="logo-google" size={18} color={colors.accentText} />} />
        <Erro texto={erro} />
      </View>
    </SafeAreaView>
  );
}
