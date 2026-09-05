import { createPortal } from 'react-dom';
import { useLanguage } from '../context/LanguageContext';

// Confirmation générique avant toute action sensible ou irréversible — un seul composant réutilisé
// partout plutôt qu'une modale par action.
//
// Vivait dans components/admin/ et n'était donc utilisé que par la console d'administration, pendant
// que le tableau de bord restaurateur se rabattait sur window.confirm() pour ses suppressions (plats
// en lot, section entière). Or les dialogues natifs sont supprimés ou se comportent différemment dans
// une PWA installée et dans les webviews intégrées — précisément le contexte d'usage d'un
// restaurateur au comptoir. Remonté d'un niveau pour que les deux espaces partagent la même modale.
export default function ConfirmDialog({ open, title, message, confirmLabel = 'Confirmer', danger, loading, onConfirm, onCancel }) {
  const { t } = useLanguage();
  if (!open) return null;
  return createPortal(
    <div className="modal-overlay" onClick={onCancel}>
      <div className="modal-box" onClick={(e) => e.stopPropagation()} style={{ maxWidth: 420 }}>
        <h3 style={{ margin: '0 0 8px' }}>{title}</h3>
        {message && <p className="small" style={{ margin: '0 0 16px' }}>{message}</p>}
        <div className="row" style={{ gap: 8, justifyContent: 'flex-end' }}>
          <button className="btn-ghost" onClick={onCancel} disabled={loading}>{t('common.cancel')}</button>
          {/* btn-gold et non btn-teal : il n'existe aucune règle CSS pour `.btn-teal` sur un <button>
              (seulement `a.btn-teal`, voir styles.css), ce bouton s'affichait donc sans aucun style,
              avec l'apparence par défaut du navigateur. Reliquat du retrait du teal de l'identité
              visuelle, passé inaperçu parce que la variante `danger` couvre la plupart des appels. */}
          <button className={danger ? 'btn-outline' : 'btn-gold'} style={danger ? { borderColor: 'var(--red)', color: 'var(--red)' } : undefined} onClick={onConfirm} disabled={loading}>
            {loading ? '...' : confirmLabel}
          </button>
        </div>
      </div>
    </div>,
    document.body
  );
}
