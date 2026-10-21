/* La commande groupée EN COURS de composition, pour ce navigateur (pages/client/CommandeGroupee.jsx, backend
 * routes/commandesGroupees.js). Gardée en sessionStorage : elle ne vaut que le temps de choisir sa part, et un onglet
 * fermé n'emporte rien d'important — le groupe et les parts envoyées vivent sur le serveur. */
const CLE = 'fairide_commande_groupee';

export function groupeEnCours() {
  try { return JSON.parse(sessionStorage.getItem(CLE) || 'null'); } catch { return null; }
}
export function entrerDansGroupe({ code, restaurantId, hostFirstName }) {
  try { sessionStorage.setItem(CLE, JSON.stringify({ code, restaurantId, hostFirstName })); } catch { /* navigation privée */ }
}
export function quitterGroupe() {
  try { sessionStorage.removeItem(CLE); } catch { /* rien */ }
}

/* LE GROUPE QUE L'HÔTE EST EN TRAIN DE COMMANDER (audit du 19/10, checkout-08). Ses parts sont dans son panier : le code part
 * avec la commande (Checkout.jsx, groupCode) pour que le serveur relie la commande au groupe. Une fois payée, le groupe est
 * « commandé » : les invités le lisent, et l'hôte ne peut plus réimporter les parts ni rouvrir. Même durée de vie que le
 * groupe en cours (sessionStorage) : le temps de payer. */
const CLE_A_COMMANDER = 'fairide_groupe_a_commander';
export function retenirGroupeACommander({ code, restaurantId }) {
  try { sessionStorage.setItem(CLE_A_COMMANDER, JSON.stringify({ code, restaurantId })); } catch { /* navigation privée */ }
}
export function groupeACommander(restaurantId) {
  try {
    const g = JSON.parse(sessionStorage.getItem(CLE_A_COMMANDER) || 'null');
    return g && g.code && String(g.restaurantId) === String(restaurantId) ? g.code : null;
  } catch { return null; }
}
export function oublierGroupeACommander() {
  try { sessionStorage.removeItem(CLE_A_COMMANDER); } catch { /* rien */ }
}
