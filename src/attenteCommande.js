import { useEffect, useState } from 'react';
import { getLocale } from './context/LanguageContext';

/* L'ATTENTE ENTRE « PAYER » ET « UN LIVREUR A ACCEPTÉ » : la logique (les écrans sont dans components/client/AttenteCommande.jsx).
 * Fondateur, 2026-11-08, version C de maquettes/retours-08-11 : la liste qui se coche du paiement jusqu'au restaurant, puis les
 * ondes pendant qu'on cherche un livreur ; « informatif mais professionnel » ; le vélo de la route du bandeau avance d'un arrêt
 * à chaque coche.
 *
 * RÈGLE : une ligne ne se coche que quand la chose est vraiment faite, lue sur la commande que renvoie le serveur.
 *   - Paiement sécurisé vérifié : `paid` (le serveur l'a confirmé auprès de Stripe : webhook, ou POST /payments/confirm).
 *     Aucun autre contrôle « de sécurité » n'existe : rien d'autre n'est annoncé.
 *   - Commande envoyée : `paid` aussi (le commerce reçoit la commande, et sa notification, au paiement ; sur place, à l'envoi).
 *   - Le restaurant confirme : statut sorti de « nouveau » (il a accepté). Sans réponse à `acceptDeadline`, le serveur annule
 *     et rembourse (backend acceptation.js) : c'est la seule phrase sous la ligne.
 *   - Un livreur : `driverId`. On ne cherche un livreur qu'APRÈS l'acceptation du restaurant (notifLivreurs.js), et seulement
 *     quand la commande est ouverte aux livreurs (`noCourierCancelAt` posé par le serveur) : les ondes ne tournent qu'à ce moment.
 * Le serveur prévient tous les livreurs disponibles, pas « ceux autour du restaurant » : le texte le dit ainsi.
 *
 * PAS À PAS : une coche à la fois, au moins PAS_MS entre deux (le temps que le vélo roule d'un arrêt au suivant, .rs-velo
 * .9 s), même quand trois étapes sont déjà faites à l'ouverture. Ce qui a déjà été montré pour une commande est retenu le temps
 * de la session (`vusParCommande`) : du merci au suivi, ou en revenant sur Mes commandes, on ne rejoue pas les coches déjà vues. */
const PAS_MS = 900;
const vusParCommande = new Map();
export const mouvementReduit = () => {
  try { return window.matchMedia('(prefers-reduced-motion: reduce)').matches; } catch { return false; }
};

// `rattrapage` : jamais vue dans cette session (appli rouverte sur une commande déjà en route), on ne rejoue que les derniers
// pas, pas tout le trajet depuis le paiement.
export function usePasAPas(cle, cible, rattrapage = Infinity) {
  const [vu, setVu] = useState(() => (mouvementReduit() ? cible : Math.min(cible, vusParCommande.get(cle) ?? Math.max(0, cible - rattrapage))));
  useEffect(() => {
    if (vu > cible) { setVu(cible); return undefined; }
    if (vu === cible) return undefined;
    const id = setTimeout(() => setVu((v) => Math.min(cible, v + 1)), PAS_MS);
    return () => clearTimeout(id);
  }, [vu, cible]);
  useEffect(() => { if (cle != null) vusParCommande.set(cle, Math.max(vusParCommande.get(cle) ?? 0, vu)); }, [cle, vu]);
  return vu;
}

