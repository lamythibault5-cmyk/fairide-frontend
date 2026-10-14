// Frais de système Fairide — modèle du 2026-10-08 (fondateur) :
//   - la part de Fairide sur les plats (10 % du prix payé, modèle du 13/10/2026 ; sans TVA, Fairide étant sous le régime de la franchise) n'est pas une ligne du panier ;
//   - dans les frais de livraison, 10 % sont des frais de système (connexion, système, assurance des livreurs), COMPRIS dedans :
//     rien ne s'ajoute au total du client, le livreur touche les 90 % restants de sa grille.
// Même calcul que pricing.fraisService côté serveur (deliveryFairideRate) ; le montant exact reste toujours celui renvoyé par la
// commande réelle. Rien à emporter : pas de livraison, pas de frais.
// Fichier à part plutôt que dans CartContext.jsx : un module de composants qui exporte aussi des fonctions casse le
// rechargement à chaud de Vite (règle only-export-components de l'oxlint).
export const SERVICE_FEE_RATE = 0.10;
// Rend le montant déjà contenu dans les frais de livraison (ligne d'information « dont … » ; sans TVA, Fairide étant en
// franchise). Le reste après la part du livreur arrondie, comme le serveur : 5,00 € → 0,50 € (le livreur a 4,50 €), 5,80 € →
// 0,58 € ; 6,05 € → 0,60 € (le livreur a 5,45 €), pas 0,61 €.
export function fraisService(livraison) {
  return +(Number(livraison) - +(Number(livraison) * (1 - SERVICE_FEE_RATE)).toFixed(2)).toFixed(2);
}
