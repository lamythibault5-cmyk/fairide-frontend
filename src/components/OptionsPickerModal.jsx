import { useState } from 'react';
import { createPortal } from 'react-dom';

export default function OptionsPickerModal({ item, onConfirm, onCancel }) {
  const groups = item.optionGroups || [];
  const [selections, setSelections] = useState(() => {
    const init = {};
    groups.forEach((g) => { init[g.id] = new Set(); });
    return init;
  });

  function selectSingle(groupId, optionId) {
    setSelections((prev) => ({ ...prev, [groupId]: new Set([optionId]) }));
  }

  function toggleMultiple(groupId, optionId, maxSelections) {
    setSelections((prev) => {
      const next = new Set(prev[groupId]);
      if (next.has(optionId)) {
        next.delete(optionId);
      } else {
        if (maxSelections && next.size >= maxSelections) return prev;
        next.add(optionId);
      }
      return { ...prev, [groupId]: next };
    });
  }

  const missingRequired = groups.filter((g) => g.required && selections[g.id].size === 0);

  let delta = 0;
  const snapshot = [];
  const optionItemIds = [];
  groups.forEach((g) => {
    g.items.forEach((i) => {
      if (selections[g.id].has(i.id)) {
        delta += i.priceDelta;
        snapshot.push({ groupName: g.name, name: i.name, priceDelta: i.priceDelta });
        optionItemIds.push(i.id);
      }
    });
  });
  const unitPrice = +(item.price + delta).toFixed(2);

  return createPortal(
    <div className="modal-overlay" onClick={onCancel}>
      <div className="modal-box" onClick={(e) => e.stopPropagation()}>
        <h3 style={{ margin: '0 0 4px' }}>{item.name}</h3>
        {item.desc && <p className="small" style={{ margin: '0 0 10px' }}>{item.desc}</p>}
        {groups.map((g) => (
          <div key={g.id} style={{ marginBottom: 14 }}>
            <div className="row" style={{ justifyContent: 'space-between', marginBottom: 6 }}>
              <b style={{ fontSize: 14 }}>{g.name}</b>
              {g.required && <span className="small" style={{ color: 'var(--red)' }}>Obligatoire</span>}
            </div>
            {g.type === 'multiple' && g.maxSelections && (
              <p className="small" style={{ margin: '0 0 6px', opacity: 0.75 }}>Choisis jusqu'à {g.maxSelections} option{g.maxSelections > 1 ? 's' : ''}.</p>
            )}
            {g.items.map((i) => {
              const atMax = g.type === 'multiple' && g.maxSelections && selections[g.id].size >= g.maxSelections && !selections[g.id].has(i.id);
              return (
                <label key={i.id} className="row" style={{ justifyContent: 'space-between', gap: 8, marginBottom: 4, cursor: atMax ? 'default' : 'pointer', opacity: atMax ? 0.5 : 1 }}>
                  <span className="row" style={{ gap: 8 }}>
                    <input
                      type={g.type === 'single' ? 'radio' : 'checkbox'}
                      style={{ width: 'auto' }}
                      name={g.type === 'single' ? g.id : undefined}
                      checked={selections[g.id].has(i.id)}
                      disabled={atMax}
                      onChange={() => (g.type === 'single' ? selectSingle(g.id, i.id) : toggleMultiple(g.id, i.id, g.maxSelections))}
                    />
                    <span>{i.name}</span>
                  </span>
                  {i.priceDelta !== 0 && <span className="small">{i.priceDelta > 0 ? '+' : ''}{i.priceDelta.toFixed(2)}€</span>}
                </label>
              );
            })}
          </div>
        ))}
        <div className="divider" />
        <div className="row" style={{ justifyContent: 'space-between', marginBottom: 12 }}>
          <span>Prix</span>
          <b>{unitPrice.toFixed(2)}€</b>
        </div>
        <div className="row" style={{ gap: 8 }}>
          <button className="btn-gold" disabled={missingRequired.length > 0} onClick={() => onConfirm(optionItemIds, snapshot, unitPrice)}>
            Ajouter au panier
          </button>
          <button className="btn-ghost" onClick={onCancel}>Annuler</button>
        </div>
      </div>
    </div>,
    document.body
  );
}
