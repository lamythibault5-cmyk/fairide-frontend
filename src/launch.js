// Calendrier de lancement côté client (miroir des verrous serveur, voir routes/orders.js, routes/restaurants.js et
// lancement.js côté backend). Première campagne sur les réseaux sociaux le 16 octobre 2026 (fondateur, 2026-09-30).
// Aucune ouverture à une date : les commandes à emporter PAYÉES SUR PLACE ouvrent quand l'équipe appuie sur « Ouvrir l'à
// emporter » (fondateur, 2026-10-31 : le 1er novembre allait les ouvrir tout seul alors que l'équipe n'était pas prête) ;
// livraison et paiement en ligne quand elle appuie sur GO (fondateur, 2026-10-18 : ouvrir seulement quand assez de
// livreurs roulent). Tout le reste est visible et utilisable avant. Les administrateurs, comptes de test et simulations
// passent (essais).
import { useSyncExternalStore } from 'react';
import { API_BASE } from './api';

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
const lire = (c) => ({ go: c.go, goAt: c.goAt || null, emporter: c.emporter === true || c.go === true, livraisonMaintenant: typeof c.livraisonMaintenant === 'boolean' ? c.livraisonMaintenant : null });
let etat = { go: false, goAt: null, emporter: false, livraisonMaintenant: null };
try { const c = JSON.parse(localStorage.getItem(CLE) || 'null'); if (c && typeof c.go === 'boolean') etat = lire(c); } catch { /* stockage indisponible */ }
const abonnes = new Set();
function poser(suivant) {
  if (suivant.go === etat.go && suivant.goAt === etat.goAt && suivant.emporter === etat.emporter && suivant.livraisonMaintenant === etat.livraisonMaintenant) return;
  etat = suivant;
  try { localStorage.setItem(CLE, JSON.stringify(etat)); } catch { /* stockage indisponible */ }
  abonnes.forEach((f) => f());
}
export async function chargerLancement() {
  try {
    const r = await fetch(`${API_BASE}/orders/launch`, { cache: 'no-store' });
    if (!r.ok) return;
    const d = await r.json();
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
function abonner(f) { abonnes.add(f); suivre(); return () => abonnes.delete(f); }
export function useLancement() { return useSyncExternalStore(abonner, () => etat, () => etat); }
export function lancementGo() { return etat.go; }

export function emporterOuvert() { return etat.emporter; }

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
export function livreurFairideLibre(user) { return exempte(user) || etat.livraisonMaintenant !== false; }

/* LA LIVRAISON EST-ELLE POSSIBLE CHEZ CE COMMERCE, MAINTENANT ? (GET /orders/delivery-available/:id)
 * Après GO, une livraison demande un livreur disponible à l'instant (lancement.js) : sinon le commerce ne propose que
 * l'à emporter. Renvoie null tant qu'on ne sait pas (pas de bandeau qui clignote), true ou false ensuite. `km` écarte les
 * vélos trop loin quand la distance est connue. Une erreur réseau répond null : le serveur tranche à la commande. */
export async function livraisonDisponible(restaurantId, km = null) {
  if (!restaurantId) return null;
  try {
    const q = km !== null && km !== undefined && Number.isFinite(Number(km)) ? `?km=${Number(km)}` : '';
    const r = await fetch(`${API_BASE}/orders/delivery-available/${encodeURIComponent(restaurantId)}${q}`, { cache: 'no-store' });
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
export function dateOuverturePaiements(locale = 'fr-BE') { return formater(OUVERTURE_PAIEMENTS, locale); }

// Abonnement des commerces (version complète : livraison et paiement en ligne) : activable dès le 6 octobre 2026 (date d'abord liée à la sortie de l'application, qui n'a pas eu lieu),
// pour être prêt à l'ouverture des commandes. Miroir de FAIRIDE_SUBSCRIPTION_OPEN_AT (routes/restaurants.js).
export const OUVERTURE_ABONNEMENT = new Date('2026-10-06T00:00:00+02:00');
export function abonnementOuvert() {
  return Date.now() >= OUVERTURE_ABONNEMENT.getTime();
}
// Date annoncée au restaurateur dans la check-list de mise en ligne : elle vient d'ici, pas d'une
// phrase traduite, pour qu'un report du calendrier ne laisse pas trois textes périmés derrière lui.
export function dateOuvertureAbonnement(locale = 'fr-BE') {
  return formater(OUVERTURE_ABONNEMENT, locale);
}

// Premier prélèvement de la formule complète si le commerce l'active à la date donnée : le mois offert (30 jours)
// court à partir de l'ouverture des commandes payées en ligne (le GO), ou de l'activation si elle est postérieure. Miroir
// de routes/restaurants.js et de lancement.prolongerEssais côté serveur. Avant GO, la date n'est pas connue : null, et
// l'écran le dit en mots (« 30 jours après l'ouverture »).
export const MOIS_OFFERT_JOURS = 30;
export function datePremierPrelevement(activation = new Date()) {
  if (!etat.go) return null;
  const go = etat.goAt ? new Date(etat.goAt).getTime() : 0;
  return new Date(Math.max(activation.getTime(), go) + MOIS_OFFERT_JOURS * 86400000);
}
