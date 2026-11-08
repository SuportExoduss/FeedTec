// Tarefas e reuniões semanais (F5). Puro, como dados.ts: fácil de testar.
import { novoId } from './dados';
import type { Dados, Millis, Pauta, Prioridade, Realizada, Reuniao, Tarefa } from '../types';

export const DIAS_SEMANA = ['Domingo', 'Segunda', 'Terça', 'Quarta', 'Quinta', 'Sexta', 'Sábado'];
/** Aviso da reunião sem `antes`, em minutos antes. */
export const AVISO_REUNIAO = 15;
/** Sem tocar em Feito, o aviso volta a cada 30 min. */
export const REPETIR_MIN = 30;
// ponytail: limites fixos porque o celular agenda tudo de uma vez (o Android limita alarmes); o app refaz ao abrir.
/** Tarefa: repetições depois do 1º aviso (4 h). */
const REPETICOES = 8;
/** Reunião recorrente: semanas agendadas à frente. */
const SEMANAS = 4;

/** Minutos antes válidos (0 a 24 h); senão o padrão. */
const minutosAntes = (v: unknown, padrao: number) => (Number.isInteger(v) && (v as number) >= 0 && (v as number) <= 1440 ? (v as number) : padrao);

export const textoAntes = (min: number) => (min === 0 ? 'Na hora' : min < 60 ? `${min} min antes` : `${min / 60} h antes`);

const dois = (n: number) => String(n).padStart(2, '0');

/** "HH:MM" válido → o mesmo texto normalizado; senão null. Aceita "9:5" e "0930". */
export function lerHora(txt: unknown): string | null {
  if (typeof txt !== 'string') return null;
  const m = txt.trim().match(/^(\d{1,2}):?(\d{2})$/);
  if (!m || +m[1] > 23 || +m[2] > 59) return null;
  return `${dois(+m[1])}:${m[2]}`;
}

/** "AAAA-MM-DD" que existe no calendário. */
export function lerDiaIso(txt: unknown): string | null {
  if (typeof txt !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(txt)) return null;
  const [a, m, d] = txt.split('-').map(Number);
  const dt = new Date(a, m - 1, d);
  return dt.getFullYear() === a && dt.getMonth() === m - 1 && dt.getDate() === d ? txt : null;
}

/** O gestor digita "dd/mm" ou "dd/mm/aaaa"; sem ano = este ano (ou o próximo, se a data já passou). */
export function lerDia(txt: string, agora: Millis = Date.now()): string | null {
  const m = txt.trim().match(/^(\d{1,2})\/(\d{1,2})(?:\/(\d{2}|\d{4}))?$/);
  if (!m) return null;
  const hoje = new Date(agora);
  let ano = m[3] ? (m[3].length === 2 ? 2000 + +m[3] : +m[3]) : hoje.getFullYear();
  if (!m[3] && new Date(ano, +m[2] - 1, +m[1]) < new Date(hoje.getFullYear(), hoje.getMonth(), hoje.getDate())) ano++;
  return lerDiaIso(`${ano}-${dois(+m[2])}-${dois(+m[1])}`);
}

/** Data local → "AAAA-MM-DD" (toISOString usa UTC e vira o dia à noite). */
export const diaIso = (dt: Date) => `${dt.getFullYear()}-${dois(dt.getMonth() + 1)}-${dois(dt.getDate())}`;

export const mostrarDia =(iso: string) => iso.split('-').reverse().join('/');

/** Momento do lembrete da tarefa (só se tiver hora). */
export function momentoTarefa(t: Tarefa): Date | null {
  if (!t.hora) return null;
  const [a, m, d] = t.dia.split('-').map(Number);
  const [h, min] = t.hora.split(':').map(Number);
  return new Date(a, m - 1, d, h, min);
}

