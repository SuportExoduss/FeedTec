// Regras puras sobre os dados (sem rede nem armazenamento): fáceis de testar.
import { lerDiaIso, lerHora } from './agenda';
import type { Dados, Feedback, Ocorrencia, Pauta, Realizada, Reuniao, Tarefa, Tecnico, Tom } from '../types';

export const novoId = () => Date.now().toString(36) + Math.random().toString(36).slice(2, 8);

export const TONS: Tom[] = ['melhorar', 'neutro', 'positivo'];

const limpar = (s: string) => s.trim().replace(/\s+/g, ' ');

export function adicionarTecnico(d: Dados, nome: string, funcao = '', agora = Date.now()): Dados {
  const n = limpar(nome);
  if (!n) throw new Error('Informe o nome do técnico.');
  if (d.tecnicos.some(t => t.nome.toLowerCase() === n.toLowerCase())) throw new Error('Já existe um técnico com esse nome.');
  const t: Tecnico = { id: novoId(), nome: n, criadoEm: agora, ...(limpar(funcao) ? { funcao: limpar(funcao) } : {}) };
  return { ...d, tecnicos: [...d.tecnicos, t], alteradoEm: agora };
}

export function editarTecnico(d: Dados, id: string, nome: string, funcao = '', agora = Date.now()): Dados {
  const n = limpar(nome);
  if (!n) throw new Error('Informe o nome do técnico.');
  if (d.tecnicos.some(t => t.id !== id && t.nome.toLowerCase() === n.toLowerCase())) throw new Error('Já existe um técnico com esse nome.');
  const tecnicos = d.tecnicos.map(t => {
    if (t.id !== id) return t;
    const { funcao: _, ...resto } = t;
    return { ...resto, nome: n, ...(limpar(funcao) ? { funcao: limpar(funcao) } : {}) };
  });
  return { ...d, tecnicos, alteradoEm: agora };
}

/** Remove o técnico e os feedbacks dele. */
export function removerTecnico(d: Dados, id: string, agora = Date.now()): Dados {
  return { ...d, tecnicos: d.tecnicos.filter(t => t.id !== id), feedbacks: d.feedbacks.filter(f => f.tecnicoId !== id), alteradoEm: agora };
}

export function adicionarFeedback(d: Dados, tecnicoId: string, tom: Tom, bruto: string, texto: string, agora = Date.now(),
  { concluidas = [], ...extra }: Pick<Feedback, 'conversa' | 'audioId'> & { concluidas?: Pauta[] } = {}): Dados {
  if (!texto.trim()) throw new Error('O feedback está vazio.');
  const f: Feedback = { id: novoId(), tecnicoId, tom, bruto: bruto.trim(), texto: texto.trim(), criadoEm: agora, ...extra,
    ...(concluidas.length ? { pautas: concluidas.map(p => p.titulo) } : {}) };
  const ids = concluidas.map(p => p.id);
  return { ...d, feedbacks: [...d.feedbacks, f], alteradoEm: agora,
    tecnicos: d.tecnicos.map(t => (t.id === tecnicoId && t.pautas ? { ...t, pautas: t.pautas.filter(p => !ids.includes(p.id)) } : t)) };
}

/** Pauta para o próximo feedback do técnico (fica aberta até ser marcada num feedback). */
export function adicionarPautaTecnico(d: Dados, tecnicoId: string, titulo: string, agora = Date.now()): Dados {
  const t = limpar(titulo);
  if (!t) throw new Error('Escreva a pauta.');
  return { ...d, alteradoEm: agora,
    tecnicos: d.tecnicos.map(x => (x.id === tecnicoId ? { ...x, pautas: [...(x.pautas ?? []), { id: novoId(), titulo: t }] } : x)) };
}

export function removerPautaTecnico(d: Dados, tecnicoId: string, id: string, agora = Date.now()): Dados {
  return { ...d, alteradoEm: agora,
    tecnicos: d.tecnicos.map(x => (x.id === tecnicoId ? { ...x, pautas: (x.pautas ?? []).filter(p => p.id !== id) } : x)) };
}

export function removerFeedback(d: Dados, id: string, agora = Date.now()): Dados {
  return { ...d, feedbacks: d.feedbacks.filter(f => f.id !== id), alteradoEm: agora };
}

