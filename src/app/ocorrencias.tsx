// Ocorrências diárias: lista por dia (cards expansíveis) e Assistente de recorrência (assuntos e resumos pelo Gemini).
import { useEffect, useState } from 'react';
import { Pressable, ScrollView, Text, View } from 'react-native';
import Ionicons from '@expo/vector-icons/Ionicons';
import Svg, { Circle, Path } from 'react-native-svg';
import { Abas, Botao, BotaoMais, Campo, Dialogo, Erro, Marca, Selo, Tela, confirmar, mensagem, Vazio } from '../components/ui';
import { CampoData } from '../components/seletores';
import { Miniaturas, carregarFoto, escolherFoto } from '../components/Fotos';
import { useEstado } from '../Estado';
import { DIAS_SEMANA, diaIso, mostrarDia } from '../lib/agenda';
import { exportar, type Formato, type Fotos } from '../lib/exportar';
import { adicionarOcorrencia, definirResumo, definirTipo, deslocar, doTipo, editarOcorrencia, nomeMes, noPeriodo, ponderacao, porDia, removerOcorrencia, repetida,
  rotuloPeriodo, tiposExistentes, type CamposOcorrencia, type Periodo } from '../lib/ocorrencias';
import { classificarOcorrencia, resumirAssunto } from '../services/gemini';
import { colors, fonte, radius, space, type, cartao } from '../theme';
import type { Dados, Ocorrencia } from '../types';

const PERIODOS: { valor: Periodo; titulo: string }[] = [{ valor: 'dia', titulo: 'Dia' }, { valor: 'semana', titulo: 'Semana' }, { valor: 'mes', titulo: 'Mês' }];
const CORES = ['#2457E7', '#F5C842', '#19A58B', '#E5675B', '#8B5CF6', '#E5A04B', '#06B6D4', '#EC4899', '#84CC16', '#8FA3B8'];
const corDo = (tipos: string[], t: string) => (t === 'Sem tipo' ? colors.textMuted : CORES[tipos.indexOf(t) % CORES.length]);
const diaSemana = (iso: string) => DIAS_SEMANA[new Date(`${iso}T12:00`).getDay()];