/** Próxima vez que a reunião acontece a partir de agora (avulsa: o próprio dia, mesmo se já passou). */
export function proximaReuniao(r: Reuniao, agora: Millis = Date.now()): Date {
  const [h, min] = r.hora.split(':').map(Number);
  if (r.dia) {
    const [a, m, d] = r.dia.split('-').map(Number);
    return new Date(a, m - 1, d, h, min);
  }
  const dt = new Date(agora);
  dt.setHours(h, min, 0, 0);
  dt.setDate(dt.getDate() + ((r.diaSemana - dt.getDay() + 7) % 7));
  if (dt.getTime() <= agora) dt.setDate(dt.getDate() + 7);
  return dt;
}

export type CamposTarefa = { titulo: string; dia: string; hora?: string; antes?: number; descricao?: string; prioridade?: Prioridade; responsavelId?: string };
export type Situacao = 'pendente' | 'andamento' | 'concluida';
export const situacao = (t: Tarefa): Situacao => (t.feita ? 'concluida' : t.andamento ? 'andamento' : 'pendente');
export const PRIORIDADES: Prioridade[] = ['alta', 'media', 'baixa'];
/** `dia` preenchido = reunião única; vazio = recorrente no `diaSemana`. */
export type CamposReuniao = { titulo: string; diaSemana: number; dia?: string; hora: string; antes?: number; pautas: Pauta[] };

function limparTarefa(c: CamposTarefa): Omit<Tarefa, 'id' | 'feita' | 'andamento' | 'criadoEm'> {
  const titulo = c.titulo.trim();
  if (!titulo) throw new Error('Dê um título à tarefa.');
  const dia = lerDiaIso(c.dia);
  if (!dia) throw new Error('Escolha o dia.');
  const hora = c.hora?.trim() ? lerHora(c.hora) : undefined;
  if (hora === null) throw new Error('Hora inválida. Use hh:mm.');
  const descricao = c.descricao?.trim();
  const antes = hora && c.antes ? minutosAntes(c.antes, 0) : 0;
  const prioridade = c.prioridade && c.prioridade !== 'media' && PRIORIDADES.includes(c.prioridade) ? c.prioridade : undefined;
  return { titulo, dia, ...(hora ? { hora } : {}), ...(antes ? { antes } : {}), ...(descricao ? { descricao } : {}),
    ...(prioridade ? { prioridade } : {}), ...(c.responsavelId ? { responsavelId: c.responsavelId } : {}) };
}

function limparReuniao(c: CamposReuniao): Omit<Reuniao, 'id' | 'criadoEm'> {
  const titulo = c.titulo.trim();
  if (!titulo) throw new Error('Dê um título à reunião.');
  const hora = lerHora(c.hora);
  if (!hora) throw new Error('Escolha a hora.');
  const pautas = c.pautas.map(p => ({ id: p.id, titulo: p.titulo.trim(), ...(p.descricao?.trim() ? { descricao: p.descricao.trim() } : {}) }));
  if (pautas.some(p => !p.titulo)) throw new Error('Toda pauta precisa de um título.');
  const aviso = c.antes === undefined ? {} : { antes: minutosAntes(c.antes, AVISO_REUNIAO) };
  if (c.dia?.trim()) {
    const dia = lerDiaIso(c.dia);
    if (!dia) throw new Error('Escolha a data.');
    const [a, m, d] = dia.split('-').map(Number);
    return { titulo, dia, diaSemana: new Date(a, m - 1, d).getDay(), hora, ...aviso, pautas };
  }
  if (!Number.isInteger(c.diaSemana) || c.diaSemana < 0 || c.diaSemana > 6) throw new Error('Escolha o dia da semana.');
  return { titulo, diaSemana: c.diaSemana, hora, ...aviso, pautas };
}

const tarefas = (d: Dados) => d.tarefas ?? [];
const reunioes = (d: Dados) => d.reunioes ?? [];
const realizadas = (d: Dados) => d.realizadas ?? [];

export const adicionarTarefa = (d: Dados, c: CamposTarefa, agora = Date.now()): Dados =>
  ({ ...d, tarefas: [...tarefas(d), { id: novoId(), feita: false, criadoEm: agora, ...limparTarefa(c) }], alteradoEm: agora });

