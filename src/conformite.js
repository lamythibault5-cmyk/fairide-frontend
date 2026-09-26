// Fonctions de conformité partagées, sans composant (backlog du 23/09/2026) — séparées des fichiers de
// composants pour garder le rechargement à chaud de Vite (un fichier de composants n'exporte que des
// composants).

// Ce qui manque encore au panier avant d'envoyer la commande (message de toast), ou null. Voir
// components/conformite/CheckoutConformite.jsx : âge si alcool (C3), CGU si pas encore acceptées (C1).
export function manqueConformite(valeur, restaurant, lignes, _typeCommande, t) {
  const menu = restaurant?.menu || [];
  const alcool = lignes.some((l) => menu.find((m) => m.id === l.itemId)?.isAlcohol);
  if (alcool && !valeur.ageDeclaration) return t('conformite.toastAgeRequired');
  if (valeur.termsNeeded && !valeur.acceptTerms) return t('conformite.toastTermsRequired');
  return null;
}

// Libellé d'un manquement du dossier livreur ajouté par le backlog (les autres restent dans courierOnboarding).
export const MANQUES_CONFORMITE = ['nationalite', 'titre_sejour', 'carte_professionnelle', 'transparency_notice', 'geolocation_policy', 'dac7_info', 'self_billing_mandate'];
export function libelleManque(m, t) {
  return MANQUES_CONFORMITE.includes(m) ? t(`conformite.courierMissing_${m}`) : t(`courierOnboarding.missing_${m}`);
}
