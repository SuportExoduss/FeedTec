// Aba Técnicos: lista e o botão +.
import { useState } from 'react';
import { FlatList, Pressable, Text, View } from 'react-native';
import { router } from 'expo-router';
import Ionicons from '@expo/vector-icons/Ionicons';
import { Avatar, BotaoMais, Selo, Tela, Vazio } from '../components/ui';
import { FormTecnico } from '../components/FormTecnico';
import { useEstado } from '../Estado';
import { adicionarTecnico, tecnicosOrdenados } from '../lib/dados';
import { colors, fonte, radius, space, type, cartao } from '../theme';

export default function Tecnicos() {
  const { dados, alterar } = useEstado();
  const [novo, setNovo] = useState(false);
  const lista = tecnicosOrdenados(dados);

  return (
    <Tela titulo="Técnicos">
      <FlatList
        data={lista}
        keyExtractor={t => t.id}
        contentContainerStyle={{ padding: space(4), gap: space(2), paddingBottom: space(24) }}
        ListEmptyComponent={
          <Vazio icone="people-outline" titulo="Nenhum técnico ainda" dica="Toque em + para adicionar o primeiro." />
        }
        renderItem={({ item }) => (
          <Pressable onPress={() => router.push({ pathname: '/tecnico/[id]', params: { id: item.id } })} accessibilityRole="button"
            style={({ pressed }) => ({ flexDirection: 'row', alignItems: 'center', gap: space(3), padding: space(4), ...cartao(), opacity: pressed ? 0.7 : 1 })}>
            <Avatar nome={item.nome} apagado={item.inativo} />
            <View style={{ flex: 1, gap: 2 }}>
              <Text style={[type.body, { fontFamily: fonte.semi }]} numberOfLines={1}>{item.nome}</Text>
              {item.funcao ? <Text style={type.caption} numberOfLines={1}>{item.funcao}</Text> : null}
            </View>
            <Selo texto={item.inativo ? 'Inativo' : 'Ativo'} cor={item.inativo ? colors.textMuted : colors.sucesso} />
            <Ionicons name="chevron-forward" size={18} color={colors.textMuted} />
          </Pressable>
        )}
      />
      <BotaoMais rotulo="Novo técnico" onPress={() => setNovo(true)} />
      <FormTecnico visivel={novo} onFechar={() => setNovo(false)} onSalvar={(n, f) => alterar(d => adicionarTecnico(d, n, f))} />
    </Tela>
  );
}
