// LE PRIX DE DÉPART DE LA LIVRAISON, calculé au même endroit pour la liste, la fiche, le panier et le paiement
// (fondateur, 2026-10-01). Miroir du calcul serveur (routes/orders.js) :
//   - tarif Fairide (fondateur, 2026-10-08) : forfait de 5 € HTVA (6,05 € TVA comprise) pour le 1er km, puis 0,80 € HTVA par
//     kilomètre entamé dès le 2e (0,97 € TVA comprise), calculé au serveur — d'où
//     le « dès » ; 10 % de frais de système Fairide sont COMPRIS dedans (le livreur touche 90 %), rien ne s'ajoute au total ;
//   - commerce qui livre lui-même (deliveryMode 'own') avec ses propres frais : c'est son montant, à 100 % ;
//   - le commerce peut offrir une part fixe (deliveryFeeDiscount : 1,50 € → livraison dès 3 €), la totalité
//     (freeDelivery), ou la totalité dès un montant de commande (freeDeliveryMinOrder). Ce qu'il offre, il le reçoit
//     en moins sur son virement, et le livreur touche sa part complète.
import { getLocale } from './context/LanguageContext';
export const FORFAIT_LIVRAISON = 6.05; // 5 € HTVA + 21 % de TVA

export function tarifLivraison(r) {
  const propre = r?.deliveryMode === 'own' && r?.ownDeliveryFee != null;
  const base = propre ? Number(r.ownDeliveryFee) : FORFAIT_LIVRAISON;
  const offerte = !!r?.freeDelivery;
  const remise = Math.min(Number(r?.deliveryFeeDiscount) || 0, base);
  const depart = offerte ? 0 : +(base - remise).toFixed(2);
  return {
    base, depart, offerte, propre, remise,
    offerteDes: r?.freeDeliveryMinOrder != null ? Number(r.freeDeliveryMinOrder) : null,
    reduite: !offerte && depart < base
  };
}

// Dans le format de la langue affichée (« 3 € », « €3 », « € 3 ») : écrit à la main au format français, il donnait
// « Delivery from 3 € » à côté de « -€3 » sur la liste anglaise (test de bout en bout du 6 oct. 2026). Sans « ,00 »
// pour un montant rond, comme eurosCourt dans prixPlat.js.
export const eurosCourts = (v) => {
  const n = Number(v) || 0;
  return new Intl.NumberFormat(getLocale(), { style: 'currency', currency: 'EUR', minimumFractionDigits: Number.isInteger(n) ? 0 : 2 }).format(n);
};
