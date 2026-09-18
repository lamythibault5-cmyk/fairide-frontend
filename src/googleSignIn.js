/* Chargement du script Google Sign-In (GSI), à la demande et seulement là où il sert.
 *
 * POURQUOI CE FICHIER EXISTE. La balise <script src="https://accounts.google.com/gsi/client"> était
 * posée en dur dans le <head> de index.html : elle partait donc sur TOUTES les pages — l'accueil, la
 * carte d'un restaurant, les pages légales — et surtout AVANT que le visiteur ait répondu à la
 * bannière cookies. Google dépose ses propres traceurs au chargement du script. C'était exactement le
 * défaut déjà corrigé pour Sentry dans main.jsx, et il vidait de son sens le travail fait sur le
 * consentement : refuser ne changeait rien, la requête était déjà partie.
 *
 * POURQUOI ON NE LE MET PAS DERRIÈRE LE CONSENTEMENT. Parce que ce serait le mauvais garde-fou. Se
 * connecter avec Google est un service que le visiteur demande explicitement, en cliquant : c'est le
 * cas « strictement nécessaire au service demandé », celui qui n'exige pas de consentement préalable.
 * Le subordonner à l'acceptation des cookies interdirait la connexion Google à quiconque refuse — une
 * régression produit, et un consentement obtenu sous contrainte, donc invalide de toute façon.
 *
 * Le vrai défaut n'était pas « ce script existe », c'était « il part partout, tout le temps, sans que
 * personne ne l'ait demandé ». On le charge donc uniquement depuis la page de connexion (Auth.jsx),
 * au moment de dessiner le bouton. Effet de bord appréciable : une requête tierce en moins sur le
 * premier rendu de toutes les autres pages.
 *
 * Le domaine est déjà autorisé par `script-src` et `connect-src` dans la CSP (vercel.json) : rien à
 * y changer, on ne fait que déplacer le moment du chargement.
 */
const SRC = 'https://accounts.google.com/gsi/client';

let promesse = null;

// Résout quand window.google.accounts.id est utilisable. Rejette si le script ne se charge pas
// (bloqueur de publicité, réseau coupé, Google injoignable) — l'appelant se contente alors de ne pas
// afficher le bouton, le formulaire e-mail/mot de passe reste disponible.
export function chargerGoogleSignIn() {
  if (typeof window === 'undefined' || typeof document === 'undefined') {
    return Promise.reject(new Error('Pas de navigateur.'));
  }
  // Déjà prêt (retour sur la page, changement d'onglet du formulaire) : rien à recharger.
  if (window.google?.accounts?.id) return Promise.resolve(window.google.accounts.id);
  if (promesse) return promesse;

  promesse = new Promise((resolve, reject) => {
    // Le script a pu être ajouté par un rendu précédent sans avoir fini de s'exécuter : on se
    // raccroche à la balise existante plutôt que d'en empiler une deuxième.
    const existante = document.querySelector(`script[src="${SRC}"]`);
    const s = existante || document.createElement('script');
    function fini() {
      if (window.google?.accounts?.id) resolve(window.google.accounts.id);
      else reject(new Error('Google Sign-In indisponible.'));
    }
    s.addEventListener('load', fini, { once: true });
    s.addEventListener('error', () => {
      // On oublie la promesse échouée : une prochaine visite de la page pourra réessayer (le réseau
      // a pu revenir entre-temps). Sans ça, un échec au premier essai condamnait le bouton pour
      // toute la durée de la session.
      promesse = null;
      reject(new Error('Google Sign-In indisponible.'));
    }, { once: true });
    if (!existante) {
      s.src = SRC;
      s.async = true;
      s.defer = true;
      document.head.appendChild(s);
    }
  });
  return promesse;
}
