import { useState } from 'react';
import { CATEGORIES, defaultItemImage } from '../menuCategories';

export default function MenuItemRow({ item, onSave, onDelete, onSetPromo, onClearPromo, allOptionGroups = [], onSetOptionGroups }) {
  const [editing, setEditing] = useState(false);
  const [name, setName] = useState(item.name);
  const [desc, setDesc] = useState(item.desc || '');
  const [price, setPrice] = useState(String(item.price));
  const [category, setCategory] = useState(item.category || 'plat');
  const [imageUrl, setImageUrl] = useState(item.imageUrl || '');
  const [saving, setSaving] = useState(false);
  const [groupIds, setGroupIds] = useState(() => new Set((item.optionGroups || []).map((g) => g.id)));

  function toggleGroup(id) {
    setGroupIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id); else next.add(id);
      return next;
    });
  }

  const [promoOpen, setPromoOpen] = useState(false);
  const [promoType, setPromoType] = useState('percent');
  const [promoValue, setPromoValue] = useState('15');
  const [savingPromo, setSavingPromo] = useState(false);

  async function save() {
    setSaving(true);
    try {
      await onSave(item.id, { name: name.trim(), desc: desc.trim(), price: parseFloat(price), category, imageUrl: imageUrl.trim() });
      if (onSetOptionGroups) await onSetOptionGroups(item.id, Array.from(groupIds));
      setEditing(false);
    } finally {
      setSaving(false);
    }
  }

  async function applyPromo() {
    setSavingPromo(true);
    try {
      const body = promoType === 'percent' ? { type: 'percent', value: Number(promoValue) } : { type: 'bogo' };
      await onSetPromo(item.id, body);
      setPromoOpen(false);
    } catch {
      // toast already shown by parent
    } finally {
      setSavingPromo(false);
    }
  }

  if (editing) {
    return (
      <div className="card" style={{ marginBottom: 10 }}>
        <div className="field"><label>Nom</label><input value={name} onChange={(e) => setName(e.target.value)} /></div>
        <div className="field"><label>Description</label><input value={desc} onChange={(e) => setDesc(e.target.value)} placeholder="Ingrédients, préparation..." /></div>
        <div className="field"><label>Prix (€)</label><input type="number" step="0.5" value={price} onChange={(e) => setPrice(e.target.value)} /></div>
        <div className="field">
          <label>Catégorie</label>
          <select value={category} onChange={(e) => setCategory(e.target.value)}>
            {CATEGORIES.map((c) => <option key={c.value} value={c.value}>{c.label}</option>)}
          </select>
        </div>
        <div className="field"><label>Image (URL)</label><input value={imageUrl} onChange={(e) => setImageUrl(e.target.value)} placeholder="https://..." /></div>
        {allOptionGroups.length > 0 && (
          <div className="field">
            <label>Groupes d'options</label>
            {allOptionGroups.map((g) => (
              <label key={g.id} className="row" style={{ gap: 8, marginBottom: 4, cursor: 'pointer' }}>
                <input type="checkbox" style={{ width: 'auto' }} checked={groupIds.has(g.id)} onChange={() => toggleGroup(g.id)} />
                <span className="small">{g.name}</span>
              </label>
            ))}
          </div>
        )}
        <div className="row" style={{ gap: 8 }}>
          <button className="btn-teal" disabled={saving} onClick={save}>{saving ? '...' : 'Enregistrer'}</button>
          <button className="btn-ghost" onClick={() => setEditing(false)}>Annuler</button>
        </div>
      </div>
    );
  }

  return (
    <div style={{ borderBottom: '1px solid var(--cream-dim)', padding: '10px 0' }}>
      <div className="menu-item" style={{ padding: 0, border: 'none', ...(item.available === false ? { opacity: 0.5 } : {}) }}>
        <div className="row" style={{ gap: 10 }}>
          <img src={item.imageUrl || defaultItemImage(item)} alt={item.name} className="dish-thumb" />
          <span>
            {item.name}{item.available === false ? ' (indisponible)' : ''}
            {item.optionGroups?.length > 0 && <span className="small" style={{ marginLeft: 6 }}>· {item.optionGroups.map((g) => g.name).join(', ')}</span>}
          </span>
        </div>
        <div className="row" style={{ gap: 8 }}>
          <span className="price">{item.price.toFixed(2)}€</span>
          <button className="btn-ghost" onClick={() => onSave(item.id, { available: item.available === false })} title={item.available === false ? 'Rendre disponible' : 'Marquer indisponible'}>
            {item.available === false ? '🚫' : '✅'}
          </button>
          <button className="btn-ghost" onClick={() => setEditing(true)}>✏️</button>
          <button className="btn-danger-ghost" onClick={() => onDelete(item.id)}>Supprimer</button>
        </div>
      </div>

      {item.activePromo && (
        <div className="row" style={{ gap: 8, marginTop: 6, justifyContent: 'flex-end' }}>
          <span className="pill teal">🏷️ {item.activePromo.label}</span>
          <button className="btn-danger-ghost" style={{ padding: '2px 8px', fontSize: 12 }} onClick={() => onClearPromo(item.activePromo.id)}>Retirer</button>
        </div>
      )}
      {!item.activePromo && !promoOpen && (
        <div className="row" style={{ justifyContent: 'flex-end', marginTop: 6 }}>
          <button className="btn-ghost" style={{ fontSize: 12, padding: '2px 8px' }} onClick={() => setPromoOpen(true)}>🏷️ Ajouter une promo</button>
        </div>
      )}
      {promoOpen && (
        <div className="row" style={{ gap: 6, marginTop: 6, justifyContent: 'flex-end', alignItems: 'center' }}>
          <select style={{ width: 'auto' }} value={promoType} onChange={(e) => setPromoType(e.target.value)}>
            <option value="percent">Réduction %</option>
            <option value="bogo">1 acheté = 1 offert</option>
          </select>
          {promoType === 'percent' && (
            <select style={{ width: 'auto' }} value={promoValue} onChange={(e) => setPromoValue(e.target.value)}>
              {[10, 15, 20, 25, 30].map((v) => <option key={v} value={v}>{v}%</option>)}
            </select>
          )}
          <button className="btn-teal" style={{ padding: '4px 10px', fontSize: 12 }} disabled={savingPromo} onClick={applyPromo}>{savingPromo ? '...' : 'Activer'}</button>
          <button className="btn-ghost" style={{ padding: '4px 10px', fontSize: 12 }} onClick={() => setPromoOpen(false)}>Annuler</button>
        </div>
      )}
    </div>
  );
}
