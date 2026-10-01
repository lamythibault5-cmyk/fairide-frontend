// LE PRIX DE DÉPART DE LA LIVRAISON, calculé au même endroit pour la liste, la fiche, le panier et le paiement
// (fondateur, 2026-10-01). Miroir du calcul serveur (routes/orders.js) :
//   - tarif Fairide : forfait de départ (4,50 €), puis la distance, calculée au serveur — d'où le « dès » ;
//   - commerce qui livre lui-même (deliveryMode 'own') avec ses propres frais : c'est son montant, à 100 % ;
//   - le commerce peut offrir une part fixe (deliveryFeeDiscount : 1,50 € → livraison dès 3 €), la totalité
//     (freeDelivery), ou la totalité dès un montant de commande (freeDeliveryMinOrder). Ce qu'il offre, il le reçoit
//     en moins sur son virement, et le livreur touche les frais complets.
export const FORFAIT_LIVRAISON = 4.5;

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

export const eurosCourts = (v) => `${Number(v).toFixed(2).replace('.', ',').replace(/,00$/, '')} €`;
