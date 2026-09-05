import { useEffect, useState } from 'react';
import { categoryEmoji, suggestItemImages } from '../menuCategories';
import GalleryPickerModal from './GalleryPickerModal';
import RestaurantPreview from './RestaurantPreview';
import { useLanguage } from '../context/LanguageContext';

function draftKeyFor(restoId) {
  return `fairide_menu_import_draft_${restoId}`;
}

// Relit un brouillon sauvegardé (voir l'effet de sauvegarde plus bas) — un restaurateur qui rafraîchit
// la page en pleine relecture (ou revient dessus plus tard) retombe exactement là où il en était, avec
// toutes ses modifications (plats renommés/décochés, photos choisies, sous-sections) plutôt que de tout
// perdre et repartir de l'écran "+ Choisir un fichier" vide.
function loadDraft(restoId) {
  try {
    const raw = sessionStorage.getItem(draftKeyFor(restoId));
    return raw ? JSON.parse(raw) : null;
  } catch {
    return null;
  }
}

// Relecture des plats extraits d'un PDF/photo de menu par l'IA avant tout ajout réel — chaque champ
// reste modifiable (l'IA peut se tromper sur un prix mal imprimé ou une catégorie ambiguë) et chaque
// ligne peut être décochée, exactement comme pour un template de démarrage classique.
export default function MenuImportReview({ items: initialItems, existingItemCount, restoId, restaurant, onSubmit, onCancel, submitting }) {
  const { t } = useLanguage();
  const [items, setItems] = useState(() => {
    const draft = loadDraft(restoId);
    if (draft?.items) return draft.items;
    return initialItems.map((it, i) => ({
      ...it,
      subsection: it.subsection || '',
      key: i,
      included: true,
      // Jamais de photo auto-assignée sur un plat importé d'un document — même en cas de correspondance
      // exacte, mieux vaut laisser le restaurateur choisir lui-même (voir GalleryPickerModal plus bas, qui
      // propose sa galerie déjà en ligne + quelques suggestions) que de remplir silencieusement le menu.
      imageUrl: ''
    }));
  });
  // Par défaut on ajoute aux plats existants — remplacer est une action destructive (supprime tout le
  // menu actuel), donc jamais le choix pré-sélectionné, même quand le resto n'a encore aucun plat.
  const [mode, setMode] = useState(() => loadDraft(restoId)?.mode || 'append');
  const [pickerKey, setPickerKey] = useState(null);
  const [previewOpen, setPreviewOpen] = useState(false);
  const [confirmOpen, setConfirmOpen] = useState(false);

  useEffect(() => {
    sessionStorage.setItem(draftKeyFor(restoId), JSON.stringify({ items, mode }));
  }, [items, mode, restoId]);

  function discardDraft() {
    sessionStorage.removeItem(draftKeyFor(restoId));
  }

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
  const pickerItem = items.find((it) => it.key === pickerKey);

  function submit() {
    setConfirmOpen(false);
    const toSubmit = items
      .filter((it) => it.included)
      .map((it) => ({ name: it.name.trim(), price: parseFloat(it.price), category: it.category.trim() || 'plat', subsection: it.subsection.trim(), desc: it.desc.trim(), imageUrl: it.imageUrl }))
      .filter((it) => it.name && Number.isFinite(it.price) && it.price > 0);
    discardDraft();
    onSubmit(toSubmit, mode === 'replace');
  }

  function cancel() {
    discardDraft();
    onCancel();
  }

  if (previewOpen) {
    const orderedCategories = [];
    items.filter((it) => it.included).forEach((it) => {
      const cat = it.category.trim() || 'plat';
      if (!orderedCategories.includes(cat)) orderedCategories.push(cat);
    });
    const draftRestaurant = {
      ...restaurant,
      menu: items.filter((it) => it.included).map((it) => ({
        id: `draft-${it.key}`,
        name: it.name,
        price: parseFloat(it.price) || 0,
        desc: it.desc,
        category: it.category.trim() || 'plat',
        subsection: it.subsection,
        imageUrl: it.imageUrl,
        available: true,
        optionGroups: []
      })),
      sections: orderedCategories.map((name, i) => ({ id: `draft-sec-${i}`, name }))
    };
    return (
      <div>
        <button type="button" className="btn-ghost" style={{ marginBottom: 10 }} onClick={() => setPreviewOpen(false)}>{t('menuImport.backToReview')}</button>
        <RestaurantPreview restaurant={draftRestaurant} />
      </div>
    );
  }

  return (
    <div>
      <div className="row" style={{ gap: 8, justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 12 }}>
        <p className="small" style={{ margin: 0 }}>
          {t('menuImport.readIntro', { n: items.length })}
        </p>
        <button type="button" className="btn-outline" style={{ flexShrink: 0, whiteSpace: 'nowrap' }} onClick={() => setPreviewOpen(true)}>
          {t('menuImport.customerPreview')}
        </button>
      </div>
      {existingItemCount > 0 && (
        <div className="field" style={{ marginBottom: 14 }}>
          <label>{t('menuImport.whatAboutExisting', { n: existingItemCount })}</label>
          <div className="role-pick" style={{ marginBottom: 0 }}>
            <div className={`chip${mode === 'append' ? ' active' : ''}`} onClick={() => setMode('append')}>
              {t('menuImport.keepAndAdd')}
            </div>
            <div className={`chip${mode === 'replace' ? ' active' : ''}`} onClick={() => setMode('replace')}>
              {t('menuImport.replaceWithDoc')}
            </div>
          </div>
          {mode === 'replace' && (
            <p className="small" style={{ color: 'var(--red)', margin: '8px 0 0' }}>
              {t('menuImport.replaceWarn', { n: existingItemCount })}
            </p>
          )}
        </div>
      )}
      <div className="card" style={{ marginBottom: 8, padding: 12, border: '1px dashed var(--line)', background: 'var(--cream-dim)' }}>
        <div className="row" style={{ gap: 8, alignItems: 'flex-start' }}>
          <span className="small" style={{ fontWeight: 700, marginTop: 10, flexShrink: 0 }}>{t('menuImport.example')}</span>
          <span className="dish-thumb-empty">🍽️</span>
          <div style={{ flex: 1, display: 'grid', gap: 6 }}>
            <div className="row" style={{ gap: 8 }}>
              <input style={{ flex: 2 }} disabled placeholder={t('menuImport.phName')} />
              <input style={{ flex: 1 }} disabled placeholder={t('menuImport.phPrice')} />
            </div>
            <div className="row" style={{ gap: 8 }}>
              <input style={{ flex: 1 }} disabled placeholder={t('menuImport.phSection')} />
              <input style={{ flex: 1 }} disabled placeholder={t('menuImport.phSubsection')} />
            </div>
            <input disabled placeholder={t('menuImport.phDescription')} />
          </div>
        </div>
        <p className="small" style={{ margin: '10px 0 0' }}>
          {t('menuImport.the')} <b>section</b> {t('menuImport.sectionExplain')} <b>sous-section</b> {t('menuImport.subsectionExplain')} <b>{t('menuImport.exSauces')}</b> ou <b>{t('menuImport.exCrudites')}</b> {t('menuImport.inMains')} <b>{t('menuImport.exHot')}</b> / <b>{t('menuImport.exCold')}</b> / <b>{t('menuImport.exAlcohol')}</b> {t('menuImport.inDrinks')}
        </p>
      </div>
      {items.map((it) => (
        <div key={it.key} className="card" style={{ marginBottom: 8, opacity: it.included ? 1 : 0.5, padding: 12 }}>
          <div className="row" style={{ gap: 8, alignItems: 'flex-start' }}>
            <input type="checkbox" style={{ width: 'auto', marginTop: 10 }} checked={it.included} onChange={() => toggleIncluded(it.key)} />
            <button
              type="button"
              onClick={() => setPickerKey(it.key)}
              title={it.imageUrl ? t('menuImport.changePhoto') : t('menuImport.choosePhotoNone')}
              style={{ flexShrink: 0, padding: 0, border: 'none', background: 'none', cursor: 'pointer' }}
            >
              {it.imageUrl ? (
                <img loading="lazy" src={it.imageUrl} alt="" className="dish-thumb" />
              ) : (
                <span className="dish-thumb-empty">{categoryEmoji(it.category)}</span>
              )}
            </button>
            <div style={{ flex: 1, display: 'grid', gap: 6 }}>
              <div className="row" style={{ gap: 8 }}>
                <input style={{ flex: 2 }} value={it.name} onChange={(e) => updateField(it.key, 'name', e.target.value)} placeholder={t('menuImport.phName')} />
                <input style={{ flex: 1 }} type="number" step="0.5" value={it.price} onChange={(e) => updateField(it.key, 'price', e.target.value)} placeholder={t('menuImport.phPrice')} />
              </div>
              <div className="row" style={{ gap: 8 }}>
                <input style={{ flex: 1 }} value={it.category} onChange={(e) => updateField(it.key, 'category', e.target.value)} placeholder={t('menuImport.phSectionShort')} />
                <input style={{ flex: 1 }} value={it.subsection} onChange={(e) => updateField(it.key, 'subsection', e.target.value)} placeholder={t('menuImport.phSubsectionShort')} />
              </div>
              <input value={it.desc} onChange={(e) => updateField(it.key, 'desc', e.target.value)} placeholder={t('menuImport.phDescription')} />
            </div>
            <button type="button" className="btn-danger-ghost" style={{ padding: '4px 8px', marginTop: 4 }} onClick={() => removeRow(it.key)} title={t('menuImport.removeLine')}>🗑️</button>
          </div>
        </div>
      ))}
      <div className="row" style={{ gap: 8, marginTop: 10 }}>
        <button className={mode === 'replace' ? 'btn-danger' : 'btn-teal'} disabled={submitting || includedCount === 0} onClick={() => setConfirmOpen(true)}>
          {submitting ? '...' : mode === 'replace' ? t('menuImport.replaceMenuBtn', { n: includedCount }) : t('menuImport.addDishesBtn', { n: includedCount })}
        </button>
        <button className="btn-ghost" onClick={cancel}>{t('menuImport.cancel')}</button>
      </div>
      {confirmOpen && (
        <div className="modal-overlay" onClick={() => setConfirmOpen(false)}>
          <div className="modal-box" onClick={(e) => e.stopPropagation()}>
            <h3 style={{ margin: '0 0 10px', fontSize: 16 }}>
              {mode === 'replace' ? t('menuImport.replaceConfirmTitle') : t('menuImport.addConfirmTitle')}
            </h3>
            <p className="small" style={{ margin: '0 0 16px' }}>
              {mode === 'replace'
                ? t('menuImport.replaceConfirmBody', { existing: existingItemCount, n: includedCount })
                : existingItemCount > 0
                ? t('menuImport.addConfirmBodyExisting', { existing: existingItemCount, n: includedCount })
                : t('menuImport.addConfirmBody', { n: includedCount })}
            </p>
            <div className="row" style={{ gap: 8 }}>
              <button className={mode === 'replace' ? 'btn-danger' : 'btn-teal'} disabled={submitting} onClick={submit}>
                {submitting ? '...' : mode === 'replace' ? 'Oui, remplacer' : 'Oui, ajouter'}
              </button>
              <button className="btn-ghost" disabled={submitting} onClick={() => setConfirmOpen(false)}>{t('menuImport.cancel')}</button>
            </div>
          </div>
        </div>
      )}
      {pickerItem && (
        <GalleryPickerModal
          restoId={restoId}
          currentImageUrl={pickerItem.imageUrl}
          suggestions={suggestItemImages(pickerItem)}
          suggestionsTitle={t('menuImport.suggestedForDish')}
          title={t('menuImport.photoOf', { name: pickerItem.name || t('menuImport.thisDish') })}
          onSelect={(url) => { updateField(pickerKey, 'imageUrl', url); setPickerKey(null); }}
          onCancel={() => setPickerKey(null)}
        />
      )}
    </div>
  );
}