export default function Ocorrencias() {
  const { dados, alterar } = useEstado();
  const hoje = diaIso(new Date());
  const [aba, setAba] = useState<'lista' | 'peso'>('lista');
  const [periodo, setPeriodo] = useState<Periodo>('mes');
  const [ref, setRef] = useState(hoje);
  const [aberta, setAberta] = useState<Ocorrencia | null>(null);
  const [editando, setEditando] = useState<Ocorrencia | 'nova' | null>(null);
  const [aviso, setAviso] = useState<string | null>(null);
  const [ocupado, setOcupado] = useState(false);
  const [ajuda, setAjuda] = useState(false);
  const [resumindo, setResumindo] = useState<string | null>(null);

  const todas = dados.ocorrencias ?? [];
  const p = aba === 'peso' ? 'mes' : periodo;
  const doPeriodo = noPeriodo(dados, p, ref);
  const contar = (per: Periodo) => noPeriodo(dados, per, hoje).length;

  useEffect(() => { if (!aviso) return; const t = setTimeout(() => setAviso(null), 6000); return () => clearTimeout(t); }, [aviso]);

  /** Classifica em sequência (cada assunto novo já vale para a próxima) e depois refaz o resumo de cada assunto tocado. */
  async function classificar(os: Ocorrencia[], base: Dados) {
    if (!dados.chaveGemini) { setAviso('Sem chave do Gemini no Perfil: a ocorrência ficou sem assunto.'); return; }
    let d = base;
    const tocados = new Set<string>();
    for (const o of os) {
      try {
        const tipo = await classificarOcorrencia(dados.chaveGemini, o, tiposExistentes(d, o.id));
        const iguais = (d.ocorrencias ?? []).filter(x => x.tipo === tipo && x.id !== o.id).length;
        d = definirTipo(d, o.id, tipo);
        alterar(x => definirTipo(x, o.id, tipo));
        tocados.add(tipo);
        setAviso(iguais ? `Parecida com ${iguais} ocorrência(s) de “${tipo}”.` : `Assunto novo: ${tipo}.`);
      } catch (e) { setAviso(`Não deu para classificar: ${mensagem(e)}`); break; }
    }
    for (const t of tocados) await resumir(t, d);
  }

  // ponytail: remover ocorrência não refaz o resumo; ele se corrige na próxima do mesmo assunto (ou em "Atualizar agora").
  async function resumir(tipo: string, d: Dados) {
    if (!dados.chaveGemini) return;
    setResumindo(tipo);
    try { const r = await resumirAssunto(dados.chaveGemini, tipo, doTipo(d, tipo)); alterar(x => definirResumo(x, tipo, r)); }
    catch (e) { setAviso(`O resumo de “${tipo}” não atualizou: ${mensagem(e)}`); }
    finally { setResumindo(null); }
  }

  function salvar(c: CamposOcorrencia) {
    const antiga = editando !== 'nova' ? editando : null;
    let d: Dados, o: Ocorrencia;
    if (antiga) { d = editarOcorrencia(dados, antiga.id, c); o = d.ocorrencias!.find(x => x.id === antiga.id)!; }
    else ({ dados: d, nova: o } = adicionarOcorrencia(dados, c));
    alterar(() => d);
    const mudou = !antiga || !antiga.tipo || antiga.titulo !== o.titulo || antiga.descricao !== o.descricao || antiga.observacao !== o.observacao;
    if (mudou) classificar([o], d);
  }

  async function exportarComo(f: Formato) {
    if (!doPeriodo.length) { setAviso('Nada para exportar neste período.'); return; }
    setOcupado(true);
    try {
      const fotos: Fotos = {};
      if (f !== 'excel') for (const id of doPeriodo.flatMap(o => o.fotos ?? [])) fotos[id] = await carregarFoto(id).catch(() => undefined as never);
      await exportar(f, `Ocorrências ${rotuloPeriodo(p, ref)}`, doPeriodo, fotos);
    } catch (e) { setAviso(mensagem(e)); }
    finally { setOcupado(false); }
  }

  const semTipo = todas.filter(o => !o.tipo);

  return (
    <Tela titulo="Ocorrências" menu={[
      { titulo: 'Exportar Word', onPress: () => exportarComo('word') },
      { titulo: 'Exportar Excel', onPress: () => exportarComo('excel') },
      { titulo: 'Exportar PDF', onPress: () => exportarComo('pdf') },
    ]}>
      <View style={{ paddingHorizontal: space(4), paddingTop: space(2), gap: space(3) }}>
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: space(2) }}>
          <View style={{ flex: 1 }}>
            <Abas valor={aba} onChange={setAba} opcoes={[{ valor: 'lista', titulo: 'Lista' }, { valor: 'peso', titulo: 'Assistente de recorrência' }]} />
          </View>
          <Pressable onPress={() => setAjuda(true)} accessibilityRole="button" accessibilityLabel="Como funciona" hitSlop={8} style={{ padding: space(1) }}>
            <Ionicons name="help-circle-outline" size={24} color={colors.textMuted} />
          </Pressable>
        </View>
        {aba === 'lista' ? <Abas valor={periodo} onChange={setPeriodo} opcoes={PERIODOS} /> : null}
        <View style={{ flexDirection: 'row', alignItems: 'center' }}>
          <Seta nome="chevron-back" rotulo="Período anterior" onPress={() => setRef(deslocar(p, ref, -1))} />
          <Pressable onPress={() => setRef(hoje)} accessibilityRole="button" accessibilityLabel="Voltar para hoje" style={{ flex: 1, alignItems: 'center' }}>
            <Text style={[type.body, { fontFamily: fonte.semi }]}>{rotuloPeriodo(p, ref)}</Text>
            <Text style={type.caption}>{doPeriodo.length} no período · hoje {contar('dia')} · mês {contar('mes')}</Text>
          </Pressable>
          <Seta nome="chevron-forward" rotulo="Próximo período" onPress={() => setRef(deslocar(p, ref, 1))} />
        </View>
        {aviso ? <Text style={[type.caption, { color: colors.accent, textAlign: 'center' }]}>{aviso}</Text> : null}
        {ocupado ? <Text style={[type.caption, { textAlign: 'center' }]}>Preparando o arquivo…</Text> : null}
      </View>

      <ScrollView contentContainerStyle={{ padding: space(4), gap: space(3), paddingBottom: space(24) }}>
        {aba === 'lista' ? (
          doPeriodo.length ? porDia(doPeriodo).map(g => (
            <View key={g.dia} style={{ gap: space(2) }}>
              <Text style={[type.caption, { fontFamily: fonte.semi }]}>{diaSemana(g.dia)}, {mostrarDia(g.dia)} · {g.itens.length}</Text>
              {g.itens.map(o => <Card key={o.id} o={o} onAbrir={() => setAberta(o)} />)}
            </View>
          )) : <Vazio icone="alert-circle-outline" titulo="Nenhuma ocorrência" dica="Toque em + para registrar." />
        ) : (
          <Recorrencia dados={dados} refIso={ref} semTipo={semTipo.length} resumindo={resumindo} onAbrir={setAberta}
            onClassificar={dados.chaveGemini && semTipo.length ? () => classificar(semTipo, dados) : undefined}
            onResumir={dados.chaveGemini ? t => resumir(t, dados) : undefined} />
        )}
      </ScrollView>

      <BotaoMais rotulo="Nova ocorrência" onPress={() => setEditando('nova')} />
      <Dialogo visivel={ajuda} titulo="Como funciona" onFechar={() => setAjuda(false)}>
        {AJUDA.map(([t, d]) => (
          <View key={t} style={{ gap: 2 }}>
            <Text style={[type.body, { fontFamily: fonte.semi }]}>{t}</Text>
            <Text style={type.caption}>{d}</Text>
          </View>
        ))}
        <View style={{ alignItems: 'flex-end' }}><Botao titulo="Entendi" onPress={() => setAjuda(false)} /></View>
      </Dialogo>
      <Ver o={aberta} onFechar={() => setAberta(null)} onEditar={() => { setEditando(aberta); setAberta(null); }}
        onRemover={async () => { if (aberta && await confirmar('Remover ocorrência?', aberta.titulo, 'Remover')) { alterar(d => removerOcorrencia(d, aberta.id)); setAberta(null); } }} />
      <Form o={editando} diaInicial={periodo === 'dia' ? ref : hoje} onFechar={() => setEditando(null)} onSalvar={salvar} />
    </Tela>
  );
}

