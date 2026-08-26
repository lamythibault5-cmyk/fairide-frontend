import { createPortal } from 'react-dom';

// Confirmation générique avant toute action admin sensible (suspendre, annuler, rembourser, réassigner,
// changer la tarification...) — un seul composant réutilisé partout plutôt qu'une modale par action.
export default function ConfirmDialog({ open, title, message, confirmLabel = 'Confirmer', danger, loading, onConfirm, onCancel }) {
  if (!open) return null;
  return createPortal(
    <div className="modal-overlay" onClick={onCancel}>
      <div className="modal-box" onClick={(e) => e.stopPropagation()} style={{ maxWidth: 420 }}>
        <h3 style={{ margin: '0 0 8px' }}>{title}</h3>
        {message && <p className="small" style={{ margin: '0 0 16px' }}>{message}</p>}
        <div className="row" style={{ gap: 8, justifyContent: 'flex-end' }}>
          <button className="btn-ghost" onClick={onCancel} disabled={loading}>Annuler</button>
          <button className={danger ? 'btn-outline' : 'btn-teal'} style={danger ? { borderColor: 'var(--red)', color: 'var(--red)' } : undefined} onClick={onConfirm} disabled={loading}>
            {loading ? '...' : confirmLabel}
          </button>
        </div>
      </div>
    </div>,
    document.body
  );
}
