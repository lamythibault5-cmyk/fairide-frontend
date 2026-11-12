/* L'APERÇU DE L'APPLI SUR L'ACCUEIL DU SITE (Owen, 2026-11-12, réponses à maquettes/site-appli-essai, version A).
 *
 * L'accueil de fairride.be montre un faux téléphone qu'on fait défiler (EssaiAppli.jsx). Ce n'est PAS une copie dessinée :
 * c'est la vraie page des commerces de l'appli, chargée dans un cadre (<iframe name="fairride-apercu">) et rendue en mode
 * application (experienceApp, natif.js). Chaque changement de l'appli y est donc dès que le site est mis en ligne, sans rien
 * synchroniser : mêmes rangées, même algorithme de classement, même barre de verre qui se plie, même « Ouvert », mêmes
 * catégories, même carte, et le badge « Prix du comptoir » dès qu'il est posé.
 *
 * Le cadre est reconnu à son NOM (window.name), que le navigateur garde pendant toute la visite du cadre, de page en page
 * (/restaurants ↔ /map), et seulement dans un cadre : la page du site elle-même n'est jamais en aperçu. Pas un drapeau dans
 * sessionStorage : un cadre de la même origine partage le sessionStorage de la page qui le contient, le site entier
 * serait passé en aperçu au rechargement.
 *
 * Ce que l'aperçu change (et rien d'autre) :
 *   - seuls Restaurants et Carte se visitent (CHEMINS_APERCU) ; tout autre lien touché (un commerce, la connexion, une
 *     demande…) n'ouvre rien dans le cadre : il est passé au site (signalerAuSite), qui montre sa fenêtre « installe
 *     l'appli / crée ton compte » (GardeApercu, Layout.jsx) ;
 *   - la barre du bas n'a que Restaurants et Carte, sans le rond Recherche (DashboardSidebar.jsx, réponse 6) ;
 *   - toutes les cartes de commerce se ressemblent : ni « Carte seule », ni « Fermé », ni heure d'ouverture, ni délai, ni
 *     services, ni photo grisée — seulement le badge « Prix du comptoir » (RestaurantList.jsx, remarque 8). « Sponsorisé »
 *     reste : une position payée est toujours dite au client (CDE VI.99) ;
 *   - pas d'écran de bienvenue, de carte des cookies, de demande de notifications, et pas de rapports de panne sans le
 *     consentement donné sur le site (consent.js) : le visiteur est sur le site, pas dans l'appli. */
export const NOM_CADRE_APERCU = 'fairride-apercu';
export const CHEMINS_APERCU = ['/restaurants', '/map'];
const SOURCE = 'fairride-apercu';

export function estApercu() {
  try { return window.self !== window.top && window.name === NOM_CADRE_APERCU; } catch { return false; }
}

// Le cadre parle au site qui le contient, jamais à une autre origine.
export function signalerAuSite(message) {
  try { window.parent.postMessage({ source: SOURCE, ...message }, window.location.origin); } catch { /* sans parent */ }
}

// Côté site : un message vient-il bien de notre aperçu (même origine, notre source) ?
export function messageDeLApercu(e) {
  return e.origin === window.location.origin && e.data && e.data.source === SOURCE;
}

export function cheminPermisEnApercu(chemin) {
  return CHEMINS_APERCU.includes(String(chemin || '').replace(/\/+$/, '') || '/');
}