const AJUDA: [string, string][] = [
  ['1. Você registra', 'Cada ocorrência tem dia, título, descrição, observação e fotos. Pode ser de qualquer área da empresa.'],
  ['2. A IA dá um assunto', 'Ao salvar, o Gemini lê o texto e coloca a ocorrência num assunto que já existe, se for o mesmo problema de fundo, ou cria um assunto novo.'],
  ['3. A IA resume o assunto', 'Logo depois, ela relê todas as ocorrências daquele assunto e reescreve o resumo: o que se repete, se está aumentando e uma sugestão. Sozinha, sem você abrir nada.'],
  ['4. Assistente de recorrência', 'A pizza mostra os assuntos do mês. Toque numa fatia ou num assunto para ver o resumo, a contagem dos últimos 4 meses e as ocorrências dele.'],
  ['Repetidas e isoladas', 'Repetidas aconteceram 2 vezes ou mais nos últimos 4 meses: são as que merecem atenção. A seta mostra se o mês subiu ou caiu em relação ao anterior.'],
  ['Sem chave do Gemini?', 'As ocorrências ficam sem assunto. Coloque a chave no Perfil e toque em "Classificar" aqui.'],
];

const Seta = ({ nome, rotulo, onPress }: { nome: 'chevron-back' | 'chevron-forward'; rotulo: string; onPress: () => void }) => (
  <Pressable onPress={onPress} accessibilityRole="button" accessibilityLabel={rotulo} hitSlop={8} style={{ padding: space(2) }}>
    <Ionicons name={nome} size={22} color={colors.text} />
  </Pressable>
);

