/* CE QUE LA RECHERCHE (OU L'ACCUEIL) ENVOIE À LA LISTE DES COMMERCES — un seul endroit pour les deux côtés.
 *
 * Toucher « Pizza » dans la Recherche doit ouvrir la liste sur Pizza, bulle posée. Deux fois ça a cassé (2026-10-27 puis
 * 2026-11-08, Owen : « this is 2nd time it bugs ») : les tuiles « Par envie » envoyaient `{ famille }` alors que la liste ne
 * lisait plus que `{ categorie }` depuis les catégories à plat, et une liste déjà ouverte derrière la Recherche ignorait ce
 * qu'on lui envoyait. Les deux côtés passent maintenant par ici : `versListe()` pour envoyer, `filtresEnvoyes()` pour lire.
 * `npm run check:app` touche une tuile et une spécialité de la Recherche et échoue si la liste n'a pas la bonne bulle.
 */

/** L'état de navigation à passer à `/restaurants` (Link `state=` ou `navigate(…, { state })`). */
export function versListe({ categorie, commune, search } = {}) {
  const etat = {};
  if (categorie) etat.categorie = categorie;
  if (commune) etat.commune = commune;
  if (search) etat.search = search;
  return etat;
}

/** Ce que la liste doit appliquer, lu dans `location.state`. `famille` : l'ancien nom, encore lu pour ne plus jamais
 *  perdre une catégorie envoyée sous ce nom. */
export function filtresEnvoyes(etat) {
  const st = etat || {};
  return {
    categorie: st.categorie || st.famille || '',
    commune: st.commune || '',
    search: st.search || ''
  };
}

/** Vrai quand la navigation porte au moins un filtre à appliquer. */
export function aDesFiltres(etat) {
  const f = filtresEnvoyes(etat);
  return !!(f.categorie || f.commune || f.search);
}
