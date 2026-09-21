import { useEffect, useRef } from 'react';

/* Rappelle `reload` toutes les `ms` millisecondes — mais seulement tant que l'onglet est visible.
 *
 * POURQUOI CE FICHIER. Le hook existait déjà, mais enfermé dans pages/admin/logistics/common.jsx :
 * seules les deux pages de logistique en profitaient. Les écrans de marketing, eux, appelaient
 * setInterval directement et continuaient donc d'interroger l'API depuis un onglet laissé en
 * arrière-plan — pendant un envoi de campagne, à 4 et 5 secondes, deux appels par tour. Personne ne
 * regardait l'écran, et Railway facturait quand même. Le hook est remonté ici pour que le prochain
 * écran « vivant » n'ait pas à le réinventer ; common.jsx le ré-exporte, donc rien ne change pour
 * FleetTab et LiveTab.
 *
 * L'INTERVALLE N'EST PAS LE PROBLÈME, et il n'est pas allongé. Quatre secondes pendant qu'une
 * campagne s'envoie, c'est ce qui fait qu'on voit les compteurs bouger ; rallonger dégraderait
 * l'écran sans rien régler. Ce qui manquait, c'est de s'arrêter quand personne ne regarde.
 *
 * `reload` passe par une ref : une fonction recréée à chaque rendu (le cas courant) ne doit pas
 * relancer l'intervalle, sinon le compte à rebours repart de zéro à chaque fois et l'appel finit
 * par ne plus jamais partir. Seul `ms` remonte l'intervalle. */
export default function useAutoRefresh(reload, ms) {
  const fn = useRef(reload);
  fn.current = reload;
  useEffect(() => {
    if (!ms) return undefined;
    const id = setInterval(() => {
      if (document.visibilityState !== 'visible') return;
      try {
        const r = fn.current?.();
        // Un rejet ici n'a personne pour l'attraper : l'écran garde ce qu'il affiche déjà, et une
        // erreur non gérée dans un intervalle finirait dans Sentry sans rien apprendre à personne.
        if (r && typeof r.catch === 'function') r.catch(() => {});
      } catch { /* jamais bloquant */ }
    }, ms);
    return () => clearInterval(id);
  }, [ms]);
}