/** Card expansível: a seta mostra os detalhes; tocar no resto abre a ocorrência. */
function Card({ o, onAbrir }: { o: Ocorrencia; onAbrir: () => void }) {
  const [aberto, setAberto] = useState(false);
  const temMais = !!(o.descricao || o.observacao || o.fotos?.length);
  return (
    <View style={{ ...cartao() }}>
      <View style={{ flexDirection: 'row', alignItems: 'center' }}>
        <Pressable onPress={onAbrir} accessibilityRole="button" accessibilityLabel={`Abrir ${o.titulo}`} style={{ flex: 1, padding: space(4), gap: 4 }}>
          <Text style={[type.body, { fontFamily: fonte.semi }]} numberOfLines={aberto ? undefined : 1}>{o.titulo}</Text>
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: space(2), flexWrap: 'wrap' }}>
            <Text style={type.caption}>{mostrarDia(o.dia)}</Text>
            <Selo texto={o.tipo ?? 'Sem tipo'} cor={o.tipo ? colors.accent : colors.textMuted} />
            {o.fotos?.length ? <Text style={type.caption}><Ionicons name="image-outline" size={12} /> {o.fotos.length}</Text> : null}
          </View>
        </Pressable>
        {temMais ? (
          <Pressable onPress={() => setAberto(!aberto)} accessibilityRole="button" accessibilityLabel={aberto ? 'Recolher' : 'Expandir'}
            accessibilityState={{ expanded: aberto }} style={{ padding: space(4) }}>
            <Ionicons name={aberto ? 'chevron-up' : 'chevron-down'} size={20} color={colors.textMuted} />
          </Pressable>
        ) : null}
      </View>
      {aberto ? <View style={{ paddingHorizontal: space(4), paddingBottom: space(4), gap: space(2) }}><Detalhes o={o} /></View> : null}
    </View>
  );
}

const Detalhes = ({ o }: { o: Ocorrencia }) => (
  <>
    {o.descricao ? <Text style={type.body}>{o.descricao}</Text> : null}
    {o.observacao ? <Text style={type.body}><Text style={{ fontFamily: fonte.semi }}>Observação: </Text>{o.observacao}</Text> : null}
    <Miniaturas ids={o.fotos ?? []} />
  </>
);

function Ver({ o, onFechar, onEditar, onRemover }: { o: Ocorrencia | null; onFechar: () => void; onEditar: () => void; onRemover: () => void }) {
  return (
    <Dialogo visivel={!!o} titulo={o?.titulo ?? ''} onFechar={onFechar}>
      {o ? <>
        <View style={{ flexDirection: 'row', gap: space(2), alignItems: 'center' }}>
          <Text style={type.caption}>{diaSemana(o.dia)}, {mostrarDia(o.dia)}</Text>
          <Selo texto={o.tipo ?? 'Sem tipo'} cor={o.tipo ? colors.accent : colors.textMuted} />
        </View>
        <Detalhes o={o} />
        <View style={{ flexDirection: 'row', gap: space(3), justifyContent: 'flex-end' }}>
          <View style={{ marginRight: 'auto' }}><Botao titulo="Remover" secundario onPress={onRemover} /></View>
          <Botao titulo="Fechar" secundario onPress={onFechar} />
          <Botao titulo="Editar" onPress={onEditar} />
        </View>
      </> : null}
    </Dialogo>
  );
}

