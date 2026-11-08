// Toca a gravação da conversa guardada no Drive. Android: direto do Drive com o token; web: baixa antes.
import { useEffect, useState } from 'react';
import { Platform, Pressable, Text, View } from 'react-native';
import { useAudioPlayer, useAudioPlayerStatus } from 'expo-audio';
import { Botao, Icone, mensagem } from './ui';
import { useEstado } from '../Estado';
import { DriveSemAcesso, baixarAudio, urlAudio } from '../services/drive';
import { tokenDrive } from '../services/googleSignIn';
import { colors, space, type } from '../theme';

const relogio = (seg: number) => `${String(Math.floor(seg / 60)).padStart(2, '0')}:${String(Math.floor(seg % 60)).padStart(2, '0')}`;

export function Player({ audioId }: { audioId: string }) {
  const { reconectar } = useEstado();
  const player = useAudioPlayer(null);
  const st = useAudioPlayerStatus(player);
  const [estado, setEstado] = useState<'carregando' | 'pronto' | 'reconectar' | string>('carregando');
  const [largura, setLargura] = useState(1);
  const [tentativa, setTentativa] = useState(0);

  useEffect(() => {
    let url: string | undefined;
    let vivo = true;
    (async () => {
      const token = await tokenDrive();
      if (!token) throw new DriveSemAcesso('');
      if (Platform.OS === 'web') player.replace((url = URL.createObjectURL(await baixarAudio(token, audioId))));
      else player.replace({ uri: urlAudio(audioId), headers: { Authorization: `Bearer ${token}` } });
      if (vivo) setEstado('pronto');
    })().catch(e => vivo && setEstado(e instanceof DriveSemAcesso ? 'reconectar' : `Não deu para abrir a gravação. ${mensagem(e)}`));
    return () => { vivo = false; if (url) URL.revokeObjectURL(url); };
  }, [audioId, player, tentativa]);

  if (estado === 'reconectar') return (
    <View style={{ gap: space(2) }}>
      <Text style={type.caption}>Para ouvir a gravação, reconecte o Drive.</Text>
      <Botao titulo="Reconectar Drive" secundario onPress={async () => { await reconectar(); setEstado('carregando'); setTentativa(t => t + 1); }} />
    </View>
  );
  if (estado !== 'carregando' && estado !== 'pronto') return <Text style={type.caption}>{estado}</Text>;

  const dur = st.duration || 0;
  const pos = Math.min(st.currentTime || 0, dur);
  function tocar() {
    if (st.playing) return player.pause();
    if (dur && pos >= dur - 0.3) player.seekTo(0);
    player.play();
  }

  return (
    <View style={{ flexDirection: 'row', alignItems: 'center', gap: space(2) }}>
      <Icone nome={st.playing ? 'pause' : 'play'} rotulo={st.playing ? 'Pausar gravação' : 'Ouvir gravação'}
        onPress={estado === 'pronto' && st.isLoaded ? tocar : () => {}} cor={st.isLoaded ? colors.text : colors.textMuted} />
      <Pressable accessibilityRole="adjustable" accessibilityLabel="Posição da gravação" style={{ flex: 1, paddingVertical: space(3) }}
        onLayout={e => setLargura(e.nativeEvent.layout.width || 1)}
        onPress={e => dur && player.seekTo((e.nativeEvent.locationX / largura) * dur)}>
        <View style={{ height: 4, borderRadius: 2, backgroundColor: colors.border }}>
          <View style={{ height: 4, borderRadius: 2, backgroundColor: colors.accent, width: `${dur ? (pos / dur) * 100 : 0}%` }} />
        </View>
      </Pressable>
      <Text style={[type.caption, { fontVariant: ['tabular-nums'] }]}>{st.isLoaded ? `${relogio(pos)} / ${relogio(dur)}` : 'carregando…'}</Text>
    </View>
  );
}
