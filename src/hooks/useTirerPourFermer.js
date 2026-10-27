import useFeuilleGlissable from './useFeuilleGlissable';
import { experienceApp } from '../natif';

/* UNE FENÊTRE QU'ON TIRE VERS LE BAS POUR LA FERMER (fondateur, 2026-10-23, version A du point 7 de
 * maquettes/transitions-appli) : Modale.jsx et ConfirmDialog.jsx, dans l'app, sur téléphone, où elles montent du bas en feuille
 * (transitions-appli.css). Le même geste que la fiche d'un plat (useFeuilleGlissable : la feuille suit le doigt, part d'après
 * l'élan, revient au ressort) ; fermer par le geste, c'est la même chose que toucher le fond ou Annuler (`onFermer`).
 * Sur le site, ou au-delà de 640 px (fenêtre centrée), rien : aucun écouteur n'est posé. */
export default function useTirerPourFermer(boite, onFermer) {
  const fermer = () => onFermer?.();
  // Pas de retour par le bord gauche : une fenêtre du bas n'est pas un écran, comme une alerte d'iOS.
  const glisser = useFeuilleGlissable({ panneau: boite, defile: boite, fermerAnime: fermer, fermerTout: fermer, bord: false });
  // Rien à fermer (une confirmation en cours d'envoi) : pas de geste, sinon la feuille partirait sans que rien ne la démonte.
  if (!experienceApp() || !onFermer) return {};
  const surTelephone = () => window.innerWidth <= 640;
  return {
    onTouchStart: (e) => { if (surTelephone()) glisser.onTouchStart(e); },
    onTouchMove: glisser.onTouchMove,
    onTouchEnd: glisser.onTouchEnd,
    onTouchCancel: glisser.onTouchCancel
  };
}
