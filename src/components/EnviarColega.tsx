// Enviar reunião ou tarefa a um colega pelo e-mail do Google; os e-mails usados ficam como atalhos (dados.recentes).
import { useEffect, useState } from 'react';
import { Pressable, Text, View } from 'react-native';
import { Botao, Campo, Dialogo, Erro, mensagem } from './ui';
import { useEstado } from '../Estado';
import { lembrarEmail } from '../lib/dados';
import { colors, space, type } from '../theme';

export function EnviarColega({ visivel, titulo, texto, onFechar, enviar: mandar }: {
  visivel: boolean; titulo: string; texto: string; onFechar: () => void; enviar: (email: string) => Promise<void>;
}) {
  const { dados, alterar } = useEstado();
  const recentes = dados.recentes ?? [];
  const [email, setEmail] = useState('');
  const [erro, setErro] = useState<string | null>(null);
  const [enviando, setEnviando] = useState(false);
  useEffect(() => { setEmail(''); setErro(null); }, [visivel]);

  async function enviar() {
    setEnviando(true);
    try {
      await mandar(email);
      const e = email.trim().toLowerCase();
      alterar(d => lembrarEmail(d, e)); // fica como atalho para os próximos envios
      onFechar();
    } catch (e) { setErro(mensagem(e)); } finally { setEnviando(false); }
  }

  return (
    <Dialogo visivel={visivel} titulo={titulo} onFechar={onFechar}>
      <Text style={type.caption}>{texto}</Text>
      <Campo rotulo="E-mail do Google do colega" value={email} onChangeText={setEmail} keyboardType="email-address" autoCapitalize="none" autoCorrect={false} />
      {recentes.length ? (
        <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: space(2) }}>
          {recentes.map(e => (
            <Pressable key={e} onPress={() => setEmail(e)} accessibilityRole="button" accessibilityLabel={`Usar ${e}`}
              style={{ paddingHorizontal: space(3), paddingVertical: space(1), borderRadius: 999, borderWidth: 1, borderColor: email === e ? colors.accent : colors.border }}>
              <Text style={type.caption}>{e}</Text>
            </Pressable>
          ))}
        </View>
      ) : null}
      <Erro texto={erro} />
      <View style={{ flexDirection: 'row', gap: space(3), justifyContent: 'flex-end' }}>
        <Botao titulo="Cancelar" secundario onPress={onFechar} />
        <Botao titulo="Enviar" onPress={enviar} carregando={enviando} disabled={!email.trim()} />
      </View>
    </Dialogo>
  );
}
