import { useState } from 'react';
import { createPortal } from 'react-dom';
import { api } from '../../api';
import { useAuth } from '../../context/AuthContext';
import { useToast } from '../../context/ToastContext';
import { useLanguage } from '../../context/LanguageContext';

// Bouton "Créer une tâche" réutilisé sur les fiches restaurant/livreur/client/commande/ticket/document/
// facture/prospect CRM (module Tâches) — pré-lie la tâche à la fiche courante via targetType/targetId
// (voir routes/adminTasks.js POST /admin/tasks). Même pattern que CreateTicketButton.jsx.
export default function CreateTaskButton({ targetType, targetId, label }) {
  const { t: tr } = useLanguage();
  const { token, user } = useAuth();
  const toast = useToast();
  const [open, setOpen] = useState(false);
  const [title, setTitle] = useState('');
  const [dueAt, setDueAt] = useState('');
  const [priority, setPriority] = useState('medium');
  const [assignedToEmail, setAssignedToEmail] = useState('');
  const [creating, setCreating] = useState(false);

  async function create() {
    if (!title.trim()) { toast(tr('adminCommon.toastTitleRequired')); return; }
    setCreating(true);
    try {
      await api('/admin/tasks', {
        method: 'POST', token,
        body: { title: title.trim(), priority, assignedToEmail: assignedToEmail || undefined, dueAt: dueAt || undefined, targetType, targetId }
      });
      toast(tr('adminCommon.toastTaskCreated'));
      setOpen(false); setTitle(''); setDueAt(''); setAssignedToEmail('');
    } catch (e) {
      toast(e.message);
    } finally {
      setCreating(false);
    }
  }

  return (
    <>
      <button className="btn-outline" style={{ padding: '6px 14px', fontSize: 13 }} onClick={() => setOpen(true)}>{tr('adminTasks.createTaskBtn')}</button>
      {open && createPortal(
        <div className="modal-overlay" onClick={() => setOpen(false)}>
          <div className="modal-box" onClick={(e) => e.stopPropagation()} style={{ maxWidth: 420 }}>
            <h3 style={{ margin: '0 0 4px' }}>{tr('adminCommon.newTask')}</h3>
            <p className="small" style={{ margin: '0 0 10px', opacity: 0.7 }}>{tr('adminCommon.linkedTo', { label })}</p>
            <div className="field"><label>{tr('adminCommon.title')}</label><input value={title} onChange={(e) => setTitle(e.target.value)} autoFocus /></div>
            <div className="row" style={{ gap: 8 }}>
              <div className="field" style={{ flex: 1 }}>
                <label>{tr('adminCommon.dueDate')}</label>
                <input type="datetime-local" value={dueAt} onChange={(e) => setDueAt(e.target.value)} />
              </div>
              <div className="field" style={{ flex: 1 }}>
                <label>{tr('adminCommon.priority')}</label>
                <select value={priority} onChange={(e) => setPriority(e.target.value)}>
                  <option value="low">{tr('adminCommon.low')}</option><option value="medium">{tr('adminCommon.medium')}</option><option value="high">{tr('adminCommon.high')}</option>
                </select>
              </div>
            </div>
            <div className="field">
              <label>{tr('adminCommon.ownerOptional')}</label>
              <input value={assignedToEmail} onChange={(e) => setAssignedToEmail(e.target.value)} placeholder={user?.email || 'email@fairide.be'} />
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
