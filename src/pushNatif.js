// Notifications push dans l'application native (APNs sur iPhone, FCM sur Android).
//
// Le Web Push de push.js passe par le service worker : il n'existe pas dans une WebView Capacitor. Ici le
// système remet un jeton d'appareil, que l'on confie au serveur (POST /push/native-token) ; c'est lui qui
// envoie ensuite par Firebase Cloud Messaging (voir pushService.js côté API). Même interface que push.js :
// 'ok' | 'refuse' | 'indisponible' | 'erreur', pour que usePushNotifications ne voie pas la différence.

import { api } from './api';
import { plateforme } from './natif';

const CLE_JETON = 'fairide_push_natif';
// Jeton retiré parce que la permission du téléphone l'a été (suivrePermissionNative, plus bas, G39).
const CLE_COUPE = 'fairide_push_natif_coupe';

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
      // Un chemin interne seulement (audit sécurité 2026-10-31) : « //autre.site » et « /\autre.site » commencent aussi
      // par « / » mais désignent un autre site pour le navigateur.
      if (url && typeof url === 'string' && url.startsWith('/') && !url.startsWith('//') && !url.startsWith('/\\')) historique.push(url);
    });
    // Reçue alors que l'application est au premier plan : les listes se rafraîchissent tout de suite
    // (useNewOrderAlert sonne et affiche la commande dès qu'elle apparaît).
    // Le faux « visibilitychange » ne suffisait pas : useRevalidation ne relit qu'après 20 s de page cachée, et la commande
    // n'apparaissait qu'au sondage suivant, jusqu'à 15 s plus tard (audit du 19/10, shop-216). Le tableau du commerce écoute
    // aussi l'événement du flux du terminal (terminalNavigateur.js, même nom) : il relit les commandes tout de suite.
    PushNotifications.addListener('pushNotificationReceived', () => {
      document.dispatchEvent(new Event('visibilitychange'));
      window.dispatchEvent(new Event('fairide:commande-arrivee'));
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

  return enregistrerAppareil(PushNotifications, token);
}

/* LES CANAUX ANDROID ET LE SON LONG D'UNE NOUVELLE COMMANDE.
 *
 * Android 8+ : un canal avec son et importance haute, sinon la notification arrive muette et repliée. Créé à CHAQUE
 * enregistrement du jeton (bug hunt avant GO, G110) : il ne l'était qu'à l'activation par la personne, et un téléphone
 * rattaché sans demande (permission déjà accordée : réinstallation, second compte) recevait tout dans le canal par défaut,
 * sans bandeau. Créer un canal qui existe déjà ne change rien.
 *
 * LE SON LONG (bug hunt avant GO, G43 ; décision d'Owen, 2026-11-06). Téléphone verrouillé, la sonnerie de la page se tait
 * et il ne restait qu'un « ding » court. Une nouvelle commande sonne maintenant ~14 s (scripts/son-nouvelle-commande.mjs) :
 *   - Android : le canal « commandes2 » et son son res/raw/nouvelle_commande.wav, seulement dans une app qui a ce fichier.
 *     Le greffon EcranAllume arrive dans la même version du store : sa présence le dit (une mise à jour directe de ces
 *     écrans sur une app plus ancienne créerait sinon un canal au son introuvable, donc muet).
 *   - iPhone : le son est copié dans Library/Sounds, où iOS le cherche (aucune nouvelle version du store nécessaire).
 * Le serveur ne l'envoie qu'aux appareils qui le déclarent (POST /push/native-token › alarmeLongue, fairide-backend/fcm.js). */
let sonIos = null;
async function preparerSonIos() {
  sonIos ||= (async () => {
    const { Filesystem, Directory } = await import('@capacitor/filesystem');
    const blob = await (await fetch('/sons/nouvelle_commande.wav')).blob();
    const base64 = await new Promise((resolve, reject) => { const l = new FileReader(); l.onload = () => resolve(String(l.result).split(',')[1] || ''); l.onerror = reject; l.readAsDataURL(blob); });
    if (!base64) return false;
    await Filesystem.writeFile({ path: 'Sounds/nouvelle_commande.wav', data: base64, directory: Directory.Library, recursive: true });
    return true;
  })().catch(() => { sonIos = null; return false; });
  return sonIos;
}
async function preparerCanaux(PushNotifications) {
  if (plateforme() === 'ios') return preparerSonIos();
  if (plateforme() !== 'android') return false;
  await PushNotifications.createChannel({
    id: 'commandes', name: 'Commandes', description: 'Nouvelles commandes et livraisons',
    importance: 5, visibility: 1, sound: 'default', vibration: true
  }).catch(() => {});
  let Capacitor;
  try { ({ Capacitor } = await import('@capacitor/core')); } catch { return false; }
  if (!Capacitor.isPluginAvailable('EcranAllume')) return false;
  return PushNotifications.createChannel({
    id: 'commandes2', name: 'Nouvelles commandes', description: 'Sonnerie longue pour chaque nouvelle commande',
    importance: 5, visibility: 1, sound: 'nouvelle_commande.wav', vibration: true
  }).then(() => true, () => false);
}

/* Le jeton de l'appareil, confié au serveur POUR LE COMPTE DE `token`.
 *
 * LES ÉCOUTEURS PARTENT AVEC LA DEMANDE (2026-10-26). Ils restaient posés : à la demande suivante (autre compte sur le
 * même téléphone), l'événement « registration » réveillait aussi ceux d'avant, qui renvoyaient le jeton avec la session
 * d'avant — rattachant le téléphone à l'ancien compte, ou, cette session étant fermée, recevant un 401 qui déconnectait
 * le nouveau compte (api.js). Chaque demande retire maintenant les siens dès qu'elle a sa réponse. */
async function enregistrerAppareil(PushNotifications, token) {
  const alarmeLongue = await preparerCanaux(PushNotifications).catch(() => false);
  return new Promise((resolve) => {
    let fini = false;
    const poses = [];
    const terminer = (issue) => {
      if (fini) return;
      fini = true;
      for (const p of poses) Promise.resolve(p).then((h) => h?.remove?.()).catch(() => {});
      resolve(issue);
    };
    poses.push(PushNotifications.addListener('registration', async ({ value }) => {
      if (fini) return;
      try {
        await api('/push/native-token', { method: 'POST', token, body: { token: value, platform: plateforme(), alarmeLongue: alarmeLongue === true } });
        try { localStorage.setItem(CLE_JETON, value); localStorage.removeItem(CLE_COUPE); } catch { /* rien */ }
        terminer('ok');
      } catch { terminer('erreur'); }
    }));
    poses.push(PushNotifications.addListener('registrationError', () => terminer('erreur')));
    PushNotifications.register().catch(() => terminer('erreur'));
    setTimeout(() => terminer('erreur'), 15000);
  });
}

/* CHANGEMENT DE COMPTE SUR LE MÊME TÉLÉPHONE (fondateur, 2026-10-26). La permission est demandée une fois par téléphone
 * (AmorceNotifications.jsx, juste après la première inscription ou connexion) et le jeton s'enregistrait seulement à ce
 * moment-là. Se déconnecter puis se connecter avec un autre compte laissait donc le téléphone rattaché au premier : le
 * second ne recevait rien (constaté sur le compte de relecture d'Apple, aucun appareil enregistré). À chaque ouverture de
 * session, si la permission est DÉJÀ accordée, le jeton est confié au serveur pour ce compte — sans jamais la demander :
 * une demande de permission non sollicitée, au démarrage, est ce qu'Apple et les clients refusent. Le serveur rattache
 * le jeton au dernier compte qui l'envoie (pushService.enregistrerJetonNatif, ON CONFLICT). */
export async function rattacherAppareilSiAutorise(token) {
  if (!token) return 'indisponible';
  let PushNotifications;
  try { ({ PushNotifications } = await import('@capacitor/push-notifications')); } catch { return 'indisponible'; }
  const permission = await PushNotifications.checkPermissions().catch(() => null);
  if (permission?.receive !== 'granted') return 'refuse';
  const { enabled, native } = await api('/push/key').catch(() => ({ enabled: false }));
  if (!enabled || !native) return 'indisponible';
  return enregistrerAppareil(PushNotifications, token);
}

/* NOTIFICATIONS COUPÉES DANS LES RÉGLAGES DU TÉLÉPHONE (bug hunt avant GO, G39). Le jeton reste valable : Firebase accepte
 * l'envoi et le téléphone n'affiche rien, et le serveur, voyant un appareil, ne faisait pas partir les e-mails de secours
 * (prête à retirer, livreur en route, nouvelle commande au commerce…). L'écran, lui, disait les notifications actives.
 * À l'ouverture de session et à chaque retour au premier plan (AuthContext.jsx) : permission retirée → le jeton est
 * retiré du serveur (les e-mails reprennent) ; permission rendue → il revient, seulement s'il était parti pour cette raison
 * (CLE_COUPE) : « Désactiver » dans l'app reste respecté. Jamais de demande de permission ici. */
export async function permissionNativeAccordee() {
  try {
    const { PushNotifications } = await import('@capacitor/push-notifications');
    return (await PushNotifications.checkPermissions())?.receive === 'granted';
  } catch { return false; }
}
export async function suivrePermissionNative(token) {
  if (!token) return;
  let PushNotifications;
  try { ({ PushNotifications } = await import('@capacitor/push-notifications')); } catch { return; }
  const permission = await PushNotifications.checkPermissions().catch(() => null);
  if (!permission) return;
  let coupe = false;
  try { coupe = localStorage.getItem(CLE_COUPE) === '1'; } catch { /* sans stockage */ }
  if (permission.receive === 'granted') {
    if (coupe && !jetonNatifCourant() && (await rattacherAppareilSiAutorise(token)) === 'ok') {
      try { localStorage.removeItem(CLE_COUPE); } catch { /* rien */ }
    }
    return;
  }
  if (!jetonNatifCourant()) return;
  try { localStorage.setItem(CLE_COUPE, '1'); } catch { /* rien */ }
  await desabonnerNatif(token);
}

export async function desabonnerNatif(token) {
  const jeton = jetonNatifCourant();
  // Oublié AVANT l'appel : à la déconnexion, le compte suivant peut déjà réenregistrer ce téléphone (et réécrire la clé)
  // pendant que la suppression voyage ; l'effacer après aurait perdu son jeton à lui.
  try { localStorage.removeItem(CLE_JETON); } catch { /* rien */ }
  if (jeton) await api('/push/native-token', { method: 'DELETE', token, body: { token: jeton } }).catch(() => {});
  return true;
}