export function definirGenero(d: Dados, genero: 'masculino' | 'feminino', agora = Date.now()): Dados {
  return { ...d, genero, alteradoEm: agora };
}

export function definirChaveGemini(d: Dados, chave: string, agora = Date.now()): Dados {
  const { chaveGemini: _, ...resto } = d;
  return chave.trim() ? { ...resto, chaveGemini: chave.trim(), alteradoEm: agora } : { ...resto, alteradoEm: agora };
}

export function definirInstrucoesIA(d: Dados, texto: string, agora = Date.now()): Dados {
  const { instrucoesIA: _, ...resto } = d;
  return texto.trim() ? { ...resto, instrucoesIA: texto.trim(), alteradoEm: agora } : { ...resto, alteradoEm: agora };
}

export const lembrarEmail = (d: Dados, email: string, agora = Date.now()): Dados =>
  ({ ...d, recentes: [email, ...(d.recentes ?? []).filter(e => e !== email)].slice(0, 8), alteradoEm: agora });

/** Feedbacks (de um técnico ou de todos), do mais novo ao mais antigo, agrupados pelo dia local. */
export function feedbacksPorDia(d: Dados, tecnicoId?: string, soGravados = false): { dia: string; itens: Feedback[] }[] {
  const grupos = new Map<string, Feedback[]>();
  for (const f of d.feedbacks.filter(f => (!tecnicoId || f.tecnicoId === tecnicoId) && (!soGravados || f.conversa?.length)).sort((a, b) => b.criadoEm - a.criadoEm)) {
    const dia = new Date(f.criadoEm).toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit', year: 'numeric' });
    grupos.set(dia, [...(grupos.get(dia) ?? []), f]);
  }
  return [...grupos].map(([dia, itens]) => ({ dia, itens }));
}

/** Ativos primeiro, cada grupo por nome. */
export const tecnicosOrdenados = (d: Dados) =>
  [...d.tecnicos].sort((a, b) => Number(!!a.inativo) - Number(!!b.inativo) || a.nome.localeCompare(b.nome, 'pt-BR'));

export function alternarAtivo(d: Dados, id: string, agora = Date.now()): Dados {
  const tecnicos = d.tecnicos.map(t => {
    if (t.id !== id) return t;
    const { inativo, ...resto } = t;
    return inativo ? resto : { ...resto, inativo: true as const };
  });
  return { ...d, tecnicos, alteradoEm: agora };
}

/** Cache local x Drive: vence o mais recente. ponytail: último a gravar vence; mesclar por item se houver 2 gestores. */
export const maisRecente = (a: Dados, b: Dados) => (b.alteradoEm > a.alteradoEm ? b : a);

