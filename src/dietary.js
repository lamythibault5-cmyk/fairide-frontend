// Mentions alimentaires d'un plat, partagées entre l'accueil (rangées Bio / Vegan), la barre de recherche
// des restaurants et la page Recherche. Un plat est « bio » ou « vegan » si le restaurateur l'a coché
// (menu_items.organic / .vegan), ou si son nom ou sa description le dit (« Vin bio », « Burger vegan »),
// pour que les rangées et les filtres vivent avant que toutes les cartes soient annotées.
const texteDuPlat = (m) => `${m.name || ''} ${m.desc || m.description || ''}`.toLowerCase();

export const platBio = (m) => !!m.organic || /(^|[^a-zà-ÿ])bio(logique)?s?($|[^a-zà-ÿ])|organic/i.test(texteDuPlat(m));
export const platVegan = (m) => !!m.vegan || /v[eé]gan/i.test(texteDuPlat(m));
export const restoBio = (r) => (r.menu || []).some(platBio);
export const restoVegan = (r) => (r.menu || []).some(platVegan);
