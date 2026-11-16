// Ocorrências diárias: regras puras (períodos, agrupamento, ponderação por tipo).
import { diaIso, lerDiaIso } from './agenda';
import { novoId } from './dados';
import type { Dados, Ocorrencia } from '../types';

export type CamposOcorrencia = { dia: string; titulo: string; descricao?: string; observacao?: string; fotos?: string[] };
export type Periodo = 'dia' | 'semana' | 'mes';

/** Só guarda o que tem conteúdo (JSON enxuto no Drive). */
function campos(c: CamposOcorrencia) {
  const titulo = c.titulo.trim();
  if (!titulo) throw new Error('Dê um título à ocorrência.');
  if (!lerDiaIso(c.dia)) throw new Error('Data inválida.');
  const descricao = c.descricao?.trim(), observacao = c.observacao?.trim();
  return { dia: c.dia, titulo, ...(descricao ? { descricao } : {}), ...(observacao ? { observacao } : {}),
    ...(c.fotos?.length ? { fotos: c.fotos } : {}) };
}

const lista = (d: Dados) => d.ocorrencias ?? [];

export function adicionarOcorrencia(d: Dados, c: CamposOcorrencia, agora = Date.now()): { dados: Dados; nova: Ocorrencia } {
  const nova: Ocorrencia = { id: novoId(), ...campos(c), criadoEm: agora };
  return { dados: { ...d, ocorrencias: [...lista(d), nova], alteradoEm: agora }, nova };
}

/** Editar mantém o tipo; quem chama reclassifica se o texto mudou. */
export const editarOcorrencia = (d: Dados, id: string, c: CamposOcorrencia, agora = Date.now()): Dados =>
  ({ ...d, ocorrencias: lista(d).map(o => (o.id === id ? { id, ...campos(c), ...(o.tipo ? { tipo: o.tipo } : {}), criadoEm: o.criadoEm } : o)), alteradoEm: agora });

export const removerOcorrencia = (d: Dados, id: string, agora = Date.now()): Dados =>
  ({ ...d, ocorrencias: lista(d).filter(o => o.id !== id), alteradoEm: agora });

export const definirTipo = (d: Dados, id: string, tipo: string, agora = Date.now()): Dados =>
  ({ ...d, ocorrencias: lista(d).map(o => (o.id === id ? { ...o, tipo } : o)), alteradoEm: agora });

export const definirResumo = (d: Dados, tipo: string, resumo: string, agora = Date.now()): Dados =>
  ({ ...d, resumos: { ...d.resumos, [tipo]: resumo }, alteradoEm: agora });

/** Ocorrências de um assunto, mais recente primeiro. */
export const doTipo = (d: Dados, tipo: string) =>
  lista(d).filter(o => (o.tipo ?? 'Sem tipo') === tipo).sort((a, b) => b.dia.localeCompare(a.dia) || b.criadoEm - a.criadoEm);

const data = (iso: string) => { const [a, m, d] = iso.split('-').map(Number); return new Date(a, m - 1, d); };

/** Primeiro e último dia (AAAA-MM-DD) do período que contém `ref`. Semana = segunda a domingo. */
export function intervalo(p: Periodo, ref: string): [string, string] {
  const r = data(ref);
  if (p === 'dia') return [ref, ref];
  if (p === 'mes') return [diaIso(new Date(r.getFullYear(), r.getMonth(), 1)), diaIso(new Date(r.getFullYear(), r.getMonth() + 1, 0))];
  const seg = new Date(r.getFullYear(), r.getMonth(), r.getDate() - ((r.getDay() + 6) % 7));
  return [diaIso(seg), diaIso(new Date(seg.getFullYear(), seg.getMonth(), seg.getDate() + 6))];
}

/** Anda `n` períodos para frente (negativo = para trás). */
export function deslocar(p: Periodo, ref: string, n: number): string {
  const r = data(ref);
  if (p === 'mes') return diaIso(new Date(r.getFullYear(), r.getMonth() + n, 1));
  return diaIso(new Date(r.getFullYear(), r.getMonth(), r.getDate() + n * (p === 'dia' ? 1 : 7)));
}

const MESES = ['janeiro', 'fevereiro', 'março', 'abril', 'maio', 'junho', 'julho', 'agosto', 'setembro', 'outubro', 'novembro', 'dezembro'];
const curto = (iso: string) => iso.slice(8) + '/' + iso.slice(5, 7);
export const nomeMes = (iso: string) => `${MESES[Number(iso.slice(5, 7)) - 1]} ${iso.slice(0, 4)}`;

export function rotuloPeriodo(p: Periodo, ref: string): string {
  if (p === 'dia') return curto(ref) + '/' + ref.slice(0, 4);
  if (p === 'mes') return nomeMes(ref);
  const [ini, fim] = intervalo('semana', ref);
  return `${curto(ini)} a ${curto(fim)}`;
}

export function noPeriodo(d: Dados, p: Periodo, ref: string): Ocorrencia[] {
  const [ini, fim] = intervalo(p, ref);
  return lista(d).filter(o => o.dia >= ini && o.dia <= fim);
}

/** Mais recente primeiro; dentro do dia, a última registrada no topo. */
export function porDia(os: Ocorrencia[]): { dia: string; itens: Ocorrencia[] }[] {
  const grupos = new Map<string, Ocorrencia[]>();
  for (const o of [...os].sort((a, b) => b.dia.localeCompare(a.dia) || b.criadoEm - a.criadoEm))
    grupos.set(o.dia, [...(grupos.get(o.dia) ?? []), o]);
  return [...grupos].map(([dia, itens]) => ({ dia, itens }));
}

/** Tipos já usados, cada um com até 3 títulos de exemplo (contexto para o Gemini). */
export function tiposExistentes(d: Dados, menos?: string): { tipo: string; exemplos: string[] }[] {
  const m = new Map<string, string[]>();
  for (const o of lista(d)) if (o.tipo && o.id !== menos) m.set(o.tipo, [...(m.get(o.tipo) ?? []), o.titulo]);
  return [...m].map(([tipo, ex]) => ({ tipo, exemplos: ex.slice(-3) }));
}

export type Peso = { tipo: string; meses: number[]; total: number };

/**
 * Contagem por tipo no mês de `ref` (meses[0]) e nos `anteriores` meses antes dele (meses[1..]).
 * Ordena pelo mês atual, depois pelo total. Sem tipo entra como "Sem tipo".
 */
export function ponderacao(d: Dados, ref: string, anteriores = 3): Peso[] {
  const inicios = Array.from({ length: anteriores + 1 }, (_, i) => deslocar('mes', ref, -i).slice(0, 7));
  const m = new Map<string, number[]>();
  for (const o of lista(d)) {
    const i = inicios.indexOf(o.dia.slice(0, 7));
    if (i < 0) continue;
    const tipo = o.tipo ?? 'Sem tipo';
    const v = m.get(tipo) ?? Array(inicios.length).fill(0);
    v[i]++;
    m.set(tipo, v);
  }
  return [...m].map(([tipo, meses]) => ({ tipo, meses, total: meses.reduce((a, b) => a + b, 0) }))
    .sort((a, b) => b.meses[0] - a.meses[0] || b.total - a.total || a.tipo.localeCompare(b.tipo));
}

/** Relevante = se repete (2+ vezes nos meses olhados). */
export const repetida = (p: Peso) => p.total >= 2;
