/* POURQUOI UNE COMMANDE S'EST FERMÉE, DIT AU COMMERCE (audit du 19/10/2026, shop-203).
 *
 * Toute commande passée à « annulée » s'annonçait au commerce par « {client} a annulé sa commande avant acceptation » et la
 * notification « Rien à préparer » : y compris son propre « Client pas venu » (le toast juste affiché était remplacé), une
 * commande expirée faute de réponse (et la pause de 30 minutes qui suit, que rien n'expliquait), et l'annulation du client
 * faute de livreur, APRÈS que la cuisine a préparé (le commerce garde alors ce qui lui est dû : routes/orders.js,
 * no-courier-cancel). L'historique ne disait pas la raison non plus.
 *
 * Lit les champs que le serveur renvoie déjà (mapOrder : expiredUnaccepted, deliveryIncident, pickupNoShow, ageCheck,
 * refusalReason). `statutAvant` : le statut vu au sondage précédent (useNewOrderAlert) ; absent pour l'historique, où une
 * annulation sans raison connue ne porte pas de ligne. Renvoie { cle, valeurs, propre } ou null. `propre` : c'est le geste
 * du commerce lui-même (refus, client pas venu, contrôle d'âge au comptoir) : pas d'alerte pour son propre geste. */
export function raisonFermeture(o, statutAvant) {
  if (o.status === 'refuse') return o.refusalReason ? { cle: 'alertBar.closedRefused', valeurs: { reason: o.refusalReason }, propre: true } : { cle: null, propre: true };
  if (o.status !== 'annule') return null;
  if (o.pickupNoShow || o.deliveryIncident === 'pickup_not_collected') return { cle: 'alertBar.closedNoShow', propre: true };
  if (o.orderType === 'pickup' && o.ageCheck === 'refused_absent') return { cle: 'alertBar.closedAgeAbsent', propre: true };
  if (o.expiredUnaccepted) return { cle: 'alertBar.closedExpired' };
  if (o.deliveryIncident === 'no_courier_cancelled') return { cle: 'alertBar.closedNoCourier' };
  if (o.deliveryIncident === 'client_absent' || o.ageCheck === 'refused_absent') return { cle: 'alertBar.closedClientAbsent' };
  if (statutAvant === undefined) return null;
  // Depuis « nouveau », seul le client annule (l'expiration est traitée plus haut) ; après acceptation, c'est l'équipe Fairide.
  return { cle: statutAvant === 'nouveau' ? 'alertBar.cancelToastOne' : 'alertBar.closedAfterAccept' };
}
