// Lembretes locais: os mesmos avisos do site (avisosDaAgenda): antes escolhido, repetição a cada 30 min, botão Feito.
// Reiniciar o celular não apaga: o expo-notifications reagenda tudo no BOOT_COMPLETED (RECEIVE_BOOT_COMPLETED no manifesto).
// Refaz tudo a cada mudança (poucos itens): sem guardar ids de notificação.
import * as N from 'expo-notifications';
import { avisosDaAgenda, type Alvo } from '../lib/agenda';
import type { Dados } from '../types';

N.setNotificationHandler({
  handleNotification: async () => ({ shouldShowBanner: true, shouldShowList: true, shouldPlaySound: true, shouldSetBadge: false }),
});

const CANAL = 'lembretes';
const CATEGORIA = 'lembrete';
const MAXIMO = 60; // ponytail: o Android limita alarmes; os 60 mais próximos, o resto entra quando o app abrir de novo
let fila = Promise.resolve();
let ultimo = '';

async function refazer(d: Dados) {
  await N.cancelAllScheduledNotificationsAsync();
  const avisos = avisosDaAgenda(d).slice(0, MAXIMO);
  if (!avisos.length) return;
  if (!(await N.getPermissionsAsync()).granted && !(await N.requestPermissionsAsync()).granted) return;
  await N.setNotificationChannelAsync(CANAL, { name: 'Lembretes', importance: N.AndroidImportance.HIGH });
  // Feito abre o app: com o app fechado, só assim o JS roda para marcar a tarefa (ouvirFeito).
  await N.setNotificationCategoryAsync(CATEGORIA, [{ identifier: 'feito', buttonTitle: 'Feito', options: { opensAppToForeground: true } }]);
  for (const a of avisos) await N.scheduleNotificationAsync({
    identifier: a.id,
    content: { title: a.titulo, body: a.corpo, data: { alvo: a.alvo }, categoryIdentifier: CATEGORIA },
    trigger: { type: N.SchedulableTriggerInputTypes.DATE, date: new Date(a.quando), channelId: CANAL },
  });
}

/** Chamar sempre que os dados mudam; só refaz se tarefas/reuniões mudaram. */
export function agendarLembretes(d: Dados) {
  const chave = JSON.stringify([d.tarefas, d.reunioes]);
  if (chave === ultimo) return;
  ultimo = chave;
  fila = fila.then(() => refazer(d)).catch(e => console.warn('lembretes', e));
}

/** Toque em Feito numa notificação (também a que abriu o app). Some com os avisos daquele item que estão na tela. */
export function ouvirFeito(fn: (alvo: Alvo) => void): () => void {
  const tratar = (r: N.NotificationResponse | null) => {
    if (r?.actionIdentifier !== 'feito') return;
    N.clearLastNotificationResponse();
    const alvo = r.notification.request.content.data?.alvo as Alvo | undefined;
    if (!alvo) return;
    fn(alvo);
    N.getPresentedNotificationsAsync().then(ns => Promise.all(ns
      .filter(n => (n.request.content.data?.alvo as Alvo | undefined)?.id === alvo.id)
      .map(n => N.dismissNotificationAsync(n.request.identifier)))).catch(() => {});
  };
  tratar(N.getLastNotificationResponse());
  const sub = N.addNotificationResponseReceivedListener(tratar);
  return () => sub.remove();
}

// Web push é só do site (lembretes.ts); no celular os avisos locais acima já cobrem.
export type EstadoAvisos = 'ligado' | 'desligado' | 'negado' | 'sem-suporte';
export const estadoAvisos = async (): Promise<EstadoAvisos> => 'sem-suporte';
export const ativarAvisos = async (_d: Dados): Promise<EstadoAvisos> => 'sem-suporte';
export const desligarAvisos = async () => {};
