import { useEffect } from 'react';
import { createPortal } from 'react-dom';

/* UN ÉCRAN PLEIN DE L'APPLICATION, OUVERT DEPUIS UNE PAGE (2026-10-15) — les parcours en écrans .bv (comme l'accueil)
 * qu'on lance du tableau de bord : envoyer sa carte, les étapes du dossier livreur…
 *
 * Rendu dans <body>, pas là où le composant est monté : à l'intérieur de la coquille, l'animation d'entrée de la page
 * (.page-fade) faisait de la page le repère de son `position: fixed` et la plaçait sous la barre d'onglets — le même
 * défaut qu'avait la connexion de l'app (voir Layout.jsx). Pendant qu'il est ouvert, la page dessous ne défile pas.
 *
 * Sous l'amorce des notifications (.bv-par-dessus) : juste après l'inscription, le livreur arrive sur son dossier ET reçoit
 * la proposition d'activer les notifications ; elle passait dessous, invisible jusqu'à la fermeture du dossier. */
export default function EcranPlein({ children, etiquette }) {
  useEffect(() => {
    const avant = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => { document.body.style.overflow = avant; };
  }, []);
  return createPortal(
    <div className="bv bv-plein" role="dialog" aria-modal="true" aria-label={etiquette}>{children}</div>,
    document.body
  );
}
