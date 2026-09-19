import { useState } from 'react';
import { useLanguage } from '../context/LanguageContext';

// Choix du client sur un plat (comme sur Uber Eats / Deliveroo) : un menu à composer (pain, viande, crudités,
// sauce, boisson, dessert), un « au choix », des suppléments payants. Forme manipulée, la même que celle
// envoyée à POST /:id/menu/bulk et gardée dans les brouillons :
//   [{ name, type: 'single'|'multiple', required, maxSelections: n|null, choices: [{ name, priceDelta }] }]
// Utilisé à la relecture d'un import (MenuImportReview) ; les modèles servent aussi à l'éditeur de groupes
// (OptionGroupManager) et à la fiche d'un plat (MenuItemRow) pour partir d'un groupe déjà rempli.

// Modèles de groupes, prêts à ajuster. Les libellés et les choix viennent des traductions
// (menuOptions.tpl_<cle> / menuOptions.tplChoices_<cle>, choix séparés par des virgules).
export const MODELES_GROUPES = [
  { cle: 'crudites', type: 'multiple', required: false, maxSelections: null },
  { cle: 'sauces', type: 'multiple', required: false, maxSelections: 2 },
  { cle: 'boisson', type: 'single', required: true, maxSelections: null },
  { cle: 'dessert', type: 'single', required: false, maxSelections: null },
  { cle: 'taille', type: 'single', required: true, maxSelections: null },
  { cle: 'cuisson', type: 'single', required: true, maxSelections: null },
  { cle: 'supplements', type: 'multiple', required: false, maxSelections: null }
];

export function groupeDepuisModele(m, t) {
  const choix = String(t(`menuOptions.tplChoices_${m.cle}`) || '').split(',').map((x) => x.trim()).filter(Boolean);
  return {
    name: t(`menuOptions.tpl_${m.cle}`),
    type: m.type,
    required: m.required,
    maxSelections: m.maxSelections,
    choices: choix.map((name) => ({ name, priceDelta: m.cle === 'supplements' ? 1 : 0 }))
  };
}

// Résumé d'un groupe en une ligne : « Sauce · 1 choix · obligatoire · 6 choix ».
export function resumeGroupe(g, t) {
  const mode = g.type === 'single' ? t('menuOptions.one') : g.maxSelections ? t('menuOptions.upTo', { n: g.maxSelections }) : t('menuOptions.several');
  return `${g.name} · ${mode} · ${g.required ? t('menuOptions.required') : t('menuOptions.optional')} · ${t('menuOptions.nChoices', { n: (g.choices || []).length })}`;
}

const eur = (v) => `${Number(v) > 0 ? '+' : ''}${Number(v).toFixed(2).replace('.', ',')} €`;

function GroupeForm({ groupe, onChange, onRemove, t }) {
  const set = (champ, valeur) => onChange({ ...groupe, [champ]: valeur });
  const setChoix = (i, champ, valeur) => onChange({ ...groupe, choices: groupe.choices.map((c, k) => (k === i ? { ...c, [champ]: valeur } : c)) });
  return (
    <div className="card" style={{ padding: 10, marginBottom: 8, background: 'var(--cream-dim)' }}>
      <div className="row" style={{ gap: 8, flexWrap: 'wrap', alignItems: 'center' }}>
        <input style={{ flex: '2 1 160px' }} value={groupe.name} onChange={(e) => set('name', e.target.value)} placeholder={t('menuOptions.groupName')} aria-label={t('menuOptions.groupName')} />
        <select style={{ flex: '1 1 140px' }} value={groupe.type} onChange={(e) => set('type', e.target.value)} aria-label={t('menuOptions.type')}>
          <option value="single">{t('menuOptions.single')}</option>
          <option value="multiple">{t('menuOptions.multiple')}</option>
        </select>
        <label className="row" style={{ gap: 6, cursor: 'pointer', flex: '0 0 auto' }}>
          <input type="checkbox" style={{ width: 'auto' }} checked={!!groupe.required} onChange={(e) => set('required', e.target.checked)} />
          <span className="small">{t('menuOptions.required')}</span>
        </label>
        {groupe.type === 'multiple' && (
          <label className="row" style={{ gap: 6, flex: '0 0 auto' }}>
            <span className="small">{t('menuOptions.max')}</span>
            <input type="number" min="1" step="1" style={{ width: 70 }} value={groupe.maxSelections || ''} onChange={(e) => set('maxSelections', parseInt(e.target.value, 10) || null)} placeholder={t('menuOptions.unlimited')} aria-label={t('menuOptions.max')} />
          </label>
        )}
        <button type="button" className="btn-danger-ghost" style={{ padding: '4px 8px', marginLeft: 'auto' }} onClick={onRemove} title={t('menuOptions.removeGroup')}>🗑️</button>
      </div>
      <div style={{ marginTop: 8, display: 'grid', gap: 4 }}>
        {groupe.choices.map((c, i) => (
          <div key={i} className="row" style={{ gap: 6 }}>
            <input style={{ flex: 2 }} value={c.name} onChange={(e) => setChoix(i, 'name', e.target.value)} placeholder={t('menuOptions.choiceName')} aria-label={t('menuOptions.choices')} />
            <input style={{ flex: '0 0 110px' }} type="number" step="0.5" value={c.priceDelta} onChange={(e) => setChoix(i, 'priceDelta', e.target.value)} placeholder={t('menuOptions.delta')} aria-label={t('menuOptions.delta')} />
            <button type="button" className="btn-ghost" style={{ padding: '2px 8px' }} onClick={() => onChange({ ...groupe, choices: groupe.choices.filter((_, k) => k !== i) })} aria-label={t('menuOptions.removeChoice')}>✕</button>
          </div>
        ))}
        <button type="button" className="btn-ghost" style={{ justifySelf: 'start', padding: '4px 10px', fontSize: 13 }} onClick={() => onChange({ ...groupe, choices: [...groupe.choices, { name: '', priceDelta: 0 }] })}>{t('menuOptions.addChoice')}</button>
      </div>
    </div>
  );
}

