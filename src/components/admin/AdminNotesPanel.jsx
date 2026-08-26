import { useState } from 'react';
import { api } from '../../api';
import { useAuth } from '../../context/AuthContext';
import { useToast } from '../../context/ToastContext';
import { fmtDateTime } from '../../pages/admin/adminUtils';

// Notes internes admin, réutilisé sur toutes les fiches (commande/restaurant/livreur/client) — même
// backend transverse (admin_notes), voir GET/POST /admin/notes.
export default function AdminNotesPanel({ targetType, targetId, notes, onAdded }) {
  const { token } = useAuth();
  const toast = useToast();
  const [text, setText] = useState('');
  const [saving, setSaving] = useState(false);

  async function addNote() {
    if (!text.trim()) return;
    setSaving(true);
    try {
      const note = await api('/admin/notes', { method: 'POST', token, body: { targetType, targetId, text: text.trim() } });
      setText('');
      onAdded(note);
    } catch (e) {
      toast(e.message);
    } finally {
      setSaving(false);
    }
  }

  return (
    <div>
      <h4 style={{ margin: '0 0 8px' }}>📝 Notes internes</h4>
      <div className="row" style={{ gap: 8, marginBottom: 10 }}>
        <input value={text} onChange={(e) => setText(e.target.value)} placeholder="Ajouter une note..." style={{ flex: 1 }} onKeyDown={(e) => e.key === 'Enter' && addNote()} />
        <button className="btn-outline" style={{ padding: '6px 14px', fontSize: 13 }} disabled={saving || !text.trim()} onClick={addNote}>{saving ? '...' : 'Ajouter'}</button>
      </div>
      {(!notes || notes.length === 0) && <div className="small" style={{ opacity: 0.6 }}>Aucune note pour l'instant.</div>}
      {notes && notes.map((n) => (
        <div key={n.id} style={{ padding: '6px 0', borderBottom: '1px solid var(--cream-dim)' }}>
          <div className="small">{n.text}</div>
          <div className="small" style={{ opacity: 0.5 }}>{n.authorEmail} · {fmtDateTime(n.createdAt)}</div>
        </div>
      ))}
    </div>
  );
}
