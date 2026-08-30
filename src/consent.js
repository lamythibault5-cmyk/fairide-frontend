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

// Copie en mémoire du choix, indispensable quand localStorage n'est pas accessible (navigation privée
// stricte, cookies tiers bloqués). Sans elle, un visiteur qui ACCEPTAIT voyait son choix perdu
// aussitôt : setConsent notifiait bien les abonnés, mais ceux-ci relisaient le stockage — vide — et en
// concluaient qu'aucun consentement n'avait été donné. La bannière disparaissait, et rien ne démarrait.
let inMemoryConsent = null;

export function getConsent() {
  try {
    const value = localStorage.getItem(STORAGE_KEY);
    if (value === 'accepted' || value === 'refused') return value;
  } catch {
    // Stockage indisponible : on retombe sur la copie en mémoire ci-dessous.
  }
  // Repli sûr quand rien n'a jamais été choisi : null, donc rien de non essentiel ne démarre.
  return inMemoryConsent;
}

export function hasAcceptedConsent() {
  return getConsent() === 'accepted';
}

export function setConsent(value) {
  // Enregistré en mémoire AVANT la notification des abonnés : ceux-ci appellent getConsent() et
  // doivent y trouver le choix, même si le stockage du navigateur refuse de l'écrire.
  inMemoryConsent = value;
  try {
    localStorage.setItem(STORAGE_KEY, value);
  } catch {
    // Choix non persistable : il reste valable pour la session en cours grâce à inMemoryConsent.
  }
  listeners.forEach((fn) => fn(value));
}

// Permet à Sentry de démarrer au moment où le visiteur accepte, sans attendre un rechargement de page.
export function onConsentChange(fn) {
  listeners.add(fn);
  return () => listeners.delete(fn);
}
