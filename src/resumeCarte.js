/* LA LISTE DES COMMERCES N'A PLUS LES CARTES (audit de performance, 2026-10-24, point 3). GET /restaurants envoyait la carte
 * complète de chaque commerce (373 Ko pour 7 commerces, 95 % de plats) à l'accueil, la liste, la carte, la recherche et la
 * fiche (« À découvrir »), et la copie gardée par l'app (2 Mo au plus, cacheDonnees.js) se serait coupée vers 37 commerces.
 * Ces écrans lisent désormais CHEMIN_LISTE (`?vue=liste`) : chaque commerce sans `menu`, avec `resumeCarte`, les quelques
 * faits que la liste tirait des plats (backend routes/restaurants.js › resumeCarte) :
 *   { plats, healthy, bio, vegan, halal, sansGluten, promoPlat }
 * La fiche d'un commerce (GET /restaurants/:id) garde sa carte complète. Les fonctions ci-dessous lisent l'un OU l'autre :
 * une fiche, la copie de la liste gardée par une version précédente de l'app, ou une réponse sans `?vue` ont `menu`, et on
 * y compte alors les plats comme avant. */
export const CHEMIN_LISTE = '/restaurants?vue=liste';
// Les plats tels que la page Recherche les cherche (nom, description, prix, photo, mentions), par commerce : [{ id, plats }].
export const CHEMIN_PLATS_RECHERCHE = '/restaurants?vue=plats';

// Nombre de plats qui passent `test`, ou à défaut le compte `cle` du résumé envoyé par le serveur.
export function compterPlats(r, cle, test) {
  if (Array.isArray(r?.menu)) return r.menu.filter(test).length;
  return Number(r?.resumeCarte?.[cle]) || 0;
}

export const nbPlats = (r) => compterPlats(r, 'plats', () => true);
export const nbPlatsHealthy = (r) => compterPlats(r, 'healthy', (m) => !!m.healthy);

// La promo du premier plat qui en a une : un aperçu de l'offre sur la carte du commerce dans la liste.
export function promoDUnPlat(r) {
  if (Array.isArray(r?.menu)) return r.menu.find((i) => i.activePromo)?.activePromo || null;
  return r?.resumeCarte?.promoPlat || null;
}
