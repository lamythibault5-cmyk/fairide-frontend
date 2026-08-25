import { useState } from 'react';
import { suggestItemImages } from '../menuCategories';
import GalleryPickerModal from './GalleryPickerModal';
import RestaurantPreview from './RestaurantPreview';

// Relecture des plats extraits d'un PDF/photo de menu par l'IA avant tout ajout réel — chaque champ
// reste modifiable (l'IA peut se tromper sur un prix mal imprimé ou une catégorie ambiguë) et chaque
// ligne peut être décochée, exactement comme pour un template de démarrage classique.
export default function MenuImportReview({ items: initialItems, existingItemCount, restoId, restaurant, onSubmit, onCancel, submitting }) {
  const [items, setItems] = useState(() => initialItems.map((it, i) => ({
    ...it,
    subsection: it.subsection || '',
    key: i,
    included: true,
    // Jamais de photo auto-assignée sur un plat importé d'un document — même en cas de correspondance
    // exacte, mieux vaut laisser le restaurateur choisir lui-même (voir GalleryPickerModal plus bas, qui
    // propose sa galerie déjà en ligne + quelques suggestions) que de remplir silencieusement le menu.
    imageUrl: ''
  })));
  // Par défaut on ajoute aux plats existants — remplacer est une action destructive (supprime tout le
  // menu actuel), donc jamais le choix pré-sélectionné, même quand le resto n'a encore aucun plat.
  const [mode, setMode] = useState('append');
  const [pickerKey, setPickerKey] = useState(null);
  const [previewOpen, setPreviewOpen] = useState(false);

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
    const toSubmit = items
      .filter((it) => it.included)
      .map((it) => ({ name: it.name.trim(), price: parseFloat(it.price), category: it.category.trim() || 'plat', subsection: it.subsection.trim(), desc: it.desc.trim(), imageUrl: it.imageUrl }))
      .filter((it) => it.name && Number.isFinite(it.price) && it.price > 0);
    onSubmit(toSubmit, mode === 'replace');
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
        <button type="button" className="btn-ghost" style={{ marginBottom: 10 }} onClick={() => setPreviewOpen(false)}>← Retour à la relecture</button>
        <RestaurantPreview restaurant={draftRestaurant} />
      </div>
    );
  }

  return (
    <div>
      <div className="row" style={{ gap: 8, justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 12 }}>
        <p className="small" style={{ margin: 0 }}>
          {items.length} plat(s) lu(s) dans le document — vérifie et corrige avant d'ajouter au menu (décoche ce que tu ne veux pas garder). Aucune photo n'est ajoutée automatiquement : tu peux en choisir une pour chaque plat en cliquant sur sa vignette — les photos déjà présentes dans ta galerie y sont directement disponibles.
        </p>
        <button type="button" className="btn-outline" style={{ flexShrink: 0, whiteSpace: 'nowrap' }} onClick={() => setPreviewOpen(true)}>
          👁️ Aperçu client
        </button>
      </div>
      {existingItemCount > 0 && (
        <div className="field" style={{ marginBottom: 14 }}>
          <label>Que faire des {existingItemCount} plat(s) déjà dans ton menu ?</label>
          <div className="role-pick" style={{ marginBottom: 0 }}>
            <div className={`chip${mode === 'append' ? ' active' : ''}`} onClick={() => setMode('append')}>
              Garder et tout ajouter
            </div>
            <div className={`chip${mode === 'replace' ? ' active' : ''}`} onClick={() => setMode('replace')}>
              Remplacer par ce document
            </div>
          </div>
          {mode === 'replace' && (
            <p className="small" style={{ color: 'var(--red)', margin: '8px 0 0' }}>
              ⚠️ Les {existingItemCount} plat(s) actuel(s) de ton menu seront définitivement supprimés et remplacés par la sélection ci-dessous.
            </p>
          )}
        </div>
      )}
      <div className="card" style={{ marginBottom: 8, padding: 12, border: '1px dashed var(--line)', background: 'var(--cream-dim)' }}>
        <div className="row" style={{ gap: 8, alignItems: 'flex-start' }}>
          <span className="small" style={{ fontWeight: 700, marginTop: 10, flexShrink: 0 }}>Exemple ↓</span>
          <span className="dish-thumb-empty">+ Photo</span>
          <div style={{ flex: 1, display: 'grid', gap: 6 }}>
            <div className="row" style={{ gap: 8 }}>
              <input style={{ flex: 2 }} disabled placeholder="Nom du plat" />
              <input style={{ flex: 1 }} disabled placeholder="Prix" />
            </div>
            <div className="row" style={{ gap: 8 }}>
              <input style={{ flex: 1 }} disabled placeholder="Section (ex: Entrées, Plats, Boissons...)" />
              <input style={{ flex: 1 }} disabled placeholder="Sous-section (ex: Sauces, Crudités, Chaudes...)" />
            </div>
            <input disabled placeholder="Description (optionnel)" />
          </div>
        </div>
        <p className="small" style={{ margin: '10px 0 0' }}>
          La <b>section</b> regroupe les plats sous un même titre affiché sur ton menu (Entrées, Plats, Desserts, Boissons, ou un nom que tu choisis toi-même comme "Pizzas"). La <b>sous-section</b> crée un sous-groupe à l'intérieur d'une section — par exemple <b>"Sauces"</b> ou <b>"Crudités"</b> dans une section "Plats", ou <b>"Chaudes"</b> / <b>"Froides"</b> / <b>"Boissons alcoolisées"</b> dans une section "Boissons". Laisse-la vide pour un plat qui n'a pas besoin d'être sous-groupé.
        </p>
      </div>
      {items.map((it) => (
        <div key={it.key} className="card" style={{ marginBottom: 8, opacity: it.included ? 1 : 0.5, padding: 12 }}>
          <div className="row" style={{ gap: 8, alignItems: 'flex-start' }}>
            <input type="checkbox" style={{ width: 'auto', marginTop: 10 }} checked={it.included} onChange={() => toggleIncluded(it.key)} />
            <button
              type="button"
              onClick={() => setPickerKey(it.key)}
              title={it.imageUrl ? 'Changer la photo' : 'Choisir une photo (aucune trouvée automatiquement)'}
              style={{ flexShrink: 0, padding: 0, border: 'none', background: 'none', cursor: 'pointer' }}
            >
              {it.imageUrl ? (
                <img src={it.imageUrl} alt="" className="dish-thumb" />
              ) : (
                <span className="dish-thumb-empty">+ Photo</span>
              )}
            </button>
            <div style={{ flex: 1, display: 'grid', gap: 6 }}>
              <div className="row" style={{ gap: 8 }}>
                <input style={{ flex: 2 }} value={it.name} onChange={(e) => updateField(it.key, 'name', e.target.value)} placeholder="Nom du plat" />
                <input style={{ flex: 1 }} type="number" step="0.5" value={it.price} onChange={(e) => updateField(it.key, 'price', e.target.value)} placeholder="Prix" />
              </div>
              <div className="row" style={{ gap: 8 }}>
                <input style={{ flex: 1 }} value={it.category} onChange={(e) => updateField(it.key, 'category', e.target.value)} placeholder="Section (ex: Entrées)" />
                <input style={{ flex: 1 }} value={it.subsection} onChange={(e) => updateField(it.key, 'subsection', e.target.value)} placeholder="Sous-section (optionnel, ex: Viandes)" />
              </div>
              <input value={it.desc} onChange={(e) => updateField(it.key, 'desc', e.target.value)} placeholder="Description (optionnel)" />
            </div>
            <button type="button" className="btn-danger-ghost" style={{ padding: '4px 8px', marginTop: 4 }} onClick={() => removeRow(it.key)} title="Retirer cette ligne">🗑️</button>
          </div>
        </div>
      ))}
      <div className="row" style={{ gap: 8, marginTop: 10 }}>
        <button className={mode === 'replace' ? 'btn-danger' : 'btn-teal'} disabled={submitting || includedCount === 0} onClick={submit}>
          {submitting ? '...' : mode === 'replace' ? `Remplacer le menu par ces ${includedCount} plat(s)` : `Ajouter ${includedCount} plat(s) au menu`}
        </button>
        <button className="btn-ghost" onClick={onCancel}>Annuler</button>
      </div>
      {pickerItem && (
        <GalleryPickerModal
          restoId={restoId}
          currentImageUrl={pickerItem.imageUrl}
          suggestions={suggestItemImages(pickerItem)}
          suggestionsTitle="Photos suggérées pour ce plat"
          title={`Photo — ${pickerItem.name || 'ce plat'}`}
          onSelect={(url) => { updateField(pickerKey, 'imageUrl', url); setPickerKey(null); }}
          onCancel={() => setPickerKey(null)}
        />
      )}
    </div>
  );
}
