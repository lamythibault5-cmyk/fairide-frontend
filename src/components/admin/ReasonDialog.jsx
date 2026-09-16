import { useEffect, useState, useId } from 'react';
import { createPortal } from 'react-dom';
import { useLanguage } from '../../context/LanguageContext';

// Confirmation AVEC motif (et champs supplémentaires via `children`) : refus d'un document, perte d'un
// prospect, crédit / débit d'un solde, rejet d'un dossier… ConfirmDialog ne prend pas de contenu ; ce
// composant en reprend l'apparence et les boutons pour que « confirmer une action sensible » se lise
// pareil dans tout l'ERP, avec en plus un champ de motif (obligatoire ou non) rendu à onConfirm(reason).
//
// Remplace window.prompt / window.confirm, supprimés ou muets dans une PWA installée.
export default function ReasonDialog({ open, title, message, label, placeholder, required = true, multiline = false, confirmLabel, danger, loading, initialValue = '', children, onConfirm, onCancel }) {
  // Identifiants d'etiquette : useId donne une valeur par instance, donc pas de collision
  // quand ce composant est rendu plusieurs fois sur la meme page.
  const idsA11y = useId();
  const { t: tr } = useLanguage();
  const [motif, setMotif] = useState(initialValue);
  useEffect(() => { if (open) setMotif(initialValue); }, [open, initialValue]);
  useEffect(() => {
    if (!open) return undefined;
    function onKey(e) { if (e.key === 'Escape') onCancel?.(); }
    document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
  }, [open, onCancel]);
  if (!open) return null;
  const bloque = loading || (required && !motif.trim());
  return createPortal(
    <div className="modal-overlay" onClick={onCancel}>
      <div className="modal-box admin-reason-dialog" onClick={(e) => e.stopPropagation()} style={{ maxWidth: 440 }} role="dialog" aria-modal="true" aria-label={title}>
        <h3 style={{ margin: '0 0 8px' }}>{title}</h3>
        {message && <p className="small" style={{ margin: '0 0 12px' }}>{message}</p>}
        {children}
        <div className="field">
          <label htmlFor={idsA11y + '-reasonlabel'}>{label || tr('adminCommon.reasonLabel')}{required ? '' : ` (${tr('adminCommon.optional')})`}</label>
          {multiline
            ? <textarea id={idsA11y + '-reasonlabel'} rows={3} value={motif} onChange={(e) => setMotif(e.target.value)} placeholder={placeholder} autoFocus />
            : <input value={motif} onChange={(e) => setMotif(e.target.value)} placeholder={placeholder} autoFocus onKeyDown={(e) => { if (e.key === 'Enter' && !bloque) onConfirm(motif.trim()); }} />}
        </div>
        <div className="row" style={{ gap: 8, justifyContent: 'flex-end' }}>
          <button type="button" className="btn-ghost" onClick={onCancel} disabled={loading}>{tr('adminCommon.cancel')}</button>
          <button type="button" className={danger ? 'btn-outline' : 'btn-gold'} style={danger ? { borderColor: 'var(--red)', color: 'var(--red)' } : undefined} disabled={bloque} onClick={() => onConfirm(motif.trim())}>
            {loading ? '...' : (confirmLabel || tr('adminCommon.confirm'))}
          </button>
        </div>
      </div>
    </div>,
    document.body
  );
}
