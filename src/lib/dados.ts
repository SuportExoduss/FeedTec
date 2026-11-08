// Regras puras sobre os dados (sem rede nem armazenamento): fáceis de testar.
import { lerDiaIso, lerHora } from './agenda';
import type { Dados, Feedback, Pauta, Realizada, Reuniao, Tarefa, Tecnico, Tom } from '../types';

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
  extra: Pick<Feedback, 'conversa' | 'audioId'> = {}): Dados {
  if (!texto.trim()) throw new Error('O feedback está vazio.');
  const f: Feedback = { id: novoId(), tecnicoId, tom, bruto: bruto.trim(), texto: texto.trim(), criadoEm: agora, ...extra };
  return { ...d, feedbacks: [...d.feedbacks, f], alteradoEm: agora };
}

export function removerFeedback(d: Dados, id: string, agora = Date.now()): Dados {
  return { ...d, feedbacks: d.feedbacks.filter(f => f.id !== id), alteradoEm: agora };
}

export function definirChaveGemini(d: Dados, chave: string, agora = Date.now()): Dados {
  const { chaveGemini: _, ...resto } = d;
  return chave.trim() ? { ...resto, chaveGemini: chave.trim(), alteradoEm: agora } : { ...resto, alteradoEm: agora };
}

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
    return { versao: 1, tecnicos, feedbacks, tarefas, reunioes, realizadas, alteradoEm: Number(o.alteradoEm) || 0,
      ...(typeof o.chaveGemini === 'string' && o.chaveGemini ? { chaveGemini: o.chaveGemini } : {}) };
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
