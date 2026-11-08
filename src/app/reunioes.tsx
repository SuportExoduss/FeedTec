// Reuniões (☰): únicas (com data) ou recorrentes (toda semana), cada uma com suas pautas. Aviso quanto antes o gestor escolher (padrão 15 min).
// No dia, tocar na reunião abre as pautas para marcar e a devolutiva; ao registrar, tudo vai para Realizadas.
import { useEffect, useState } from 'react';
import { FlatList, Pressable, Text, View } from 'react-native';
import Ionicons from '@expo/vector-icons/Ionicons';
import { Abas, Botao, BotaoMais, Campo, Dialogo, Erro, Marca, Tela, confirmar, mensagem } from '../components/ui';
import { CampoAntes, CampoData, CampoHora } from '../components/seletores';
import { AvisoBateria } from '../components/AvisoBateria';
import { useEstado } from '../Estado';
import {
  AVISO_REUNIAO, DIAS_SEMANA, adicionarReuniao, diaIso, editarReuniao, mostrarDia, proximaReuniao, realizadasOrdenadas,
  registrarReuniao, removerRealizada, removerReuniao, reuniaoDeHoje, reunioesOrdenadas, type CamposReuniao,
} from '../lib/agenda';
import { novoId } from '../lib/dados';
import { colors, radius, space, type } from '../theme';
import type { Pauta, Realizada, Reuniao } from '../types';

const cartao = ({ pressed }: { pressed: boolean }) => ({ gap: 2, padding: space(4), borderRadius: radius.card, backgroundColor: colors.surface, borderWidth: 1, borderColor: colors.border, opacity: pressed ? 0.7 : 1 });
const qtd = (n: number) => (n === 1 ? '1 pauta' : `${n} pautas`);

export default function Reunioes() {
  const { dados, alterar } = useEstado();
  const [aba, setAba] = useState<'agendadas' | 'realizadas'>('agendadas');
  const [editar, setEditar] = useState<Reuniao | 'nova' | null>(null);
  const [doDia, setDoDia] = useState<Reuniao | null>(null);
  const [vista, setVista] = useState<Realizada | null>(null);
  const hoje = diaIso(new Date());

  const topo = (
    <Abas valor={aba} onChange={setAba} opcoes={[{ valor: 'agendadas', titulo: `Agendadas (${(dados.reunioes ?? []).length})` }, { valor: 'realizadas', titulo: `Realizadas (${(dados.realizadas ?? []).length})` }]} />
  );
  const lista = { contentContainerStyle: { padding: space(4), gap: space(2), paddingBottom: space(24) }, ListHeaderComponent: topo };

  return (
    <Tela titulo="Reuniões">
      <AvisoBateria />
      {aba === 'agendadas' ? (
        <FlatList {...lista}
          data={reunioesOrdenadas(dados)}
          keyExtractor={r => r.id}
          ListEmptyComponent={<Text style={[type.caption, { textAlign: 'center', marginTop: space(10) }]}>Nenhuma reunião. Toque em + para criar.</Text>}
          renderItem={({ item }) => {
            const agora = reuniaoDeHoje(dados, item);
            const passou = !!item.dia && item.dia < hoje;
            return (
              <Pressable onPress={() => (agora ? setDoDia(item) : setEditar(item))} accessibilityRole="button" style={cartao}>
                <View style={{ flexDirection: 'row', alignItems: 'center', gap: space(2) }}>
                  <Text style={[type.body, { flex: 1 }]} numberOfLines={1}>{item.titulo}</Text>
                  {agora ? <Text style={{ color: colors.accentText, backgroundColor: colors.accent, fontSize: 12, fontWeight: '700', paddingHorizontal: space(2), paddingVertical: 2, borderRadius: 999 }}>HOJE</Text> : null}
                </View>
                <Text style={[type.caption, passou && { color: colors.danger }]}>
                  {item.dia ? `${mostrarDia(item.dia)} · ${item.hora}` : `Toda ${DIAS_SEMANA[item.diaSemana].toLowerCase()} · ${item.hora} · próxima ${mostrarDia(diaIso(proximaReuniao(item))).slice(0, 5)}`}
                  {` · ${qtd(item.pautas.length)}`}
                </Text>
              </Pressable>
            );
          }}
        />
      ) : (
        <FlatList {...lista}
          data={realizadasOrdenadas(dados)}
          keyExtractor={r => r.id}
          ListEmptyComponent={<Text style={[type.caption, { textAlign: 'center', marginTop: space(10) }]}>Nenhuma reunião registrada ainda.</Text>}
          renderItem={({ item }) => (
            <Pressable onPress={() => setVista(item)} accessibilityRole="button" style={cartao}>
              <Text style={type.body} numberOfLines={1}>{item.titulo}</Text>
              <Text style={type.caption}>
                {mostrarDia(item.dia)} · {item.hora} · {item.pautas.filter(p => p.tratada).length} de {qtd(item.pautas.length)} tratadas
              </Text>
            </Pressable>
          )}
        />
      )}
      {aba === 'agendadas' ? <BotaoMais rotulo="Nova reunião" onPress={() => setEditar('nova')} /> : null}
      <FormReuniao reuniao={editar} onFechar={() => setEditar(null)}
        onSalvar={c => alterar(d => (editar && editar !== 'nova' ? editarReuniao(d, editar.id, c) : adicionarReuniao(d, c)))}
        onRemover={id => alterar(d => removerReuniao(d, id))} />
      <ReuniaoDoDia reuniao={doDia} onFechar={() => setDoDia(null)} onEditar={r => { setDoDia(null); setEditar(r); }}
        onRegistrar={(id, tratadas, devolutiva) => alterar(d => registrarReuniao(d, id, tratadas, devolutiva))} />
      <VerRealizada realizada={vista} onFechar={() => setVista(null)} onRemover={id => alterar(d => removerRealizada(d, id))} />
    </Tela>
  );
}

