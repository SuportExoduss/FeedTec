// Grava a conversa do feedback (ou recebe o arquivo de outro app de gravação), guarda o áudio no celular
// antes de tudo e transcreve no Gemini; no fim o gestor confirma quem é quem.
import { useEffect, useState } from 'react';
import { Platform, Text, View } from 'react-native';
import Ionicons from '@expo/vector-icons/Ionicons';
import * as DocumentPicker from 'expo-document-picker';
import * as Sharing from 'expo-sharing';
import { Directory, File, Paths } from 'expo-file-system';
import { RecordingPresets, requestRecordingPermissionsAsync, setAudioModeAsync, useAudioRecorder, useAudioRecorderState } from 'expo-audio';
import { Botao, Erro, confirmar, mensagem } from './ui';
import { inverterFalas } from '../lib/prompt';
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
const extDe = (nome: string) => nome.split('.').pop()?.toLowerCase() ?? '';

/** Áudio guardado no celular (no navegador fica só na memória da aba). */
type Gravacao = { nome: string; uri: string; mime: string; blob?: Blob };

const WEB = Platform.OS === 'web';
// ponytail: no navegador a gravação some se recarregar a página; usar IndexedDB se o site virar uso diário.
const pasta = () => new Directory(Paths.document, 'gravacoes');

function listarGravacoes(): Gravacao[] {
  if (WEB || !pasta().exists) return [];
  return pasta().list().filter((f): f is File => f instanceof File)
    .map(f => ({ nome: f.name, uri: f.uri, mime: MIME_EXT[extDe(f.name)] ?? 'audio/aac' }))
    .sort((a, b) => b.nome.localeCompare(a.nome));
}

/** Chamado depois que o áudio já está no Drive junto com o feedback. */
export function apagarGravacao(uri: string) {
  if (WEB) { URL.revokeObjectURL(uri); return; }
  try { new File(uri).delete(); } catch { /* já não existe */ }
}

async function compartilhar(g: Gravacao) {
  if (WEB) {
    const a = document.createElement('a');
    a.href = g.uri; a.download = g.nome; a.click();
    return;
  }
  // Menu do Android: salvar no Drive, em Arquivos, mandar no WhatsApp…
  await Sharing.shareAsync(g.uri, { mimeType: g.mime, dialogTitle: 'Salvar ou enviar o áudio' });
}

