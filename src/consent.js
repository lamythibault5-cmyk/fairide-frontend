// Consentement cookies/traceurs, source unique de vérité pour la bannière ET pour tout ce qui dépend
// du consentement (aujourd'hui Sentry, voir main.jsx).
//
// Jusqu'ici la bannière ne proposait qu'« Accepter » et personne ne relisait la valeur stockée :
// Sentry démarrait dès le chargement de la page, donc avant toute réponse du visiteur. Le RGPD et la
// directive ePrivacy imposent que refuser soit aussi simple qu'accepter, et que rien de non essentiel
// ne parte avant le choix — l'APD/GBA a déjà sanctionné exactement ce schéma en Belgique.
//
// Valeurs possibles : 'accepted' | 'refused' | null (pas encore répondu).
const STORAGE_KEY = 'fairide_cookie_consent';

const listeners = new Set();

export function getConsent() {
  try {
    const value = localStorage.getItem(STORAGE_KEY);
    return value === 'accepted' || value === 'refused' ? value : null;
  } catch {
    // Stockage indisponible (navigation privée stricte) : on considère qu'aucun consentement n'a été
    // donné. C'est le repli sûr — rien de non essentiel ne démarre.
    return null;
  }
}

export function hasAcceptedConsent() {
  return getConsent() === 'accepted';
}

export function setConsent(value) {
  try {
    localStorage.setItem(STORAGE_KEY, value);
  } catch {
    // Choix non persistable : il reste valable pour la session en cours via les abonnés ci-dessous.
  }
  listeners.forEach((fn) => fn(value));
}

// Permet à Sentry de démarrer au moment où le visiteur accepte, sans attendre un rechargement de page.
export function onConsentChange(fn) {
  listeners.add(fn);
  return () => listeners.delete(fn);
}
