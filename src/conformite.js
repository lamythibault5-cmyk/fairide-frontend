// Fonctions de conformité partagées, sans composant (backlog du 23/09/2026) — séparées des fichiers de
// composants pour garder le rechargement à chaud de Vite (un fichier de composants n'exporte que des
// composants).

// Nouvelles conditions acceptées sur l'écran plein (NouvellesConditions.jsx), detail { role } : les écrans qui les rappelaient
// se mettent à jour (carte en tête de Commandes, « Signe ton nouveau contrat » sur Courses).
export const EVENEMENT_CONDITIONS_ACCEPTEES = 'fairide:conditions-acceptees';

// Sa hausse de 10 % (l'ancien maximum) monte au nouveau plafond en acceptant le contrat (RESTO-2026.22) : 10,00 € → 11,20 €,
// 10,08 € pour lui. null si sa hausse n'est pas au maximum. Carte en tête de Commandes (RenouvellementContrat.jsx) et écran
// plein (NouvellesConditions.jsx).
export function exempleHausse(hausse) {
  const p = hausse && hausse.maxContract && Number(hausse.percent) === Number(hausse.max) ? Number(hausse.maxContract) : null;
  if (!p) return null;
  const affiche = Math.ceil(10 * (1 + p / 100) * 10 - 1e-6) / 10;
  return { p, affiche, recu: +(affiche * (1 - (Number(hausse.fairideRate) || 0.1))).toFixed(2) };
}

// Ce qui manque encore au panier avant d'envoyer la commande (message de toast), ou null. Voir
// components/conformite/CheckoutConformite.jsx : âge si alcool (C3), CGU si pas encore acceptées (C1).
export function manqueConformite(valeur, restaurant, lignes, _typeCommande, t) {
  const menu = restaurant?.menu || [];
  const alcool = lignes.some((l) => menu.find((m) => m.id === l.itemId)?.isAlcohol);
  if (alcool && !valeur.ageDeclaration) return t('conformite.toastAgeRequired');
  if (valeur.termsNeeded && !valeur.acceptTerms) return t('conformite.toastTermsRequired');
  return null;
}

// Attente du livreur à la porte d'un client injoignable avant de pouvoir clôturer : reprend ATTENTE_CLIENT_ABSENT_MIN
// de routes/orders.js côté serveur. Les deux doivent bouger ensemble.
export const ATTENTE_PORTE_MIN = 10;
// Appels au client exigés pendant cette attente avant de clore (APPELS_CLIENT_MIN de routes/orders.js).
export const APPELS_CLIENT_MIN = 2;

// Libellé d'un manquement du dossier livreur ajouté par le backlog (les autres restent dans courierOnboarding).
export const MANQUES_CONFORMITE = ['nationalite', 'titre_sejour', 'carte_professionnelle', 'transparency_notice', 'geolocation_policy', 'dac7_info', 'self_billing_mandate', 'declaration_honneur'];
export function libelleManque(m, t) {
  return MANQUES_CONFORMITE.includes(m) ? t(`conformite.courierMissing_${m}`) : t(`courierOnboarding.missing_${m}`);
}
