import { useState } from 'react';
import { createPortal } from 'react-dom';
import { api } from '../../api';
import { useAuth } from '../../context/AuthContext';
import { useToast } from '../../context/ToastContext';

// Bouton "Créer une tâche" réutilisé sur les fiches restaurant/livreur/client/commande/ticket/document/
// facture/prospect CRM (module Tâches) — pré-lie la tâche à la fiche courante via targetType/targetId
// (voir routes/adminTasks.js POST /admin/tasks). Même pattern que CreateTicketButton.jsx.
export default function CreateTaskButton({ targetType, targetId, label }) {
  const { token, user } = useAuth();
  const toast = useToast();
  const [open, setOpen] = useState(false);
  const [title, setTitle] = useState('');
  const [dueAt, setDueAt] = useState('');
  const [priority, setPriority] = useState('medium');
  const [assignedToEmail, setAssignedToEmail] = useState('');
  const [creating, setCreating] = useState(false);

  async function create() {
    if (!title.trim()) { toast('Titre requis.'); return; }
    setCreating(true);
    try {
      await api('/admin/tasks', {
        method: 'POST', token,
        body: { title: title.trim(), priority, assignedToEmail: assignedToEmail || undefined, dueAt: dueAt || undefined, targetType, targetId }
      });
      toast('Tâche créée.');
      setOpen(false); setTitle(''); setDueAt(''); setAssignedToEmail('');
    } catch (e) {
      toast(e.message);
    } finally {
      setCreating(false);
    }
  }

  return (
    <>
      <button className="btn-outline" style={{ padding: '6px 14px', fontSize: 13 }} onClick={() => setOpen(true)}>✅ Créer une tâche</button>
      {open && createPortal(
        <div className="modal-overlay" onClick={() => setOpen(false)}>
          <div className="modal-box" onClick={(e) => e.stopPropagation()} style={{ maxWidth: 420 }}>
            <h3 style={{ margin: '0 0 4px' }}>Nouvelle tâche</h3>
            <p className="small" style={{ margin: '0 0 10px', opacity: 0.7 }}>Liée à : {label}</p>
            <div className="field"><label>Titre</label><input value={title} onChange={(e) => setTitle(e.target.value)} autoFocus /></div>
            <div className="row" style={{ gap: 8 }}>
              <div className="field" style={{ flex: 1 }}>
                <label>Échéance</label>
                <input type="datetime-local" value={dueAt} onChange={(e) => setDueAt(e.target.value)} />
              </div>
              <div className="field" style={{ flex: 1 }}>
                <label>Priorité</label>
                <select value={priority} onChange={(e) => setPriority(e.target.value)}>
                  <option value="low">Basse</option><option value="medium">Moyenne</option><option value="high">Haute</option>
                </select>
              </div>
            </div>
            <div className="field">
              <label>Responsable (optionnel)</label>
              <input value={assignedToEmail} onChange={(e) => setAssignedToEmail(e.target.value)} placeholder={user?.email || 'email@fairide.be'} />
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
