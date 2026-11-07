// Calendrier de lancement côté client (miroir des verrous serveur, voir routes/orders.js, routes/restaurants.js et
// lancement.js côté backend). Première campagne sur les réseaux sociaux le 16 octobre 2026 (fondateur, 2026-09-30).
// Aucune ouverture à une date : les commandes à emporter PAYÉES SUR PLACE ouvrent quand l'équipe appuie sur « Ouvrir l'à
// emporter » (fondateur, 2026-10-31 : le 1er novembre allait les ouvrir tout seul alors que l'équipe n'était pas prête) ;
// livraison et paiement en ligne quand elle appuie sur GO (fondateur, 2026-10-18 : ouvrir seulement quand assez de
// livreurs roulent). Tout le reste est visible et utilisable avant. Les administrateurs, comptes de test et simulations
// passent (essais).
import { useSyncExternalStore } from 'react';
import { adresseApi, api, siRefusOuverture } from './api';
import { poserForfaitLivraison } from './livraison';

export const CAMPAGNE_RESEAUX = new Date('2026-10-16T00:00:00+02:00');
export const APP_STORES = new Date('2026-10-06T00:00:00+02:00');
// Plus aucune date dans la construction : VITE_PICKUP_OPEN_AT, VITE_DELIVERY_OPEN_AT et VITE_ONLINE_PAYMENT_OPEN_AT ne
// servent plus. L'appli copie ce fichier dans son paquet : une date ici restait dans chaque appli installée. Le site et
// l'appli suivent leur serveur (le staging ouvre tout par FAIRIDE_GO=on).

/* L'ÉTAT DES BOUTONS D'OUVERTURE, LU SUR LE SERVEUR (GET /orders/launch) : `emporter` (pickupOpen) et `go`.
 *
 * Le site ne décide rien : il affiche ce que le serveur appliquera. Au démarrage, la dernière réponse connue (gardée sur
 * l'appareil, pour ne pas montrer « bientôt » une seconde à quelqu'un qui revient après le GO), sinon « fermé » ; puis
 * l'état du serveur, relu toutes les minutes tant que la page est visible et au retour sur la page. Un serveur
 * injoignable laisse l'état tel quel : le serveur refuse de toute façon ce qui n'est pas ouvert.
 * Les composants qui en dépendent appellent useLancement() pour se redessiner au changement. */
const CLE = 'fairide_lancement';
// livraisonMaintenant (audit du 19/10, discovery-02) : après GO, un livreur du pool Fairide est-il libre à l'instant ?
// Oui/non seulement, jamais un nombre ; null tant qu'on ne sait pas (rien n'est alors retiré de la liste).
// emporter : l'à emporter payé sur place est-il ouvert ? Une réponse gardée d'avant ce bouton n'en dit rien : fermé.
// livraisonLoinMaintenant / veloMaxKm : la même question au-delà de la distance d'un vélo (comparaison front / serveur, 2026-11-05).
const oui = (v) => (typeof v === 'boolean' ? v : null);
const lire = (c) => ({ go: c.go, goAt: c.goAt || null, emporter: c.emporter === true || c.go === true, livraisonMaintenant: oui(c.livraisonMaintenant),
  livraisonLoinMaintenant: oui(c.livraisonLoinMaintenant), veloMaxKm: Number(c.veloMaxKm) || null });
let etat = { go: false, goAt: null, emporter: false, livraisonMaintenant: null, livraisonLoinMaintenant: null, veloMaxKm: null };
try { const c = JSON.parse(localStorage.getItem(CLE) || 'null'); if (c && typeof c.go === 'boolean') etat = lire(c); } catch { /* stockage indisponible */ }
const abonnes = new Set();
function poser(suivant) {
  if (suivant.go === etat.go && suivant.goAt === etat.goAt && suivant.emporter === etat.emporter && suivant.livraisonMaintenant === etat.livraisonMaintenant
    && suivant.livraisonLoinMaintenant === etat.livraisonLoinMaintenant && suivant.veloMaxKm === etat.veloMaxKm) return;
  etat = suivant;
  try { localStorage.setItem(CLE, JSON.stringify(etat)); } catch { /* stockage indisponible */ }
  abonnes.forEach((f) => f());
}
// Par api() (G100, 2026-11-06) : un fetch direct ne passait jamais par le relais, et une appli sur un réseau qui bloque
// Railway restait sur « bientôt » après le GO. Une réponse en erreur (503 quand le serveur n'a pas pu lire l'état, G99)
// laisse l'état connu tel quel.
export async function chargerLancement() {
  try {
    const d = await api('/orders/launch', { cache: 'no-store' });
    // Le forfait de livraison du serveur (livraison.js) : posé avant `poser`, qui redessine la liste et les fiches.
    if (d?.forfaitLivraison != null) poserForfaitLivraison(d.forfaitLivraison);
    if (typeof d?.go === 'boolean') poser(lire({ ...d, emporter: d.pickupOpen === true }));
  } catch { /* hors ligne : on garde l'état connu */ }
}
let suivi = null;
function suivre() {
  if (suivi || typeof window === 'undefined') return;
  suivi = setInterval(() => { if (document.visibilityState === 'visible') chargerLancement(); }, 60000);
  document.addEventListener('visibilitychange', () => { if (document.visibilityState === 'visible') chargerLancement(); });
  chargerLancement();
}
// Un refus « pas encore ouvert » (PICKUP_NOT_OPEN, DELIVERY_NOT_OPEN, ONLINE_PAYMENT_NOT_OPEN) veut dire que l'état gardé ici
// est en retard (GO refermé il y a moins d'une minute) : on le relit tout de suite, le panier cesse de proposer la livraison
// (G100, 2026-11-06). Au plus une relecture toutes les 5 secondes.
let dernierRefus = 0;
siRefusOuverture(() => { if (Date.now() - dernierRefus > 5000) { dernierRefus = Date.now(); chargerLancement(); } });
function abonner(f) { abonnes.add(f); suivre(); return () => abonnes.delete(f); }
export function useLancement() { return useSyncExternalStore(abonner, () => etat, () => etat); }
export function lancementGo() { return etat.go; }

