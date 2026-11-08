// Grava a conversa do feedback, transcreve no Gemini e pergunta qual voz é a do gestor.
import { useState } from 'react';
import { Platform, Text, View } from 'react-native';
import Ionicons from '@expo/vector-icons/Ionicons';
import { RecordingPresets, requestRecordingPermissionsAsync, setAudioModeAsync, useAudioRecorder, useAudioRecorderState } from 'expo-audio';
import { Botao, Erro, confirmar, mensagem } from './ui';
import { marcarVozes, type Trecho } from '../lib/prompt';
import { transcrever } from '../services/gemini';
import { colors, radius, space, type } from '../theme';
import type { Fala } from '../types';

// Web: o primeiro formato que o navegador grava e o Gemini aceita. Android: AAC puro (audio/aac).
const MIME_WEB = typeof MediaRecorder === 'undefined' ? 'audio/webm'
  : ['audio/ogg;codecs=opus', 'audio/mp4', 'audio/webm'].find(m => MediaRecorder.isTypeSupported(m)) ?? 'audio/webm';

// Voz falada não precisa de mais: mono, 16 kHz, 32 kbps (~15 MB por hora).
const OPCOES = {
  ...RecordingPresets.HIGH_QUALITY,
  extension: '.aac', sampleRate: 16000, numberOfChannels: 1, bitRate: 32000,
  android: { extension: '.aac', outputFormat: 'aac_adts' as const, audioEncoder: 'aac' as const },
  web: { mimeType: MIME_WEB, bitsPerSecond: 32000 },
};

const relogio = (ms: number) => {
  const s = Math.floor(ms / 1000);
  return `${String(Math.floor(s / 60)).padStart(2, '0')}:${String(s % 60).padStart(2, '0')}`;
};

function base64(blob: Blob): Promise<string> {
  return new Promise((ok, falha) => {
    const r = new FileReader();
    r.onload = () => ok(String(r.result).split(',')[1] ?? '');
    r.onerror = () => falha(new Error('Não deu para ler a gravação.'));
    r.readAsDataURL(blob);
  });
}

export function Gravador({ chave, onPronto }: { chave?: string; onPronto: (falas: Fala[], audio: Blob) => void }) {
  const rec = useAudioRecorder(OPCOES);
  const st = useAudioRecorderState(rec, 500);
  const [fase, setFase] = useState<'parado' | 'gravando' | 'transcrevendo' | 'vozes'>('parado');
  const [trechos, setTrechos] = useState<Trecho[]>([]);
  const [audio, setAudio] = useState<Blob | null>(null);
  const [erro, setErro] = useState<string | null>(null);

  async function iniciar() {
    setErro(null);
    if (!(await confirmar('Gravar conversa', 'Avise o técnico que a conversa será gravada e transcrita.', 'Gravar'))) return;
    try {
      if (!(await requestRecordingPermissionsAsync()).granted) throw new Error('Sem permissão para o microfone.');
      await setAudioModeAsync({ allowsRecording: true, playsInSilentMode: true });
      await rec.prepareToRecordAsync();
      rec.record();
      setFase('gravando');
    } catch (e) { setErro(mensagem(e)); }
  }

  async function parar() {
    setFase('transcrevendo');
    try {
      await rec.stop();
      if (!rec.uri) throw new Error('A gravação não foi salva. Tente de novo.');
      const blob = await (await fetch(rec.uri)).blob();
      const mime = (blob.type || (Platform.OS === 'web' ? MIME_WEB : 'audio/aac')).split(';')[0];
      setTrechos(await transcrever(chave!, await base64(blob), mime));
      setAudio(blob);
      setFase('vozes');
    } catch (e) { setErro(mensagem(e)); setFase('parado'); }
  }

  function escolher(minha: 'A' | 'B') {
    onPronto(marcarVozes(trechos, minha), audio!);
    setFase('parado');
  }

  if (fase === 'parado') return (
    <View style={{ gap: space(2) }}>
      <Botao titulo="Gravar conversa" secundario disabled={!chave} onPress={iniciar}
        icone={<Ionicons name="mic" size={20} color={colors.text} />} />
      <Erro texto={erro} />
    </View>
  );

  if (fase === 'transcrevendo') return <Botao titulo="Transcrevendo a conversa…" carregando onPress={() => {}} />;

  if (fase === 'gravando') return (
    <View style={{ gap: space(3), padding: space(4), borderRadius: radius.card, backgroundColor: colors.surface, alignItems: 'center' }}>
      <Text accessibilityLiveRegion="polite" style={[type.title, { fontVariant: ['tabular-nums'] }]}>
        {st.isRecording ? '● ' : '❚❚ '}{relogio(st.durationMillis)}
      </Text>
      <View style={{ flexDirection: 'row', gap: space(2), alignSelf: 'stretch' }}>
        <View style={{ flex: 1 }}>
          <Botao titulo={st.isRecording ? 'Pausar' : 'Continuar'} secundario onPress={() => (st.isRecording ? rec.pause() : rec.record())} />
        </View>
        <View style={{ flex: 1 }}><Botao titulo="Parar" onPress={parar} /></View>
      </View>
    </View>
  );

  // Uma frase de cada voz para o gestor dizer qual é a dele.
  const vozes = (['A', 'B'] as const).filter(v => trechos.some(t => t.voz === v));
  return (
    <View style={{ gap: space(3) }}>
      <Text style={type.body}>Qual destas é a sua voz?</Text>
      {vozes.map(v => (
        <View key={v} style={{ gap: space(2), padding: space(3), borderRadius: radius.card, backgroundColor: colors.surface }}>
          <Text style={type.caption} numberOfLines={3}>“{trechos.find(t => t.voz === v)!.texto}”</Text>
          <Botao titulo="Sou eu" secundario onPress={() => escolher(v)} />
        </View>
      ))}
      {vozes.length === 1 ? <Botao titulo="Nenhuma, é só o técnico" secundario onPress={() => escolher(vozes[0] === 'A' ? 'B' : 'A')} /> : null}
    </View>
  );
}
