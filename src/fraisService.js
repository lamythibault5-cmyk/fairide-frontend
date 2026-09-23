// Frais de service Fairide payés par le client — modèle du 23/09/2026 (soir), « comme Uber Eats » :
//   - la part de Fairide sur les plats est DANS le prix affiché (prix de salle + 10 %), pas une ligne du panier ;
//   - le client paie en plus 10 % des frais de livraison, HORS TVA, la TVA (21 %) s'y ajoutant.
// Même calcul que pricing.fraisService côté serveur (deliveryFairideRate, vatRateServiceFee) ; le montant exact
// reste toujours celui renvoyé par la commande réelle. Rien à emporter : pas de livraison, pas de frais.
// Fichier à part plutôt que dans CartContext.jsx : un module de composants qui exporte aussi des fonctions casse le
// rechargement à chaud de Vite (règle only-export-components de l'oxlint).
export const SERVICE_FEE_RATE = 0.10;
const SERVICE_FEE_VAT_RATE = 0.21;
// Rend le montant TVA comprise — c'est lui que le client voit, et que le total contient.
export function fraisService(livraison) {
  const ht = +(Number(livraison) * SERVICE_FEE_RATE).toFixed(2);
  const tva = +(ht * SERVICE_FEE_VAT_RATE).toFixed(2);
  return +(ht + tva).toFixed(2);
}
