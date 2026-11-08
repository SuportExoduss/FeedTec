// Tudo que o app guarda cabe num único JSON no Drive do usuário (pasta FeedTec/feedtec.json).
export type Millis = number;

export interface Tecnico {
  id: string;
  nome: string;
  funcao?: string;
  /** Saiu da equipe ou afastado: fica no fim da lista, com os feedbacks guardados. */
  inativo?: true;
  criadoEm: Millis;
}

export type Tom = 'melhorar' | 'neutro' | 'positivo';

/** Uma fala da conversa gravada, já com a voz marcada pelo gestor. */
export interface Fala { quem: 'eu' | 'tecnico'; texto: string }

export interface Feedback {
  id: string;
  tecnicoId: string;
  tom: Tom;
  /** O que o gestor escreveu. */
  bruto: string;
  /** Texto final (gerado pela IA e talvez editado). */
  texto: string;
  criadoEm: Millis;
  /** Conversa transcrita, quando o feedback veio de uma gravação. */
  conversa?: Fala[];
  /** Id do áudio no Drive (pasta FeedTec). */
  audioId?: string;
}

/** Tarefa da agenda (F5). `dia` em AAAA-MM-DD; `hora` (HH:MM) liga o lembrete; `antes` = minutos antes (sem = na hora). */
export type Prioridade = 'alta' | 'media' | 'baixa';
/** `feita` vence `andamento`. Sem `prioridade` = média. `responsavelId` = um técnico. */
export interface Tarefa {
  id: string; titulo: string; dia: string; hora?: string; antes?: number; descricao?: string; feita: boolean; criadoEm: Millis;
  andamento?: true; prioridade?: Prioridade; responsavelId?: string;
}

/** Um assunto da reunião; a descrição pode ter várias linhas. */
export interface Pauta { id: string; titulo: string; descricao?: string }

/**
 * Reunião: com `dia` (AAAA-MM-DD) acontece uma vez; sem `dia` é recorrente, toda semana no `diaSemana`
 * (0 = domingo … 6 = sábado). Aviso `antes` minutos antes (sem = 15). As pautas valem até a reunião ser registrada.
 * `ciente` = início da ocorrência em que o gestor tocou Feito no aviso (para de repetir nela).
 */
export interface Reuniao { id: string; titulo: string; diaSemana: number; dia?: string; hora: string; antes?: number; ciente?: Millis; pautas: Pauta[]; criadoEm: Millis }

/** Reunião registrada no dia: o que foi tratado e a devolutiva (o que foi acordado). */
export interface Realizada {
  id: string; reuniaoId: string; titulo: string; dia: string; hora: string;
  pautas: (Pauta & { tratada: boolean })[]; devolutiva: string; criadoEm: Millis;
}

export interface Dados {
  versao: 1;
  tecnicos: Tecnico[];
  feedbacks: Feedback[];
  tarefas?: Tarefa[];
  reunioes?: Reuniao[];
  realizadas?: Realizada[];
  /** Chave do Gemini (AI Studio) do próprio gestor; vai junto no Drive dele para valer em todo aparelho. */
  chaveGemini?: string;
  /** Momento da última alteração: decide quem vence entre o cache local e o Drive. */
  alteradoEm: Millis;
}

export const DADOS_VAZIOS: Dados = { versao: 1, tecnicos: [], feedbacks: [], alteradoEm: 0 };
