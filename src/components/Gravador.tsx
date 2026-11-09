// Grava a conversa do feedback (ou recebe o arquivo de outro app de gravação) e transcreve no Gemini já separando gestor e técnico.
import { useState } from 'react';
import { Platform, Text, View } from 'react-native';
import Ionicons from '@expo/vector-icons/Ionicons';
import * as DocumentPicker from 'expo-document-picker';
import { RecordingPresets, requestRecordingPermissionsAsync, setAudioModeAsync, useAudioRecorder, useAudioRecorderState } from 'expo-audio';
import { Botao, Erro, confirmar, mensagem } from './ui';
import { transcrever, type Progresso } from '../services/gemini';
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

// Extensão → tipo que o Gemini aceita (apps de gravação costumam mandar m4a, que é áudio mp4).
const MIME_EXT: Record<string, string> = {
  m4a: 'audio/mp4', mp4: 'audio/mp4', aac: 'audio/aac', mp3: 'audio/mp3', ogg: 'audio/ogg', opus: 'audio/ogg',
  oga: 'audio/ogg', wav: 'audio/wav', flac: 'audio/flac', webm: 'audio/webm', aiff: 'audio/aiff',
};

export function Gravador({ chave, tecnico, onPronto }: { chave?: string; tecnico: string; onPronto: (falas: Fala[], audio: Blob) => void }) {
  const rec = useAudioRecorder(OPCOES);
  const st = useAudioRecorderState(rec, 500);
  const [fase, setFase] = useState<'parado' | 'gravando' | 'transcrevendo'>('parado');
  const [progresso, setProgresso] = useState<Progresso>({ fase: 'enviando' });
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

  async function transcreverAudio(audio: Blob, mime: string) {
    setFase('transcrevendo');
    setProgresso({ fase: 'enviando' });
    try {
      onPronto(await transcrever(chave!, audio, mime, tecnico, setProgresso), audio);
    } catch (e) { setErro(mensagem(e)); }
    setFase('parado');
  }

  async function parar() {
    setFase('transcrevendo');
    try {
      await rec.stop();
      if (!rec.uri) throw new Error('A gravação não foi salva. Tente de novo.');
      const blob = await (await fetch(rec.uri)).blob();
      await transcreverAudio(blob, (blob.type || (Platform.OS === 'web' ? MIME_WEB : 'audio/aac')).split(';')[0]);
    } catch (e) { setErro(mensagem(e)); setFase('parado'); }
  }

  /** Arquivo já gravado em outro app (gravador do celular, WhatsApp…). */
  async function enviar() {
    setErro(null);
    try {
      const r = await DocumentPicker.getDocumentAsync({ type: 'audio/*', copyToCacheDirectory: true });
      const a = r.canceled ? undefined : r.assets[0];
      if (!a) return;
      const ext = a.name.split('.').pop()?.toLowerCase() ?? '';
      const mime = MIME_EXT[ext] ?? a.mimeType?.split(';')[0];
      if (!mime?.startsWith('audio/')) throw new Error('Formato não aceito. Use m4a, mp3, aac, ogg, wav ou flac.');
      const blob = a.file ?? await (await fetch(a.uri)).blob();
      await transcreverAudio(blob, mime);
    } catch (e) { setErro(mensagem(e)); setFase('parado'); }
  }

  if (fase === 'parado') return (
    <View style={{ gap: space(2) }}>
      <View style={{ flexDirection: 'row', gap: space(2) }}>
        <View style={{ flex: 1 }}>
          <Botao titulo="Gravar" secundario disabled={!chave} onPress={iniciar}
            icone={<Ionicons name="mic" size={20} color={colors.text} />} />
        </View>
        <View style={{ flex: 1 }}>
          <Botao titulo="Arquivo" secundario disabled={!chave} onPress={enviar}
            icone={<Ionicons name="cloud-upload-outline" size={20} color={colors.text} />} />
        </View>
      </View>
      <Erro texto={erro} />
    </View>
  );

  if (fase === 'transcrevendo') return (
    <View accessibilityLiveRegion="polite" style={{ gap: space(2) }}>
      <Botao titulo={progresso.fase === 'enviando' ? 'Enviando o áudio…' : 'Transcrevendo a conversa…'} carregando onPress={() => {}} />
      <Text style={[type.caption, { textAlign: 'center' }]}>
        {progresso.fase === 'transcrevendo' && progresso.falas ? `${progresso.falas} falas transcritas até agora` : 'Conversas longas levam alguns minutos.'}
      </Text>
    </View>
  );

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
}