export const editarTarefa = (d: Dados, id: string, c: CamposTarefa, agora = Date.now()): Dados =>
  ({ ...d, tarefas: tarefas(d).map(t => (t.id === id ? { id, feita: t.feita, ...(t.andamento ? { andamento: true as const } : {}), criadoEm: t.criadoEm, ...limparTarefa(c) } : t)), alteradoEm: agora });

export const alternarFeita = (d: Dados, id: string, agora = Date.now()): Dados =>
  ({ ...d, tarefas: tarefas(d).map(t => (t.id === id ? { ...t, feita: !t.feita } : t)), alteradoEm: agora });

export function moverTarefa(d: Dados, id: string, s: Situacao, agora = Date.now()): Dados {
  return { ...d, alteradoEm: agora, tarefas: tarefas(d).map(t => {
    if (t.id !== id) return t;
    const { andamento: _, ...resto } = t;
    return { ...resto, feita: s === 'concluida', ...(s === 'andamento' ? { andamento: true as const } : {}) };
  }) };
}

export const removerTarefa = (d: Dados, id: string, agora = Date.now()): Dados =>
  ({ ...d, tarefas: tarefas(d).filter(t => t.id !== id), alteradoEm: agora });

export const adicionarReuniao = (d: Dados, c: CamposReuniao, agora = Date.now()): Dados =>
  ({ ...d, reunioes: [...reunioes(d), { id: novoId(), criadoEm: agora, ...limparReuniao(c) }], alteradoEm: agora });

export const editarReuniao = (d: Dados, id: string, c: CamposReuniao, agora = Date.now()): Dados =>
  ({ ...d, reunioes: reunioes(d).map(r => (r.id === id ? { id, criadoEm: r.criadoEm, ...(r.ciente ? { ciente: r.ciente } : {}), ...limparReuniao(c) } : r)), alteradoEm: agora });

export const removerReuniao = (d: Dados, id: string, agora = Date.now()): Dados =>
  ({ ...d, reunioes: reunioes(d).filter(r => r.id !== id), alteradoEm: agora });

/** A reunião cai hoje e ainda não foi registrada hoje: dá para marcar as pautas e escrever a devolutiva. */
export function reuniaoDeHoje(d: Dados, r: Reuniao, agora: Millis = Date.now()): boolean {
  const hoje = diaIso(new Date(agora));
  const cai = r.dia ? r.dia === hoje : r.diaSemana === new Date(agora).getDay();
  return cai && !realizadas(d).some(x => x.reuniaoId === r.id && x.dia === hoje);
}

/**
 * Registra a reunião de hoje: todas as pautas (tratadas ou não) ficam nesse registro e não seguem
 * para a próxima. A recorrente volta sem pautas; a única sai da agenda.
 */
export function registrarReuniao(d: Dados, id: string, tratadas: string[], devolutiva: string, agora = Date.now()): Dados {
  const r = reunioes(d).find(x => x.id === id);
  if (!r) throw new Error('Reunião não encontrada.');
  const feita: Realizada = {
    id: novoId(), reuniaoId: r.id, titulo: r.titulo, dia: diaIso(new Date(agora)), hora: r.hora,
    pautas: r.pautas.map(p => ({ ...p, tratada: tratadas.includes(p.id) })), devolutiva: devolutiva.trim(), criadoEm: agora,
  };
  return {
    ...d,
    reunioes: r.dia ? reunioes(d).filter(x => x.id !== id) : reunioes(d).map(x => (x.id === id ? { ...x, pautas: [] } : x)),
    realizadas: [...realizadas(d), feita],
    alteradoEm: agora,
  };
}

export const removerRealizada = (d: Dados, id: string, agora = Date.now()): Dados =>
  ({ ...d, realizadas: realizadas(d).filter(x => x.id !== id), alteradoEm: agora });

/** Mais recentes primeiro. */
export const realizadasOrdenadas = (d: Dados) =>
  [...realizadas(d)].sort((a, b) => (b.dia + b.hora).localeCompare(a.dia + a.hora) || b.criadoEm - a.criadoEm);

