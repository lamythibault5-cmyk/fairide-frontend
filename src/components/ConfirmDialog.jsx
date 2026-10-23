import { useRef } from 'react';
import { createPortal } from 'react-dom';
import { useLanguage } from '../context/LanguageContext';
import useDialogue from '../hooks/useDialogue';
import useTirerPourFermer from '../hooks/useTirerPourFermer';
import Icone from './Icone';

// Confirmation générique avant toute action sensible ou irréversible — un seul composant réutilisé
// partout plutôt qu'une modale par action.
//
// Vivait dans components/admin/ et n'était donc utilisé que par la console d'administration, pendant
// que le tableau de bord restaurateur se rabattait sur window.confirm() pour ses suppressions (plats
// en lot, section entière). Or les dialogues natifs sont supprimés ou se comportent différemment dans
// une PWA installée et dans les webviews intégrées — précisément le contexte d'usage d'un
// restaurateur au comptoir. Remonté d'un niveau pour que les deux espaces partagent la même modale.
// Le corps est séparé pour que useDialogue ne soit monté QUE lorsque la fenêtre est ouverte : un
// hook ne peut pas être appelé après le `if (!open) return null` ci-dessous, et le déplacer avant
// poserait le verrou de défilement et volerait le focus alors que rien n'est affiché.
//
// LA FEUILLE DE CONFIRMATION DE L'APP (fondateur, 2026-10-17, « Confirmation sheets » de maquettes/commerces-marque/commerces-marque.html) :
// dans l'app (html.appli), la fenêtre monte du bas en feuille — poignée, tuile d'icône (`icone`, nom d'Icone.jsx), titre,
// message, ce qui va changer dans un encart (`detail`), le bouton d'action sur toute la largeur et l'annulation en texte
// dessous. Le site garde sa fenêtre centrée. Styles dans client-ui.css (.confirm-feuille).
function Corps({ title, message, detail, icone, confirmLabel = 'Confirmer', cancelLabel, danger, loading, onConfirm, onCancel }) {
  const { t } = useLanguage();
  const racine = useRef(null);
  /* Cette fenêtre garde la porte de toutes les actions irréversibles du dépôt — supprimer une
     section de carte, un bon cadeau, une réservation. Elle n'avait ni Échap, ni rôle de dialogue,
     ni la moindre gestion du focus : à l'ouverture le focus restait derrière, sur la page, si bien
     qu'au clavier on pouvait continuer à parcourir — et actionner — ce que la fenêtre recouvrait. */
  useDialogue(racine, onCancel);
  // Dans l'app, sur téléphone : la feuille se tire vers le bas, comme Annuler (2026-10-23, maquettes/transitions-appli point 7).
  // Pas pendant l'envoi : l'action est partie, la feuille attend sa réponse.
  const tirer = useTirerPourFermer(racine, loading ? null : onCancel);
  return (
    <div className="modal-overlay confirm-voile" onClick={onCancel}>
      <div {...tirer} className="modal-box confirm-feuille" onClick={(e) => e.stopPropagation()} style={{ maxWidth: 420 }}
        role="dialog" aria-modal="true" aria-labelledby="confirm-titre" ref={racine} tabIndex={-1}>
        <span className="confirm-poignee" aria-hidden="true" />
        {icone && <span className={`confirm-icone${danger ? ' confirm-icone--danger' : ''}`} aria-hidden="true"><Icone nom={icone} taille={22} /></span>}
        <h3 className="modal-titre" id="confirm-titre">{title}</h3>
        {message && <p className="small" style={{ margin: '0 0 4px' }}>{message}</p>}
        {detail && <p className="confirm-detail"><Icone nom="croix" taille={15} />{detail}</p>}
        {/* Pied collant : l'action décisive barre toute la largeur, l'annulation est un lien en
            dessous. Les deux boutons étaient auparavant alignés à droite, à la suite du message —
            dans une modale un peu longue, ils passaient sous la ligne de flottaison. */}
        <div className="modal-pied">
          {/* btn-gold et non btn-teal : il n'existe aucune règle CSS pour `.btn-teal` sur un <button>
              (seulement `a.btn-teal`, voir styles.css), ce bouton s'affichait donc sans aucun style,
              avec l'apparence par défaut du navigateur. Reliquat du retrait du teal de l'identité
              visuelle, passé inaperçu parce que la variante `danger` couvre la plupart des appels. */}
          <button className={danger ? 'btn-outline' : 'btn-gold'} style={danger ? { borderColor: 'var(--red)', color: 'var(--red)' } : undefined} onClick={onConfirm} disabled={loading}>
            {loading ? '...' : confirmLabel}
          </button>
          <button className="btn-ghost" onClick={onCancel} disabled={loading}>{cancelLabel || t('common.cancel')}</button>
        </div>
      </div>
    </div>
  );
}

export default function ConfirmDialog({ open, ...reste }) {
  if (!open) return null;
  return createPortal(<Corps {...reste} />, document.body);
}
