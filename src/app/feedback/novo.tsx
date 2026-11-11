// Novo feedback: tom → anotações (escritas ou conversa gravada) → Gemini gera → gestor ajusta → salva.
import { useState } from 'react';
import { ScrollView, Text, View } from 'react-native';
import { Redirect, router, useLocalSearchParams } from 'expo-router';
import { Botao, Campo, Erro, Marca, Tela, mensagem } from '../../components/ui';
import { SeletorTom } from '../../components/Tom';
import { Gravador, apagarGravacao } from '../../components/Gravador';
import { useEstado } from '../../Estado';
import { adicionarFeedback } from '../../lib/dados';
import { conversaComoTexto, inverterFalas, montarPedido } from '../../lib/prompt';
import { gerarTexto } from '../../services/gemini';
import { salvarAudioNoDrive } from '../../services/drive';
import { tokenDrive } from '../../services/googleSignIn';
import { space, type } from '../../theme';
import type { Fala, Tom } from '../../types';

export default function NovoFeedback() {
  const { tecnico: tecnicoId } = useLocalSearchParams<{ tecnico: string }>();
  const { dados, alterar } = useEstado();
  const [tom, setTom] = useState<Tom>('neutro');
  const [bruto, setBruto] = useState('');
  const [comContexto, setComContexto] = useState(false);
  const [contexto, setContexto] = useState('');
  const [texto, setTexto] = useState('');
  const [gerando, setGerando] = useState(false);
  const [salvando, setSalvando] = useState(false);
  const [conversa, setConversa] = useState<Fala[] | undefined>();
  const [audio, setAudio] = useState<Blob | null>(null);
  const [arquivo, setArquivo] = useState<string | undefined>();
  const [erro, setErro] = useState<string | null>(null);
  const tecnico = dados.tecnicos.find(t => t.id === tecnicoId);
  if (!tecnico) return <Redirect href="/" />;

  async function gerar() {
    setErro(null);
    if (!dados.chaveGemini) { setErro('Cadastre sua chave do Gemini no Perfil primeiro.'); return; }
    setGerando(true);
    try { setTexto(await gerarTexto(dados.chaveGemini, montarPedido(tom, tecnico!.nome, bruto, comContexto ? contexto : ''))); }
    catch (e) { setErro(mensagem(e)); }
    finally { setGerando(false); }
  }

  async function salvar() {
    setErro(null);
    if (!texto.trim()) { setErro('O feedback está vazio.'); return; }
    setSalvando(true);
    // ponytail: sem Drive o áudio se perde, mas a conversa transcrita fica no feedback.
    let audioId: string | undefined;
    try {
      const token = audio && (await tokenDrive());
      if (audio && token) audioId = await salvarAudioNoDrive(token, audio, `conversa-${tecnico!.nome}-${new Date().toISOString().slice(0, 16)}.${audio.type.match(/ogg|webm|mp4|wav|flac|mp3|mpeg/)?.[0].replace('mpeg', 'mp3') ?? 'aac'}`);
    } catch { /* segue sem o áudio; a cópia no aparelho fica */ }
    // Já está no Drive: a cópia guardada no aparelho não precisa mais ficar.
    if (audioId && arquivo) apagarGravacao(arquivo);
    try { alterar(d => adicionarFeedback(d, tecnico!.id, tom, bruto, texto, Date.now(), { conversa, audioId })); router.back(); }
    catch (e) { setErro(mensagem(e)); }
    finally { setSalvando(false); }
  }

  return (
    <Tela titulo={`Feedback · ${tecnico.nome}`} voltar>
      <ScrollView contentContainerStyle={{ padding: space(4), gap: space(4), paddingBottom: space(10) }} keyboardShouldPersistTaps="handled">
        <SeletorTom valor={tom} onMudar={setTom} />
        <Gravador chave={dados.chaveGemini} tecnico={tecnico.nome} onPronto={(falas, a, arq) => { setConversa(falas); setAudio(a); setArquivo(arq); setBruto(conversaComoTexto(falas)); }} />
        {conversa ? (
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: space(2) }}>
            <Text style={[type.caption, { flex: 1 }]}>Trocou quem falou o quê?</Text>
            <Botao titulo="Inverter Eu / Técnico" secundario onPress={() => {
              const inv = inverterFalas(conversa); setConversa(inv); setBruto(conversaComoTexto(inv));
            }} />
          </View>
        ) : null}
        <Campo rotulo={conversa ? 'Conversa transcrita (pode ajustar)' : 'O que aconteceu'} value={bruto} onChangeText={setBruto} multiline
          placeholder="Escreva do seu jeito: fatos, OS, o que foi bem ou mal…" />
        <Marca texto="Adicionar contexto ou ressalvas" marcado={comContexto} onPress={() => setComContexto(v => !v)} />
        {comContexto ? <Campo rotulo="Contexto ou ressalvas" value={contexto} onChangeText={setContexto} multiline
          placeholder="Ex.: foque na OS 12; não citar a questão pessoal; ele já foi advertido antes…" /> : null}
        <Botao titulo={texto ? 'Gerar de novo' : 'Gerar feedback'} onPress={gerar} carregando={gerando}
          disabled={!bruto.trim()} secundario={!!texto} />
        {!dados.chaveGemini ? (
          <View style={{ gap: space(2) }}>
            <Text style={type.caption}>A IA precisa da sua chave do Gemini.</Text>
            <Botao titulo="Ir para o Perfil" secundario onPress={() => router.push('/perfil')} />
          </View>
        ) : null}
        <Erro texto={erro} />
        {texto ? (
          <>
            <Campo rotulo="Feedback (pode ajustar)" value={texto} onChangeText={setTexto} multiline />
            <Botao titulo="Salvar feedback" onPress={salvar} carregando={salvando} />
          </>
        ) : null}
      </ScrollView>
    </Tela>
  );
}
