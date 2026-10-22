/* ADRESSE LISIBLE DE LA FICHE D'UN COMMERCE (fondateur, 2026-10-22) : /restaurants/delispice-woluwe-saint-pierre au lieu de
 * /restaurants/679984e1-7e91-…. Google lit les mots de l'adresse, et un lien partagé dit où il mène.
 *
 * Le slug est posé par le backend (migration 083, il ne bouge plus une fois le commerce en ligne) et renvoyé avec chaque
 * commerce (`slug`). L'IDENTIFIANT RESTE LA CLÉ DE TOUT : panier, favoris, commandes, routes du commerce. Le slug ne sert
 * qu'à l'adresse affichée ; FicheCommerce.jsx le traduit en identifiant avant de monter la fiche.
 *
 * Les anciens liens par identifiant (partagés, indexés, écrits par un écran qui n'a que l'id en main : commandes, panier,
 * console) marchent toujours : la fiche se charge, puis l'adresse est remplacée par la lisible. Le pré-rendu
 * (scripts/prerender.mjs) écrit pour eux une page de redirection, que Google traite comme une redirection permanente. */

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export const estIdentifiant = (valeur) => UUID.test(String(valeur || ''));

// Chemin (sans préfixe de langue, voir i18n/routing.js) de la fiche d'un commerce : son slug, ou son identifiant à défaut.
// Accepte le commerce lui-même ou son seul identifiant.
export function cheminFiche(commerce) {
  if (commerce && typeof commerce === 'object') return `/restaurants/${commerce.slug || commerce.id}`;
  return `/restaurants/${commerce}`;
}

// slug → identifiant, appris de chaque commerce vu pendant la visite : une fiche ouverte depuis la liste se monte sans
// requête de plus, et le remplacement d'une ancienne adresse par la lisible ne recharge rien.
const idsParSlug = new Map();

export function retenirSlugs(commerces) {
  for (const c of Array.isArray(commerces) ? commerces : [commerces]) {
    if (c?.slug && c?.id) idsParSlug.set(String(c.slug).toLowerCase(), String(c.id));
  }
}

export function idPourSlug(slug) {
  return idsParSlug.get(String(slug || '').toLowerCase());
}
