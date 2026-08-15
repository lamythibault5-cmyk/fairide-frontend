import { useState } from 'react';
import { categoryLabel } from '../menuCategories';
import { useLanguage } from '../context/LanguageContext';

function itemKey(category, name) {
  return `${category}::${name}`;
}

function allKeysFor(template) {
  const s = new Set();
  Object.entries(template).forEach(([cat, items]) => items.forEach((it) => s.add(itemKey(cat, it.name))));
  return s;
}

// Sélecteur de plats type par section — le restaurateur coche/décoche individuellement chaque plat
// suggéré (regroupés par section, avec un "tout cocher" par section) avant de les ajouter à son menu.
// Réutilisé pour le menu de démarrage (création du resto) et pour "piocher d'autres plats types" plus
// tard, avec les mêmes contrôles.
export default function TemplatePicker({ template, quickItems, onSubmit, onCancel, submitting, submitLabel }) {
  const { t } = useLanguage();
  const [selected, setSelected] = useState(() => allKeysFor(template));

  function toggle(key) {
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(key)) next.delete(key); else next.add(key);
      return next;
    });
  }

  function toggleSection(cat, items, checked) {
    setSelected((prev) => {
      const next = new Set(prev);
      items.forEach((it) => {
        const k = itemKey(cat, it.name);
        if (checked) next.add(k); else next.delete(k);
      });
      return next;
    });
  }

  function selectAll() { setSelected(allKeysFor(template)); }
  function selectNone() { setSelected(new Set()); }
  function selectQuick() {
    if (!quickItems) return;
    setSelected(new Set(quickItems.map((it) => itemKey(it.category, it.name))));
  }

  function submit() {
    const items = [];
    Object.entries(template).forEach(([cat, list]) => {
      list.forEach((it) => { if (selected.has(itemKey(cat, it.name))) items.push({ ...it, category: cat }); });
    });
    onSubmit(items);
  }

  return (
    <div>
      <div className="row" style={{ gap: 8, marginBottom: 12, flexWrap: 'wrap' }}>
        <button type="button" className="btn-ghost" onClick={selectAll}>Tout sélectionner</button>
        {quickItems && <button type="button" className="btn-ghost" onClick={selectQuick}>Essentiels seulement ({quickItems.length})</button>}
        <button type="button" className="btn-ghost" onClick={selectNone}>Tout désélectionner</button>
      </div>
      {Object.entries(template).map(([cat, items]) => {
        if (!items.length) return null;
        const allChecked = items.every((it) => selected.has(itemKey(cat, it.name)));
        return (
          <div key={cat} style={{ marginBottom: 14 }}>
            <label className="row" style={{ gap: 8, cursor: 'pointer', marginBottom: 6, fontWeight: 700 }}>
              <input type="checkbox" style={{ width: 'auto' }} checked={allChecked} onChange={(e) => toggleSection(cat, items, e.target.checked)} />
              <span>{categoryLabel(cat, t)} ({items.length})</span>
            </label>
            {items.map((it) => (
              <label key={it.name} className="row" style={{ gap: 8, marginLeft: 24, marginBottom: 4, cursor: 'pointer' }}>
                <input type="checkbox" style={{ width: 'auto' }} checked={selected.has(itemKey(cat, it.name))} onChange={() => toggle(itemKey(cat, it.name))} />
                <span className="small">{it.name} — {it.price.toFixed(2)}€</span>
              </label>
            ))}
          </div>
        );
      })}
      <div className="row" style={{ gap: 8, marginTop: 10 }}>
        <button className="btn-teal" disabled={submitting || selected.size === 0} onClick={submit}>
          {submitting ? '...' : (submitLabel || `Ajouter ${selected.size} plat(s) au menu`)}
        </button>
        <button className="btn-ghost" onClick={onCancel}>Annuler</button>
      </div>
    </div>
  );
}
