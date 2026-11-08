// Tarefas: abas por situação; o círculo marca como feita; tocar no resto abre para editar, mover ou remover.
import { useEffect, useState } from 'react';
import { FlatList, Platform, Pressable, Text, View } from 'react-native';
import Ionicons from '@expo/vector-icons/Ionicons';
import { Abas, Botao, BotaoMais, Campo, Dialogo, Erro, Selo, Tela, confirmar, mensagem } from '../components/ui';
import { AvisoBateria } from '../components/AvisoBateria';
import { useEstado } from '../Estado';
import { CampoAntes, CampoData, CampoHora } from '../components/seletores';
import { adicionarTarefa, alternarFeita, diaIso, editarTarefa, mostrarDia, moverTarefa, removerTarefa, situacao, tarefasOrdenadas,
  type CamposTarefa, type Situacao } from '../lib/agenda';
import { tecnicosOrdenados } from '../lib/dados';
import { colors, fonte, radius, space, type } from '../theme';
import type { Prioridade, Tarefa } from '../types';

const SITUACOES: { valor: Situacao; titulo: string; um: string }[] = [
  { valor: 'pendente', titulo: 'Pendentes', um: 'Pendente' },
  { valor: 'andamento', titulo: 'Em andamento', um: 'Em andamento' },
  { valor: 'concluida', titulo: 'Concluídas', um: 'Concluída' },
];
const PRIO: Record<Prioridade, { titulo: string; cor: () => string }> = {
  alta: { titulo: 'Alta', cor: () => colors.danger },
  media: { titulo: 'Média', cor: () => colors.amarelo },
  baixa: { titulo: 'Baixa', cor: () => colors.sucesso },
};

export default function Tarefas() {
  const { dados, alterar } = useEstado();
  const [aberta, setAberta] = useState<Tarefa | 'nova' | null>(null);
  const [aba, setAba] = useState<Situacao>('pendente');
  const hoje = diaIso(new Date());
  const todas = tarefasOrdenadas(dados);
  const nomeDe = (id?: string) => dados.tecnicos.find(t => t.id === id)?.nome;

  return (
    <Tela titulo="Tarefas">
      <AvisoBateria />
      <View style={{ paddingHorizontal: space(4), paddingTop: space(2) }}>
        <Abas valor={aba} onChange={setAba}
          opcoes={SITUACOES.map(o => ({ valor: o.valor, titulo: `${o.titulo} (${todas.filter(t => situacao(t) === o.valor).length})` }))} />
      </View>
      <FlatList
        data={todas.filter(t => situacao(t) === aba)}
        keyExtractor={t => t.id}
        contentContainerStyle={{ padding: space(4), gap: space(2), paddingBottom: space(24) }}
        ListEmptyComponent={<Text style={[type.caption, { textAlign: 'center', marginTop: space(10) }]}>
          {aba === 'pendente' ? 'Nenhuma tarefa. Toque em + para criar.' : 'Nada aqui.'}</Text>}
        renderItem={({ item }) => {
          const p = PRIO[item.prioridade ?? 'media'];
          const resp = nomeDe(item.responsavelId);
          return (
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: space(1), paddingRight: space(4), borderRadius: radius.card,
              backgroundColor: colors.surface, borderWidth: 1, borderColor: colors.border, opacity: item.feita ? 0.6 : 1 }}>
              <Pressable onPress={() => alterar(d => alternarFeita(d, item.id))} accessibilityRole="checkbox" accessibilityState={{ checked: item.feita }}
                accessibilityLabel={`Feita: ${item.titulo}`} style={{ padding: space(4) }}>
                <Ionicons name={item.feita ? 'checkmark-circle' : item.andamento ? 'time-outline' : 'ellipse-outline'} size={24}
                  color={item.feita ? colors.sucesso : item.andamento ? colors.amarelo : colors.textMuted} />
              </Pressable>
              <Pressable onPress={() => setAberta(item)} accessibilityRole="button" style={{ flex: 1, paddingVertical: space(3), gap: 2 }}>
                <View style={{ flexDirection: 'row', alignItems: 'center', gap: space(2) }}>
                  <Text style={[type.body, { flex: 1, fontFamily: fonte.semi }, item.feita && { textDecorationLine: 'line-through' }]}
                    numberOfLines={1}>{item.titulo}</Text>
                  <Selo texto={p.titulo} cor={p.cor()} />
                </View>
                <Text style={[type.caption, !item.feita && item.dia < hoje && { color: colors.danger }]}>
                  {mostrarDia(item.dia)}{item.hora ? ` · ${item.hora}` : ''}{item.descricao ? ` · ${item.descricao}` : ''}
                </Text>
                {resp ? <Text style={type.caption} numberOfLines={1}>Responsável: {resp}</Text> : null}
              </Pressable>
            </View>
          );
        }}
      />
      <BotaoMais rotulo="Nova tarefa" onPress={() => setAberta('nova')} />
      <FormTarefa tarefa={aberta} onFechar={() => setAberta(null)}
        onSalvar={(c, s) => alterar(d => (aberta && aberta !== 'nova' ? moverTarefa(editarTarefa(d, aberta.id, c), aberta.id, s) : adicionarTarefa(d, c)))}
        onRemover={id => alterar(d => removerTarefa(d, id))} />
    </Tela>
  );
}

