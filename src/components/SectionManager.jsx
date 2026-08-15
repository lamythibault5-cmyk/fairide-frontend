import { useState } from 'react';
import { categoryLabel } from '../menuCategories';
import { useLanguage } from '../context/LanguageContext';

// Gestion des sections de menu du restaurateur (ajouter/renommer/retirer) — mêmes conventions UI que
// OptionGroupManager (formulaire inline par ligne, "+ Créer" en bas). La confirmation de suppression
// quand une section contient encore des plats est décidée par le parent (onDelete), pas ici.
export default function SectionManager({ sections, itemCounts, onCreate, onRename, onDelete }) {
  const { t } = useLanguage();
  const [creating, setCreating] = useState(false);
  const [newName, setNewName] = useState('');
  const [editingId, setEditingId] = useState(null);
  const [editName, setEditName] = useState('');
  const [saving, setSaving] = useState(false);

  async function handleCreate() {
    if (!newName.trim()) return;
    setSaving(true);
    try {
      await onCreate(newName.trim());
      setNewName('');
      setCreating(false);
    } catch {
      // toast déjà affiché par le parent
    } finally {
      setSaving(false);
    }
  }

  async function handleRename(id) {
    if (!editName.trim()) return;
    setSaving(true);
    try {
      await onRename(id, editName.trim());
      setEditingId(null);
    } catch {
      // toast déjà affiché par le parent
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="card">
      <h3 style={{ margin: '0 0 6px', fontSize: 15 }}>Sections du menu</h3>
      <p className="small" style={{ margin: '0 0 10px' }}>
        Choisis les sections de ton menu (Entrées, Plats, Desserts, Boissons ou tout ce que tu veux — "Menu enfants", "Nos spécialités"...), renomme-les ou retire celles dont tu n'as pas besoin.
      </p>
      {sections.length === 0 && !creating && <div className="small" style={{ marginBottom: 10 }}>Aucune section pour l'instant.</div>}
      {sections.map((s) => (
        <div key={s.id} className="row" style={{ justifyContent: 'space-between', padding: '6px 0', borderBottom: '1px solid var(--cream-dim)' }}>
          {editingId === s.id ? (
            <div className="row" style={{ gap: 8, flex: 1 }}>
              <input style={{ flex: 1 }} value={editName} onChange={(e) => setEditName(e.target.value)} />
              <button className="btn-teal" style={{ padding: '4px 10px' }} disabled={saving} onClick={() => handleRename(s.id)}>{saving ? '...' : 'Enregistrer'}</button>
              <button className="btn-ghost" style={{ padding: '4px 10px' }} onClick={() => setEditingId(null)}>Annuler</button>
            </div>
          ) : (
            <>
              <span>
                {categoryLabel(s.name, t)} <span className="small">({itemCounts[s.name] || 0} plat{(itemCounts[s.name] || 0) > 1 ? 's' : ''})</span>
              </span>
              <div className="row" style={{ gap: 6 }}>
                <button className="btn-ghost" onClick={() => { setEditingId(s.id); setEditName(s.name); }}>✏️</button>
                <button className="btn-danger-ghost" onClick={() => onDelete(s)}>Supprimer</button>
              </div>
            </>
          )}
        </div>
      ))}
      {creating ? (
        <div className="row" style={{ gap: 8, marginTop: 10 }}>
          <input style={{ flex: 1 }} value={newName} onChange={(e) => setNewName(e.target.value)} placeholder="Menu enfants, Formules midi..." />
          <button className="btn-teal" style={{ padding: '4px 10px' }} disabled={saving} onClick={handleCreate}>{saving ? '...' : 'Créer'}</button>
          <button className="btn-ghost" style={{ padding: '4px 10px' }} onClick={() => setCreating(false)}>Annuler</button>
        </div>
      ) : (
        <button type="button" className="btn-ghost" style={{ marginTop: 10 }} onClick={() => setCreating(true)}>+ Nouvelle section</button>
      )}
    </div>
  );
}
