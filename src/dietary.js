// Mentions alimentaires d'un plat, partagées entre l'accueil (rangées Bio / Vegan), la barre de recherche
// des restaurants et la page Recherche. Un plat est « bio » ou « vegan » si le restaurateur l'a coché
// (menu_items.organic / .vegan), ou si son nom ou sa description le dit (« Vin bio », « Burger vegan »),
// pour que les rangées et les filtres vivent avant que toutes les cartes soient annotées.
//
// HALAL ET SANS GLUTEN (15 oct. 2026, backend migration 042) : déclarés par le commerce, qui en répond — par plat, ou
// pour tout l'établissement en halal (halalAll ; le serveur marque alors aussi chaque plat). Comme pour bio et vegan, le
// nom ou la description du plat écrits par le commerce comptent aussi (« Poulet halal », « Pain sans gluten ») : c'est sa
// propre déclaration. Rien n'est déduit des allergènes (fondateur : ils ne sont pas encore fiables).
const texteDuPlat = (m) => `${m.name || ''} ${m.desc || m.description || ''}`.toLowerCase();

export const platBio = (m) => !!m.organic || /(^|[^a-zà-ÿ])bio(logique)?s?($|[^a-zà-ÿ])|organic/i.test(texteDuPlat(m));
export const platVegan = (m) => !!m.vegan || /v[eé]gan/i.test(texteDuPlat(m));
export const platHalal = (m) => !!m.halal || /(^|[^a-zà-ÿ])halal($|[^a-zà-ÿ])/i.test(texteDuPlat(m));
export const platSansGluten = (m) => !!m.glutenFree || /sans gluten|gluten[- ]?free|glutenvrij/i.test(texteDuPlat(m));
export const restoBio = (r) => (r.menu || []).some(platBio);
export const restoVegan = (r) => (r.menu || []).some(platVegan);
export const restoHalal = (r) => !!r.halalAll || (r.menu || []).some(platHalal);
export const restoSansGluten = (r) => (r.menu || []).some(platSansGluten);
