import { useState, useId } from 'react';
import { createPortal } from 'react-dom';
import { api } from '../../api';
import { useAuth } from '../../context/AuthContext';
import { useToast } from '../../context/ToastContext';
import { useLanguage } from '../../context/LanguageContext';

// Bouton "Créer un ticket" réutilisé sur les fiches commande/restaurant/livreur/client (module Support) —
// pré-lie le ticket à la fiche courante via linkedClientId/linkedDriverId/linkedRestaurantId/linkedOrderId
// (voir routes/adminSupport.js POST /admin/support/tickets).
export default function CreateTicketButton({ linkType, linkId, label }) {
  // Identifiants d'etiquette : useId donne une valeur par instance, donc pas de collision
  // quand ce composant est rendu plusieurs fois sur la meme page.
  const idsA11y = useId();
  const { t: tr } = useLanguage();
  const { token } = useAuth();
  const toast = useToast();
  const [open, setOpen] = useState(false);
  const [subject, setSubject] = useState('');
  const [message, setMessage] = useState('');
  const [priority, setPriority] = useState('medium');
  const [creating, setCreating] = useState(false);

  async function create() {
    if (!subject.trim() || !message.trim()) { toast(tr('adminCommon.toastSubjectMessageRequired')); return; }
    setCreating(true);
    try {
      const body = { subject: subject.trim(), message: message.trim(), priority, [linkType]: linkId };
      const t = await api('/admin/support/tickets', { method: 'POST', token, body });
      toast(tr('adminSupport.toastCreated', { n: t.ticketNumber }));
      setOpen(false); setSubject(''); setMessage('');
    } catch (e) {
      toast(e.message, 'erreur');
    } finally {
      setCreating(false);
    }
  }

  return (
    <>
      <button className="btn-outline" style={{ padding: '6px 14px', fontSize: 13 }} onClick={() => setOpen(true)}>{tr('adminSupport.createTicketBtn')}</button>
      {open && createPortal(
        <div className="modal-overlay" onClick={() => setOpen(false)}>
          <div className="modal-box" onClick={(e) => e.stopPropagation()} style={{ maxWidth: 420 }}>
            <h3 style={{ margin: '0 0 4px' }}>{tr('adminCommon.newTicket')}</h3>
            <p className="small" style={{ margin: '0 0 10px', opacity: 0.7 }}>{tr('adminCommon.linkedTo', { label })}</p>
            <div className="field"><label htmlFor={idsA11y + '-subject'}>{tr('adminCommon.subject')}</label><input id={idsA11y + '-subject'} value={subject} onChange={(e) => setSubject(e.target.value)} autoFocus /></div>
            <div className="field"><label htmlFor={idsA11y + '-message'}>{tr('adminCommon.message')}</label><textarea id={idsA11y + '-message'} rows={4} value={message} onChange={(e) => setMessage(e.target.value)} /></div>
            <div className="field">
              <label htmlFor={idsA11y + '-priority'}>{tr('adminCommon.priority')}</label>
              <select id={idsA11y + '-priority'} value={priority} onChange={(e) => setPriority(e.target.value)}>
                <option value="low">{tr('adminCommon.low')}</option><option value="medium">{tr('adminCommon.medium')}</option><option value="high">{tr('adminCommon.high')}</option><option value="urgent">{tr('adminCommon.urgent')}</option>
              </select>
            </div>
            <div className="row" style={{ gap: 8, marginTop: 8 }}>
              <button className="btn-teal" disabled={creating} onClick={create}>{creating ? '...' : tr('adminCommon.create')}</button>
              <button className="btn-ghost" onClick={() => setOpen(false)}>{tr('adminCommon.cancel')}</button>
            </div>
          </div>
        </div>,
        document.body
      )}
    </>
  );
}
