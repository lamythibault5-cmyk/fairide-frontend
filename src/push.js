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
import { estNatif } from './natif';
import { abonnerNatif, desabonnerNatif, jetonNatifCourant } from './pushNatif';

// La clé publique VAPID arrive en base64url ; l'API du navigateur veut un tableau d'octets.
function base64UrlVersOctets(base64) {
  const bourrage = '='.repeat((4 - (base64.length % 4)) % 4);
  const normal = (base64 + bourrage).replace(/-/g, '+').replace(/_/g, '/');
  const brut = window.atob(normal);
  return Uint8Array.from(brut, (c) => c.charCodeAt(0));
}

export function estSupporte() {
  if (estNatif()) return true;
  return typeof window !== 'undefined'
    && 'serviceWorker' in navigator
    && 'PushManager' in window
    && 'Notification' in window;
}

// L'abonnement déjà en place sur CE navigateur, ou null.
export async function abonnementCourant() {
  if (estNatif()) return jetonNatifCourant() ? { natif: true } : null;
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
  if (estNatif()) return abonnerNatif(token);
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

/* L'ABONNEMENT DE CE NAVIGATEUR REVIENT À CHAQUE SESSION (audit sécurité 2026-10-31, décision d'Owen). Le serveur efface
 * les abonnements push d'un compte quand toutes ses sessions sont fermées (« déconnecter tous mes appareils », mot de passe
 * réinitialisé) : un navigateur volé ou partagé ne doit plus recevoir les notifications du compte. Mais le navigateur, lui,
 * garde son abonnement et sa permission, et l'interface le montre « activé » : sans ce renvoi, la personne qui se reconnecte
 * ne recevait plus rien, sans le savoir. Donc, à chaque connexion et à chaque reprise de session sur le SITE, si la
 * permission est DÉJÀ accordée et qu'un abonnement existe DÉJÀ, il est renvoyé au serveur (même endpoint = même ligne).
 * Jamais de demande de permission ici (hors geste, les navigateurs la refusent et c'est ce qu'on ne veut pas imposer), ni
 * de nouvel abonnement : seulement celui qui existe. En silence : aucune erreur ne remonte, aucune interface.
 * L'application native a son propre chemin (pushNatif.rattacherAppareilSiAutorise, AuthContext.jsx). */
export async function reabonnerSiDejaAutorise(token) {
  if (!token || estNatif() || !estSupporte()) return;
  try {
    if (Notification.permission !== 'granted') return;
    // getRegistration et non `ready` : sans service worker enregistré, `ready` attendrait pour toujours.
    const enregistrement = await navigator.serviceWorker.getRegistration();
    const abonnement = await enregistrement?.pushManager.getSubscription();
    if (!abonnement) return;
    // logoutOn401: false : un renvoi en arrière-plan ne décide pas d'une déconnexion (la relecture de /auth/me s'en charge).
    await api('/push/subscribe', { method: 'POST', token, body: { subscription: abonnement.toJSON() }, logoutOn401: false });
  } catch { /* silencieux : la personne peut toujours réactiver depuis ses réglages */ }
}

export async function desabonner(token) {
  if (estNatif()) return desabonnerNatif(token);
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
