import { useState, useId } from 'react';
import { useLanguage } from '../context/LanguageContext';
import { MODELES_GROUPES, groupeDepuisModele } from './OptionsEditor';

function emptyItem() {
  return { name: '', priceDelta: '0' };
}

export function OptionGroupForm({ initial, onSave, onCancel, saving }) {
  // Identifiants d'etiquette : useId donne une valeur par instance, donc pas de collision
  // quand ce composant est rendu plusieurs fois sur la meme page.
  const idsA11y = useId();
  const { t } = useLanguage();
  const [name, setName] = useState(initial?.name || '');
  const [type, setType] = useState(initial?.type || 'multiple');
  const [required, setRequired] = useState(initial?.required || false);
  const [maxSelections, setMaxSelections] = useState(initial?.maxSelections ? String(initial.maxSelections) : '');
  const [items, setItems] = useState(
    initial?.items?.length ? initial.items.map((i) => ({ name: i.name, priceDelta: String(i.priceDelta) })) : [emptyItem()]
  );

  function setItemField(idx, field, value) {
    setItems((prev) => prev.map((it, i) => (i === idx ? { ...it, [field]: value } : it)));
  }

  function addRow() {
    setItems((prev) => [...prev, emptyItem()]);
  }

  function removeRow(idx) {
    setItems((prev) => prev.filter((_, i) => i !== idx));
  }

  // Un modèle remplit tout d'un coup (nom, type, obligation, choix) : le restaurateur ajuste ensuite.
  function appliquerModele(m) {
    const g = groupeDepuisModele(m, t);
    setName(g.name); setType(g.type); setRequired(g.required); setMaxSelections(g.maxSelections ? String(g.maxSelections) : '');
    setItems(g.choices.map((c) => ({ name: c.name, priceDelta: String(c.priceDelta) })));
  }

  function save() {
    const cleanItems = items
      .filter((it) => it.name.trim())
      .map((it) => ({ name: it.name.trim(), priceDelta: parseFloat(it.priceDelta) || 0 }));
    if (!name.trim() || !cleanItems.length) return;
    const maxSel = type === 'multiple' ? parseInt(maxSelections, 10) || null : null;
    onSave({ name: name.trim(), type, required, maxSelections: maxSel, items: cleanItems });
  }

  return (
    <div className="card" style={{ marginBottom: 10 }}>
      {!initial && (
        <div className="row" style={{ gap: 6, flexWrap: 'wrap', alignItems: 'center', marginBottom: 10 }}>
          <span className="small">{t('menuOptions.addFromTemplate')}</span>
          {MODELES_GROUPES.map((m) => (
            <button key={m.cle} type="button" className="chip" onClick={() => appliquerModele(m)}>{t(`menuOptions.tpl_${m.cle}`)}</button>
          ))}
        </div>
      )}
      <div className="field"><label htmlFor={idsA11y + '-groupname'}>{t('optionGroups.groupName')}</label><input id={idsA11y + '-groupname'} value={name} onChange={(e) => setName(e.target.value)} placeholder={t('optionGroups.phGroupName')} /></div>
      <div className="field">
        <label htmlFor={idsA11y + '-type'}>{t('optionGroups.type')}</label>
        <select id={idsA11y + '-type'} value={type} onChange={(e) => setType(e.target.value)}>
          <option value="multiple">{t('optionGroups.multiple')}</option>
          <option value="single">{t('optionGroups.single')}</option>
        </select>
      </div>
      <label className="row" style={{ gap: 8, marginBottom: 12, cursor: 'pointer' }}>
        <input type="checkbox" style={{ width: 'auto' }} checked={required} onChange={(e) => setRequired(e.target.checked)} />
        <span className="small">{t('optionGroups.required')}</span>
      </label>
      {type === 'multiple' && (
        <div className="field">
          <label htmlFor={idsA11y + '-maxchoices'}>{t('optionGroups.maxChoices')}</label>
          <input id={idsA11y + '-maxchoices'} type="number" min="1" step="1" value={maxSelections} onChange={(e) => setMaxSelections(e.target.value)} placeholder={t('optionGroups.phUnlimited')} />
        </div>
      )}
      <label className="small" style={{ display: 'block', marginBottom: 6 }} htmlFor={idsA11y + '-options'}>{t('optionGroups.options')}</label>
      {items.map((it, idx) => (
        <div className="row" key={idx} style={{ gap: 8, marginBottom: 6 }}>
          <input id={idsA11y + '-options'} style={{ flex: 2 }} value={it.name} onChange={(e) => setItemField(idx, 'name', e.target.value)} placeholder={t('optionGroups.phOption')} />
          <input style={{ flex: 1 }} type="number" step="0.5" value={it.priceDelta} onChange={(e) => setItemField(idx, 'priceDelta', e.target.value)} placeholder="+1.00" />
          <button type="button" className="btn-danger-ghost" style={{ padding: '4px 10px' }} onClick={() => removeRow(idx)} disabled={items.length <= 1}>✕</button>
        </div>
      ))}
      <button type="button" className="btn-ghost" style={{ marginBottom: 12 }} onClick={addRow}>{t('optionGroups.addOption')}</button>
      <div className="row" style={{ gap: 8 }}>
        <button className="btn-teal" disabled={saving} onClick={save}>{saving ? '...' : 'Enregistrer'}</button>
        <button className="btn-ghost" onClick={onCancel}>{t('optionGroups.cancel')}</button>
      </div>
    </div>
  );
}

