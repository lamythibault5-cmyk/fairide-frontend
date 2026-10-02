// Mises en avant payantes (fondateur, 2026-10-02) : un commerce paie pour la 1re, 2e ou 3e position d'une rangée de la
// liste (voir routes/placements.js côté API). Ici, le seul calcul que fait le site : remonter les commerces épinglés à
// leur position dans une rangée, en les marquant `sponsorise` pour que la carte porte la mention — un classement payé
// doit toujours être signalé au client.
//
// `liste` : la rangée telle qu'elle serait sans rien de payé. `admissibles` : les commerces qui ont le droit d'y figurer
// (par défaut ceux de la rangée) ; un commerce épinglé qui n'en fait pas partie est ignoré — on ne passe pas premier de
// « Vegan » sans plat vegan.
export function epingler(liste, placements, cle, admissibles = liste) {
  const epingles = (placements || []).filter((p) => p.sectionKey === cle).sort((a, b) => a.slot - b.slot);
  if (!epingles.length || !liste) return liste;
  const parId = new Map(admissibles.map((r) => [r.id, r]));
  const retenus = epingles.map((p) => ({ slot: p.slot, r: parId.get(p.restaurantId) })).filter((x) => x.r);
  if (!retenus.length) return liste;
  const ids = new Set(retenus.map((x) => x.r.id));
  const resultat = liste.filter((r) => !ids.has(r.id));
  for (const { slot, r } of retenus) resultat.splice(Math.min(slot - 1, resultat.length), 0, { ...r, sponsorise: true });
  return resultat;
}

// Les rangées où une place s'achète : clé API → clé de traduction du titre de la rangée (restaurantList.*).
export const TITRES_RANGEES = {
  nearby: 'sectionNearby', offers: 'sectionOffers', healthy: 'sectionHealthy', bio: 'sectionBio',
  vegan: 'sectionVegan', grocery: 'sectionGrocery', discover: 'sectionDiscover'
};

export const euros = (v) => `${Number(v).toFixed(2).replace('.', ',').replace(/,00$/, '')} €`;
export const jourCourt = (iso) => String(iso || '').split('-').reverse().join('/');