function FormReuniao({ reuniao, onFechar, onSalvar, onRemover }: {
  reuniao: Reuniao | 'nova' | null; onFechar: () => void; onSalvar: (c: CamposReuniao) => void; onRemover: (id: string) => void;
}) {
  const [titulo, setTitulo] = useState('');
  const [recorrente, setRecorrente] = useState(false);
  const [diaSemana, setDiaSemana] = useState(1);
  const [dia, setDia] = useState<string | undefined>();
  const [hora, setHora] = useState<string | undefined>();
  const [antes, setAntes] = useState(AVISO_REUNIAO);
  const [pautas, setPautas] = useState<Pauta[]>([]);
  const [pauta, setPauta] = useState<Pauta | null>(null); // pauta sendo escrita (nova ou editando)
  const [erro, setErro] = useState<string | null>(null);
  const r = reuniao === 'nova' ? undefined : reuniao ?? undefined;

  useEffect(() => {
    if (!reuniao) return;
    setTitulo(r?.titulo ?? ''); setRecorrente(!!r && !r.dia); setDiaSemana(r?.diaSemana ?? 1);
    setDia(r?.dia ?? diaIso(new Date())); setHora(r?.hora); setAntes(r?.antes ?? AVISO_REUNIAO); setPautas(r?.pautas ?? []); setPauta(null); setErro(null);
  }, [reuniao]); // eslint-disable-line react-hooks/exhaustive-deps

  function guardarPauta() {
    if (!pauta?.titulo.trim()) return setErro('Dê um título à pauta.');
    setPautas(ps => (ps.some(p => p.id === pauta.id) ? ps.map(p => (p.id === pauta.id ? pauta : p)) : [...ps, pauta]));
    setPauta(null); setErro(null);
  }

  function salvar() {
    try {
      if (pauta) throw new Error('Termine a pauta aberta (Guardar pauta) antes de salvar.');
      onSalvar({ titulo, diaSemana, dia: recorrente ? undefined : dia, hora: hora ?? '', antes, pautas });
      onFechar();
    } catch (e) { setErro(mensagem(e)); }
  }

  async function remover() {
    if (r && await confirmar('Remover reunião?', r.titulo, 'Remover')) { onRemover(r.id); onFechar(); }
  }

  return (
    <Dialogo visivel={!!reuniao} titulo={r ? 'Editar reunião' : 'Nova reunião'} onFechar={onFechar}>
      <Campo rotulo="Título da reunião" value={titulo} onChangeText={setTitulo} autoFocus={!r} />
      <Marca texto="Recorrente (toda semana)" marcado={recorrente} onPress={() => setRecorrente(v => !v)} />
      {recorrente ? (
        <View accessibilityRole="radiogroup" accessibilityLabel="Dia da semana" style={{ flexDirection: 'row', gap: space(1) }}>
          {DIAS_SEMANA.map((nome, i) => (
            <Pressable key={nome} onPress={() => setDiaSemana(i)} accessibilityRole="radio" accessibilityLabel={nome} accessibilityState={{ selected: diaSemana === i }}
              style={{ flex: 1, minHeight: 44, alignItems: 'center', justifyContent: 'center', borderRadius: radius.input, borderWidth: 1,
                borderColor: diaSemana === i ? colors.accent : colors.border, backgroundColor: diaSemana === i ? colors.accent : 'transparent' }}>
              <Text style={{ fontWeight: '600', fontSize: 13, color: diaSemana === i ? colors.accentText : colors.text }}>{nome.slice(0, 3)}</Text>
            </Pressable>
          ))}
        </View>
      ) : null}
      <View style={{ flexDirection: 'row', gap: space(3) }}>
        {recorrente ? null : <CampoData rotulo="Data" valor={dia} onChange={setDia} />}
        <CampoHora rotulo="Hora" valor={hora} onChange={setHora} />
      </View>

      <Text style={[type.body, { fontWeight: '600', marginTop: space(2) }]}>Pautas</Text>
      {pautas.map(p => (
        <View key={p.id} style={{ flexDirection: 'row', gap: space(2), padding: space(3), borderRadius: radius.input, borderWidth: 1, borderColor: pauta?.id === p.id ? colors.accent : colors.border }}>
          <Pressable onPress={() => setPauta(p)} accessibilityRole="button" accessibilityLabel={`Editar pauta ${p.titulo}`} style={{ flex: 1, gap: 2 }}>
            <Text style={type.body}>{p.titulo}</Text>
            {p.descricao ? <Text style={type.caption} numberOfLines={2}>{p.descricao}</Text> : null}
          </Pressable>
          <Pressable onPress={() => { setPautas(ps => ps.filter(x => x.id !== p.id)); if (pauta?.id === p.id) setPauta(null); }}
            accessibilityRole="button" accessibilityLabel={`Remover pauta ${p.titulo}`} hitSlop={8}>
            <Ionicons name="close" size={20} color={colors.textMuted} />
          </Pressable>
        </View>
      ))}
      {pauta ? (
        <View style={{ gap: space(3), padding: space(3), borderRadius: radius.input, backgroundColor: colors.bg }}>
          <Campo rotulo="Título da pauta" value={pauta.titulo} onChangeText={titulo => setPauta({ ...pauta, titulo })} autoFocus />
          <Campo rotulo="Descrição (pode quebrar linhas)" value={pauta.descricao ?? ''} onChangeText={descricao => setPauta({ ...pauta, descricao })} multiline />
          <View style={{ flexDirection: 'row', gap: space(3), justifyContent: 'flex-end' }}>
            <Botao titulo="Cancelar" secundario onPress={() => setPauta(null)} />
            <Botao titulo="Guardar pauta" onPress={guardarPauta} disabled={!pauta.titulo.trim()} />
          </View>
        </View>
      ) : (
        <Botao titulo="Adicionar pauta" secundario icone={<Ionicons name="add" size={20} color={colors.text} />}
          onPress={() => setPauta({ id: novoId(), titulo: '' })} />
      )}

      <View style={{ flexDirection: 'row' }}><CampoAntes rotulo="Avisar" valor={antes} onChange={setAntes} /></View>
      <Text style={type.caption}>{recorrente ? 'Toda semana. ' : ''}Sem tocar em Feito no aviso, ele volta a cada 30 min até a reunião.</Text>
      <Erro texto={erro} />
      <View style={{ flexDirection: 'row', gap: space(3), justifyContent: 'flex-end' }}>
        {r ? <View style={{ marginRight: 'auto' }}><Botao titulo="Remover" secundario onPress={remover} /></View> : null}
        <Botao titulo="Cancelar" secundario onPress={onFechar} />
        <Botao titulo="Salvar" onPress={salvar} disabled={!titulo.trim() || !hora} />
      </View>
    </Dialogo>
  );
}