/** Pendentes primeiro (por dia e hora; sem hora no fim do dia), feitas depois. */
export const tarefasOrdenadas = (d: Dados) =>
  [...tarefas(d)].sort((a, b) => Number(a.feita) - Number(b.feita) || (a.dia + (a.hora ?? '99')).localeCompare(b.dia + (b.hora ?? '99')));

/** Pela próxima ocorrência. */
export const reunioesOrdenadas = (d: Dados, agora = Date.now()) =>
  [...reunioes(d)].sort((a, b) => proximaReuniao(a, agora).getTime() - proximaReuniao(b, agora).getTime());

/** A quem o botão Feito do aviso se refere; `ocorrencia` = início daquela reunião. */
export type Alvo = { tipo: 'tarefa'; id: string } | { tipo: 'reuniao'; id: string; ocorrencia: Millis };
/** Aviso com momento absoluto; `id` único (identificador da notificação no celular, tag no site). */
export type Aviso = { id: string; quando: Millis; titulo: string; corpo: string; alvo: Alvo };

/**
 * Avisos depois de `desde`, para o celular (lembretes.native.ts) e o site (lembretes.ts), ordenados.
 * Tarefa: `antes` min antes da hora e de novo a cada 30 min (até 4 h) enquanto não for feita.
 * Reunião: `antes` min antes (padrão 15) e a cada 30 min até começar, salvo se já deu Feito naquela ocorrência.
 */
export function avisosDaAgenda(d: Dados, desde: Millis = Date.now()): Aviso[] {
  const lista: Aviso[] = [];
  const por = (inicio: Millis, vezes: number, titulo: string, corpo: string, alvo: Alvo) => {
    for (let i = 0; i < vezes; i++) {
      const quando = inicio + i * REPETIR_MIN * 60000;
      if (quando > desde) lista.push({ id: `${alvo.tipo}-${alvo.id}-${quando}`, quando, titulo, corpo, alvo });
    }
  };
  for (const t of tarefas(d)) {
    const m = momentoTarefa(t);
    if (!t.feita && m) por(m.getTime() - minutosAntes(t.antes, 0) * 60000, 1 + REPETICOES, t.titulo, t.descricao ?? 'Tarefa de hoje', { tipo: 'tarefa', id: t.id });
  }
  for (const r of reunioes(d)) {
    const antes = minutosAntes(r.antes, AVISO_REUNIAO);
    const n = r.pautas.length;
    const corpo = `Reunião às ${r.hora}${n ? ` · ${n === 1 ? '1 pauta' : `${n} pautas`}` : ''}`;
    const primeira = proximaReuniao(r, desde);
    for (let k = 0; k < (r.dia ? 1 : SEMANAS); k++) {
      const inicio = new Date(primeira);
      inicio.setDate(inicio.getDate() + 7 * k);
      const ocorrencia = inicio.getTime();
      if (ocorrencia > desde && ocorrencia !== r.ciente)
        por(ocorrencia - antes * 60000, Math.max(1, Math.ceil(antes / REPETIR_MIN)), r.titulo, corpo, { tipo: 'reuniao', id: r.id, ocorrencia });
    }
  }
  return lista.sort((a, b) => a.quando - b.quando);
}

/** Botão Feito do aviso: tarefa fica feita; reunião para de repetir naquela ocorrência. Item sumiu: não muda nada. */
export function concluirAviso(d: Dados, alvo: Alvo, agora = Date.now()): Dados {
  if (alvo.tipo === 'tarefa') {
    if (!tarefas(d).some(t => t.id === alvo.id && !t.feita)) return d;
    return { ...d, tarefas: tarefas(d).map(t => (t.id === alvo.id ? { ...t, feita: true } : t)), alteradoEm: agora };
  }
  if (!reunioes(d).some(r => r.id === alvo.id)) return d;
  return { ...d, reunioes: reunioes(d).map(r => (r.id === alvo.id ? { ...r, ciente: alvo.ocorrencia } : r)), alteradoEm: agora };
}
