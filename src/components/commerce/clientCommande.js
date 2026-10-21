import { getLanguage, getLocale } from '../../context/LanguageContext';

/* CE QUE LE COMMERCE SAIT D'UNE COMMANDE, CALCULÉ DE CE QU'IL REÇOIT DÉJÀ (audit design 2, fondateur, 2026-10-19).
 * Aucune route en plus : tout vient de GET /orders/restaurant/:id (backend routes/orders.js, mapOrder), qui renvoie TOUT
 * l'historique du commerce. Utilisé par la feuille « Nouvelle commande », les cartes de Commandes et « Ce soir » de
 * l'accueil.
 *
 * ATTENTION à `order.commune` : c'est la commune du COMMERCE (copiée à la commande), pas celle du client. La commune du
 * client vient du code postal de livraison, à défaut de la ville qu'il a tapée. */

// Les 19 communes et la périphérie desservie, par code postal (même table que HeroAdresse.jsx et le backend adresseCollee.js).
const COMMUNE_PAR_CODE = {
  1000: 'Bruxelles', 1020: 'Bruxelles', 1120: 'Bruxelles', 1130: 'Bruxelles', 1030: 'Schaerbeek', 1040: 'Etterbeek', 1050: 'Ixelles',
  1060: 'Saint-Gilles', 1070: 'Anderlecht', 1080: 'Molenbeek-Saint-Jean', 1081: 'Koekelberg', 1082: 'Berchem-Sainte-Agathe', 1083: 'Ganshoren',
  1090: 'Jette', 1140: 'Evere', 1150: 'Woluwe-Saint-Pierre', 1160: 'Auderghem', 1170: 'Watermael-Boitsfort', 1180: 'Uccle', 1190: 'Forest',
  1200: 'Woluwe-Saint-Lambert', 1210: 'Saint-Josse-ten-Noode',
  1930: 'Zaventem', 1950: 'Kraainem', 1970: 'Wezembeek-Oppem', 1980: 'Tervuren', 1700: 'Dilbeek', 1620: 'Drogenbos', 1630: 'Linkebeek',
  1640: 'Rhode-Saint-Genèse', 1560: 'Hoeilaart', 1853: 'Strombeek-Bever', 1780: 'Wemmel', 1731: 'Zellik'
};
// Comme on les dit à Bruxelles : « Molenbeek », pas « Molenbeek-Saint-Jean ». Les deux Woluwe gardent leur nom entier.
const COURTES = {
  'Molenbeek-Saint-Jean': 'Molenbeek', 'Saint-Josse-ten-Noode': 'Saint-Josse', 'Berchem-Sainte-Agathe': 'Berchem', 'Watermael-Boitsfort': 'Boitsfort'
};
export function communeCourte(nom) {
  const n = String(nom || '').trim();
  if (!n) return '';
  return COURTES[n] || n;
}

// Commune de livraison du client, en court. Un retrait n'en a pas.
export function communeClient(o) {
  if (!o || o.orderType !== 'delivery') return '';
  const cp = Number(String(o.addressPostalCode || '').trim());
  return communeCourte(COMMUNE_PAR_CODE[cp] || o.addressCity || '');
}

// Prénom seul (« Nora Kaddouri » → « Nora », « Yanis B. » → « Yanis »).
export function prenom(nom) {
  return String(nom || '').trim().split(/\s+/)[0] || '';
}

const kmLisible = (km) => `${Number(km).toLocaleString(getLocale(), { minimumFractionDigits: 1, maximumFractionDigits: 1 })} km`;

// « Molenbeek, 1,2 km » (livraison) ; '' pour un retrait.
export function ouEstLeClient(o) {
  const commune = communeClient(o);
  if (!commune) return '';
  return o.distanceKm != null ? `${commune}, ${kmLisible(o.distanceKm)}` : commune;
}

const finie = (o) => o.status === 'refuse' || o.status === 'annule';

/* Combientième commande de ce client chez ce commerce (celle-ci comprise) : 1 = la première. Refusées et annulées ne
   comptent pas (le client n'a rien reçu). null quand le serveur n'envoie pas le client (commande d'essai, par exemple). */
export function rangClient(o, orders) {
  if (!o?.clientId) return null;
  // Le tableau ne reçoit plus tout l'historique (vue « service », audit du 19/10, shop-213) : le serveur compte le rang lui-même.
  if (o.clientRank) return o.clientRank;
  const t0 = Number(o.createdAt) || 0;
  return (orders || []).filter((x) => x.clientId === o.clientId && !x.isTraining && (x.id === o.id || (!finie(x) && (Number(x.createdAt) || 0) <= t0))).length || 1;
}

// « 3e », « 3rd », « 3e » : l'ordinal de la langue courante, pour « 3e commande chez toi ».
export function ordinal(n) {
  if (getLanguage() !== 'en') return `${n}e`;
  const d = n % 10; const c = n % 100;
  const suffixe = c >= 11 && c <= 13 ? 'th' : d === 1 ? 'st' : d === 2 ? 'nd' : d === 3 ? 'rd' : 'th';
  return `${n}${suffixe}`;
}

/* Ce que le commerce garde sur une commande : la même formule que le serveur (RESTAURANT_DUE_SQL, routes/admin.js ;
   virement du commerce, routes/payments.js) — les plats (sous-total, promotions du commerce déjà déduites) moins la
   commission de Fairide et sa TVA, moins la part de livraison que le commerce offre, moins un bon cadeau qu'il a déjà
   encaissé. Payée sur place : commission 0, il garde les plats. La livraison et le pourboire vont au livreur. */
export function partCommerce(o) {
  const v = Number(o.subtotal || 0) - Number(o.commission || 0) - Number(o.commissionVat || 0) - Number(o.deliveryDiscount || 0) - Number(o.giftVoucherDiscount || 0);
  return Math.max(0, Math.round(v * 100) / 100);
}

/* Heure à laquelle la commande doit être prête : l'heure promise au client (estimatedDeliveryAt, posée à la commande sur le
   temps de préparation du commerce), moins le trajet pour une livraison, plus le temps ajouté à l'acceptation. Une fois
   acceptée, le serveur a déjà ajouté ce temps à l'heure promise : `enPlus` ne sert qu'à une commande qui attend. Jamais
   dans le passé (acceptée en retard : « vers maintenant »). null sans estimation. */
export function heurePrete(o, enPlus = 0) {
  if (!o?.estimatedDeliveryAt) return null;
  const trajet = o.orderType === 'delivery' ? Number(o.travelMinutes || 0) : 0;
  const t = Number(o.estimatedDeliveryAt) - trajet * 60000 + enPlus * 60000;
  const ms = Math.max(t, Date.now() + enPlus * 60000);
  return new Date(ms).toLocaleTimeString(getLocale(), { hour: '2-digit', minute: '2-digit' });
}

// Pourboire déjà payé pour le livreur (au paiement, ou après la livraison).
export function pourboire(o) {
  return Number(o.tipAtCheckout || 0) || (o.tipPaid ? Number(o.tipAmount || 0) : 0);
}

// « #058 » : même forme que le ticket imprimé.
export const numeroCommande = (o) => (o?.orderNumber ? `#${String(o.orderNumber).padStart(3, '0')}` : '');
