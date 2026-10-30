/* CE QUI EST CHOISI AU PAIEMENT RESTE (fondateur, 2026-10-30, coupure 11 de maquettes/progression). Revenir au menu pour
 * ajouter un plat effaçait l'allergie, les instructions au livreur, la note, les couverts et le pourboire (Checkout.jsx).
 * Gardés dans cet onglet seulement (sessionStorage, effacé à sa fermeture), par commerce, oubliés une fois la commande
 * passée : payée sur place ou couverte tout de suite (Checkout.jsx), payée par carte (CartContext.discardStashed, appelé
 * quand le paiement est confirmé). Jamais les cases d'âge et des conditions : celles-là se recochent à chaque commande. */
const cle = (restaurantId) => `fairide_paiement_${restaurantId}`;

export function lireSaisiePaiement(restaurantId) {
  if (!restaurantId) return {};
  try { return JSON.parse(sessionStorage.getItem(cle(restaurantId)) || '{}') || {}; } catch { return {}; }
}

export function garderSaisiePaiement(restaurantId, saisie) {
  if (!restaurantId) return;
  try { sessionStorage.setItem(cle(restaurantId), JSON.stringify(saisie)); } catch { /* navigation privée */ }
}

export function oublierSaisiePaiement(restaurantId) {
  if (!restaurantId) return;
  try { sessionStorage.removeItem(cle(restaurantId)); } catch { /* navigation privée */ }
}