/** No dia: marca as pautas tratadas e escreve a devolutiva. Não marcadas ficam registradas assim, não passam adiante. */
function ReuniaoDoDia({ reuniao, onFechar, onEditar, onRegistrar }: {
  reuniao: Reuniao | null; onFechar: () => void; onEditar: (r: Reuniao) => void; onRegistrar: (id: string, tratadas: string[], devolutiva: string) => void;
}) {
  const [tratadas, setTratadas] = useState<string[]>([]);
  const [devolutiva, setDevolutiva] = useState('');
  const [erro, setErro] = useState<string | null>(null);
  useEffect(() => { setTratadas([]); setDevolutiva(''); setErro(null); }, [reuniao]);
  if (!reuniao) return null;

  function registrar() {
    try { onRegistrar(reuniao!.id, tratadas, devolutiva); onFechar(); }
    catch (e) { setErro(mensagem(e)); }
  }

  return (
    <Dialogo visivel titulo={reuniao.titulo} onFechar={onFechar}>
      <Text style={type.caption}>Hoje · {reuniao.hora}</Text>
      {reuniao.pautas.length ? reuniao.pautas.map(p => (
        <Marca key={p.id} texto={p.titulo} marcado={tratadas.includes(p.id)}
          onPress={() => setTratadas(t => (t.includes(p.id) ? t.filter(x => x !== p.id) : [...t, p.id]))}>
          {p.descricao ? <Text style={type.caption}>{p.descricao}</Text> : null}
        </Marca>
      )) : <Text style={type.caption}>Sem pautas.</Text>}
      <Campo rotulo="Devolutiva: o que foi acordado e decidido" value={devolutiva} onChangeText={setDevolutiva} multiline />
      <Text style={type.caption}>Pautas não marcadas ficam registradas nesta reunião e não passam para a próxima.</Text>
      <Erro texto={erro} />
      <View style={{ flexDirection: 'row', gap: space(3), justifyContent: 'flex-end', flexWrap: 'wrap' }}>
        <View style={{ marginRight: 'auto' }}><Botao titulo="Editar" secundario onPress={() => onEditar(reuniao)} /></View>
        <Botao titulo="Fechar" secundario onPress={onFechar} />
        <Botao titulo="Registrar" onPress={registrar} />
      </View>
    </Dialogo>
  );
}

