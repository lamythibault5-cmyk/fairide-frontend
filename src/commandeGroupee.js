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
