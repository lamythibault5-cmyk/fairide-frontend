// Abonnement du navigateur aux notifications push.
//
// CE QUE ÇA AJOUTE À CE QUI EXISTE. useNewOrderAlert.js prévient déjà : un son, un compteur dans le
// titre de l'onglet, une notification système. Les trois meurent avec la page. Le push est reçu par
// le service worker (public/sw.js), qui tourne encore quand l'onglet est fermé — c'est toute la
// différence, et la seule raison d'ajouter ce code.
//
// CE QUE ÇA N'AJOUTE PAS. Sur iPhone et iPad, le push n'existe qu'à partir d'iOS 16.4 ET uniquement
// si le site a été ajouté à l'écran d'accueil. Dans Safari, `PushManager` n'est tout simplement pas
// défini : `estSupporte()` renvoie false et l'interface ne propose rien plutôt que de promettre ce
// qu'elle ne peut pas tenir.

import { api } from './api';

// La clé publique VAPID arrive en base64url ; l'API du navigateur veut un tableau d'octets.
function base64UrlVersOctets(base64) {
  const bourrage = '='.repeat((4 - (base64.length % 4)) % 4);
  const normal = (base64 + bourrage).replace(/-/g, '+').replace(/_/g, '/');
  const brut = window.atob(normal);
  return Uint8Array.from(brut, (c) => c.charCodeAt(0));
}

export function estSupporte() {
  return typeof window !== 'undefined'
    && 'serviceWorker' in navigator
    && 'PushManager' in window
    && 'Notification' in window;
}

// L'abonnement déjà en place sur CE navigateur, ou null.
export async function abonnementCourant() {
  if (!estSupporte()) return null;
  try {
    const enregistrement = await navigator.serviceWorker.ready;
    return await enregistrement.pushManager.getSubscription();
  } catch {
    return null;
  }
}

// Demande la permission puis abonne. Doit être appelée depuis un geste de l'utilisateur : les
// navigateurs rejettent une demande de permission qui ne vient pas d'un clic.
//
// Renvoie 'ok', 'refuse' (permission refusée), 'indisponible' (pas de clé côté serveur, ou
// navigateur sans push) ou 'erreur'.
export async function abonner(token) {
  if (!estSupporte()) return 'indisponible';

  const { enabled, key } = await api('/push/key').catch(() => ({ enabled: false }));
  if (!enabled || !key) return 'indisponible';

  const permission = Notification.permission === 'granted'
    ? 'granted'
    : await Notification.requestPermission();
  if (permission !== 'granted') return 'refuse';

  try {
    const enregistrement = await navigator.serviceWorker.ready;
    // Réutiliser l'abonnement existant s'il y en a un : en créer un second sur le même navigateur
    // échoue, et le serveur l'aurait de toute façon écrasé (endpoint unique).
    const abonnement = await enregistrement.pushManager.getSubscription()
      || await enregistrement.pushManager.subscribe({
        // Obligatoire sur Chrome : un push silencieux (sans notification visible) n'est pas permis,
        // et le navigateur refuse l'abonnement si on ne s'y engage pas ici.
        userVisibleOnly: true,
        applicationServerKey: base64UrlVersOctets(key)
      });
    await api('/push/subscribe', { method: 'POST', token, body: { subscription: abonnement.toJSON() } });
    return 'ok';
  } catch {
    return 'erreur';
  }
}

export async function desabonner(token) {
  const abonnement = await abonnementCourant();
  if (!abonnement) return true;
  // Le serveur d'abord : si le navigateur oublie l'abonnement mais que la ligne reste en base, on
  // continuerait d'envoyer vers une adresse morte jusqu'au prochain 410. L'inverse est sans risque.
  await api('/push/subscribe', { method: 'DELETE', token, body: { endpoint: abonnement.endpoint } }).catch(() => {});
  try {
    await abonnement.unsubscribe();
  } catch {
    // Le navigateur a pu le jeter de son côté : la ligne serveur est déjà supprimée, c'est l'essentiel.
  }
  return true;
}