// Nettoyage avant envoi : mêmes règles que le serveur (nettoyerOptions dans menuImport.js).
export function nettoyerOptionsClient(options) {
  return (options || [])
    .map((g) => ({
      name: String(g.name || '').trim(),
      type: g.type === 'single' ? 'single' : 'multiple',
      required: !!g.required,
      maxSelections: g.type === 'multiple' && Number(g.maxSelections) > 0 ? Number(g.maxSelections) : null,
      choices: (g.choices || []).map((c) => ({ name: String(c.name || '').trim(), priceDelta: Number(c.priceDelta) || 0 })).filter((c) => c.name)
    }))
    .filter((g) => g.name && g.choices.length);
}

export default function OptionsEditor({ options = [], onChange, compact = true }) {
  const { t } = useLanguage();
  const [ouvert, setOuvert] = useState(!compact);
  const groupes = options;
  const setGroupe = (i, g) => onChange(groupes.map((x, k) => (k === i ? g : x)));
  const ajouter = (g) => { onChange([...groupes, g]); setOuvert(true); };
  return (
    <div className="options-editor">
      <div className="row" style={{ gap: 8, alignItems: 'center', flexWrap: 'wrap' }}>
        <span className="small" style={{ fontWeight: 700 }}>🧩 {t('menuOptions.title')}</span>
        {groupes.length === 0 && <span className="small" style={{ opacity: 0.75 }}>{t('menuOptions.summaryNone')}</span>}
        <button type="button" className="btn-ghost" style={{ padding: '2px 10px', fontSize: 12, marginLeft: 'auto' }} onClick={() => setOuvert((o) => !o)}>
          {ouvert ? t('menuOptions.close') : t('menuOptions.edit')}
        </button>
      </div>
      {!ouvert && groupes.length > 0 && (
        <ul className="small" style={{ margin: '4px 0 0', paddingLeft: 18 }}>
          {groupes.map((g, i) => (
            <li key={i}>{resumeGroupe(g, t)}{g.choices?.length ? ` — ${g.choices.slice(0, 6).map((c) => (Number(c.priceDelta) ? `${c.name} (${eur(c.priceDelta)})` : c.name)).join(', ')}${g.choices.length > 6 ? '…' : ''}` : ''}</li>
          ))}
        </ul>
      )}
      {ouvert && (
        <div style={{ marginTop: 8 }}>
          <p className="small" style={{ margin: '0 0 8px', opacity: 0.85 }}>{t('menuOptions.hint')}</p>
          {groupes.map((g, i) => (
            <GroupeForm key={i} groupe={g} t={t} onChange={(ng) => setGroupe(i, ng)} onRemove={() => onChange(groupes.filter((_, k) => k !== i))} />
          ))}
          <div className="row" style={{ gap: 6, flexWrap: 'wrap', alignItems: 'center' }}>
            <span className="small">{t('menuOptions.addFromTemplate')}</span>
            {MODELES_GROUPES.map((m) => (
              <button key={m.cle} type="button" className="chip" onClick={() => ajouter(groupeDepuisModele(m, t))}>{t(`menuOptions.tpl_${m.cle}`)}</button>
            ))}
            <button type="button" className="btn-ghost" style={{ padding: '4px 10px', fontSize: 13 }} onClick={() => ajouter({ name: '', type: 'single', required: true, maxSelections: null, choices: [{ name: '', priceDelta: 0 }] })}>{t('menuOptions.addGroup')}</button>
          </div>
        </div>
      )}
    </div>
  );
}
