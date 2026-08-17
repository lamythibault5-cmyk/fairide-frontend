import { useState } from 'react';

// Relecture des plats extraits d'un PDF/photo de menu par l'IA avant tout ajout réel — chaque champ
// reste modifiable (l'IA peut se tromper sur un prix mal imprimé ou une catégorie ambiguë) et chaque
// ligne peut être décochée, exactement comme pour un template de démarrage classique.
export default function MenuImportReview({ items: initialItems, onSubmit, onCancel, submitting }) {
  const [items, setItems] = useState(() => initialItems.map((it, i) => ({ ...it, key: i, included: true })));

  function updateField(key, field, value) {
    setItems((prev) => prev.map((it) => (it.key === key ? { ...it, [field]: value } : it)));
  }

  function toggleIncluded(key) {
    setItems((prev) => prev.map((it) => (it.key === key ? { ...it, included: !it.included } : it)));
  }

  function removeRow(key) {
    setItems((prev) => prev.filter((it) => it.key !== key));
  }

  const includedCount = items.filter((it) => it.included).length;

  function submit() {
    const toSubmit = items
      .filter((it) => it.included)
      .map((it) => ({ name: it.name.trim(), price: parseFloat(it.price), category: it.category.trim() || 'plat', desc: it.desc.trim() }))
      .filter((it) => it.name && Number.isFinite(it.price) && it.price > 0);
    onSubmit(toSubmit);
  }

  return (
    <div>
      <p className="small" style={{ margin: '0 0 12px' }}>
        {items.length} plat(s) lu(s) dans le document — vérifie et corrige avant d'ajouter au menu (décoche ce que tu ne veux pas garder).
      </p>
      {items.map((it) => (
        <div key={it.key} className="card" style={{ marginBottom: 8, opacity: it.included ? 1 : 0.5, padding: 12 }}>
          <div className="row" style={{ gap: 8, alignItems: 'flex-start' }}>
            <input type="checkbox" style={{ width: 'auto', marginTop: 10 }} checked={it.included} onChange={() => toggleIncluded(it.key)} />
            <div style={{ flex: 1, display: 'grid', gap: 6 }}>
              <div className="row" style={{ gap: 8 }}>
                <input style={{ flex: 2 }} value={it.name} onChange={(e) => updateField(it.key, 'name', e.target.value)} placeholder="Nom du plat" />
                <input style={{ flex: 1 }} type="number" step="0.5" value={it.price} onChange={(e) => updateField(it.key, 'price', e.target.value)} placeholder="Prix" />
              </div>
              <div className="row" style={{ gap: 8 }}>
                <input style={{ flex: 1 }} value={it.category} onChange={(e) => updateField(it.key, 'category', e.target.value)} placeholder="Section (ex: Entrées)" />
                <input style={{ flex: 2 }} value={it.desc} onChange={(e) => updateField(it.key, 'desc', e.target.value)} placeholder="Description (optionnel)" />
              </div>
            </div>
            <button type="button" className="btn-danger-ghost" style={{ padding: '4px 8px', marginTop: 4 }} onClick={() => removeRow(it.key)} title="Retirer cette ligne">🗑️</button>
          </div>
        </div>
      ))}
      <div className="row" style={{ gap: 8, marginTop: 10 }}>
        <button className="btn-teal" disabled={submitting || includedCount === 0} onClick={submit}>
          {submitting ? '...' : `Ajouter ${includedCount} plat(s) au menu`}
        </button>
        <button className="btn-ghost" onClick={onCancel}>Annuler</button>
      </div>
    </div>
  );
}
