import { useRef } from 'react';
import { createPortal } from 'react-dom';
import { useLanguage } from '../context/LanguageContext';
import useDialogue from '../hooks/useDialogue';

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
function Corps({ title, message, confirmLabel = 'Confirmer', danger, loading, onConfirm, onCancel }) {
  const { t } = useLanguage();
  const racine = useRef(null);
  /* Cette fenêtre garde la porte de toutes les actions irréversibles du dépôt — supprimer une
     section de carte, un bon cadeau, une réservation. Elle n'avait ni Échap, ni rôle de dialogue,
     ni la moindre gestion du focus : à l'ouverture le focus restait derrière, sur la page, si bien
     qu'au clavier on pouvait continuer à parcourir — et actionner — ce que la fenêtre recouvrait. */
  useDialogue(racine, onCancel);
  return (
    <div className="modal-overlay" onClick={onCancel}>
      <div className="modal-box" onClick={(e) => e.stopPropagation()} style={{ maxWidth: 420 }}
        role="dialog" aria-modal="true" aria-labelledby="confirm-titre" ref={racine} tabIndex={-1}>
        <h3 className="modal-titre" id="confirm-titre">{title}</h3>
        {message && <p className="small" style={{ margin: '0 0 4px' }}>{message}</p>}
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
          <button className="btn-ghost" onClick={onCancel} disabled={loading}>{t('common.cancel')}</button>
        </div>
      </div>
    </div>
  );
}

export default function ConfirmDialog({ open, ...reste }) {
  if (!open) return null;
  return createPortal(<Corps {...reste} />, document.body);
}
