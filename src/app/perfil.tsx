import { useEffect, useState, useSyncExternalStore } from 'react';
import Constants from 'expo-constants';
import Ionicons from '@expo/vector-icons/Ionicons';
import { Image, Linking, Platform, ScrollView, Text, View } from 'react-native';
import { Abas, Avatar, Botao, Campo, Tela } from '../components/ui';
import { definirChaveGemini } from '../lib/dados';
import { AvisoDrive } from '../components/AvisoDrive';
import { AvisoBateria } from '../components/AvisoBateria';
import { useEstado, type StatusDrive } from '../Estado';
import { ativarAvisos, estadoAvisos, type EstadoAvisos } from '../services/lembretes';
import { colors, definirModo, fonte, lerModo, ouvirModo, radius, space, type } from '../theme';

const ROTULO: Record<StatusDrive, string> = {
  carregando: 'Carregando do Drive…',
  salvando: 'Salvando no Drive…',
  salvo: 'Tudo salvo no Drive (pasta FeedTec)',
  reconectar: 'Drive desconectado',
  erro: 'Falha ao salvar no Drive',
};

const TEXTO_AVISOS: Record<EstadoAvisos, string> = {
  ligado: 'Ligados neste navegador. Chegam enquanto o FeedTec estiver aberto em alguma aba (pode ficar em segundo plano).',
  desligado: 'Receba aqui os lembretes de tarefas e reuniões enquanto o site estiver aberto em alguma aba.',
  negado: 'O navegador bloqueou os avisos. Libere no cadeado ao lado do endereço e recarregue a página.',
  'sem-suporte': 'Este navegador não recebe avisos. No iPhone, instale o site na tela de início (Safari › Compartilhar).',
};

/** Só no site: no celular os lembretes já são locais. */
function AvisosNavegador() {
  const { dados } = useEstado();
  const [estado, setEstado] = useState<EstadoAvisos | null>(null);
  const [ocupado, setOcupado] = useState(false);
  const [erro, setErro] = useState('');
  useEffect(() => { estadoAvisos().then(setEstado).catch(() => setEstado('sem-suporte')); }, []);
  if (!estado) return null;
  return (
    <View style={{ gap: space(3) }}>
      <Text style={type.body}>Avisos no navegador</Text>
      <Text style={[type.caption, estado === 'ligado' ? { color: colors.positivo } : null]}>{TEXTO_AVISOS[estado]}</Text>
      {erro ? <Text style={[type.caption, { color: colors.melhorar }]}>{erro}</Text> : null}
      {estado === 'desligado' ? (
        <Botao titulo={ocupado ? 'Ativando…' : 'Ativar avisos no navegador'} disabled={ocupado} onPress={async () => {
          setOcupado(true); setErro('');
          try { setEstado(await ativarAvisos(dados)); }
          catch (e) { setErro(`Não deu para ativar: ${e instanceof Error ? e.message : e}`); }
          finally { setOcupado(false); }
        }} />
      ) : null}
    </View>
  );
}

