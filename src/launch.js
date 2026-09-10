// Calendrier de lancement côté client (miroir des verrous serveur, voir routes/orders.js et routes/restaurants.js).
// Les commandes clients ouvrent le 10 octobre 2026 ; tout le reste est visible avant. Les administrateurs passent
// (essais). L'application native (App Store / Google Play) arrive le 1er octobre 2026.
export const OUVERTURE_COMMANDES = new Date('2026-10-10T00:00:00+02:00');
export const APP_STORES = new Date('2026-10-01T00:00:00+02:00');
// Réservations de table chez les partenaires : dès le 1er octobre 2026 (livraison et à emporter : le 10).
export const OUVERTURE_RESERVATIONS = new Date('2026-10-01T00:00:00+02:00');

export function reservationsOuvertes(user) {
  return Date.now() >= OUVERTURE_RESERVATIONS.getTime() || !!user?.isAdmin;
}
export function dateOuvertureReservations(locale = 'fr-BE') {
  return OUVERTURE_RESERVATIONS.toLocaleDateString(locale, { day: 'numeric', month: 'long', timeZone: 'Europe/Brussels' });
}

export function commandesOuvertes(user) {
  return Date.now() >= OUVERTURE_COMMANDES.getTime() || !!user?.isAdmin;
}
export function dateOuvertureCommandes(locale = 'fr-BE') {
  return OUVERTURE_COMMANDES.toLocaleDateString(locale, { day: 'numeric', month: 'long', timeZone: 'Europe/Brussels' });
}