/** Valida o JSON vindo do Drive (pode ter sido editado à mão): nunca deixa um arquivo estranho quebrar o app. */
export function lerDadosJson(texto: string): Dados | null {
  try {
    const o = JSON.parse(texto);
    if (o?.versao !== 1 || !Array.isArray(o.tecnicos)) return null;
    const tecnicos = o.tecnicos.filter((t: Tecnico) => typeof t?.id === 'string' && typeof t?.nome === 'string')
      .map(({ inativo, ...t }: Tecnico) => ({ ...t, ...(inativo === true ? { inativo } : {}) }));
    const feedbacks = (Array.isArray(o.feedbacks) ? o.feedbacks : []).filter((f: Feedback) =>
      typeof f?.id === 'string' && typeof f?.tecnicoId === 'string' && typeof f?.texto === 'string' && TONS.includes(f?.tom))
      .map(({ conversa, audioId, ...f }: Feedback) => ({ ...f,
        ...(Array.isArray(conversa) && conversa.every(c => (c?.quem === 'eu' || c?.quem === 'tecnico') && typeof c.texto === 'string') ? { conversa } : {}),
        ...(typeof audioId === 'string' && audioId ? { audioId } : {}) }));
    const tarefas = (Array.isArray(o.tarefas) ? o.tarefas : []).filter((t: Tarefa) =>
      typeof t?.id === 'string' && typeof t?.titulo === 'string' && lerDiaIso(t?.dia) && (t.hora === undefined || lerHora(t.hora)))
      .map(({ andamento, prioridade, responsavelId, ...t }: Tarefa) => ({ ...t, feita: t.feita === true,
        ...(andamento === true ? { andamento } : {}), ...(prioridade === 'alta' || prioridade === 'baixa' ? { prioridade } : {}),
        ...(typeof responsavelId === 'string' && responsavelId ? { responsavelId } : {}) }));
    const pautas = (x: unknown): Pauta[] => (Array.isArray(x) ? x : []).filter((p: Pauta) => typeof p?.id === 'string' && typeof p?.titulo === 'string')
      .map((p: Pauta) => ({ id: p.id, titulo: p.titulo, ...(typeof p.descricao === 'string' && p.descricao ? { descricao: p.descricao } : {}) }));
    const reunioes = (Array.isArray(o.reunioes) ? o.reunioes : []).filter((r: Reuniao) =>
      typeof r?.id === 'string' && typeof r?.titulo === 'string' && Number.isInteger(r?.diaSemana) && r.diaSemana >= 0 && r.diaSemana <= 6 && lerHora(r?.hora)
      && (r.dia === undefined || lerDiaIso(r.dia)))
      // F5 tinha `descricao` no lugar das pautas: vira a 1ª pauta.
      .map(({ descricao, pautas: ps, ...r }: Reuniao & { descricao?: unknown }) => ({ ...r,
        pautas: ps !== undefined ? pautas(ps) : typeof descricao === 'string' && descricao ? [{ id: `${r.id}-p`, titulo: 'Pauta', descricao }] : [] }));
    const realizadas = (Array.isArray(o.realizadas) ? o.realizadas : []).filter((x: Realizada) =>
      typeof x?.id === 'string' && typeof x?.reuniaoId === 'string' && typeof x?.titulo === 'string' && lerDiaIso(x?.dia) && lerHora(x?.hora))
      .map((x: Realizada) => ({ ...x, devolutiva: typeof x.devolutiva === 'string' ? x.devolutiva : '',
        pautas: (Array.isArray(x.pautas) ? x.pautas : []).filter(p => typeof p?.id === 'string' && typeof p?.titulo === 'string')
          .map(p => ({ ...pautas([p])[0], tratada: p.tratada === true })) }));
    const opc = (x: unknown) => (typeof x === 'string' && x ? x : undefined);
    const ocorrencias = (Array.isArray(o.ocorrencias) ? o.ocorrencias : []).filter((x: Ocorrencia) =>
      typeof x?.id === 'string' && typeof x?.titulo === 'string' && lerDiaIso(x?.dia))
      .map((x: Ocorrencia): Ocorrencia => {
        const fotos = Array.isArray(x.fotos) ? x.fotos.filter(f => typeof f === 'string' && f) : [];
        return JSON.parse(JSON.stringify({ id: x.id, dia: x.dia, titulo: x.titulo, descricao: opc(x.descricao), observacao: opc(x.observacao),
          tipo: opc(x.tipo), fotos: fotos.length ? fotos : undefined, criadoEm: Number(x.criadoEm) || 0 }));
      });
    const resumos: Record<string, string> = Object.fromEntries(Object.entries(o.resumos && typeof o.resumos === 'object' ? o.resumos : {}).filter((e): e is [string, string] => typeof e[1] === 'string' && !!e[1]));
    return { versao: 1, tecnicos, feedbacks, tarefas, reunioes, realizadas, ocorrencias, ...(Object.keys(resumos).length ? { resumos } : {}), alteradoEm: Number(o.alteradoEm) || 0,
      ...(typeof o.chaveGemini === 'string' && o.chaveGemini ? { chaveGemini: o.chaveGemini } : {}),
      ...(o.genero === 'masculino' || o.genero === 'feminino' ? { genero: o.genero } : {}) };
  } catch {
    return null;
  }
}

/** "0.2.0" > "0.1.10"? Compara número a número. */
export function maisNova(a: string, b: string) {
  const x = a.split('.').map(Number), y = b.split('.').map(Number);
  for (let i = 0; i < Math.max(x.length, y.length); i++) if ((x[i] ?? 0) !== (y[i] ?? 0)) return (x[i] ?? 0) > (y[i] ?? 0);
  return false;
}