export default function Perfil() {
  const { user, status, sair, dados, alterar } = useEstado();
  const [chave, setChave] = useState(dados.chaveGemini ?? '');
  const salva = chave.trim() === (dados.chaveGemini ?? '');
  const modo = useSyncExternalStore(ouvirModo, lerModo);
  return (
    <Tela titulo="Perfil" voltar>
      <ScrollView contentContainerStyle={{ width: '100%', maxWidth: 720, alignSelf: 'center', paddingBottom: space(10) }}>
      <View style={{ padding: space(4), gap: space(3), alignItems: 'center' }}>
        {user?.photoURL ? <Image source={{ uri: user.photoURL }} style={{ width: 80, height: 80, borderRadius: 40 }} accessibilityIgnoresInvertColors />
          : <Avatar nome={user?.displayName ?? '?'} tamanho={80} />}
        <View style={{ alignItems: 'center', gap: space(1) }}>
          <Text style={[type.body, { fontFamily: fonte.semi, fontSize: 18 }]}>{user?.displayName}</Text>
          <Text style={type.caption}>{user?.email}</Text>
        </View>
        <Text style={[type.caption, { color: status === 'salvo' ? colors.positivo : colors.textMuted }]}>{ROTULO[status]}</Text>
      </View>

      <Secao titulo="Integração com IA" icone="sparkles-outline">
        <Text style={type.body}>Chave do Gemini</Text>
        <Text style={type.caption}>
          A IA usa a sua própria chave do Google AI Studio. Ela fica no aparelho e no seu Drive (pasta FeedTec).
        </Text>
        <View style={{ gap: space(1), padding: space(3), borderRadius: 10, backgroundColor: colors.bg }}>
          <Text style={[type.caption, { color: colors.text, fontFamily: fonte.semi }]}>Como pegar a chave</Text>
          {[
            'Toque em "Criar chave no AI Studio" (abaixo) e entre com a sua conta Google.',
            'Aceite os termos, se o site pedir (só na 1ª vez).',
            'Toque em "Create API key" (Criar chave de API) e escolha ou crie um projeto.',
            'Na chave criada (começa com AIza…), toque em copiar.',
            'Volte aqui, cole no campo Chave e toque em Salvar chave.',
          ].map((p, i) => <Text key={i} style={type.caption}>{i + 1}. {p}</Text>)}
        </View>
        <Text style={[type.caption, { color: colors.melhorar }]}>
          Atenção (LGPD): no plano gratuito o Google pode usar os textos enviados para melhorar os modelos.
          Ative o faturamento no AI Studio para os feedbacks da equipe não serem usados.
        </Text>
        <Campo rotulo="Chave" value={chave} onChangeText={setChave} secureTextEntry autoCapitalize="none" autoCorrect={false}
          placeholder="Cole aqui a chave (começa com AIza…)" />
        <Botao titulo={salva && chave ? 'Chave salva' : 'Salvar chave'} disabled={salva}
          onPress={() => alterar(d => definirChaveGemini(d, chave))} />
        <Botao titulo="Criar chave no AI Studio" secundario onPress={() => Linking.openURL('https://aistudio.google.com/apikey')} />
      </Secao>

      <Secao titulo="Configurações" icone="settings-outline">
        <Text style={type.body}>Tema</Text>
        <Abas valor={modo} onChange={m => definirModo(m)}
          opcoes={[{ valor: 'sistema', titulo: 'Sistema' }, { valor: 'claro', titulo: 'Claro' }, { valor: 'escuro', titulo: 'Escuro' }]} />
        <AvisoDrive />
        <AvisoBateria />
        {Platform.OS === 'web' ? <AvisosNavegador /> : null}
      </Secao>

      <Secao titulo="Sobre" icone="information-circle-outline">
        <Text style={type.body}>FeedTec {Constants.expoConfig?.version ?? ''}</Text>
        <Text style={type.caption}>Feedbacks, tarefas e reuniões da equipe técnica. Seus dados ficam no seu Google Drive (pasta FeedTec).</Text>
      </Secao>

      <View style={{ padding: space(4) }}>
        <Botao titulo="Sair" secundario onPress={sair} />
      </View>
      </ScrollView>
    </Tela>
  );
}

function Secao({ titulo, icone, children }: { titulo: string; icone: keyof typeof Ionicons.glyphMap; children: React.ReactNode }) {
  return (
    <View style={{ marginHorizontal: space(4), marginTop: space(4), padding: space(4), gap: space(3), borderRadius: radius.card,
      backgroundColor: colors.surface, borderWidth: 1, borderColor: colors.border }}>
      <View style={{ flexDirection: 'row', alignItems: 'center', gap: space(2) }}>
        <Ionicons name={icone} size={20} color={colors.amarelo} />
        <Text accessibilityRole="header" style={{ fontFamily: fonte.semi, fontSize: 17, color: colors.text }}>{titulo}</Text>
      </View>
      {children}
    </View>
  );
}
