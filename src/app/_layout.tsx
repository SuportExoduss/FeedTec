import { useSyncExternalStore } from 'react';
import { ActivityIndicator, useColorScheme, View } from 'react-native';
import { Redirect, Stack, useSegments } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { useFonts, Inter_400Regular, Inter_500Medium, Inter_600SemiBold, Inter_700Bold } from '@expo-google-fonts/inter';
import { EstadoProvider, useEstado } from '../Estado';
import { aplicarTema, colors, lerModo, ouvirModo } from '../theme';
import { Abertura } from '../components/Abertura';
import { BarraAbas } from '../components/BarraAbas';

function Portao() {
  const { user, carregandoUsuario } = useEstado();
  const [rota] = useSegments();
  if (carregandoUsuario) {
    return <View style={{ flex: 1, backgroundColor: colors.bg, justifyContent: 'center' }}><ActivityIndicator color={colors.accent} /></View>;
  }
  if (!user && rota !== 'entrar') return <Redirect href="/entrar" />;
  return (
    <View style={{ flex: 1, backgroundColor: colors.bg }}>
      <Stack screenOptions={{ headerShown: false, contentStyle: { backgroundColor: colors.bg } }} />
      <BarraAbas />
    </View>
  );
}

export default function Layout() {
  const [fontes] = useFonts({ Inter_400Regular, Inter_500Medium, Inter_600SemiBold, Inter_700Bold });
  const modo = useSyncExternalStore(ouvirModo, lerModo);
  const sistema = useColorScheme();
  const escuro = modo === 'sistema' ? sistema !== 'light' : modo === 'escuro';
  aplicarTema(escuro);
  return (
    <SafeAreaProvider>
      <EstadoProvider>
        <StatusBar style={escuro ? 'light' : 'dark'} />
        {fontes ? <Portao key={escuro ? 'escuro' : 'claro'} /> : <View style={{ flex: 1, backgroundColor: colors.bg }} />}
        <Abertura />
      </EstadoProvider>
    </SafeAreaProvider>
  );
}
