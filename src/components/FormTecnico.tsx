// Novo técnico / editar técnico (mesmo formulário).
import { useEffect, useState } from 'react';
import { View } from 'react-native';
import { Botao, Campo, Dialogo, Erro, mensagem } from './ui';
import { space } from '../theme';
import type { Tecnico } from '../types';

export function FormTecnico({ visivel, tecnico, onFechar, onSalvar }: {
  visivel: boolean; tecnico?: Tecnico; onFechar: () => void; onSalvar: (nome: string, funcao: string) => void;
}) {
  const [nome, setNome] = useState('');
  const [funcao, setFuncao] = useState('');
  const [erro, setErro] = useState<string | null>(null);

  useEffect(() => {
    if (visivel) { setNome(tecnico?.nome ?? ''); setFuncao(tecnico?.funcao ?? ''); setErro(null); }
  }, [visivel, tecnico]);

  function salvar() {
    try { onSalvar(nome, funcao); onFechar(); }
    catch (e) { setErro(mensagem(e)); }
  }

  return (
    <Dialogo visivel={visivel} titulo={tecnico ? 'Editar técnico' : 'Novo técnico'} onFechar={onFechar}>
      <Campo rotulo="Nome" value={nome} onChangeText={setNome} autoFocus autoCapitalize="words" onSubmitEditing={salvar} />
      <Campo rotulo="Função (opcional)" value={funcao} onChangeText={setFuncao} placeholder="Ex.: técnico de campo" onSubmitEditing={salvar} />
      <Erro texto={erro} />
      <View style={{ flexDirection: 'row', gap: space(3), justifyContent: 'flex-end' }}>
        <Botao titulo="Cancelar" secundario onPress={onFechar} />
        <Botao titulo="Salvar" onPress={salvar} disabled={!nome.trim()} />
      </View>
    </Dialogo>
  );
}
