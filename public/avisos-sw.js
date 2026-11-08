// Service worker só para os avisos do site (src/services/lembretes.ts): tocar no aviso abre/foca o FeedTec;
// o botão Feito avisa a aba aberta (ouvirFeito), que marca a tarefa ou para de repetir a reunião.
self.addEventListener('notificationclick', e => {
  e.notification.close();
  e.waitUntil(self.clients.matchAll({ type: 'window', includeUncontrolled: true }).then(abas => {
    const aba = abas.find(a => a.url.startsWith(self.location.origin));
    if (e.action === 'feito') {
      // ponytail: sem aba aberta o Feito se perde (o aviso só toca com o site aberto, então é raro)
      for (const a of abas) a.postMessage({ feito: e.notification.data?.alvo });
      return;
    }
    return aba ? aba.focus() : self.clients.openWindow('/');
  }));
});
