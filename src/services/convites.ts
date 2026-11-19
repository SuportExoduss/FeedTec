// Enviar reunião a um colega pelo e-mail do Google dele. O convite fica no Firestore só até ele aceitar
// (a reunião vira dele, no Drive dele) ou recusar; nos dois casos o convite é apagado. Regras em firestore.rules.
import { addDoc, collection, deleteDoc, doc, getFirestore, onSnapshot, query, serverTimestamp, where } from 'firebase/firestore';
import { app, auth } from './firebase';
import type { CamposReuniao, CamposTarefa } from '../lib/agenda';
import { novoId } from '../lib/dados';
import type { Reuniao, Tarefa } from '../types';

const convites = collection(getFirestore(app), 'convites');
export type Convite = { id: string; deNome: string; reuniao: CamposReuniao };
export const EMAIL = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

function remetente(email: string) {
  const eu = auth.currentUser;
  if (!eu) throw new Error('Entre com o Google para enviar.');
  const para = email.trim().toLowerCase();
  if (!EMAIL.test(para)) throw new Error('E-mail inválido.');
  if (para === eu.email?.toLowerCase()) throw new Error('Esse é o seu e-mail.');
  return { deUid: eu.uid, deNome: (eu.displayName ?? eu.email ?? 'Um colega').slice(0, 80), para, criadoEm: serverTimestamp() };
}

export async function enviarConvite(email: string, r: Reuniao) {
  const de = remetente(email);
  // JSON tira os campos undefined (o Firestore recusa undefined). O aviso (antes) cada um escolhe o seu.
  const reuniao = JSON.parse(JSON.stringify({ titulo: r.titulo, diaSemana: r.diaSemana, dia: r.dia, hora: r.hora, pautas: r.pautas }));
  await addDoc(convites, { ...de, reuniao });
}

// Tarefas vão numa coleção à parte: versões antigas do app só leem `convites` e não mostram tarefa como reunião vazia.
const convitesTarefa = collection(getFirestore(app), 'convitesTarefa');
export type ConviteTarefa = { id: string; deNome: string; tarefa: CamposTarefa };

export async function enviarTarefa(email: string, t: Tarefa) {
  const de = remetente(email);
  // Responsável é um técnico meu: não vai. Feita/andamento também não; o colega recebe como pendente.
  const tarefa = JSON.parse(JSON.stringify({ titulo: t.titulo, dia: t.dia, hora: t.hora, descricao: t.descricao, prioridade: t.prioridade }));
  await addDoc(convitesTarefa, { ...de, tarefa });
}

export function ouvirTarefas(email: string, aoMudar: (c: ConviteTarefa[]) => void) {
  const txt = (v: unknown) => (typeof v === 'string' ? v.slice(0, 2000) : '');
  return onSnapshot(query(convitesTarefa, where('para', '==', email.toLowerCase())),
    s => aoMudar(s.docs.map(d => {
      const t = d.data().tarefa;
      return { id: d.id, deNome: txt(d.data().deNome), tarefa: { titulo: txt(t?.titulo), dia: txt(t?.dia), hora: txt(t?.hora) || undefined,
        descricao: txt(t?.descricao) || undefined, prioridade: ['alta', 'baixa'].includes(t?.prioridade) ? t.prioridade : undefined } };
    })),
    () => aoMudar([]));
}

export const apagarConviteTarefa = (id: string) => deleteDoc(doc(convitesTarefa, id));

/** Convites para o e-mail de quem está logado. Devolve a função que para de ouvir. */
export function ouvirConvites(email: string, aoMudar: (c: Convite[]) => void) {
  return onSnapshot(query(convites, where('para', '==', email.toLowerCase())),
    s => aoMudar(s.docs.map(d => ({ id: d.id, deNome: String(d.data().deNome ?? ''), reuniao: camposDoConvite(d.data().reuniao) }))),
    () => aoMudar([]));
}

/** O convite veio de outra pessoa: só passa adiante o que tem o formato certo. adicionarReuniao valida o resto. */
export function camposDoConvite(r: any): CamposReuniao {
  const txt = (v: unknown) => (typeof v === 'string' ? v.slice(0, 2000) : '');
  return {
    titulo: txt(r?.titulo), hora: txt(r?.hora), diaSemana: Number(r?.diaSemana),
    ...(txt(r?.dia) ? { dia: txt(r.dia) } : {}),
    pautas: (Array.isArray(r?.pautas) ? r.pautas : []).slice(0, 50)
      .map((p: any) => ({ id: novoId(), titulo: txt(p?.titulo), ...(txt(p?.descricao) ? { descricao: txt(p.descricao) } : {}) })),
  };
}

export const apagarConvite = (id: string) => deleteDoc(doc(convites, id));