export function emporterOuvert() { return etat.emporter; }

// Paiement de l'à emporter proposé à l'inscription d'un commerce (Owen, 2026-11-04 : la peur du client qui commande, ne vient
// pas et ne paie pas). « En ligne uniquement » demande des paiements Stripe actifs (G7, fondateur 2026-11-06), qu'un commerce
// qui s'inscrit n'a jamais encore : « Au choix du client », avant comme après le GO ; il vend déjà sur place et passe « en
// ligne uniquement » dans Mon compte une fois ses paiements actifs. Le serveur applique la même règle (inscription) : la page
// d'inscription n'a plus à attendre l'état du GO pour proposer le bon mode (G98).
export function modeEmporterParDefaut() { return 'both'; }

// Admin, compte de test posé par l'équipe (users.is_test) et simulation : mêmes exemptions que le serveur (compteExempte).
const exempte = (user) => !!user?.isAdmin || !!user?.isTest || !!user?.simulation;
export const exempteLancement = exempte;

// Paiement en ligne (à emporter payé en ligne) : ouvre avec la livraison, au GO (fondateur, 2026-09-19 puis 2026-10-18).
// Avant, l'à emporter n'est possible que payé sur place.
export function paiementEnLigneOuvert(user) { return etat.go || exempte(user); }

// type : 'pickup' | 'delivery'.
export function serviceOuvert(type, user) {
  if (exempte(user)) return true;
  return type === 'pickup' ? etat.emporter : etat.go;
}
export function commandesOuvertes(user) { return serviceOuvert('pickup', user); }
export function livraisonOuverte(user) { return serviceOuvert('delivery', user); }
// La liste des commerces (audit du 19/10, discovery-02) : après GO, aucun livreur du pool Fairide libre maintenant = la
// livraison n'est pas promise sur les cartes (le serveur la refuserait : NO_COURIER_AVAILABLE). Un commerce qui livre
// lui-même garde sa vérification sur sa fiche (GET /orders/delivery-available/:id). Les comptes exemptés passent, comme
// côté serveur.
// `km` (distance du client, quand elle est connue) : au-delà de veloMaxKm, seul un livreur qui n'est pas à vélo compte, comme
// au serveur (lancement.livreursDisponiblesListe).
export function livreurFairideLibre(user, km = null) {
  if (exempte(user)) return true;
  if (km !== null && etat.veloMaxKm && km > etat.veloMaxKm && etat.livraisonLoinMaintenant === false) return false;
  return etat.livraisonMaintenant !== false;
}

/* LA LIVRAISON EST-ELLE POSSIBLE CHEZ CE COMMERCE, MAINTENANT ? (GET /orders/delivery-available/:id)
 * Après GO, une livraison demande un livreur disponible à l'instant (lancement.js) : sinon le commerce ne propose que
 * l'à emporter. Renvoie null tant qu'on ne sait pas (pas de bandeau qui clignote), true ou false ensuite. `km` écarte les
 * vélos trop loin quand la distance est connue. Une erreur réseau répond null : le serveur tranche à la commande.
 * `cp` et `ville` (G68, 2026-11-06) : l'adresse de livraison, dont la commune peut être suspendue (Admin › Logistique › Zones) ;
 * le serveur la lit comme à la commande (adminLogistics.js › communeDeLAdresse). */
export async function livraisonDisponible(restaurantId, km = null, cp = '', ville = '') {
  if (!restaurantId) return null;
  try {
    const params = new URLSearchParams();
    if (km !== null && km !== undefined && Number.isFinite(Number(km))) params.set('km', String(Number(km)));
    if (cp) params.set('cp', cp);
    if (cp && ville) params.set('ville', ville);
    const q = params.toString() ? `?${params}` : '';
    const r = await fetch(`${adresseApi()}/orders/delivery-available/${encodeURIComponent(restaurantId)}${q}`, { cache: 'no-store' });
    if (!r.ok) return null;
    const d = await r.json();
    return typeof d?.available === 'boolean' ? d : null;
  } catch { return null; }
}

// Activation des paiements (Stripe Connect), commerces et livreurs. Cette date vivait en double, écrite
// en dur dans PaiementRestaurant.jsx ET PaiementLivreur.jsx, hors de ce calendrier — d'où une
// trentaine de phrases qui annonçaient « début octobre » sans que rien ne les relie à la date
// réellement appliquée. Une seule origine, ici, comme pour toutes les autres dates.
export const OUVERTURE_PAIEMENTS = new Date('2026-10-05T00:00:00+02:00');
export function paiementsOuverts() { return Date.now() >= OUVERTURE_PAIEMENTS.getTime(); }
// Formatage local (G129, 2026-11-06) : la fonction commune `formater` a disparu avec les dates d'ouverture, et cette ligne
// levait une ReferenceError sur un téléphone à l'heure fausse (avant le 5 octobre 2026), l'écran plantait.
export function dateOuverturePaiements(locale = 'fr-BE') {
  return OUVERTURE_PAIEMENTS.toLocaleDateString(locale, { day: 'numeric', month: 'long', timeZone: 'Europe/Brussels' });
}

// L'abonnement des commerces (OUVERTURE_ABONNEMENT, datePremierPrelevement) n'existe plus depuis le 04/11/2026 (fondateur :
// « on retire les 20 € par mois ») : plus de date d'activation ni de premier prélèvement à annoncer.
