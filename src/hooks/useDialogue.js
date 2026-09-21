import { useEffect } from 'react';

// LE COMPORTEMENT COMMUN D'UNE FENÊTRE MODALE : verrou de défilement, focus à l'ouverture, Échap
// pour fermer, piège à focus, et restitution du focus à la fermeture.
//
// Les deux premiers étaient déjà écrits, à l'identique, dans FichePlat.jsx et SousEcran.jsx. Les
// deux derniers ne l'étaient nulle part : sur 22 fenêtres construites à la main dans le dépôt, une
// seule (RecordDrawer) gérait Échap, et AUCUNE ne retenait le focus. Concrètement, un visiteur au
// clavier ouvrait la fiche d'un plat, tabulait trois fois et se retrouvait dans la page derrière,
// sur des commandes qu'il ne voyait plus — la feuille restant ouverte par-dessus. À la fermeture,
// le focus repartait en haut du document plutôt qu'au bouton qui avait ouvert la fenêtre.
//
// TROIS EFFETS SÉPARÉS, ET C'EST VOULU. `onFermer` est une nouvelle fonction à chaque rendu de
// l'appelant : un effet unique qui en dépendrait rejouerait `focus()` à chaque frappe et volerait
// le focus du champ en cours de saisie. Le défaut a déjà été corrigé une fois dans FichePlat.jsx
// et SousEcran.jsx ; la note y est explicite, on la respecte ici plutôt que de la redécouvrir.
//
// `racine` doit porter tabIndex={-1} pour pouvoir recevoir le focus sans entrer dans l'ordre de
// tabulation, et role="dialog" aria-modal="true" pour que le lecteur d'écran annonce une fenêtre.
export default function useDialogue(racine, onFermer) {
  // 1. Ouverture : on gèle le fond, on prend le focus, on retient d'où l'on vient. Dépendances
  //    vides — tout ceci n'arrive qu'une fois, à l'ouverture, et se défait à la fermeture.
  useEffect(() => {
    const avant = document.body.style.overflow;
    // Capturé AVANT de déplacer le focus, sinon on mémoriserait la fenêtre elle-même.
    const ouvrant = document.activeElement;
    document.body.style.overflow = 'hidden';
    racine.current?.focus();
    return () => {
      document.body.style.overflow = avant;
      // `isConnected` : le bouton d'ouverture peut avoir disparu pendant que la fenêtre était
      // ouverte (une ligne supprimée, une liste rechargée). Lui rendre le focus échouerait en
      // silence et laisserait le focus nulle part, ce qui est pire que de ne rien faire.
      if (ouvrant instanceof HTMLElement && ouvrant.isConnected) ouvrant.focus();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // 2. Échap. Seul effet qui dépend d'`onFermer`, et il ne touche pas au focus.
  useEffect(() => {
    const surTouche = (e) => { if (e.key === 'Escape') onFermer(); };
    document.addEventListener('keydown', surTouche);
    return () => document.removeEventListener('keydown', surTouche);
  }, [onFermer]);

  // 3. Piège à focus. Posé sur `document` et non sur la racine : si le focus s'est échappé pour une
  //    raison quelconque, un écouteur posé sur la racine ne recevrait plus rien et le piège serait
  //    silencieusement inopérant — exactement le genre de panne qu'on ne voit pas.
  useEffect(() => {
    function surTab(e) {
      if (e.key !== 'Tab') return;
      const el = racine.current;
      if (!el) return;
      const cibles = el.querySelectorAll(
        'a[href], button:not([disabled]), input:not([disabled]), select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex="-1"])'
      );
      // offsetParent écarte ce qui est masqué (display:none) ; un panneau replié ne doit pas
      // capturer le focus. position:fixed renvoie null lui aussi, d'où le repli sur les rectangles.
      const visibles = [...cibles].filter((n) => n.offsetParent !== null || n.getClientRects().length);
      if (!visibles.length) return;
      const premier = visibles[0];
      const dernier = visibles[visibles.length - 1];
      const actif = document.activeElement;
      // Le focus est hors de la fenêtre (ou sur la racine elle-même) : on le ramène au début.
      if (!el.contains(actif) || actif === el) {
        e.preventDefault();
        (e.shiftKey ? dernier : premier).focus();
        return;
      }
      if (e.shiftKey && actif === premier) { e.preventDefault(); dernier.focus(); }
      else if (!e.shiftKey && actif === dernier) { e.preventDefault(); premier.focus(); }
    }
    document.addEventListener('keydown', surTab);
    return () => document.removeEventListener('keydown', surTab);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);
}