// L'heure limite d'acceptation : l'heure seule aujourd'hui, la date avec un autre jour (comme ProchaineEtape, orderStatus.jsx).
function heureLimite(ms) {
  const d = new Date(ms);
  return d.toDateString() === new Date().toDateString()
    ? d.toLocaleTimeString(getLocale(), { hour: '2-digit', minute: '2-digit' })
    : d.toLocaleString(getLocale(), { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' });
}

/* Les lignes de la liste de l'attente pour cette commande. `indices` : avant la première lecture de la commande (écran du
 * paiement), ce que le paiement savait déjà (sur place, livraison, livrée par le commerce). */
export function etapesAttente(order, t, indices = {}) {
  const o = order || {};
  const enLigne = order ? o.paymentMode !== 'on_site' : !indices.surPlace;
  const livraison = order ? o.orderType === 'delivery' : !!indices.livraison;
  const parFairride = livraison && (order ? o.deliveryBy !== 'restaurant' : !indices.parCommerce);
  const nom = o.restaurantName;
  const avecNom = (cle) => (nom ? t(`attente.${cle}`, { restaurant: nom }) : t(`attente.${cle}SansNom`));
  const etapes = [];
  if (enLigne) etapes.push({ cle: 'paiement', titre: t('attente.paiement') });
  etapes.push({ cle: 'envoyee', titre: avecNom('envoyee') });
  etapes.push({
    cle: 'confirmee', titre: avecNom('confirme'),
    sous: o.acceptDeadline ? t(enLigne ? 'attente.confirmeSous' : 'attente.confirmeSousSurPlace', { time: heureLimite(o.acceptDeadline) }) : null
  });
  if (parFairride) etapes.push({ cle: 'livreur', titre: t('attente.livreur') });
  return { etapes, enLigne };
}

// Combien de lignes sont cochées à l'état `vu` de la route (routeCommande). Payée sur place, pas de ligne « Paiement » : l'état 1
// (envoyée) coche « Commande envoyée », l'état 2 (le commerce confirme) n'ajoute rien, puis une ligne par état.
export function lignesCochees(vu, enLigne) {
  return enLigne || vu <= 1 ? vu : vu - 1;
}

// Le titre du bandeau pendant l'attente (écran du paiement, et suivi tant que le commerce doit confirmer).
export function titreAttente(order, t, vu, enLigne = true) {
  const nom = order?.restaurantName;
  const avecNom = (cle) => (nom ? t(`attente.${cle}`, { restaurant: nom }) : t(`attente.${cle}SansNom`));
  if (vu <= 0 && enLigne) return t('attente.titrePaiement');
  if (vu <= 1) return avecNom('titreEnvoyee');
  return avecNom('titreConfirmee');
}

/* Le moment du suivi où l'attente remplace la route habituelle : le restaurant doit confirmer, ou on cherche un livreur.
 * Ailleurs (en cuisine avec un livreur, en route, à emporter acceptée…), la carte du suivi reste celle d'avant ; la route du
 * bandeau, elle, est la même du paiement à la livraison (routeCommande). */
export function modeAttente(o) {
  if (!o) return null;
  if (o.status === 'nouveau' && o.paid) return 'confirmation';
  const parFairride = o.orderType === 'delivery' && o.deliveryBy !== 'restaurant';
  if (parFairride && !o.driverId && ['preparation', 'pret'].includes(o.status) && o.noCourierCancelAt && !o.courierNoShow) return 'recherche';
  return null;
}

/* UNE SEULE ROUTE PAR COMMANDE, DU PAIEMENT À LA FIN, ET LE VÉLO NE RECULE JAMAIS (fondateur, 2026-11-08, maquettes/retours-08-11/
 * attente-v2.html, réponses « 5 arrêts », « grande carte d'ondes », « son initiale arrive dans les ondes »). Avant, la route de
 * l'attente cédait la place, le livreur trouvé, à celle du suivi (Envoyée · En cuisine · Prête · En route) : le vélo reculait.
 *   - livraison par un livreur Fairride : Paiement · Confirmée · Livreur · En route · Livrée ;
 *   - livraison par l'équipe du commerce : Paiement · Confirmée · Prête · En route · Livrée (pas de livreur à chercher) ;
 *   - à emporter : Paiement · Confirmée · Prête · Récupérée.
 * Payée sur place : « Envoyée » au lieu de « Paiement » (rien n'est payé avant ; la commande part au commerce à l'envoi).
 * « Commande envoyée » n'est pas un arrêt : elle part au commerce au paiement (la liste la garde comme ligne).
 * Chaque commande avance d'état en état (`etats`, dans l'ordre) : `fait` = arrêts cochés, `place` = où est le vélo. Un demi :
 * « en chemin » entre le dernier arrêt coché et le suivant (payée → vers Confirmée ; en cuisine → vers Livreur ; livreur trouvé
 * → vers En route ; récupérée par le livreur → vers Livrée). La liste de l'attente se coche au même rythme : son nombre de
 * lignes cochées est l'état lui-même (état 1 : paiement coché ; 2 : envoyée ; 3 : confirmée ; 4 : livreur trouvé). */
export const CLES_ARRETS = {
  paiement: 'attente.arretPaiement', envoyee: 'attente.arretEnvoyee', confirmee: 'attente.arretConfirmee', livreur: 'attente.arretLivreur',
  prete: 'orderStatus.progress.ready', enRoute: 'orderStatus.progress.onTheWay', livree: 'orderStatus.progress.delivered', recuperee: 'orderStatus.progress.pickedUp'
};
const E = (fait, place) => ({ fait, place });
export function routeCommande(order, indices = {}) {
  const o = order || {};
  const enLigne = order ? o.paymentMode !== 'on_site' : !indices.surPlace;
  const livraison = order ? o.orderType === 'delivery' : !!indices.livraison;
  const parFairride = livraison && (order ? o.deliveryBy !== 'restaurant' : !indices.parCommerce);
  const arrets = [enLigne ? 'paiement' : 'envoyee', 'confirmee', parFairride ? 'livreur' : 'prete', ...(livraison ? ['enRoute', 'livree'] : ['recuperee'])];
  const st = o.status;
  // Communs : 0 vérification/envoi · 1 payée, en chemin vers Confirmée · 2 le commerce confirme · 3 acceptée, en cuisine.
  let etats;
  let etat;
  if (!o.paid) etat = 0;
  else if (st === 'nouveau') etat = 2;
  if (parFairride) {
    // … 4 livreur trouvé · 5 en route · 6 livrée
    etats = [E(0, 0), E(1, 0.5), E(1, 1), E(2, 1.5), E(3, 2.5), E(4, 3.5), E(5, 4)];
    if (etat === undefined) etat = st === 'livre' ? 6 : st === 'livraison' ? 5 : o.driverId ? 4 : 3;
  } else if (livraison) {
    // … 4 prête · 5 en route · 6 livrée
    etats = [E(0, 0), E(1, 0.5), E(1, 1), E(2, 1.5), E(3, 2.5), E(4, 3.5), E(5, 4)];
    if (etat === undefined) etat = st === 'livre' ? 6 : st === 'livraison' ? 5 : st === 'pret' ? 4 : 3;
  } else {
    // … 4 prête · 5 récupérée
    etats = [E(0, 0), E(1, 0.5), E(1, 1), E(2, 1.5), E(3, 2.5), E(4, 3)];
    if (etat === undefined) etat = st === 'livre' ? 5 : st === 'pret' ? 4 : 3;
  }
  return { arrets, etats, etat, parFairride };
}

// L'état de la route et de la liste, au pas : une seule horloge pour le vélo et les coches (et pour l'en-tête comme pour la
// feuille, qui la retrouvent sous la même clé). `etatMax` : jusqu'où aller sur cet écran (celui du paiement s'arrête à 2).
export function useEtatAttente(order, { cle = order?.id, indices, etatMax = Infinity } = {}) {
  const route = routeCommande(order, indices);
  const vu = usePasAPas(cle != null ? `${cle}:route` : null, Math.min(route.etat, etatMax), 2);
  return { ...route, vu, position: route.etats[Math.min(vu, route.etats.length - 1)] };
}
