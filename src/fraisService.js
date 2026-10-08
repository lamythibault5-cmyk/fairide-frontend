// Frais de système Fairide — modèle du 2026-10-08 (fondateur) :
//   - la part de Fairide sur les plats est DANS le prix affiché (prix de salle + 10 % HTVA), pas une ligne du panier ;
//   - dans les frais de livraison, 10 % sont des frais de système (connexion, système, assurance des livreurs), COMPRIS dedans :
//     rien ne s'ajoute au total du client, le livreur touche les 90 % restants de sa grille.
// Même calcul que pricing.fraisService côté serveur (deliveryFairideRate) ; le montant exact reste toujours celui renvoyé par la
// commande réelle. Rien à emporter : pas de livraison, pas de frais.
// Fichier à part plutôt que dans CartContext.jsx : un module de composants qui exporte aussi des fonctions casse le
// rechargement à chaud de Vite (règle only-export-components de l'oxlint).
export const SERVICE_FEE_RATE = 0.10;
// Rend le montant TVA comprise, déjà contenu dans les frais de livraison (ligne d'information « dont … »).
export function fraisService(livraison) {
  return +(Number(livraison) * SERVICE_FEE_RATE).toFixed(2);
}
