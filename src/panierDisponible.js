// UN PLAT DU PANIER QUI NE SE COMMANDE PLUS (audit du 18/10/2026). Le panier garde ses lignes ; la carte du commerce, elle,
// change dans la journée (rupture, plat retiré). Le client ne l'apprenait qu'en payant (le serveur refuse : ITEM_UNAVAILABLE).
// Mêmes cas que le serveur refuse (routes/orders.js) : plat absent de la carte, indisponible, en rupture aujourd'hui, retiré,
// allergènes non déclarés, alcool non vendable. Sans carte chargée (null), on ne dit rien : rien n'est encore connu.
export function ligneIndisponible(ligne, menu) {
  if (!Array.isArray(menu)) return false;
  const plat = menu.find((m) => m.id === ligne.itemId);
  return !plat || plat.available === false || !!plat.outOfStockToday || !!plat.withdrawn || !!plat.allergensMissing || !!plat.alcoholUnavailable
    || prixActuelLigne(ligne, plat) === false;
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

export function lignesIndisponibles(lignes, menu) {
  return Object.entries(lignes || {}).filter(([, l]) => ligneIndisponible(l, menu)).map(([cle]) => cle);
}
