import { statutOuverture } from './openingHours';
import { horsZoneLivraison } from './livraison';
import { livraisonOuverte, paiementEnLigneOuvert, livreurFairideLibre, commandesOuvertes } from './launch';

/* PEUT-ON COMMANDER ICI, MAINTENANT ? Les règles de la liste des commerces (RestaurantList.jsx), sorties ici le 2026-10-26
 * pour que les filtres « Ouvert » et « Livre chez toi » de la liste et la pastille « Ouvert » de l'onglet Carte
 * (MapPage.jsx) disent la même chose que les cartes des commerces. */

// Livraison réellement possible ici et maintenant : ouverte (GO), dans la zone, et un livreur libre dans le pool Fairide
// (audit du 19/10, discovery-02 ; un commerce qui livre lui-même garde sa vérification sur sa fiche).
export function livraisonPossibleIci(r, user) {
  return !!r.offersDelivery && livraisonOuverte(user) && !horsZoneLivraison(r, user)
    && (r.deliveryMode === 'own' || livreurFairideLibre(user));
}

// L'à emporter réellement commandable aujourd'hui : ouvert (bouton « Ouvrir l'à emporter », payé sur place) et, s'il ne se paie qu'en ligne,
// après le GO. Avant l'ouverture, la carte disait « À emporter » et le filtre gardait le commerce, alors que le serveur
// refuse (PICKUP_NOT_OPEN) — audit du 19/10, discovery-25.
export function emporterPossibleIci(r, user) {
  return !!r.offersPickup && commandesOuvertes(user) && (r.pickupPaymentMode !== 'online' || paiementEnLigneOuvert(user));
}

/* « OUVERT » = OUVERT ET COMMANDABLE (fondateur, 2026-10-26, réponse 3 de maquettes/filtre-ouvert) : ouvert à ses horaires
 * (pause, fermeture du jour et interrupteur du commerce compris, statutOuverture) ET une commande possible, en livraison
 * chez soi ou à emporter. Un commerce « Carte seule » (vitrine) ouvert n'y est pas : on peut aller y manger, pas commander
 * chez nous. Le 26/10, 23 commerces étaient « ouverts » à midi sur l'onglet Carte, et 2 commandables.
 * `toujoursOuvert` fait comme si l'heure allait : pour dire, quand le filtre ne laisse rien, qui rouvre en premier. */
export function ouvertPourCommander(r, user, maintenant = new Date(), { toujoursOuvert = false } = {}) {
  if (r.vitrine) return false;
  if (!toujoursOuvert && !statutOuverture(r, maintenant).isOpen) return false;
  return livraisonPossibleIci(r, user) || emporterPossibleIci(r, user);
}

/* « LIVRE CHEZ TOI » (même questionnaire, réponse 2) : ouvert, pas « Carte seule », l'adresse du compte dans sa zone et un
 * livreur libre maintenant. Sans adresse géolocalisée on ne sait pas si c'est « chez toi » : la pastille n'est pas montrée
 * (filtreLivraisonPossible), et cette fonction ne garde rien. */
export function livreChezToi(r, user, maintenant = new Date(), { toujoursOuvert = false } = {}) {
  if (r.vitrine || !user?.lat || !user?.lng) return false;
  if (!toujoursOuvert && !statutOuverture(r, maintenant).isOpen) return false;
  return livraisonPossibleIci(r, user);
}
// La pastille n'a de sens qu'après le GO (avant, seul l'à emporter est ouvert, lancement.md) et avec une adresse connue.
export const filtreLivraisonPossible = (user) => !!(user?.lat && user?.lng) && livraisonOuverte(user);

// Le moment où le premier commerce de la liste rouvre (statutOuverture.opensAt), ou null s'il n'y en a aucun.
export function premierARouvrir(commerces, maintenant = new Date()) {
  let premier = null;
  for (const r of commerces) {
    const s = statutOuverture(r, maintenant);
    if (s.isOpen || !s.opensAt) continue;
    if (!premier || s.opensAt < premier.quand) premier = { r, quand: s.opensAt };
  }
  return premier;
}