export default function OptionGroupManager({ groups, onCreate, onUpdate, onDelete }) {
  const { t } = useLanguage();
  const [creating, setCreating] = useState(false);
  const [editingId, setEditingId] = useState(null);
  const [saving, setSaving] = useState(false);

  async function handleCreate(payload) {
    setSaving(true);
    try {
      await onCreate(payload);
      setCreating(false);
    } finally {
      setSaving(false);
    }
  }

  async function handleUpdate(groupId, payload) {
    setSaving(true);
    try {
      await onUpdate(groupId, payload);
      setEditingId(null);
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="card">
      <h3 style={{ margin: '0 0 6px', fontSize: 15 }}>{t('optionGroups.title')}</h3>
      <p className="small" style={{ margin: '0 0 10px' }}>
        {t('optionGroups.intro')}
      </p>
      {groups.length === 0 && !creating && <div className="small" style={{ marginBottom: 10 }}>{t('optionGroups.none')}</div>}
      {groups.map((g) => (
        editingId === g.id ? (
          <OptionGroupForm
            key={g.id}
            initial={g}
            saving={saving}
            onSave={(payload) => handleUpdate(g.id, payload)}
            onCancel={() => setEditingId(null)}
          />
        ) : (
          <div key={g.id} style={{ borderBottom: '1px solid var(--cream-dim)', padding: '8px 0' }}>
            <div className="row" style={{ justifyContent: 'space-between' }}>
              <span>
                <b>{g.name}</b>{' '}
                <span className="small">({g.type === 'single' ? t('optionGroups.singleShort') : g.maxSelections ? t('optionGroups.maxShort', { n: g.maxSelections }) : t('optionGroups.multipleShort')}{g.required ? t('optionGroups.requiredShort') : ''})</span>
              </span>
              <div className="row" style={{ gap: 6 }}>
                <button className="btn-ghost" onClick={() => setEditingId(g.id)}>✏️</button>
                <button className="btn-danger-ghost" onClick={() => onDelete(g.id)}>{t('optionGroups.delete')}</button>
              </div>
            </div>
            <div className="small" style={{ marginTop: 4 }}>
              {g.items.map((i) => `${i.name} (${i.priceDelta > 0 ? '+' : ''}${i.priceDelta.toFixed(2)}€)`).join(', ')}
            </div>
          </div>
        )
      ))}
      {creating && (
        <OptionGroupForm saving={saving} onSave={handleCreate} onCancel={() => setCreating(false)} />
      )}
      {!creating && (
        <button type="button" className="btn-ghost" style={{ marginTop: 10 }} onClick={() => setCreating(true)}>{t('optionGroups.createGroup')}</button>
      )}
    </div>
  );
}
