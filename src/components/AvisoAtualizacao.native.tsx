// Android: compara a versão do app (app.json) com a última release do repositório privado de APKs.
// Versão nova = janela que não fecha até atualizar. O APK baixado fica guardado (FeedTec-x.y.z.apk):
// se o gestor sair do app no meio, ao voltar já pede só a instalação. Ao baixar uma versão, apaga as outras.
// Fica em .native para o token não entrar no bundle do site (no web vale AvisoAtualizacao.tsx).
import { useEffect, useState } from 'react';
import { Modal, Platform, Text, View } from 'react-native';
import Ionicons from '@expo/vector-icons/Ionicons';
import Constants from 'expo-constants';
import { Directory, File, Paths } from 'expo-file-system';
import * as IntentLauncher from 'expo-intent-launcher';
import { maisNova } from '../lib/dados';
import { Botao, mensagem } from './ui';
import { colors, radius, space, type } from '../theme';

const RELEASE = 'https://api.github.com/repos/SuportExoduss/FeedTec-apk/releases/latest';
// Token fine-grained só com Contents: Read no FeedTec-apk (repo só com APKs). Vem do .env.local.
const TOKEN = process.env.EXPO_PUBLIC_GITHUB_APK_TOKEN;
type Nova = { versao: string; url: string; tamanho: number };

const pasta = () => new Directory(Paths.document, 'atualizacao');
const arquivo = (versao: string) => new File(pasta(), `FeedTec-${versao}.apk`);
/** Apaga os APKs guardados, menos o desta versão (se vier). */
function limpar(manter?: string) {
  if (!pasta().exists) return;
  for (const f of pasta().list()) if (f instanceof File && f.name !== (manter && `FeedTec-${manter}.apk`)) f.delete();
}

async function instalarApk(f: File) {
  await IntentLauncher.startActivityAsync('android.intent.action.VIEW', {
    data: f.contentUri, type: 'application/vnd.android.package-archive', flags: 1, // FLAG_GRANT_READ_URI_PERMISSION
  });
}

export function AvisoAtualizacao() {
  const [nova, setNova] = useState<Nova | null>(null);
  const [baixado, setBaixado] = useState(false);
  const [texto, setTexto] = useState<string | null>(null);
  const [ocupado, setOcupado] = useState(false);

  useEffect(() => {
    if (Platform.OS !== 'android' || !TOKEN) return;
    const atual = Constants.expoConfig?.version ?? '0';
    fetch(RELEASE, { headers: { Authorization: `Bearer ${TOKEN}`, Accept: 'application/vnd.github+json' } })
      .then(r => r.json())
      .then((r: { tag_name?: string; assets?: { name: string; url: string; size: number }[] }) => {
        const versao = String(r.tag_name ?? '').replace(/^v/, '');
        const apk = r.assets?.find(a => a.name.endsWith('.apk'));
        if (!apk || !maisNova(versao, atual)) { limpar(); return; } // já atualizado: o APK guardado não serve mais
        limpar(versao);
        const f = arquivo(versao);
        setBaixado(f.exists && f.size === apk.size);
        setNova({ versao, url: apk.url, tamanho: apk.size });
      })
      .catch(() => {});
  }, []);

  async function atualizar() {
    if (!nova || ocupado) return;
    setOcupado(true);
    setTexto(null);
    try {
      const f = arquivo(nova.versao);
      if (!baixado) {
        limpar();
        if (!pasta().exists) pasta().create({ intermediates: true });
        // Baixa num .part: se cair no meio, o arquivo incompleto não passa por versão baixada.
        const parte = new File(pasta(), `FeedTec-${nova.versao}.part`);
        setTexto('Baixando… 0%');
        // A API do GitHub redireciona para outro host; o Android não repassa o Authorization no redirecionamento.
        await File.createDownloadTask(nova.url, parte, {
          headers: { Authorization: `Bearer ${TOKEN}`, Accept: 'application/octet-stream' },
          onProgress: ({ bytesWritten, totalBytes }) => {
            if (totalBytes > 0) setTexto(`Baixando… ${Math.round((bytesWritten / totalBytes) * 100)}%`);
          },
        }).downloadAsync();
        parte.move(f);
        setBaixado(true);
      }
      setTexto(null);
      await instalarApk(f);
    } catch (e) {
      setTexto(`Não deu para baixar: ${mensagem(e)}`);
    } finally {
      setOcupado(false);
    }
  }

  if (!nova) return null;
  return (
    // onRequestClose vazio: o botão voltar do Android não fecha a janela.
    <Modal visible transparent animationType="fade" onRequestClose={() => {}}>
      <View style={{ flex: 1, backgroundColor: 'rgba(0,0,0,0.6)', justifyContent: 'center', padding: space(5) }}>
        <View accessibilityViewIsModal style={{ width: '100%', maxWidth: 440, alignSelf: 'center', gap: space(4), padding: space(5),
          backgroundColor: colors.surface, borderRadius: radius.card }}>
          <Ionicons name="cloud-download-outline" size={32} color={colors.accent} />
          <Text accessibilityRole="header" style={[type.title, { fontSize: 20 }]}>Nova versão {nova.versao}</Text>
          <Text style={type.body}>
            {baixado ? 'A atualização já foi baixada. Toque em Instalar e confirme no Android.'
              : `Atualize para continuar usando o FeedTec (${Math.round(nova.tamanho / 1e6)} MB).`}
          </Text>
          {texto ? <Text accessibilityLiveRegion="polite" style={type.caption}>{texto}</Text> : null}
          <Botao titulo={baixado ? 'Instalar' : 'Atualizar'} carregando={ocupado} onPress={atualizar} />
        </View>
      </View>
    </Modal>
  );
}
