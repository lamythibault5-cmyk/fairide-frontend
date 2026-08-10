import { useState } from 'react';
import { CATEGORIES } from '../menuCategories';

export default function MenuItemRow({ item, onSave, onDelete }) {
  const [editing, setEditing] = useState(false);
  const [name, setName] = useState(item.name);
  const [price, setPrice] = useState(String(item.price));
  const [category, setCategory] = useState(item.category || 'plat');
  const [imageUrl, setImageUrl] = useState(item.imageUrl || '');
  const [saving, setSaving] = useState(false);

  async function save() {
    setSaving(true);
    try {
      await onSave(item.id, { name: name.trim(), price: parseFloat(price), category, imageUrl: imageUrl.trim() });
      setEditing(false);
    } finally {
      setSaving(false);
    }
  }

  if (editing) {
    return (
      <div className="card" style={{ marginBottom: 10 }}>
        <div className="field"><label>Nom</label><input value={name} onChange={(e) => setName(e.target.value)} /></div>
        <div className="field"><label>Prix (€)</label><input type="number" step="0.5" value={price} onChange={(e) => setPrice(e.target.value)} /></div>
        <div className="field">
          <label>Catégorie</label>
          <select value={category} onChange={(e) => setCategory(e.target.value)}>
            {CATEGORIES.map((c) => <option key={c.value} value={c.value}>{c.label}</option>)}
          </select>
        </div>
        <div className="field"><label>Image (URL)</label><input value={imageUrl} onChange={(e) => setImageUrl(e.target.value)} placeholder="https://..." /></div>
        <div className="row" style={{ gap: 8 }}>
          <button className="btn-teal" disabled={saving} onClick={save}>{saving ? '...' : 'Enregistrer'}</button>
          <button className="btn-ghost" onClick={() => setEditing(false)}>Annuler</button>
        </div>
      </div>
    );
  }

  return (
    <div className="menu-item">
      <div className="row" style={{ gap: 10 }}>
        {item.imageUrl && <img src={item.imageUrl} alt={item.name} className="dish-thumb" />}
        <span>{item.name}</span>
      </div>
      <div className="row" style={{ gap: 8 }}>
        <span className="price">{item.price.toFixed(2)}€</span>
        <button className="btn-ghost" onClick={() => setEditing(true)}>✏️</button>
        <button className="btn-danger-ghost" onClick={() => onDelete(item.id)}>Supprimer</button>
      </div>
    </div>
  );
}
