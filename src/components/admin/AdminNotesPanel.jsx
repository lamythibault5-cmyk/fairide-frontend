import { useState } from 'react';
import { api } from '../../api';
import { useAuth } from '../../context/AuthContext';
import { useToast } from '../../context/ToastContext';
import { fmtDateTime, CRM_NOTE_CHANNEL_LABELS } from '../../pages/admin/adminUtils';

// Notes internes admin, réutilisé sur toutes les fiches (commande/restaurant/livreur/client/prospect CRM)
// — même backend transverse (admin_notes), voir GET/POST /admin/notes. `showChannel` (module CRM
// uniquement) ajoute un sélecteur Note/Appel/Email/RDV — les autres fiches restent inchangées.
export default function AdminNotesPanel({ targetType, targetId, notes, onAdded, showChannel }) {
  const { token } = useAuth();
  const toast = useToast();
  const [text, setText] = useState('');
  const [channel, setChannel] = useState('');
  const [saving, setSaving] = useState(false);

  async function addNote() {
    if (!text.trim()) return;
    setSaving(true);
    try {
      const note = await api('/admin/notes', { method: 'POST', token, body: { targetType, targetId, text: text.trim(), channel: channel || undefined } });
      setText(''); setChannel('');
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
        {showChannel && (
          <select value={channel} onChange={(e) => setChannel(e.target.value)} style={{ maxWidth: 130 }}>
            <option value="">Note</option>
            <option value="call">📞 Appel</option>
            <option value="email">✉️ Email</option>
            <option value="meeting">🤝 Rendez-vous</option>
          </select>
        )}
        <input value={text} onChange={(e) => setText(e.target.value)} placeholder="Ajouter une note..." style={{ flex: 1 }} onKeyDown={(e) => e.key === 'Enter' && addNote()} />
        <button className="btn-outline" style={{ padding: '6px 14px', fontSize: 13 }} disabled={saving || !text.trim()} onClick={addNote}>{saving ? '...' : 'Ajouter'}</button>
      </div>
      {(!notes || notes.length === 0) && <div className="small" style={{ opacity: 0.6 }}>Aucune note pour l'instant.</div>}
      {notes && notes.map((n) => (
        <div key={n.id} style={{ padding: '6px 0', borderBottom: '1px solid var(--cream-dim)' }}>
          <div className="small">{n.channel && `${CRM_NOTE_CHANNEL_LABELS[n.channel]} — `}{n.text}</div>
          <div className="small" style={{ opacity: 0.5 }}>{n.authorEmail} · {fmtDateTime(n.createdAt)}</div>
        </div>
      ))}
    </div>
  );
}
