import { useRef } from 'react';
import { createPortal } from 'react-dom';
import useDialogue from '../hooks/useDialogue';

/* UN ÉCRAN PLEIN DE L'APPLICATION, OUVERT DEPUIS UNE PAGE (2026-10-15) — les parcours en écrans .bv (comme l'accueil)
 * qu'on lance du tableau de bord : envoyer sa carte, les étapes du dossier livreur…
 *
 * Rendu dans <body>, pas là où le composant est monté : à l'intérieur de la coquille, l'animation d'entrée de la page
 * (.page-fade) faisait de la page le repère de son `position: fixed` et la plaçait sous la barre d'onglets — le même
 * défaut qu'avait la connexion de l'app (voir Layout.jsx). Pendant qu'il est ouvert, la page dessous ne défile pas.
 *
 * Sous l'amorce des notifications (.bv-par-dessus) : juste après l'inscription, le livreur arrive sur son dossier ET reçoit
 * la proposition d'activer les notifications ; elle passait dessous, invisible jusqu'à la fermeture du dossier.
 *
 * LE FOCUS ENTRE ET RESTE DEDANS (audit du 24/10). Annoncé comme fenêtre modale (role="dialog" aria-modal), l'écran laissait
 * pourtant le focus dans la page dessous : au clavier ou au lecteur d'écran, on tabulait dans des commandes invisibles.
 * useDialogue, comme Modale et SousEcran : focus sur l'écran à l'ouverture, Tab qui tourne dedans, focus rendu au bouton
 * d'ouverture à la fermeture, et le même gel du fond sur <html> qu'avant (jamais <body> : html porte overflow-x: clip, un
 * body en overflow: hidden devenait sa propre boîte de défilement). Échap ne ferme rien : ces parcours ont leurs propres
 * boutons de retour, et un écran à moitié rempli ne doit pas disparaître sur une touche. */
const RIEN = () => {};
// `classe` : « bv-bandeau » pour le fond iris des écrans de l'inscription (InscriptionAppli.jsx, compte existant).
export default function EcranPlein({ children, etiquette, classe = '' }) {
  const racine = useRef(null);
  useDialogue(racine, RIEN);
  return createPortal(
    <div className={`bv bv-plein${classe ? ` ${classe}` : ''}`} role="dialog" aria-modal="true" aria-label={etiquette} ref={racine} tabIndex={-1}>{children}</div>,
    document.body
  );
}
