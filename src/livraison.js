// LE PRIX DE DÉPART DE LA LIVRAISON, calculé au même endroit pour la liste, la fiche, le panier et le paiement
// (fondateur, 2026-10-01). Miroir du calcul serveur (routes/orders.js) :
//   - tarif Fairide (fondateur, 2026-10-14) : 5,00 € jusqu'à 1 km, puis 0,80 € par kilomètre entamé dès le 2e — prix
//     finaux, TVA comprise le cas échéant, plus de « + 21 % » (6,05 € du 08 au 14/10) ; calculé au serveur — d'où
//     le « dès » ; 10 % de frais de système Fairide sont COMPRIS dedans (le livreur touche 90 %), rien ne s'ajoute au total ;
//   - commerce qui livre avec son équipe (deliveredByRestaurant, fondateur 2026-11-02) : ses frais, fixes, à lui ; avec
//     « Renfort Fairride » allumé, ses nouvelles commandes suivent le tarif Fairride ;
//   - le commerce peut offrir une part fixe (deliveryFeeDiscount : 1,50 € → livraison dès 3 €), la totalité
//     (freeDelivery), ou la totalité dès un montant de commande (freeDeliveryMinOrder). Ce qu'il offre, il le reçoit
//     en moins sur son virement, et le livreur touche sa part complète.
import { eurosCourt } from './prixPlat';
import { haversineDistanceKm } from './menuCategories';
/* LE FORFAIT DE LIVRAISON VIENT DU SERVEUR (comparaison front / serveur, 2026-11-05). La copie fixe d'ici disait encore 5 € le
 * 06/11 alors que le serveur facture 5,80 € depuis le 31/10 (pricing.js, migration 101) : « Livraison dès 5 € » partout, et
 * davantage au paiement. Il est réglable dans Admin : GET /orders/launch l'envoie (forfaitLivraison), launch.js le pose ici.
 * 5,80 € en attendant la première réponse (et pour un serveur plus ancien). */
let forfait = 5.8;
export function forfaitLivraison() { return forfait; }
export function poserForfaitLivraison(v) {
  const n = Number(v);
  if (Number.isFinite(n) && n > 0) forfait = n;
}

export function tarifLivraison(r) {
  const propre = !!r?.deliveredByRestaurant && r?.ownDeliveryFee != null;
  const base = propre ? Number(r.ownDeliveryFee) : forfaitLivraison();
  const offerte = !!r?.freeDelivery;
  const remise = Math.min(Number(r?.deliveryFeeDiscount) || 0, base);
  const depart = offerte ? 0 : +(base - remise).toFixed(2);
  return {
    base, depart, offerte, propre, remise,
    offerteDes: r?.freeDeliveryMinOrder != null ? Number(r.freeDeliveryMinOrder) : null,
    reduite: !offerte && depart < base
  };
}

// Même format que tous les prix (« 3 € », « 2.50 € », prixPlat.js, Owen 2026-11-08) : c'est eurosCourt, gardé sous ce nom
// pour la liste et la fiche. Écrit à la main au format français, il donnait « Delivery from 3 € » à côté de « -€3 » sur la
// liste anglaise (6 oct. 2026) ; un seul formateur pour tous évite ces écarts.
export const eurosCourts = (v) => eurosCourt(v);

/* HORS ZONE DE LIVRAISON (audit du 19/10, discovery-03). Le serveur refuse une livraison au-delà de la distance du commerce
 * (routes/orders.js, OUT_OF_DELIVERY_RADIUS) : vol d'oiseau arrondi au dixième (geocode.estimateDeliveryMinutes), comparé
 * à deliveryRadiusKm. Même calcul ici, depuis l'adresse du compte, pour la liste et la fiche : le client l'apprenait au
 * devis, panier rempli. Sans position connue, on ne sait pas : rien n'est retiré (le serveur tranche à la commande). */
export function distanceLivraisonKm(r, user) {
  if (!user?.lat || !user?.lng || !r?.lat || !r?.lng) return null;
  return Math.round(haversineDistanceKm(user.lat, user.lng, r.lat, r.lng) * 10) / 10;
}
export function horsZoneLivraison(r, user) {
  const km = distanceLivraisonKm(r, user);
  return km !== null && r?.deliveryRadiusKm != null && km > Number(r.deliveryRadiusKm);
}