function VerRealizada({ realizada: x, onFechar, onRemover }: { realizada: Realizada | null; onFechar: () => void; onRemover: (id: string) => void }) {
  if (!x) return null;
  async function remover() {
    if (await confirmar('Remover registro?', `${x!.titulo} · ${mostrarDia(x!.dia)}`, 'Remover')) { onRemover(x!.id); onFechar(); }
  }
  return (
    <Dialogo visivel titulo={x.titulo} onFechar={onFechar}>
      <Text style={type.caption}>{mostrarDia(x.dia)} · {x.hora}</Text>
      {x.pautas.map(p => (
        <View key={p.id} style={{ flexDirection: 'row', gap: space(3) }}>
          <Ionicons name={p.tratada ? 'checkbox' : 'square-outline'} size={22} color={p.tratada ? colors.accent : colors.textMuted}
            accessibilityLabel={p.tratada ? 'Tratada' : 'Não tratada'} />
          <View style={{ flex: 1, gap: 2 }}>
            <Text style={[type.body, !p.tratada && { color: colors.textMuted }]}>{p.titulo}</Text>
            {p.descricao ? <Text style={type.caption}>{p.descricao}</Text> : null}
          </View>
        </View>
      ))}
      <Text style={[type.body, { fontWeight: '600' }]}>Devolutiva</Text>
      <Text selectable style={type.body}>{x.devolutiva || 'Sem devolutiva.'}</Text>
      <View style={{ flexDirection: 'row', gap: space(3), justifyContent: 'flex-end' }}>
        <View style={{ marginRight: 'auto' }}><Botao titulo="Remover" secundario onPress={remover} /></View>
        <Botao titulo="Fechar" onPress={onFechar} />
      </View>
    </Dialogo>
  );
}
