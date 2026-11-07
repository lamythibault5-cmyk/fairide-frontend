/* COMMANDE PROGRAMMÉE LOINTAINE (chasse aux bogues d'avant GO, 2026-11-06, G153). Acceptée mardi pour jeudi, elle disait
 * « C'est en cuisine » pendant deux jours, l'app relisait le serveur toutes les 15 s et retenait ses mises à jour
 * (useCommandeEnCours). Prévue dans plus de PROGRAMMEE_LOINTAINE_MS : rien ne cuit encore, rien à suivre de près.
 * Dans un module à part (pas orderStatus.jsx) : un fichier de composants qui exporte aussi des fonctions perd le
 * rechargement à chaud de Vite (react/only-export-components), et le crochet n'a pas à charger les composants du suivi. */
const PROGRAMMEE_LOINTAINE_MS = 90 * 60000;
export function programmeeLointaine(order) {
  if (!order?.scheduledFor || !['nouveau', 'preparation'].includes(order.status)) return false;
  return new Date(order.scheduledFor).getTime() - Date.now() > PROGRAMMEE_LOINTAINE_MS;
}
