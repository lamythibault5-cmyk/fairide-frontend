import { useState } from 'react';
import { createPortal } from 'react-dom';
import { api } from '../../api';
import { useAuth } from '../../context/AuthContext';
import { useToast } from '../../context/ToastContext';

// Bouton "Créer un ticket" réutilisé sur les fiches commande/restaurant/livreur/client (module Support) —
// pré-lie le ticket à la fiche courante via linkedClientId/linkedDriverId/linkedRestaurantId/linkedOrderId
// (voir routes/adminSupport.js POST /admin/support/tickets).
export default function CreateTicketButton({ linkType, linkId, label }) {
  const { token } = useAuth();
  const toast = useToast();
  const [open, setOpen] = useState(false);
  const [subject, setSubject] = useState('');
  const [message, setMessage] = useState('');
  const [priority, setPriority] = useState('medium');
  const [creating, setCreating] = useState(false);

  async function create() {
    if (!subject.trim() || !message.trim()) { toast('Sujet et message requis.'); return; }
    setCreating(true);
    try {
      const body = { subject: subject.trim(), message: message.trim(), priority, [linkType]: linkId };
      const t = await api('/admin/support/tickets', { method: 'POST', token, body });
      toast(`Ticket ${t.ticketNumber} créé.`);
      setOpen(false); setSubject(''); setMessage('');
    } catch (e) {
      toast(e.message);
    } finally {
      setCreating(false);
    }
  }

  return (
    <>
      <button className="btn-outline" style={{ padding: '6px 14px', fontSize: 13 }} onClick={() => setOpen(true)}>🎫 Créer un ticket</button>
      {open && createPortal(
        <div className="modal-overlay" onClick={() => setOpen(false)}>
          <div className="modal-box" onClick={(e) => e.stopPropagation()} style={{ maxWidth: 420 }}>
            <h3 style={{ margin: '0 0 4px' }}>Nouveau ticket</h3>
            <p className="small" style={{ margin: '0 0 10px', opacity: 0.7 }}>Lié à : {label}</p>
            <div className="field"><label>Sujet</label><input value={subject} onChange={(e) => setSubject(e.target.value)} autoFocus /></div>
            <div className="field"><label>Message</label><textarea rows={4} value={message} onChange={(e) => setMessage(e.target.value)} /></div>
            <div className="field">
              <label>Priorité</label>
              <select value={priority} onChange={(e) => setPriority(e.target.value)}>
                <option value="low">Basse</option><option value="medium">Moyenne</option><option value="high">Haute</option><option value="urgent">Urgente</option>
              </select>
            </div>
            <div className="row" style={{ gap: 8, marginTop: 8 }}>
              <button className="btn-teal" disabled={creating} onClick={create}>{creating ? '...' : 'Créer'}</button>
              <button className="btn-ghost" onClick={() => setOpen(false)}>Annuler</button>
            </div>
          </div>
        </div>,
        document.body
      )}
    </>
  );
}
