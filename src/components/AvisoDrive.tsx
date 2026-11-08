// Faixa discreta só quando o Drive precisa de atenção; com tudo salvo, não aparece.
import { useState } from 'react';
import { Pressable, Text } from 'react-native';
import { useEstado } from '../Estado';
import { mensagem } from './ui';
import { colors, radius, space } from '../theme';

export function AvisoDrive() {
  const { status, reconectar } = useEstado();
  const [erro, setErro] = useState<string | null>(null);
  if (status !== 'reconectar' && status !== 'erro' && !erro) return null;
  const texto = erro ?? (status === 'reconectar'
    ? 'Toque para reconectar o Google Drive. Suas alterações estão guardadas no aparelho.'
    : 'Não foi possível salvar no Drive agora. Toque para tentar de novo.');
  return (
    <Pressable accessibilityRole="button" onPress={() => { setErro(null); reconectar().catch(e => setErro(mensagem(e))); }}
      style={{ marginHorizontal: space(4), padding: space(3), borderRadius: radius.input, borderWidth: 1, borderColor: colors.melhorar }}>
      <Text style={{ color: colors.text, fontSize: 14 }}>{texto}</Text>
    </Pressable>
  );
}
