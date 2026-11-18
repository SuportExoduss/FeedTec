// Técnico: pautas do próximo feedback no topo, histórico de feedbacks por dia e botão + para um novo; editar/remover escondidos no ⋮.
import { useState } from 'react';
import { Pressable, SectionList, Text, View } from 'react-native';
import { Redirect, router, useLocalSearchParams } from 'expo-router';
import Ionicons from '@expo/vector-icons/Ionicons';
import { Abas, Botao, Campo, Dialogo, Tela, confirmar, Vazio } from '../../components/ui';
import { Etiqueta } from '../../components/Tom';
import { FormTecnico } from '../../components/FormTecnico';
import { useEstado } from '../../Estado';
import { adicionarPautaTecnico, alternarAtivo, editarTecnico, feedbacksPorDia, removerPautaTecnico, removerTecnico } from '../../lib/dados';
import { colors, radius, space, type, cartao } from '../../theme';

export default function Tecnico() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const { dados, alterar } = useEstado();
  const [editando, setEditando] = useState(false);
  const [soGravados, setSoGravados] = useState(false);
  const [novaPauta, setNovaPauta] = useState('');
  const [pautasAbertas, setPautasAbertas] = useState(false);
  const [verPautas, setVerPautas] = useState(false);
  const tecnico = dados.tecnicos.find(t => t.id === id);
  if (!tecnico) return <Redirect href="/" />;
  // Encerradas = marcadas como tratadas em algum feedback deste técnico (mais recentes primeiro).
  const encerradas = dados.feedbacks.filter(f => f.tecnicoId === tecnico.id && f.pautas?.length).sort((a, b) => b.criadoEm - a.criadoEm)
    .flatMap(f => f.pautas!.map(titulo => ({ titulo, em: f.criadoEm })));

  async function remover() {
    if (!(await confirmar('Remover técnico', `Remover ${tecnico!.nome} e os feedbacks dele?`, 'Remover'))) return;
    router.back();
    alterar(d => removerTecnico(d, tecnico!.id));
  }

  return (
    <Tela titulo={tecnico.nome} voltar menu={[
      { titulo: 'Editar', onPress: () => setEditando(true) },
      { titulo: 'Pautas futuras', onPress: () => setVerPautas(true) },
      { titulo: tecnico.inativo ? 'Marcar como ativo' : 'Marcar como inativo', onPress: () => alterar(d => alternarAtivo(d, tecnico.id)) },
      { titulo: 'Remover', onPress: remover, perigo: true },
    ]}>
      <SectionList
        sections={feedbacksPorDia(dados, tecnico.id, soGravados).map(g => ({ title: g.dia, data: g.itens }))}
        keyExtractor={f => f.id}
        stickySectionHeadersEnabled={false}
        contentContainerStyle={{ padding: space(4), gap: space(2), paddingBottom: space(24) }}
        ListHeaderComponent={
          <View style={{ gap: space(3) }}>
            {tecnico.funcao ? <Text style={type.caption}>{tecnico.funcao}</Text> : null}
            <View style={{ gap: space(2), padding: space(4), ...cartao() }}>
              <Pressable onPress={() => setPautasAbertas(v => !v)} accessibilityRole="button" accessibilityState={{ expanded: pautasAbertas }}
                style={{ flexDirection: 'row', alignItems: 'center', gap: space(2) }}>
                <Text style={[type.body, { fontWeight: '600', flex: 1 }]}>Pautas do próximo feedback{tecnico.pautas?.length ? ` (${tecnico.pautas.length})` : ''}</Text>
                <Ionicons name={pautasAbertas ? 'chevron-up' : 'chevron-down'} size={20} color={colors.textMuted} />
              </Pressable>
              {pautasAbertas ? <>
              {(tecnico.pautas ?? []).map(p => (
                <View key={p.id} style={{ flexDirection: 'row', alignItems: 'center', gap: space(2) }}>
                  <Ionicons name="square-outline" size={20} color={colors.textMuted} />
                  <Text style={[type.body, { flex: 1 }]}>{p.titulo}</Text>
                  <Pressable onPress={() => alterar(d => removerPautaTecnico(d, tecnico.id, p.id))} hitSlop={8}
                    accessibilityRole="button" accessibilityLabel={`Remover pauta ${p.titulo}`}>
                    <Ionicons name="close" size={20} color={colors.textMuted} />
                  </Pressable>
                </View>
              ))}
              <Campo rotulo="Nova pauta" value={novaPauta} onChangeText={setNovaPauta} placeholder="Ex.: pontualidade nas OS"
                onSubmitEditing={() => { if (novaPauta.trim()) { alterar(d => adicionarPautaTecnico(d, tecnico.id, novaPauta)); setNovaPauta(''); } }} />
              <Botao titulo="Adicionar pauta" secundario disabled={!novaPauta.trim()}
                onPress={() => { alterar(d => adicionarPautaTecnico(d, tecnico.id, novaPauta)); setNovaPauta(''); }} />
              </> : null}
            </View>
            <Abas valor={soGravados ? 'g' : 't'} onChange={v => setSoGravados(v === 'g')}
              opcoes={[{ valor: 't', titulo: 'Todos' }, { valor: 'g', titulo: 'Gravados' }]} />
          </View>
        }
        ListEmptyComponent={
          <Vazio icone={soGravados ? 'mic-outline' : 'chatbubble-ellipses-outline'} titulo={soGravados ? 'Nenhuma conversa gravada' : 'Nenhum feedback ainda'} dica={soGravados ? undefined : 'Toque em + para criar.'} />
        }
        renderSectionHeader={({ section }) => <Text style={[type.caption, { marginTop: space(4) }]}>{section.title}</Text>}
        renderItem={({ item }) => (
          <Pressable onPress={() => router.push({ pathname: '/feedback/[id]', params: { id: item.id } })} accessibilityRole="button"
            style={({ pressed }) => ({ gap: space(1), padding: space(4), ...cartao(),
              opacity: pressed ? 0.7 : 1 })}>
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: space(2) }}>
              <Etiqueta tom={item.tom} />
              {item.conversa?.length ? <Ionicons name="mic" size={16} color={colors.textMuted} accessibilityLabel="Gravado" /> : null}
            </View>
            <Text style={type.body} numberOfLines={2}>{item.texto}</Text>
          </Pressable>
        )}
      />
      <Pressable onPress={() => router.push({ pathname: '/feedback/novo', params: { tecnico: tecnico.id } })}
        accessibilityRole="button" accessibilityLabel="Novo feedback"
        style={({ pressed }) => ({ position: 'absolute', right: space(5), bottom: space(6), width: 56, height: 56, borderRadius: 28,
          backgroundColor: colors.accent, alignItems: 'center', justifyContent: 'center', opacity: pressed ? 0.8 : 1 })}>
        <Ionicons name="add" size={28} color={colors.accentText} />
      </Pressable>
      <Dialogo visivel={verPautas} titulo="Pautas futuras" onFechar={() => setVerPautas(false)}>
        <Text style={type.caption}>Em aberto</Text>
        {tecnico.pautas?.length ? tecnico.pautas.map(p => (
          <View key={p.id} style={{ flexDirection: 'row', alignItems: 'center', gap: space(2) }}>
            <Ionicons name="square-outline" size={18} color={colors.textMuted} />
            <Text style={[type.body, { flex: 1 }]}>{p.titulo}</Text>
          </View>
        )) : <Text style={type.caption}>Nenhuma pauta em aberto.</Text>}
        <Text style={type.caption}>Encerradas</Text>
        {encerradas.length ? encerradas.map((p, i) => (
          <View key={i} style={{ flexDirection: 'row', alignItems: 'center', gap: space(2) }}>
            <Ionicons name="checkbox" size={18} color={colors.accent} />
            <Text style={[type.body, { flex: 1 }]}>{p.titulo}</Text>
            <Text style={type.caption}>{new Date(p.em).toLocaleDateString('pt-BR')}</Text>
          </View>
        )) : <Text style={type.caption}>Nenhuma pauta encerrada.</Text>}
        <Botao titulo="Fechar" secundario onPress={() => setVerPautas(false)} />
      </Dialogo>
      <FormTecnico visivel={editando} tecnico={tecnico} onFechar={() => setEditando(false)}
        onSalvar={(n, f) => alterar(d => editarTecnico(d, tecnico.id, n, f))} />
    </Tela>
  );
}
