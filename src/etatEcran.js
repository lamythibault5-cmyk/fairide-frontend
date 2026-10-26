/* CE QU'ON A CHOISI SUR UN ÉCRAN, GARDÉ DANS SON ENTRÉE D'HISTORIQUE (fondateur, 2026-10-26 : « ce sont de vrais
 * problèmes »).
 *
 * Les filtres de la liste et le texte de la Recherche vivaient dans l'état React seul. Ouvrir un commerce démonte l'écran :
 * au retour, la liste repartait sans ses filtres et la Recherche sans son texte. À l'inverse, la catégorie envoyée par la
 * Recherche (« Poissons ») vit dans l'entrée d'historique de la liste (location.state) : effacée à l'écran, elle revenait
 * au retour d'une fiche.
 *
 * Une seule règle maintenant : ce qui est à l'écran est écrit dans l'entrée d'historique de cet écran (history.state.usr,
 * que historiqueLangue.js relit au retour), sans navigation ni rendu. Revenir sur l'écran, c'est le retrouver tel qu'on
 * l'a quitté. L'écriture ne vise que l'entrée de l'écran qui écrit : une page en train d'être remplacée (transition,
 * retour) n'écrit jamais dans l'entrée de la suivante. */
export function lireEtatEcran(cle) {
  try { return window.history.state?.usr?.[cle]; } catch { return undefined; }
}

// `cleEntree` : location.key de l'écran qui écrit (useLocation().key), comparé à l'entrée courante du navigateur.
export function ecrireEtatEcran(cleEntree, cle, valeur) {
  try {
    const st = window.history.state || {};
    if (cleEntree && st.key && st.key !== cleEntree) return;
    const usr = { ...(st.usr || {}) };
    if (valeur === undefined) delete usr[cle]; else usr[cle] = valeur;
    window.history.replaceState({ ...st, usr }, '');
  } catch { /* stockage de l'historique indisponible : l'écran marche, il ne se souviendra pas */ }
}
