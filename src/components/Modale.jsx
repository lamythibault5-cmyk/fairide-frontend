import { useId, useRef } from 'react';
import { createPortal } from 'react-dom';
import useDialogue from '../hooks/useDialogue';

// LA FENÊTRE MODALE, UNE FOIS POUR TOUTES.
//
// Le couple `.modal-overlay` + `.modal-box` était réécrit à la main dans 22 fichiers. Chaque copie
// refaisait le fond cliquable et le stopPropagation ; aucune n'apportait Échap ni la gestion du
// focus, sauf RecordDrawer pour Échap seul. Ce qui manquait n'était donc pas du style — il était
// déjà commun — mais le comportement, et c'est justement ce qu'une copie ne transporte pas.
//
// Rendue dans document.body : `.modal-overlay` est en position fixed avec z-index 100, donc sa place
// dans l'arbre ne change rien à son affichage, et la sortir de son parent la met hors d'atteinte
// d'un `overflow: hidden` ou d'un contexte d'empilement posé au-dessus d'elle. Vérifié avant de le
// faire : aucune règle du dépôt ne vise `.modal-overlay` ou `.modal-box` par un sélecteur descendant.
//
// `titre` est facultatif : quelques appelants composent leur propre en-tête. Quand il est fourni, il
// devient le nom accessible de la fenêtre (aria-labelledby) — sinon il faut passer `ariaLabel`, pour
// qu'un lecteur d'écran annonce autre chose que « dialogue ».
export default function Modale({ titre, ariaLabel, largeur, onFermer, children }) {
  const racine = useRef(null);
  const idTitre = useId();
  useDialogue(racine, onFermer);
  return createPortal(
    <div className="modal-overlay" onClick={onFermer}>
      <div
        className="modal-box"
        onClick={(e) => e.stopPropagation()}
        style={largeur ? { maxWidth: largeur } : undefined}
        role="dialog"
        aria-modal="true"
        aria-labelledby={titre ? idTitre : undefined}
        aria-label={titre ? undefined : ariaLabel}
        ref={racine}
        tabIndex={-1}
      >
        {titre && <h3 className="modal-titre" id={idTitre}>{titre}</h3>}
        {children}
      </div>
    </div>,
    document.body
  );
}
