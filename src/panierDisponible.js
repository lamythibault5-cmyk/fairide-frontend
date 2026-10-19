// UN PLAT DU PANIER QUI NE SE COMMANDE PLUS (audit du 18/10/2026). Le panier garde ses lignes ; la carte du commerce, elle,
// change dans la journée (rupture, plat retiré). Le client ne l'apprenait qu'en payant (le serveur refuse : ITEM_UNAVAILABLE).
// Mêmes cas que le serveur refuse (routes/orders.js) : plat absent de la carte, indisponible, en rupture aujourd'hui, retiré,
// allergènes non déclarés, alcool non vendable. Sans carte chargée (null), on ne dit rien : rien n'est encore connu.
export function ligneIndisponible(ligne, menu) {
  if (!Array.isArray(menu)) return false;
  const plat = menu.find((m) => m.id === ligne.itemId);
  return !plat || plat.available === false || !!plat.outOfStockToday || !!plat.withdrawn || !!plat.allergensMissing || !!plat.alcoholUnavailable;
}

export function lignesIndisponibles(lignes, menu) {
  return Object.entries(lignes || {}).filter(([, l]) => ligneIndisponible(l, menu)).map(([cle]) => cle);
}
