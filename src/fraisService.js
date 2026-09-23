// Frais de service Fairide (modèle du 23/09/2026) : 10 % des plats et de la livraison, TVA COMPRISE — le commerce
// touche 100 % de ses prix, sans commission. Même règle que pricing.fraisService côté serveur ; le montant exact
// reste toujours celui renvoyé par la commande réelle. Rien quand l'à emporter est payé sur place.
// Fichier à part plutôt que dans CartContext.jsx : un module de composants qui exporte aussi des fonctions casse le
// rechargement à chaud de Vite (règle only-export-components de l'oxlint).
export const SERVICE_FEE_RATE = 0.10;
export const fraisService = (montant) => +(Number(montant) * SERVICE_FEE_RATE).toFixed(2);
