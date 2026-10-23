/* CE QUE LE TABLEAU DE BORD DU COMMERCE CHANGE SUR PLACE, AVANT LA RÉPONSE DU SERVEUR (2026-10-23, app lente : « épuisé »,
 * « Prête », la pause restaient figés le temps d'un appel puis d'un rechargement complet de la fiche et des commandes).
 * Les écrans modifient la fiche et la liste des commandes gardées par DashboardLayout (ou AdminMenuPage), puis le serveur
 * confirme (actionOptimiste.js). Les règles ci-dessous recopient celles du serveur pour deviner juste ; sa réponse, quand
 * elle arrive, remplace toujours la devinette. */

// POST /restaurants/:id/menu/:itemId/stock (routes/restaurants.js côté serveur) : ce que la route écrit sur le plat.
//   { outOfStock: true }  → rupture du jour : plus disponible, revient tout seul demain ;
//   { outOfStock: false } → remis en vente (sauf s'il est retiré de la carte) ;
//   { withdrawn: true }   → retiré de la carte jusqu'à nouvel ordre, sans rupture du jour ;
//   { withdrawn: false }  → remis sur la carte et en vente.
export function champsStockVises(plat, corps) {
  if (corps.withdrawn === true) return { withdrawn: true, available: false, outOfStockToday: false };
  if (corps.withdrawn === false) return { withdrawn: false, available: true, outOfStockToday: false };
  if (corps.outOfStock === true) return { outOfStockToday: true, available: false };
  return { outOfStockToday: false, available: !plat?.withdrawn };
}

// L'état d'un plat que ces gestes touchent : ce qu'il faut remettre si le serveur refuse.
export const etatStock = (plat) => (plat ? { available: plat.available, outOfStockToday: !!plat.outOfStockToday, withdrawn: !!plat.withdrawn } : null);

// Change un plat de la fiche gardée. `modifierRestaurant` est le setState de la fiche ; absent, rien ne bouge avant la
// relecture (l'écran se comporte comme avant).
export function modifierPlat(modifierRestaurant, itemId, champs) {
  if (!modifierRestaurant || !champs) return;
  modifierRestaurant((r) => (r?.menu ? { ...r, menu: r.menu.map((i) => (i.id === itemId ? { ...i, ...champs } : i)) } : r));
}

/* Une commande renvoyée par PATCH /orders/:id/accept ou /ready (mapOrder côté serveur) n'a PAS la forme de la liste du
 * tableau (GET /orders/restaurant/:id) : celle-ci masque le code de retrait tant qu'aucun livreur n'est passé, la position du
 * livreur, la commission pour un membre de l'équipe, et ajoute l'état du ticket et le rang du client. On ne reprend donc de
 * la réponse que ce que l'action a changé ; le reste attend la relecture en arrière-plan. */
const CHAMPS_ACTION = ['status', 'extraPrepMinutes', 'estimatedDeliveryAt', 'allergyAck', 'allergyAckAt', 'acceptDeadline', 'noCourierCancelAt', 'noShowFrom'];
export function fusionnerCommande(liste, maj) {
  if (!maj?.id || !Array.isArray(liste)) return liste;
  return liste.map((o) => {
    if (o.id !== maj.id) return o;
    const champs = {};
    for (const c of CHAMPS_ACTION) if (maj[c] !== undefined) champs[c] = maj[c];
    return { ...o, ...champs };
  });
}

// Le prochain 6 h du matin (heure de l'appareil, à Bruxelles pour un commerce) : « Stopper pour aujourd'hui » rouvre là
// (sqlProchain6h côté serveur). Seulement le temps de la réponse, qui donne l'heure exacte.
export function prochain6h(maintenant = Date.now()) {
  const d = new Date(maintenant);
  d.setHours(6, 0, 0, 0);
  if (d.getTime() <= maintenant) d.setDate(d.getDate() + 1);
  return d.getTime();
}
