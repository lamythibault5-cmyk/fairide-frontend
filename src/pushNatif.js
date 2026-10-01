// Notifications push dans l'application native (APNs sur iPhone, FCM sur Android).
//
// Le Web Push de push.js passe par le service worker : il n'existe pas dans une WebView Capacitor. Ici le
// système remet un jeton d'appareil, que l'on confie au serveur (POST /push/native-token) ; c'est lui qui
// envoie ensuite par Firebase Cloud Messaging (voir pushService.js côté API). Même interface que push.js :
// 'ok' | 'refuse' | 'indisponible' | 'erreur', pour que usePushNotifications ne voie pas la différence.

import { api } from './api';
import { plateforme } from './natif';

const CLE_JETON = 'fairide_push_natif';

export function jetonNatifCourant() {
  try { return localStorage.getItem(CLE_JETON); } catch { return null; }
}

let ecouteursPoses = false;
// Clic sur une notification : on ouvre la page qu'elle désigne (data.url), comme le service worker le fait
// sur le web. Posé une seule fois, à la première demande d'abonnement ou au démarrage (main.jsx).
export async function ecouterNotificationsNatives(historique) {
  if (ecouteursPoses) return;
  ecouteursPoses = true;
  try {
    const { PushNotifications } = await import('@capacitor/push-notifications');
    PushNotifications.addListener('pushNotificationActionPerformed', ({ notification }) => {
      const url = notification?.data?.url;
      if (url && typeof url === 'string' && url.startsWith('/')) historique.push(url);
    });
    // Reçue alors que l'application est au premier plan : les listes se rafraîchissent tout de suite
    // (useNewOrderAlert sonne et affiche la commande dès qu'elle apparaît).
    PushNotifications.addListener('pushNotificationReceived', () => {
      document.dispatchEvent(new Event('visibilitychange'));
    });
  } catch { /* greffon absent */ }
}

export async function abonnerNatif(token) {
  const { enabled, native } = await api('/push/key').catch(() => ({ enabled: false }));
  if (!enabled || !native) return 'indisponible';
  let PushNotifications;
  try { ({ PushNotifications } = await import('@capacitor/push-notifications')); } catch { return 'indisponible'; }

  let permission = await PushNotifications.checkPermissions();
  if (permission.receive === 'prompt' || permission.receive === 'prompt-with-rationale') {
    permission = await PushNotifications.requestPermissions();
  }
  if (permission.receive !== 'granted') return 'refuse';

  // Android 8+ : un canal avec son et importance haute, sinon la notification arrive muette et repliée.
  if (plateforme() === 'android') {
    await PushNotifications.createChannel({
      id: 'commandes', name: 'Commandes', description: 'Nouvelles commandes et livraisons',
      importance: 5, visibility: 1, sound: 'default', vibration: true
    }).catch(() => {});
  }

  return new Promise((resolve) => {
    let fini = false;
    const terminer = (issue) => { if (!fini) { fini = true; resolve(issue); } };
    PushNotifications.addListener('registration', async ({ value }) => {
      try {
        await api('/push/native-token', { method: 'POST', token, body: { token: value, platform: plateforme() } });
        try { localStorage.setItem(CLE_JETON, value); } catch { /* rien */ }
        terminer('ok');
      } catch { terminer('erreur'); }
    });
    PushNotifications.addListener('registrationError', () => terminer('erreur'));
    PushNotifications.register().catch(() => terminer('erreur'));
    setTimeout(() => terminer('erreur'), 15000);
  });
}

export async function desabonnerNatif(token) {
  const jeton = jetonNatifCourant();
  if (jeton) await api('/push/native-token', { method: 'DELETE', token, body: { token: jeton } }).catch(() => {});
  try { localStorage.removeItem(CLE_JETON); } catch { /* rien */ }
  return true;
}
