// Início: saudação, contadores da equipe e os próximos compromissos.
import { Pressable, ScrollView, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { router, type Href } from 'expo-router';
import Ionicons from '@expo/vector-icons/Ionicons';
import { AvisoDrive } from '../components/AvisoDrive';
import { AvisoAtualizacao } from '../components/AvisoAtualizacao';
import { useEstado } from '../Estado';
import { diaIso, DIAS_SEMANA, mostrarDia, proximaReuniao } from '../lib/agenda';
import { colors, fonte, radius, space, temaEscuro } from '../theme';

type Icone = keyof typeof Ionicons.glyphMap;
type Compromisso = { id: string; titulo: string; dia: string; hora?: string; icone: Icone; cor: string; rota: Href };

function quando(dia: string, hora?: string) {
  const hoje = new Date();
  const amanha = new Date(hoje); amanha.setDate(hoje.getDate() + 1);
  const [a, m, d] = dia.split('-').map(Number);
  const nome = dia === diaIso(hoje) ? 'Hoje' : dia === diaIso(amanha) ? 'Amanhã'
    : `${DIAS_SEMANA[new Date(a, m - 1, d).getDay()].slice(0, 3)}, ${mostrarDia(dia).slice(0, 5)}`;
  return hora ? `${nome} · ${hora}` : nome;
}

function Contador({ titulo, valor, icone, cor, rota }: { titulo: string; valor: number; icone: Icone; cor: string; rota: Href }) {
  return (
    <Pressable accessibilityRole="button" accessibilityLabel={`${titulo}: ${valor}`} onPress={() => (rota === '/historico' ? router.push(rota) : router.replace(rota))}
      style={({ pressed }) => ({ flex: 1, padding: space(4), gap: space(3), borderRadius: radius.card, backgroundColor: colors.surface,
        borderWidth: 1, borderColor: colors.border, opacity: pressed ? 0.75 : 1 })}>
      <View style={{ width: 40, height: 40, borderRadius: 12, alignItems: 'center', justifyContent: 'center', backgroundColor: cor + '24' }}>
        <Ionicons name={icone} size={22} color={cor} />
      </View>
      <View>
        <Text style={{ fontFamily: fonte.media, fontSize: 14, color: colors.textMuted }}>{titulo}</Text>
        <Text style={{ fontFamily: fonte.negrito, fontSize: 30, color: colors.text }}>{valor}</Text>
      </View>
    </Pressable>
  );
}

export default function Inicio() {
  const { user, dados } = useEstado();
  const agora = Date.now();
  const hoje = diaIso(new Date(agora));
  const pendentes = (dados.tarefas ?? []).filter(t => !t.feita);
  const nome = user?.displayName?.split(' ')[0];

  const proximos: Compromisso[] = [
    ...pendentes.filter(t => t.dia >= hoje).map(t => ({ id: t.id, titulo: t.titulo, dia: t.dia, hora: t.hora,
      icone: 'checkbox-outline' as Icone, cor: colors.sucesso, rota: '/tarefas' as Href })),
    ...(dados.reunioes ?? []).map(r => ({ r, dt: proximaReuniao(r, agora) })).filter(({ r }) => !r.dia || r.dia >= hoje)
      .map(({ r, dt }) => ({ id: r.id, titulo: r.titulo, dia: diaIso(dt), hora: r.hora,
        icone: 'calendar-outline' as Icone, cor: colors.amarelo, rota: '/reunioes' as Href })),
  ].sort((a, b) => (a.dia + (a.hora ?? '99')).localeCompare(b.dia + (b.hora ?? '99'))).slice(0, 4);

  return (
    <SafeAreaView edges={['top', 'left', 'right']} style={{ flex: 1, backgroundColor: colors.bg, overflow: 'hidden' }}>
      {temaEscuro ? (
        // Brilho azul do topo: círculos sobrepostos imitam um degradê (sem lib de gradiente).
        [420, 330, 240].map(t => <View key={t} pointerEvents="none" style={{ position: 'absolute', top: -t / 2, right: -t / 3,
          width: t, height: t, borderRadius: t / 2, backgroundColor: colors.accent, opacity: 0.14 }} />)
      ) : null}
      <View style={{ flexDirection: 'row', alignItems: 'center', height: 56, paddingHorizontal: space(5) }}>
        <Text accessibilityRole="header" style={{ flex: 1, fontFamily: fonte.negrito, fontSize: 22, color: colors.text }}>
          Feed<Text style={{ color: colors.amarelo }}>Tec</Text>
        </Text>
        <Pressable accessibilityRole="button" accessibilityLabel={`Tarefas pendentes: ${pendentes.length}`} hitSlop={8}
          onPress={() => router.replace('/tarefas')} style={{ width: 44, height: 44, alignItems: 'center', justifyContent: 'center' }}>
          <Ionicons name="notifications-outline" size={24} color={colors.text} />
          {pendentes.length ? <View style={{ position: 'absolute', top: 10, right: 11, width: 9, height: 9, borderRadius: 5,
            backgroundColor: colors.amarelo, borderWidth: 1.5, borderColor: colors.bg }} /> : null}
        </Pressable>
      </View>
      <ScrollView contentContainerStyle={{ width: '100%', maxWidth: 720, alignSelf: 'center', paddingBottom: space(8) }}>
        <AvisoAtualizacao />
        <AvisoDrive />
        <View style={{ paddingHorizontal: space(5), paddingTop: space(4), gap: space(1) }}>
          <Text style={{ fontFamily: fonte.negrito, fontSize: 28, color: colors.text }}>Olá{nome ? `, ${nome}` : ''}</Text>
          <Text style={{ fontFamily: fonte.regular, fontSize: 16, color: colors.textMuted }}>Tudo em dia na sua equipe?</Text>
        </View>
        <View style={{ padding: space(5), gap: space(3) }}>
          <View style={{ flexDirection: 'row', gap: space(3) }}>
            <Contador titulo="Técnicos" valor={dados.tecnicos.length} icone="people-outline" cor="#5B8BFF" rota="/tecnicos" />
            <Contador titulo="Reuniões" valor={(dados.reunioes ?? []).length} icone="calendar-outline" cor={colors.amarelo} rota="/reunioes" />
          </View>
          <View style={{ flexDirection: 'row', gap: space(3) }}>
            <Contador titulo="Tarefas" valor={pendentes.length} icone="checkmark-circle-outline" cor={colors.sucesso} rota="/tarefas" />
            <Contador titulo="Feedbacks" valor={dados.feedbacks.length} icone="chatbubble-ellipses-outline" cor={colors.amarelo} rota="/historico" />
          </View>
        </View>
        <View style={{ paddingHorizontal: space(5), gap: space(3) }}>
          <View style={{ flexDirection: 'row', alignItems: 'center' }}>
            <Text style={{ flex: 1, fontFamily: fonte.semi, fontSize: 18, color: colors.text }}>Próximos compromissos</Text>
            <Pressable accessibilityRole="button" hitSlop={8} onPress={() => router.replace('/reunioes')}>
              <Text style={{ fontFamily: fonte.semi, fontSize: 14, color: colors.amarelo }}>Ver todos</Text>
            </Pressable>
          </View>
          {proximos.length ? proximos.map(c => (
            <Pressable key={c.id} accessibilityRole="button" onPress={() => router.replace(c.rota)}
              style={({ pressed }) => ({ flexDirection: 'row', alignItems: 'center', gap: space(3), padding: space(3),
                borderRadius: radius.card, backgroundColor: colors.surface, borderWidth: 1, borderColor: colors.border, opacity: pressed ? 0.75 : 1 })}>
              <View style={{ width: 44, height: 44, borderRadius: 12, alignItems: 'center', justifyContent: 'center', backgroundColor: c.cor + '24' }}>
                <Ionicons name={c.icone} size={22} color={c.cor} />
              </View>
              <View style={{ flex: 1, gap: 2 }}>
                <Text numberOfLines={1} style={{ fontFamily: fonte.semi, fontSize: 15, color: colors.text }}>{c.titulo}</Text>
                <Text style={{ fontFamily: fonte.regular, fontSize: 13, color: colors.textMuted }}>{quando(c.dia, c.hora)}</Text>
              </View>
              <Ionicons name="chevron-forward" size={18} color={colors.textMuted} />
            </Pressable>
          )) : (
            <Text style={{ fontFamily: fonte.regular, fontSize: 14, color: colors.textMuted, paddingVertical: space(4) }}>
              Nada marcado. Crie tarefas e reuniões nas abas abaixo.
            </Text>
          )}
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}
