/* L'ADRESSE TAPÉE SUR L'ACCUEIL DU SITE, REPRISE À L'INSCRIPTION (audit du 19/10, auth-27 et LIVE-12).
 *
 * Un visiteur choisit « Rue du Midi 12, 1000 Bruxelles » dans la barre d'adresse de l'accueil (HeroAdresse.jsx), ouvre un
 * commerce, arrive sur l'inscription : l'étape « Ton adresse » était vide, il retapait tout. L'adresse choisie est donc
 * gardée dans CET onglet (sessionStorage, effacé à sa fermeture), jamais envoyée au serveur ni gardée au-delà : elle ne
 * sert qu'à préremplir les champs encore vides de l'inscription (Auth.jsx), que la personne relit et corrige.
 * Stockage indisponible (navigation privée stricte) : rien n'est prérempli, rien ne casse. */
const CLE = 'fairide_adresse_accueil';

export function retenirAdresseAccueil({ street = '', number = '', postalCode = '', city = '' } = {}) {
  try { sessionStorage.setItem(CLE, JSON.stringify({ street, number, postalCode, city })); } catch { /* sans stockage */ }
}

export function lireAdresseAccueil() {
  try { return JSON.parse(sessionStorage.getItem(CLE) || 'null'); } catch { return null; }
}
