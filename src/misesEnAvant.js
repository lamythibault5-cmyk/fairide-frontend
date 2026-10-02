import { restaurantTypeLabel } from './menuCategories';

// Mises en avant payantes (fondateur, 2026-10-02) : un commerce paie pour une position en tête d'une rangée de la
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

// Les rangées d'origine : clé API → clé de traduction du titre de la rangée (restaurantList.*).
export const TITRES_RANGEES = {
  nearby: 'sectionNearby', offers: 'sectionOffers', healthy: 'sectionHealthy', bio: 'sectionBio',
  vegan: 'sectionVegan', grocery: 'sectionGrocery', discover: 'sectionDiscover', free_delivery: 'sectionFreeDelivery'
};

// Titre d'une rangée, d'origine ou ajoutée par l'admin (type de cuisine, rangées « livraison »). `section` porte au
// moins `key` ; `cuisine` et `label` viennent de l'API pour les rangées ajoutées.
export function titreRangee(t, section) {
  const cle = section?.key || section?.sectionKey;
  if (TITRES_RANGEES[cle]) return t(`restaurantList.${TITRES_RANGEES[cle]}`);
  if (cle === 'cheap_delivery') return t('restaurantList.sectionDeliveryFrom', { amount: '3 €' });
  const cuisine = section?.cuisine || (String(cle || '').startsWith('cuisine:') ? String(cle).slice(8) : null);
  if (cuisine) return restaurantTypeLabel(cuisine, t) || cuisine;
  return section?.label || section?.sectionLabel || cle;
}

// « 1re position », « 2e position », « 3e position », puis « Position 4 »… (l'admin peut en vendre jusqu'à dix).
export const libellePosition = (t, n) => (n <= 3 ? t(`placements.pos${n}`) : t('placements.posN', { n }));

export const euros = (v) => `${Number(v).toFixed(2).replace('.', ',').replace(/,00$/, '')} €`;
export const jourCourt = (iso) => String(iso || '').split('-').reverse().join('/');
