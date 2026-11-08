// Receber os lembretes com o app fechado (Android), como no Navalha: bateria sem restrição e alarme exato.
// O app confere sozinho cada item ao voltar dos ajustes. Após reiniciar o celular, o expo-notifications
// reagenda tudo sozinho (BOOT_COMPLETED), desde que a bateria não segure o app.
import { ScrollView, Text, View } from 'react-native';
import Ionicons from '@expo/vector-icons/Ionicons';
import { Botao, Tela } from '../components/ui';
import { useLiberado } from '../components/AvisoBateria';
import { abrirBateria, alarmeExato, bateriaLiberada, passosBateria, pedirAlarmeExato } from '../lib/bateria';
import { colors, radius, space, type } from '../theme';

function Item({ ok, titulo, texto, botao, onPress }: { ok: boolean | null; titulo: string; texto: string; botao: string; onPress: () => void }) {
  return (
    <View style={{ gap: space(3), padding: space(4), borderRadius: radius.card, backgroundColor: colors.surface }}>
      <View style={{ flexDirection: 'row', alignItems: 'center', gap: space(2) }}>
        <Ionicons name={ok ? 'checkmark-circle' : 'alert-circle-outline'} size={22} color={ok ? colors.positivo : colors.melhorar} />
        <Text style={[type.body, { fontWeight: '600', flex: 1 }]}>{titulo}</Text>
      </View>
      <Text style={type.caption}>{ok ? 'Liberado.' : texto}</Text>
      {ok === false ? <Botao titulo={botao} onPress={onPress} icone={<Ionicons name="open-outline" size={18} color={colors.accentText} />} /> : null}
    </View>
  );
}

export default function Bateria() {
  const bateria = useLiberado(bateriaLiberada);
  const alarme = useLiberado(alarmeExato);
  return (
    <Tela titulo="Lembretes com o app fechado" voltar>
      <ScrollView contentContainerStyle={{ padding: space(4), gap: space(4) }}>
        <Text style={type.caption}>
          Para os avisos de tarefas e reuniões chegarem na hora, mesmo com o app fechado e depois de reiniciar o celular,
          libere os dois itens abaixo.
        </Text>
        <Item ok={bateria} titulo="Bateria sem restrição" texto={passosBateria()} botao="Abrir a bateria do FeedTec" onPress={abrirBateria} />
        <Item ok={alarme} titulo="Alarmes e lembretes" texto="Ligue “Permitir definir alarmes e lembretes”. Sem isso o aviso pode atrasar."
          botao="Abrir alarmes e lembretes" onPress={pedirAlarmeExato} />
      </ScrollView>
    </Tela>
  );
}
