/* « Continuer avec Apple » SUR LE SITE (2026-11-06). Jusque-là, Apple n'existait que dans l'application iPhone (natif.js) :
 * un compte créé avec Apple sur iPhone ne pouvait pas se connecter sur fairride.be ni sur Android, sauf par « Mot de passe
 * oublié » (et l'adresse est souvent un relais Apple que la personne ne reconnaît pas).
 *
 * Le site passe par « Sign in with Apple JS » (fenêtre d'Apple, `usePopup`), avec le « Services ID » du site, que le serveur
 * accepte comme destinataire du jeton (apple.js, be.fairride.web). Il faut, chez Apple (compte développeur) : ce Services ID,
 * le domaine fairride.be et l'adresse de retour https://fairride.be/ — puis VITE_APPLE_SERVICES_ID dans Vercel. Sans cette
 * variable, aucun bouton Apple sur le site : rien ne s'affiche qui ne marcherait pas.
 *
 * Comme Google (googleSignIn.js), le script d'Apple ne part qu'au clic : aucune requête vers Apple sur les autres pages. */
const SERVICES_ID = import.meta.env.VITE_APPLE_SERVICES_ID || '';
const SRC = 'https://appleid.cdn-apple.com/appleauth/static/jsapi/appleid/1/fr_FR/appleid.auth.js';

// Seulement sur le vrai domaine : Apple refuse toute autre origine (aperçus Vercel, localhost).
export function appleWebDisponible() {
  return !!SERVICES_ID && typeof window !== 'undefined' && /(^|\.)fairride\.be$/.test(window.location.hostname);
}

let promesse = null;
function chargerApple() {
  if (window.AppleID?.auth) return Promise.resolve(window.AppleID.auth);
  if (promesse) return promesse;
  promesse = new Promise((resolve, reject) => {
    const s = document.createElement('script');
    s.src = SRC;
    s.async = true;
    s.addEventListener('load', () => (window.AppleID?.auth ? resolve(window.AppleID.auth) : reject(new Error('Apple indisponible.'))), { once: true });
    s.addEventListener('error', () => { promesse = null; reject(new Error('Apple indisponible.')); }, { once: true });
    document.head.appendChild(s);
  });
  return promesse;
}

/* Ouvre la fenêtre d'Apple. Rend { fournisseur: 'apple', jeton, code, prenom, nom } — la même forme que la feuille native
 * (natif.js, connexionFournisseur) — ou null si la personne ferme la fenêtre. Apple ne donne le nom qu'à la première
 * connexion, à côté du jeton. */
export async function connexionAppleWeb() {
  const auth = await chargerApple();
  auth.init({ clientId: SERVICES_ID, scope: 'name email', redirectURI: `${window.location.origin}/`, usePopup: true });
  try {
    const r = await auth.signIn();
    const jeton = r?.authorization?.id_token;
    if (!jeton) return null;
    return { fournisseur: 'apple', jeton, code: r.authorization.code || null, prenom: r.user?.name?.firstName || null, nom: r.user?.name?.lastName || null };
  } catch (e) {
    // Fenêtre fermée par la personne : pas une erreur à afficher.
    if (e?.error === 'popup_closed_by_user' || e?.error === 'user_cancelled_authorize') return null;
    throw e;
  }
}
