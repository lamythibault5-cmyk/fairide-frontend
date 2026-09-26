// Calendrier de lancement côté client (miroir des verrous serveur, voir routes/orders.js et routes/restaurants.js).
// Décision du fondateur (2026-09-15) : première campagne sur les réseaux sociaux le 6 octobre 2026 ;
// commandes à emporter à partir du 10 octobre ; livraison (livreurs) à partir du 20 octobre. Tout le reste
// est visible et utilisable avant. Les administrateurs passent (essais). L'application native (App Store / Google
// Play) arrive le 6 octobre 2026.
export const CAMPAGNE_RESEAUX = new Date('2026-10-06T00:00:00+02:00');
export const APP_STORES = new Date('2026-10-06T00:00:00+02:00');
export const OUVERTURE_EMPORTER = new Date('2026-10-10T00:00:00+02:00');
export const OUVERTURE_LIVRAISON = new Date('2026-10-20T00:00:00+02:00');
// Paiement en ligne (à emporter payé en ligne) : ouvre avec la livraison, le 20 octobre 2026 (fondateur, 2026-09-19).
// Avant cette date, l'à emporter n'est possible que payé sur place. Miroir de FAIRIDE_ONLINE_PAYMENT_OPEN_AT.
export const OUVERTURE_PAIEMENT_EN_LIGNE = new Date('2026-10-20T00:00:00+02:00');
export function paiementEnLigneOuvert(user) { return Date.now() >= OUVERTURE_PAIEMENT_EN_LIGNE.getTime() || !!user?.isAdmin; }
export function dateOuverturePaiementEnLigne(locale = 'fr-BE') { return formater(OUVERTURE_PAIEMENT_EN_LIGNE, locale); }
// Premières commandes payées en ligne : c'est cette date qui fait courir le mois offert de l'abonnement.
export const OUVERTURE_COMMANDES = OUVERTURE_PAIEMENT_EN_LIGNE;
const OUVERTURES = { pickup: OUVERTURE_EMPORTER, delivery: OUVERTURE_LIVRAISON };

function formater(date, locale) {
  return date.toLocaleDateString(locale, { day: 'numeric', month: 'long', timeZone: 'Europe/Brussels' });
}

// type : 'pickup' | 'delivery'.
export function serviceOuvert(type, user) {
  return Date.now() >= (OUVERTURES[type] || OUVERTURE_LIVRAISON).getTime() || !!user?.isAdmin;
}
export function dateOuverture(type, locale = 'fr-BE') {
  return formater(OUVERTURES[type] || OUVERTURE_LIVRAISON, locale);
}

// Fairide : à emporter et livraison.
export function dateOuvertureEmporter(locale = 'fr-BE') { return dateOuverture('pickup', locale); }
// Une commande en ligne est possible (à emporter) ; la livraison peut encore attendre, voir livraisonOuverte.
export function commandesOuvertes(user) { return serviceOuvert('pickup', user); }
export function dateOuvertureCommandes(locale = 'fr-BE') { return dateOuverture('pickup', locale); }
export function livraisonOuverte(user) { return serviceOuvert('delivery', user); }
export function dateOuvertureLivraison(locale = 'fr-BE') { return dateOuverture('delivery', locale); }

// Activation des paiements (Stripe Connect), commerces et livreurs. Cette date vivait en double, écrite
// en dur dans PaiementRestaurant.jsx ET PaiementLivreur.jsx, hors de ce calendrier — d'où une
// trentaine de phrases qui annonçaient « début octobre » sans que rien ne les relie à la date
// réellement appliquée. Une seule origine, ici, comme pour toutes les autres dates.
export const OUVERTURE_PAIEMENTS = new Date('2026-10-05T00:00:00+02:00');
export function paiementsOuverts() { return Date.now() >= OUVERTURE_PAIEMENTS.getTime(); }
export function dateOuverturePaiements(locale = 'fr-BE') { return formater(OUVERTURE_PAIEMENTS, locale); }

// Abonnement des commerces (version complète : livraison et paiement en ligne) : activable dès le 6 octobre 2026, avec l'application,
// pour être prêt à l'ouverture des commandes le 10. Miroir de FAIRIDE_SUBSCRIPTION_OPEN_AT (routes/restaurants.js).
export const OUVERTURE_ABONNEMENT = new Date('2026-10-06T00:00:00+02:00');
export function abonnementOuvert() {
  return Date.now() >= OUVERTURE_ABONNEMENT.getTime();
}
// Date annoncée au restaurateur dans la check-list de mise en ligne : elle vient d'ici, pas d'une
// phrase traduite, pour qu'un report du calendrier ne laisse pas trois textes périmés derrière lui.
export function dateOuvertureAbonnement(locale = 'fr-BE') {
  return formater(OUVERTURE_ABONNEMENT, locale);
}

// Premier prélèvement de la formule complète si le commerce l'active à la date donnée : le mois offert (30 jours)
// court à partir de l'ouverture des commandes payées en ligne (20 octobre 2026), ou de l'activation si elle est postérieure. Miroir
// exact de routes/restaurants.js (subscription_data.trial_end) : la date annoncée est celle que Stripe appliquera.
export const MOIS_OFFERT_JOURS = 30;
export function datePremierPrelevement(activation = new Date()) {
  return new Date(Math.max(activation.getTime(), OUVERTURE_COMMANDES.getTime()) + MOIS_OFFERT_JOURS * 86400000);
}
