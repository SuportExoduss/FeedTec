// Um feedback salvo: texto final em destaque (aba Conversa se foi gravado); copiar/compartilhar e remover no ⋮.
import { useState } from 'react';
import { Platform, Pressable, ScrollView, Share, Text, View } from 'react-native';
import { Redirect, router, useLocalSearchParams } from 'expo-router';
import { Tela, confirmar } from '../../components/ui';
import { Etiqueta } from '../../components/Tom';
import { Player } from '../../components/Player';
import { useEstado } from '../../Estado';
import { removerFeedback } from '../../lib/dados';
import { colors, radius, space, type } from '../../theme';

export default function VerFeedback() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const { dados, alterar } = useEstado();
  const [aba, setAba] = useState<'feedback' | 'conversa'>('feedback');
  const f = dados.feedbacks.find(x => x.id === id);
  if (!f) return <Redirect href="/" />;
  const tecnico = dados.tecnicos.find(t => t.id === f.tecnicoId);

  // Web: área de transferência. Android: menu de compartilhar (WhatsApp, e-mail, copiar…), sem lib nova.
  const enviar = () => { Platform.OS === 'web' ? navigator.clipboard?.writeText(f.texto) : Share.share({ message: f.texto }); };

  async function remover() {
    if (!(await confirmar('Remover feedback', 'Este feedback será apagado.', 'Remover'))) return;
    router.back();
    alterar(d => removerFeedback(d, f!.id));
  }

  return (
    <Tela titulo={tecnico?.nome ?? 'Feedback'} voltar menu={[
      { titulo: Platform.OS === 'web' ? 'Copiar texto' : 'Compartilhar', onPress: enviar },
      { titulo: 'Remover', onPress: remover, perigo: true },
    ]}>
      <ScrollView contentContainerStyle={{ padding: space(4), gap: space(4) }}>
        <View style={{ flexDirection: 'row', justifyContent: 'space-between' }}>
          <Etiqueta tom={f.tom} />
          <Text style={type.caption}>{new Date(f.criadoEm).toLocaleString('pt-BR', { dateStyle: 'short', timeStyle: 'short' })}</Text>
        </View>
        {f.conversa?.length ? (
          <View accessibilityRole="tablist" style={{ flexDirection: 'row', gap: space(2) }}>
            {(['feedback', 'conversa'] as const).map(a => (
              <Pressable key={a} accessibilityRole="tab" accessibilityState={{ selected: aba === a }} onPress={() => setAba(a)}
                style={{ paddingVertical: space(2), paddingHorizontal: space(4), borderRadius: radius.input,
                  backgroundColor: aba === a ? colors.surface : 'transparent', borderWidth: 1, borderColor: colors.border }}>
                <Text style={type.body}>{a === 'feedback' ? 'Feedback' : 'Conversa'}</Text>
              </Pressable>
            ))}
          </View>
        ) : null}
        {aba === 'conversa' && f.audioId ? <Player audioId={f.audioId} /> : null}
        {aba === 'conversa' && f.conversa ? f.conversa.map((c, i) => (
          // Balões: eu à direita, técnico à esquerda.
          <View key={i} style={{ maxWidth: '85%', alignSelf: c.quem === 'eu' ? 'flex-end' : 'flex-start', padding: space(3),
            borderRadius: radius.card, backgroundColor: c.quem === 'eu' ? colors.accent : colors.surface }}>
            <Text selectable style={[type.body, c.quem === 'eu' && { color: colors.accentText }]}>{c.texto}</Text>
          </View>
        )) : <Text selectable style={[type.body, { lineHeight: 24 }]}>{f.texto}</Text>}
        {aba === 'feedback' && f.bruto && !f.conversa ? (
          <View style={{ gap: space(1), padding: space(3), borderRadius: radius.card, backgroundColor: colors.surface }}>
            <Text style={type.caption}>Suas anotações</Text>
            <Text selectable style={type.caption}>{f.bruto}</Text>
          </View>
        ) : null}
      </ScrollView>
    </Tela>
  );
}