export function Gravador({ chave, tecnico, onPronto }: {
  chave?: string; tecnico: string; onPronto: (falas: Fala[], audio: Blob, arquivo?: string) => void;
}) {
  const rec = useAudioRecorder(OPCOES);
  const st = useAudioRecorderState(rec, 500);
  const [fase, setFase] = useState<'parado' | 'gravando' | 'transcrevendo' | 'vozes'>('parado');
  const [progresso, setProgresso] = useState<Progresso>({ fase: 'enviando' });
  const [erro, setErro] = useState<string | null>(null);
  const [salvas, setSalvas] = useState<Gravacao[]>([]);
  const [conferir, setConferir] = useState<{ falas: Fala[]; audio: Blob; g: Gravacao } | null>(null);

  useEffect(() => { setSalvas(listarGravacoes()); }, []);

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

  /** `guardada`: o arquivo está no celular, então o erro pode mandar tentar de novo depois. */
  async function transcreverGravacao(g: Gravacao, guardada: boolean) {
    setErro(null);
    setFase('transcrevendo');
    setProgresso({ fase: 'enviando' });
    try {
      const audio = g.blob ?? await (await fetch(g.uri)).blob();
      const falas = await transcrever(chave!, audio, g.mime, tecnico, setProgresso);
      setConferir({ falas, audio, g });
      setFase('vozes');
    } catch (e) {
      setErro(`${mensagem(e)}${guardada ? ' O áudio ficou guardado logo abaixo: tente de novo quando quiser.' : ''}`);
      setFase('parado');
    }
  }

  async function parar() {
    setFase('transcrevendo');
    setProgresso({ fase: 'enviando' });
    let g: Gravacao;
    try {
      await rec.stop();
      if (!rec.uri) throw new Error('A gravação não foi salva. Tente de novo.');
      const d = new Date(), p = (n: number) => String(n).padStart(2, '0');
      const nome = `${tecnico} ${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())} ${p(d.getHours())}h${p(d.getMinutes())}`;
      if (WEB) {
        const blob = await (await fetch(rec.uri)).blob();
        const mime = (blob.type || MIME_WEB).split(';')[0];
        g = { nome: `${nome}.${extDe(mime.replace('/', '.'))}`, uri: URL.createObjectURL(blob), mime, blob };
      } else {
        // Primeiro guarda (o cache do gravador pode ser limpo pelo Android); só depois transcreve.
        if (!pasta().exists) pasta().create({ intermediates: true });
        const destino = new File(pasta(), `${nome}.aac`);
        await new File(rec.uri).move(destino);
        g = { nome: destino.name, uri: destino.uri, mime: 'audio/aac' };
      }
      setSalvas(s => [g, ...s]);
    } catch (e) { setErro(mensagem(e)); setFase('parado'); return; }
    await transcreverGravacao(g, true);
  }

  /** Arquivo já gravado em outro app (gravador do celular, WhatsApp…). */
  async function enviar() {
    setErro(null);
    try {
      const r = await DocumentPicker.getDocumentAsync({ type: ['audio/*', 'video/mp4'] /* m4a renomeado para .mp4 vem como vídeo */, copyToCacheDirectory: true });
      const a = r.canceled ? undefined : r.assets[0];
      if (!a) return;
      const mime = MIME_EXT[extDe(a.name)] ?? a.mimeType?.split(';')[0];
      if (!mime?.startsWith('audio/')) throw new Error('Formato não aceito. Use m4a, mp3, aac, ogg, wav ou flac.');
      await transcreverGravacao({ nome: a.name, uri: a.uri, mime, blob: a.file }, false);
    } catch (e) { setErro(mensagem(e)); setFase('parado'); }
  }

  async function apagar(g: Gravacao) {
    if (!(await confirmar('Apagar gravação', `"${g.nome}" será apagada deste aparelho.`, 'Apagar'))) return;
    apagarGravacao(g.uri);
    setSalvas(s => s.filter(x => x.uri !== g.uri));
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
      {salvas.length ? <Text style={type.caption}>Gravações guardadas neste aparelho</Text> : null}
      {salvas.map(g => (
        <View key={g.uri} style={{ gap: space(2), padding: space(3), borderRadius: radius.card, backgroundColor: colors.surface }}>
          <Text style={type.body} numberOfLines={1}>{g.nome.replace(/\.\w+$/, '')}</Text>
          <View style={{ flexDirection: 'row', gap: space(2) }}>
            <View style={{ flex: 1 }}><Botao titulo="Transcrever" secundario disabled={!chave} onPress={() => transcreverGravacao(g, true)} /></View>
            <View style={{ flex: 1 }}><Botao titulo="Salvar" secundario onPress={() => compartilhar(g).catch(e => setErro(mensagem(e)))} /></View>
            <View style={{ flex: 1 }}><Botao titulo="Apagar" secundario onPress={() => apagar(g)} /></View>
          </View>
        </View>
      ))}
    </View>
  );

  if (fase === 'vozes' && conferir) {
    const amostra = (quem: Fala['quem']) => conferir.falas.find(f => f.quem === quem && f.texto.length > 15)?.texto
      ?? conferir.falas.find(f => f.quem === quem)?.texto ?? '(não falou)';
    const pronto = (falas: Fala[]) => {
      onPronto(falas, conferir.audio, salvas.some(s => s.uri === conferir.g.uri) ? conferir.g.uri : undefined);
      setConferir(null); setFase('parado');
    };
    return (
      <View accessibilityLiveRegion="polite" style={{ gap: space(3), padding: space(4), borderRadius: radius.card, backgroundColor: colors.surface }}>
        <Text style={type.title}>Quem é quem?</Text>
        <Text style={type.caption}>Você</Text>
        <Text style={type.body} numberOfLines={3}>“{amostra('eu')}”</Text>
        <Text style={type.caption}>{tecnico}</Text>
        <Text style={type.body} numberOfLines={3}>“{amostra('tecnico')}”</Text>
        <View style={{ flexDirection: 'row', gap: space(2) }}>
          <View style={{ flex: 1 }}><Botao titulo="Está trocado" secundario onPress={() => pronto(inverterFalas(conferir.falas))} /></View>
          <View style={{ flex: 1 }}><Botao titulo="Está certo" onPress={() => pronto(conferir.falas)} /></View>
        </View>
      </View>
    );
  }

  if (fase === 'transcrevendo') return (
    <View accessibilityLiveRegion="polite" style={{ gap: space(2) }}>
      <Botao titulo={progresso.fase === 'enviando' ? 'Enviando o áudio…' : 'Transcrevendo a conversa…'} carregando onPress={() => {}} />
      <Text style={[type.caption, { textAlign: 'center' }]}>
        {progresso.fase === 'transcrevendo' && progresso.falas ? `${progresso.falas} falas transcritas até agora` : 'Conversas longas levam alguns minutos.'}
      </Text>
    </View>
  );

  return (
    <View style={{ gap: space(3), padding: space(4), borderRadius: radius.card, backgroundColor: colors.surface, alignItems: 'center' }}>
      <Text accessibilityLiveRegion="polite" style={[type.title, { fontVariant: ['tabular-nums'] }]}>
        {st.isRecording ? '● ' : '❚❚ '}{relogio(st.durationMillis)}
      </Text>
      <Text style={[type.caption, { textAlign: 'center' }]}>Funciona sem internet: o áudio fica guardado e é transcrito ao parar.</Text>
      <View style={{ flexDirection: 'row', gap: space(2), alignSelf: 'stretch' }}>
        <View style={{ flex: 1 }}>
          <Botao titulo={st.isRecording ? 'Pausar' : 'Continuar'} secundario onPress={() => (st.isRecording ? rec.pause() : rec.record())} />
        </View>
        <View style={{ flex: 1 }}><Botao titulo="Parar" onPress={parar} /></View>
      </View>
    </View>
  );
}
