// Estado do app: usuário logado + dados. Grava primeiro no aparelho (abre na hora, funciona sem rede)
// e logo depois no Drive. Ao abrir, fica com a versão mais recente entre aparelho e Drive.
import { createContext, useCallback, useContext, useEffect, useRef, useState, type ReactNode } from 'react';
import { onAuthStateChanged, type User } from 'firebase/auth';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { auth } from './services/firebase';
import { entrarComGoogle, reconectarDrive, sairDoGoogle, tokenDrive } from './services/googleSignIn';
import { DriveSemAcesso, esquecerIdsDrive, lerDoDrive, salvarNoDrive } from './services/drive';
import { agendarLembretes, desligarAvisos, ouvirFeito } from './services/lembretes';
import { concluirAviso, type Alvo } from './lib/agenda';
import { lerDadosJson, maisRecente } from './lib/dados';
import { DADOS_VAZIOS, type Dados } from './types';

export type StatusDrive = 'carregando' | 'salvo' | 'salvando' | 'reconectar' | 'erro';

interface Estado {
  carregandoUsuario: boolean;
  user: User | null;
  dados: Dados;
  status: StatusDrive;
  /** Aplica uma alteração (pode lançar erro de validação) e agenda o envio ao Drive. */
  alterar: (fn: (d: Dados) => Dados) => void;
  entrar: () => Promise<void>;
  reconectar: () => Promise<void>;
  sair: () => Promise<void>;
}

const Ctx = createContext<Estado | null>(null);
const chaveCache = (uid: string) => `feedtec.dados.${uid}`;

export function EstadoProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [carregandoUsuario, setCarregandoUsuario] = useState(true);
  const [dados, setDados] = useState<Dados>(DADOS_VAZIOS);
  const [status, setStatus] = useState<StatusDrive>('carregando');
  const atual = useRef(dados);
  const timer = useRef<ReturnType<typeof setTimeout>>(undefined);
  const feitos = useRef<Alvo[]>([]); // Feito tocado no aviso antes dos dados carregarem
  const [novosFeitos, setNovosFeitos] = useState(0);

  const enviar = useCallback(async () => {
    const token = await tokenDrive();
    if (!token) { setStatus('reconectar'); return; }
    setStatus('salvando');
    try { await salvarNoDrive(token, atual.current); setStatus('salvo'); }
    catch (e) { setStatus(e instanceof DriveSemAcesso ? 'reconectar' : 'erro'); }
  }, []);

  const carregar = useCallback(async (uid: string) => {
    setStatus('carregando');
    const local = lerDadosJson((await AsyncStorage.getItem(chaveCache(uid))) ?? '') ?? DADOS_VAZIOS;
    atual.current = local;
    setDados(local);
    const token = await tokenDrive();
    if (!token) { setStatus('reconectar'); return; }
    try {
      const remoto = await lerDoDrive(token);
      const escolhido = remoto ? maisRecente(local, remoto) : local;
      atual.current = escolhido;
      setDados(escolhido);
      await AsyncStorage.setItem(chaveCache(uid), JSON.stringify(escolhido));
      if (escolhido.alteradoEm > (remoto?.alteradoEm ?? -1) && escolhido.alteradoEm > 0) await enviar();
      else setStatus('salvo');
    } catch (e) {
      setStatus(e instanceof DriveSemAcesso ? 'reconectar' : 'erro');
    }
  }, [enviar]);

  useEffect(() => onAuthStateChanged(auth, u => {
    setUser(u);
    setCarregandoUsuario(false);
    if (u) carregar(u.uid);
  }), [carregar]);

  useEffect(() => agendarLembretes(dados), [dados]); // inclui dados vindos do Drive e o sair (cancela tudo)

  const alterar = useCallback((fn: (d: Dados) => Dados) => {
    const novo = fn(atual.current);
    atual.current = novo;
    setDados(novo);
    if (auth.currentUser) AsyncStorage.setItem(chaveCache(auth.currentUser.uid), JSON.stringify(novo)).catch(() => undefined);
    clearTimeout(timer.current);
    timer.current = setTimeout(enviar, 1200); // junta edições seguidas num envio só
  }, [enviar]);

  useEffect(() => ouvirFeito(alvo => { feitos.current.push(alvo); setNovosFeitos(n => n + 1); }), []);
  // Só com os dados da conta na mão: aplicar sobre os dados vazios apagaria tudo ao gravar.
  useEffect(() => {
    if (!user || status === 'carregando' || !feitos.current.length) return;
    const lista = feitos.current.splice(0);
    alterar(d => lista.reduce((x, a) => concluirAviso(x, a), d));
  }, [novosFeitos, user, status, alterar]);

  // O Firebase avisa do login antes do token do Drive ser guardado: carrega de novo depois.
  const entrar = useCallback(async () => {
    await entrarComGoogle();
    if (auth.currentUser) await carregar(auth.currentUser.uid);
  }, [carregar]);

  const reconectar = useCallback(async () => {
    await reconectarDrive();
    if (auth.currentUser) await carregar(auth.currentUser.uid);
  }, [carregar]);

  const sair = useCallback(async () => {
    clearTimeout(timer.current);
    esquecerIdsDrive();
    await desligarAvisos(); // web: este navegador para de receber os avisos desta conta
    await sairDoGoogle();
    atual.current = DADOS_VAZIOS;
    setDados(DADOS_VAZIOS);
  }, []);

  return (
    <Ctx.Provider value={{ carregandoUsuario, user, dados, status, alterar, entrar, reconectar, sair }}>
      {children}
    </Ctx.Provider>
  );
}

export function useEstado(): Estado {
  const e = useContext(Ctx);
  if (!e) throw new Error('useEstado fora do EstadoProvider');
  return e;
}