function Form({ o, diaInicial, onFechar, onSalvar }: { o: Ocorrencia | 'nova' | null; diaInicial: string; onFechar: () => void; onSalvar: (c: CamposOcorrencia) => void }) {
  const [dia, setDia] = useState<string | undefined>();
  const [titulo, setTitulo] = useState('');
  const [descricao, setDescricao] = useState('');
  const [comObs, setComObs] = useState(false);
  const [observacao, setObservacao] = useState('');
  const [fotos, setFotos] = useState<string[]>([]);
  const [enviando, setEnviando] = useState(false);
  const [erro, setErro] = useState<string | null>(null);
  const x = o === 'nova' ? undefined : o ?? undefined;

  useEffect(() => {
    if (!o) return;
    setDia(x?.dia ?? diaInicial); setTitulo(x?.titulo ?? ''); setDescricao(x?.descricao ?? '');
    setComObs(!!x?.observacao); setObservacao(x?.observacao ?? ''); setFotos(x?.fotos ?? []); setErro(null);
  }, [o]); // eslint-disable-line react-hooks/exhaustive-deps

  async function anexar(origem: 'camera' | 'galeria') {
    setEnviando(true); setErro(null);
    // ponytail: a foto sobe na hora; se cancelar o formulário ela fica no Drive sem uso.
    try { const id = await escolherFoto(origem); if (id) setFotos(f => [...f, id]); }
    catch (e) { setErro(mensagem(e)); }
    finally { setEnviando(false); }
  }

  function salvar() {
    try { onSalvar({ dia: dia ?? '', titulo, descricao, observacao: comObs ? observacao : undefined, fotos }); onFechar(); }
    catch (e) { setErro(mensagem(e)); }
  }

  return (
    <Dialogo visivel={!!o} titulo={x ? 'Editar ocorrência' : 'Nova ocorrência'} onFechar={onFechar}>
      <View style={{ flexDirection: 'row' }}><CampoData rotulo="Dia" valor={dia} onChange={setDia} /></View>
      <Campo rotulo="Título" value={titulo} onChangeText={setTitulo} autoFocus={!x} />
      <Campo rotulo="Descrição (opcional)" value={descricao} onChangeText={setDescricao} multiline />
      <Marca texto="Observação" marcado={comObs} onPress={() => setComObs(!comObs)} />
      {comObs ? <Campo rotulo="Observação" value={observacao} onChangeText={setObservacao} multiline /> : null}
      <Text style={type.caption}>Fotos</Text>
      <Miniaturas ids={fotos} onRemover={id => setFotos(f => f.filter(y => y !== id))} />
      <View style={{ flexDirection: 'row', gap: space(3) }}>
        <View style={{ flex: 1 }}><Botao titulo="Câmera" secundario carregando={enviando} onPress={() => anexar('camera')}
          icone={<Ionicons name="camera-outline" size={18} color={colors.text} />} /></View>
        <View style={{ flex: 1 }}><Botao titulo="Galeria" secundario disabled={enviando} onPress={() => anexar('galeria')}
          icone={<Ionicons name="images-outline" size={18} color={colors.text} />} /></View>
      </View>
      <Erro texto={erro} />
      <View style={{ flexDirection: 'row', gap: space(3), justifyContent: 'flex-end' }}>
        <Botao titulo="Cancelar" secundario onPress={onFechar} />
        <Botao titulo="Salvar" onPress={salvar} disabled={!titulo.trim() || enviando} />
      </View>
    </Dialogo>
  );
}