function FormTarefa({ tarefa, onFechar, onSalvar, onRemover }: {
  tarefa: Tarefa | 'nova' | null; onFechar: () => void;
  onSalvar: (c: CamposTarefa, s: Situacao) => void; onRemover: (id: string) => void;
}) {
  const { dados } = useEstado();
  const [titulo, setTitulo] = useState('');
  const [dia, setDia] = useState<string | undefined>();
  const [hora, setHora] = useState<string | undefined>();
  const [antes, setAntes] = useState(0);
  const [descricao, setDescricao] = useState('');
  const [prioridade, setPrioridade] = useState<Prioridade>('media');
  const [responsavelId, setResponsavelId] = useState('');
  const [sit, setSit] = useState<Situacao>('pendente');
  const [erro, setErro] = useState<string | null>(null);
  const t = tarefa === 'nova' ? undefined : tarefa ?? undefined;

  useEffect(() => {
    if (!tarefa) return;
    setTitulo(t?.titulo ?? ''); setDia(t?.dia ?? diaIso(new Date())); setHora(t?.hora); setAntes(t?.antes ?? 0); setDescricao(t?.descricao ?? ''); setErro(null);
    setPrioridade(t?.prioridade ?? 'media'); setResponsavelId(t?.responsavelId ?? ''); setSit(t ? situacao(t) : 'pendente');
  }, [tarefa]); // eslint-disable-line react-hooks/exhaustive-deps

  function salvar() {
    try {
      onSalvar({ titulo, dia: dia ?? '', hora: hora ?? '', antes, descricao, prioridade, responsavelId: responsavelId || undefined }, sit);
      onFechar();
    } catch (e) { setErro(mensagem(e)); }
  }

  async function remover() {
    if (t && await confirmar('Remover tarefa?', t.titulo, 'Remover')) { onRemover(t.id); onFechar(); }
  }

  // Inativos somem da escolha, a não ser que já sejam o responsável desta tarefa.
  const tecnicos = tecnicosOrdenados(dados).filter(x => !x.inativo || x.id === responsavelId);

  return (
    <Dialogo visivel={!!tarefa} titulo={t ? 'Editar tarefa' : 'Nova tarefa'} onFechar={onFechar}>
      <Campo rotulo="Título" value={titulo} onChangeText={setTitulo} autoFocus />
      <View style={{ flexDirection: 'row', gap: space(3) }}>
        <CampoData rotulo="Dia" valor={dia} onChange={setDia} />
        <CampoHora rotulo="Lembrete (opcional)" valor={hora} onChange={setHora} opcional />
      </View>
      {hora ? <>
        <View style={{ flexDirection: 'row' }}><CampoAntes rotulo="Avisar" valor={antes} onChange={setAntes} /></View>
        <Text style={type.caption}>Sem tocar em Feito no aviso, ele volta a cada 30 min (até 4 h).</Text>
      </> : null}
      <Campo rotulo="Descrição (opcional)" value={descricao} onChangeText={setDescricao} multiline />
      <Text style={type.caption}>Prioridade</Text>
      <Abas valor={prioridade} onChange={setPrioridade} opcoes={(['alta', 'media', 'baixa'] as const).map(v => ({ valor: v, titulo: PRIO[v].titulo }))} />
      {tecnicos.length ? <>
        <Text style={type.caption}>Responsável</Text>
        <Abas valor={responsavelId} onChange={setResponsavelId}
          opcoes={[{ valor: '', titulo: 'Ninguém' }, ...tecnicos.map(x => ({ valor: x.id, titulo: x.nome.split(' ')[0] }))]} />
      </> : null}
      {t ? <>
        <Text style={type.caption}>Situação</Text>
        <Abas valor={sit} onChange={setSit} opcoes={SITUACOES.map(o => ({ valor: o.valor, titulo: o.um }))} />
      </> : null}
      {Platform.OS === 'web' && hora ? <Text style={type.caption}>O aviso toca no celular.</Text> : null}
      <Erro texto={erro} />
      <View style={{ flexDirection: 'row', gap: space(3), justifyContent: 'flex-end' }}>
        {t ? <View style={{ marginRight: 'auto' }}><Botao titulo="Remover" secundario onPress={remover} /></View> : null}
        <Botao titulo="Cancelar" secundario onPress={onFechar} />
        <Botao titulo="Salvar" onPress={salvar} disabled={!titulo.trim()} />
      </View>
    </Dialogo>
  );
}
