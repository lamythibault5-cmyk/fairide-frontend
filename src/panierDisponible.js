// UN PLAT DU PANIER QUI NE SE COMMANDE PLUS (audit du 18/10/2026). Le panier garde ses lignes ; la carte du commerce, elle,
// change dans la journée (rupture, plat retiré). Le client ne l'apprenait qu'en payant (le serveur refuse : ITEM_UNAVAILABLE).
// Mêmes cas que le serveur refuse (routes/orders.js) : plat absent de la carte, indisponible, en rupture aujourd'hui, retiré,
// allergènes non déclarés, alcool non vendable. Sans carte chargée (null), on ne dit rien : rien n'est encore connu.
// `jourPlusTard` : la commande est programmée pour un jour suivant (G165). Un plat épuisé AUJOURD'HUI seulement (pas retiré)
// se commande alors, comme le serveur l'accepte (routes/orders.js, ruptureDuJourSeulement) : il revient tout seul demain.
export function ligneIndisponible(ligne, menu, options) {
  const motif = motifLigne(ligne, menu, options);
  return motif === 'indisponible' || motif === 'options';
}

/* CE QUE LA LIGNE DIT AU CLIENT : 'indisponible' (« Plus disponible aujourd'hui »), 'options' (ses choix ne respectent plus
 * les règles du plat, G166 : à refaire), 'plusTard' (épuisé aujourd'hui seulement, commandable pour un autre jour, G165), ou
 * null. Seuls 'indisponible' et 'options' bloquent la commande (ligneIndisponible). */
export function motifLigne(ligne, menu, { jourPlusTard = false } = {}) {
  if (!Array.isArray(menu)) return null;
  const plat = menu.find((m) => m.id === ligne.itemId);
  if (!plat) return 'indisponible';
  const pourPlusTard = jourPlusTard && ruptureDuJourSeulement(plat);
  if ((plat.available === false && !pourPlusTard) || (!!plat.outOfStockToday && !pourPlusTard) || !!plat.withdrawn || !!plat.allergensMissing || !!plat.alcoholUnavailable
    || prixActuelLigne(ligne, plat) === false) return 'indisponible';
  if (!optionsValides(ligne, plat)) return 'options';
  return pourPlusTard ? 'plusTard' : null;
}

// Épuisé pour aujourd'hui seulement, pas retiré de la carte (G165) : commandable pour un autre jour.
export function ruptureDuJourSeulement(plat) {
  return !!plat && !!plat.outOfStockToday && !plat.withdrawn;
}

/* LES RÈGLES D'OPTIONS DU PLAT (G166). L'équipe peut rendre un groupe obligatoire, ou limiter le nombre de choix, après qu'une
 * ligne est entrée au panier : le serveur la refusait alors (OPTION_INVALID) et le paiement butait sans dire quelle ligne
 * refaire. Mêmes règles que le serveur (routes/orders.js, resolveOptions) ; sans les groupes du plat (carte de la liste), on
 * ne juge pas. */
function optionsValides(ligne, plat) {
  if (!Array.isArray(plat.optionGroups)) return true;
  const choisies = new Set(ligne.optionItemIds || []);
  return plat.optionGroups.every((g) => {
    const n = (g.items || []).filter((i) => choisies.has(i.id)).length;
    if (g.required && n === 0) return false;
    if (g.type === 'single' && n > 1) return false;
    if (g.type === 'multiple' && g.maxSelections && n > g.maxSelections) return false;
    return true;
  });
}

/* LE PRIX D'AUJOURD'HUI D'UNE LIGNE (audit du 19/10, discovery-15). Le panier garde le prix vu à l'ajout ; le serveur, lui,
 * facture le prix de la carte au moment de la commande (routes/orders.js). Un plat passé de 9 à 9,90 € gardait 9 € sur ses
 * lignes alors que le total du devis disait plus. Renvoie le prix unitaire actuel (plat + options), null quand on ne peut
 * pas le savoir (carte de la liste, sans les options), ou false quand une option choisie n'existe plus : le serveur
 * l'ignorerait sans rien dire et le ticket du commerce ne l'aurait pas — la ligne est alors traitée comme indisponible
 * (« Retirer », puis la rajouter). */
export function prixActuelLigne(ligne, plat) {
  if (!plat || !Number.isFinite(Number(plat.price))) return null;
  const ids = ligne.optionItemIds || [];
  if (!ids.length) return +Number(plat.price).toFixed(2);
  if (!Array.isArray(plat.optionGroups)) return null;
  const options = plat.optionGroups.flatMap((g) => g.items || []);
  let delta = 0;
  for (const id of ids) {
    const o = options.find((x) => x.id === id);
    if (!o) return false;
    delta += Number(o.priceDelta) || 0;
  }
  return +(Number(plat.price) + delta).toFixed(2);
}

export function lignesIndisponibles(lignes, menu, options) {
  return Object.entries(lignes || {}).filter(([, l]) => ligneIndisponible(l, menu, options)).map(([cle]) => cle);
}
