// Histórico geral: todos os feedbacks por dia, com filtro por tom ou só gravados.
import { useState } from 'react';
import { Pressable, SectionList, Text, View } from 'react-native';
import { router } from 'expo-router';
import Ionicons from '@expo/vector-icons/Ionicons';
import { Abas, Tela } from '../components/ui';
import { Etiqueta } from '../components/Tom';
import { useEstado } from '../Estado';
import { feedbacksPorDia } from '../lib/dados';
import { colors, fonte, radius, space, type } from '../theme';
import type { Tom } from '../types';

type Filtro = 'todos' | Tom | 'gravados';
const FILTROS: { valor: Filtro; titulo: string }[] = [
  { valor: 'todos', titulo: 'Todos' }, { valor: 'melhorar', titulo: 'A melhorar' }, { valor: 'neutro', titulo: 'Neutro' },
  { valor: 'positivo', titulo: 'Positivo' }, { valor: 'gravados', titulo: 'Gravados' }];

export default function Historico() {
  const { dados } = useEstado();
  const [filtro, setFiltro] = useState<Filtro>('todos');
  const nome = (id: string) => dados.tecnicos.find(t => t.id === id)?.nome ?? 'Técnico removido';

  return (
    <Tela titulo="Histórico" voltar>
      <SectionList
        sections={feedbacksPorDia(dados, undefined, filtro === 'gravados')
          .map(g => ({ title: g.dia, data: g.itens.filter(f => filtro === 'todos' || filtro === 'gravados' || f.tom === filtro) }))
          .filter(g => g.data.length)}
        ListHeaderComponent={<Abas valor={filtro} onChange={setFiltro} opcoes={FILTROS} />}
        keyExtractor={f => f.id}
        stickySectionHeadersEnabled={false}
        contentContainerStyle={{ padding: space(4), gap: space(2), paddingBottom: space(10) }}
        ListEmptyComponent={
          <Text style={[type.caption, { textAlign: 'center', marginTop: space(10) }]}>{filtro === 'todos' ? 'Nenhum feedback ainda.' : 'Nenhum feedback neste filtro.'}</Text>
        }
        renderSectionHeader={({ section }) => <Text style={[type.caption, { marginTop: space(4) }]}>{section.title}</Text>}
        renderItem={({ item }) => (
          <Pressable onPress={() => router.push({ pathname: '/feedback/[id]', params: { id: item.id } })} accessibilityRole="button"
            style={({ pressed }) => ({ gap: space(1), padding: space(4), borderRadius: radius.card, backgroundColor: colors.surface,
              borderWidth: 1, borderColor: colors.border, opacity: pressed ? 0.7 : 1 })}>
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: space(2) }}>
              <Text style={[type.body, { fontFamily: fonte.semi, flexShrink: 1 }]} numberOfLines={1}>{nome(item.tecnicoId)}</Text>
              <Etiqueta tom={item.tom} />
              {item.conversa?.length ? <Ionicons name="mic" size={16} color={colors.textMuted} accessibilityLabel="Gravado" /> : null}
            </View>
            <Text style={type.body} numberOfLines={2}>{item.texto}</Text>
          </Pressable>
        )}
      />
    </Tela>
  );
}