/** Pizza (rosca) dos assuntos do mês; tocar numa fatia ou linha abre o resumo e as ocorrências do assunto. */
function Recorrencia({ dados, refIso, semTipo, resumindo, onAbrir, onClassificar, onResumir }: {
  dados: Dados; refIso: string; semTipo: number; resumindo: string | null; onAbrir: (o: Ocorrencia) => void;
  onClassificar?: () => void; onResumir?: (tipo: string) => void;
}) {
  const [sel, setSel] = useState<string | null>(null);
  const pesos = ponderacao(dados, refIso);
  const tipos = pesos.map(x => x.tipo).filter(t => t !== 'Sem tipo').sort();
  const doMes = pesos.filter(x => x.meses[0]);
  const total = doMes.reduce((a, x) => a + x.meses[0], 0);
  const meses = [0, 1, 2, 3].map(i => nomeMes(deslocar('mes', refIso, -i)).split(' ')[0].slice(0, 3));
  const escolhido = pesos.find(x => x.tipo === sel);
  const alternar = (t: string) => setSel(s => (s === t ? null : t));

  let ang = -Math.PI / 2;
  const fatias = doMes.map(x => {
    const a = (x.meses[0] / total) * Math.PI * 2, ini = ang;
    ang += a;
    const ponto = (t: number) => `${100 + 90 * Math.cos(t)} ${100 + 90 * Math.sin(t)}`;
    return { tipo: x.tipo, d: `M100 100 L${ponto(ini)} A90 90 0 ${a > Math.PI ? 1 : 0} 1 ${ponto(ini + a)} Z` };
  });
  const opaco = (t: string) => (sel && sel !== t ? 0.25 : 1);

  const Linha = ({ x }: { x: (typeof pesos)[number] }) => {
    const seta = x.meses[0] > x.meses[1] ? 'arrow-up' : x.meses[0] < x.meses[1] ? 'arrow-down' : 'remove';
    const ativo = sel === x.tipo;
    return (
      <Pressable onPress={() => alternar(x.tipo)} accessibilityRole="button" accessibilityState={{ expanded: ativo }}
        style={{ flexDirection: 'row', alignItems: 'center', gap: space(3), padding: space(3), borderRadius: radius.input,
          backgroundColor: colors.surface, borderWidth: 1, borderColor: ativo ? corDo(tipos, x.tipo) : colors.border }}>
        <View style={{ width: 12, height: 12, borderRadius: 6, backgroundColor: corDo(tipos, x.tipo) }} />
        <View style={{ flex: 1, gap: 2 }}>
          <Text style={[type.body, { fontFamily: fonte.semi }]}>{x.tipo}</Text>
          <Text style={type.caption}>{x.meses.map((n, i) => `${meses[i]} ${n}`).join(' · ')}</Text>
        </View>
        <Text style={[type.title, { fontSize: 20 }]}>{x.meses[0]}</Text>
        <Ionicons name={seta} size={16} color={seta === 'arrow-up' ? colors.danger : seta === 'arrow-down' ? colors.sucesso : colors.textMuted}
          accessibilityLabel={seta === 'arrow-up' ? 'Subiu' : seta === 'arrow-down' ? 'Caiu' : 'Igual'} />
        <Ionicons name={ativo ? 'chevron-up' : 'chevron-down'} size={18} color={colors.textMuted} />
      </Pressable>
    );
  };

  const Detalhe = ({ tipo }: { tipo: string }) => {
    const os = doTipo(dados, tipo);
    const resumo = dados.resumos?.[tipo];
    return (
      <View style={{ gap: space(3), padding: space(4), borderRadius: radius.input, backgroundColor: colors.surface,
        borderWidth: 1, borderColor: corDo(tipos, tipo) }}>
        {tipo === 'Sem tipo' ? (
          <Text style={type.caption}>Ainda sem assunto. {onClassificar ? 'Toque em "Classificar" acima.' : 'Coloque a chave do Gemini no Perfil.'}</Text>
        ) : (
          <View style={{ gap: space(1) }}>
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: space(2) }}>
              <Ionicons name="sparkles-outline" size={16} color={colors.accent} />
              <Text style={[type.caption, { fontFamily: fonte.semi, color: colors.text }]}>Resumo da IA</Text>
            </View>
            <Text style={[type.body, { lineHeight: 22 }]}>
              {resumindo === tipo ? 'Atualizando o resumo…' : resumo ?? 'Ainda sem resumo. Ele aparece sozinho na próxima ocorrência deste assunto.'}
            </Text>
            {onResumir && resumindo !== tipo ? (
              <Pressable onPress={() => onResumir(tipo)} accessibilityRole="button" style={{ alignSelf: 'flex-start', paddingVertical: space(1) }}>
                <Text style={[type.caption, { color: colors.accent, fontFamily: fonte.semi }]}>{resumo ? 'Atualizar agora' : 'Gerar resumo agora'}</Text>
              </Pressable>
            ) : null}
          </View>
        )}
        <Text style={[type.caption, { fontFamily: fonte.semi }]}>Ocorrências · {os.length}</Text>
        {os.slice(0, 20).map(o => (
          <Pressable key={o.id} onPress={() => onAbrir(o)} accessibilityRole="button" style={{ flexDirection: 'row', gap: space(3), alignItems: 'center' }}>
            <Text style={[type.caption, { width: 44 }]}>{mostrarDia(o.dia).slice(0, 5)}</Text>
            <Text style={[type.body, { flex: 1 }]} numberOfLines={1}>{o.titulo}</Text>
            <Ionicons name="chevron-forward" size={16} color={colors.textMuted} />
          </Pressable>
        ))}
        {os.length > 20 ? <Text style={type.caption}>Mais {os.length - 20} antigas na Lista.</Text> : null}
      </View>
    );
  };

  const Grupo = ({ titulo, itens }: { titulo: string; itens: typeof pesos }) => (itens.length ? (
    <>
      <Text style={[type.caption, { fontFamily: fonte.semi }]}>{titulo}</Text>
      {itens.map(x => <View key={x.tipo} style={{ gap: space(2) }}><Linha x={x} />{sel === x.tipo ? <Detalhe tipo={x.tipo} /> : null}</View>)}
    </>
  ) : null);

  return (
    <View style={{ gap: space(3) }}>
      {total ? (
        <View style={{ alignItems: 'center', gap: space(1) }}>
          <View>
            <Svg width={220} height={220} viewBox="0 0 200 200" accessibilityLabel={`Gráfico de ${total} ocorrências por assunto`}>
              {fatias.length === 1 ? <Circle cx={100} cy={100} r={90} fill={corDo(tipos, fatias[0].tipo)} onPress={() => alternar(fatias[0].tipo)} />
                : fatias.map(f => <Path key={f.tipo} d={f.d} fill={corDo(tipos, f.tipo)} opacity={opaco(f.tipo)} stroke={colors.bg} strokeWidth={2}
                  onPress={() => alternar(f.tipo)} />)}
              <Circle cx={100} cy={100} r={52} fill={colors.bg} onPress={() => setSel(null)} />
            </Svg>
            <View pointerEvents="none" style={{ position: 'absolute', top: 0, left: 0, right: 0, bottom: 0, alignItems: 'center', justifyContent: 'center' }}>
              <Text style={[type.title, { fontSize: 28 }]}>{escolhido ? escolhido.meses[0] : total}</Text>
              <Text style={[type.caption, { textAlign: 'center', maxWidth: 100 }]} numberOfLines={2}>{escolhido ? escolhido.tipo : 'no mês'}</Text>
            </View>
          </View>
          <Text style={type.caption}>Toque numa fatia ou num assunto para ver o resumo.</Text>
        </View>
      ) : <Text style={[type.caption, { textAlign: 'center' }]}>Nenhuma ocorrência neste mês.</Text>}
      {semTipo && onClassificar ? <Botao titulo={`Classificar ${semTipo} sem assunto`} secundario onPress={onClassificar} /> : null}
      <Grupo titulo="Repetidas (2+ vezes, merecem atenção)" itens={pesos.filter(repetida)} />
      <Grupo titulo="Isoladas" itens={pesos.filter(x => !repetida(x))} />
    </View>
  );
}
