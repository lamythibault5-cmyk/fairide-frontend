// Mentions alimentaires d'un plat, partagées entre l'accueil (rangées Bio / Vegan), la barre de recherche
// des restaurants et la page Recherche. Un plat est « bio » ou « vegan » si le restaurateur l'a coché
// (menu_items.organic / .vegan), ou si son nom ou sa description le dit (« Vin bio », « Burger vegan »),
// pour que les rangées et les filtres vivent avant que toutes les cartes soient annotées.
//
// HALAL ET SANS GLUTEN (15 oct. 2026, backend migration 042) : déclarés par le commerce, qui en répond — par plat, ou
// pour tout l'établissement en halal (halalAll ; le serveur marque alors aussi chaque plat). SEULES ses cases comptent :
// le texte du plat ne vaut plus déclaration (audit du 19/10, shop-309 : « viande non halal » passait pour halal, « option
// sans gluten sur demande » pour un plat sans gluten ; décision fondateur : halal et sans gluten sont DÉCLARÉS par le
// commerce, jamais déduits). Un commerce sort sous le filtre s'il est « tout halal » ou s'il a coché au moins un plat ;
// la recherche par plat ne garde que les plats cochés. Rien n'est déduit des allergènes non plus.
const texteDuPlat = (m) => `${m.name || ''} ${m.desc || m.description || ''}`.toLowerCase();

export const platBio = (m) => !!m.organic || /(^|[^a-zà-ÿ])bio(logique)?s?($|[^a-zà-ÿ])|organic/i.test(texteDuPlat(m));
export const platVegan = (m) => !!m.vegan || /v[eé]gan/i.test(texteDuPlat(m));
export const platHalal = (m) => !!m.halal;
export const platSansGluten = (m) => !!m.glutenFree;
export const restoBio = (r) => (r.menu || []).some(platBio);
export const restoVegan = (r) => (r.menu || []).some(platVegan);
export const restoHalal = (r) => !!r.halalAll || (r.menu || []).some(platHalal);
export const restoSansGluten = (r) => (r.menu || []).some(platSansGluten);
