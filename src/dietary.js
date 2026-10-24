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
//
// MASQUÉES POUR LE MOMENT, APP ET SITE (fondateur, 2026-10-21 : « c'est très chiant pour le restaurant de le faire, on remettra
// ça bien quand on aura une bonne base de données ») : cocher bio, vegan, halal et sans gluten plat par plat pèse sur le
// commerce, et sans ces cases les filtres ne trouvent presque rien. Tant que c'est false : ni filtres (bande des cuisines,
// colonne « Envies » du site, pastilles de la recherche), ni rangées « Bio » et « Vegan » de l'accueil, ni mentions sur la
// carte des plats, ni cases côté commerce (MentionsAlimentaires, fiche d'un plat), et ces deux rangées ne se vendent plus
// en mise en avant (MiseEnAvant). Les données en base et les règles ci-dessous restent : repasser à true remet tout.
// Les allergènes ne sont PAS concernés : ils restent partout (obligation d'information, règlement UE 1169/2011).

import { compterPlats } from './resumeCarte';

export const MENTIONS_ALIMENTAIRES = false;
export const RANGEES_MENTIONS = ['bio', 'vegan'];

const texteDuPlat = (m) => `${m.name || ''} ${m.desc || m.description || ''}`.toLowerCase();

export const platBio = (m) => !!m.organic || /(^|[^a-zà-ÿ])bio(logique)?s?($|[^a-zà-ÿ])|organic/i.test(texteDuPlat(m));
export const platVegan = (m) => !!m.vegan || /v[eé]gan/i.test(texteDuPlat(m));
export const platHalal = (m) => !!m.halal;
export const platSansGluten = (m) => !!m.glutenFree;
// Un commerce de la liste n'a plus sa carte, seulement le nombre de plats de chaque mention (resumeCarte.js, 2026-10-24) : le
// serveur les compte avec les mêmes règles (routes/restaurants.js › resumeCarte). Changer une règle ici = la changer là-bas.
export const nbPlatsBio = (r) => compterPlats(r, 'bio', platBio);
export const nbPlatsVegan = (r) => compterPlats(r, 'vegan', platVegan);
export const restoBio = (r) => nbPlatsBio(r) > 0;
export const restoVegan = (r) => nbPlatsVegan(r) > 0;
export const restoHalal = (r) => !!r.halalAll || compterPlats(r, 'halal', platHalal) > 0;
export const restoSansGluten = (r) => compterPlats(r, 'sansGluten', platSansGluten) > 0;
