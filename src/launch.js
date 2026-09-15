// Calendrier de lancement côté client (miroir des verrous serveur, voir routes/orders.js et routes/restaurants.js).
// Décision du fondateur (2026-09-15) : première campagne sur les réseaux sociaux le 1er octobre 2026 ; réservations
// de table et commandes à emporter à partir du 5 octobre ; livraison (livreurs) à partir du 15 octobre. Tout le reste
// est visible et utilisable avant. Les administrateurs passent (essais). L'application native (App Store / Google
// Play) arrive le 1er octobre 2026.
export const CAMPAGNE_RESEAUX = new Date('2026-10-01T00:00:00+02:00');
export const APP_STORES = new Date('2026-10-01T00:00:00+02:00');
export const OUVERTURE_RESERVATIONS = new Date('2026-10-05T00:00:00+02:00');
export const OUVERTURE_EMPORTER = new Date('2026-10-05T00:00:00+02:00');
export const OUVERTURE_LIVRAISON = new Date('2026-10-15T00:00:00+02:00');
// Premières commandes en ligne possibles (à emporter).
export const OUVERTURE_COMMANDES = OUVERTURE_EMPORTER;
const OUVERTURES = { dine_in: OUVERTURE_RESERVATIONS, pickup: OUVERTURE_EMPORTER, delivery: OUVERTURE_LIVRAISON };

function formater(date, locale) {
  return date.toLocaleDateString(locale, { day: 'numeric', month: 'long', timeZone: 'Europe/Brussels' });
}

// type : 'dine_in' | 'pickup' | 'delivery'.
export function serviceOuvert(type, user) {
  return Date.now() >= (OUVERTURES[type] || OUVERTURE_LIVRAISON).getTime() || !!user?.isAdmin;
}
export function dateOuverture(type, locale = 'fr-BE') {
  return formater(OUVERTURES[type] || OUVERTURE_LIVRAISON, locale);
}

export function reservationsOuvertes(user) { return serviceOuvert('dine_in', user); }
export function dateOuvertureReservations(locale = 'fr-BE') { return dateOuverture('dine_in', locale); }
// Une commande en ligne est possible (à emporter) ; la livraison peut encore attendre, voir livraisonOuverte.
export function commandesOuvertes(user) { return serviceOuvert('pickup', user); }
export function dateOuvertureCommandes(locale = 'fr-BE') { return dateOuverture('pickup', locale); }
export function livraisonOuverte(user) { return serviceOuvert('delivery', user); }
export function dateOuvertureLivraison(locale = 'fr-BE') { return dateOuverture('delivery', locale); }

// Abonnement des commerces (à emporter et livraison) : activable dès le 1er octobre 2026, avec l'application,
// pour être prêt à l'ouverture des commandes le 5. Miroir de FAIRIDE_SUBSCRIPTION_OPEN_AT (routes/restaurants.js).
export const OUVERTURE_ABONNEMENT = new Date('2026-10-01T00:00:00+02:00');
export function abonnementOuvert() {
  return Date.now() >= OUVERTURE_ABONNEMENT.getTime();
}
