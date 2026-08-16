import { useState } from 'react';
import { useSortable } from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';
import { CATEGORIES, categoryLabel, defaultItemImage } from '../menuCategories';
import { useLanguage } from '../context/LanguageContext';
import GalleryPickerModal from './GalleryPickerModal';

// La carte fermée reprend exactement le style des cartes vues par le client (image, nom, prix) — cliquer
// dessus ouvre l'édition. Plus simple visuellement pour un restaurateur : il gère son menu en regardant
// la même chose que ses clients, pas une liste administrative séparée.
export default function MenuItemRow({ item, onSave, onDelete, allOptionGroups = [], onSetOptionGroups, sections = [], reorderMode = false, restoId }) {
  const { t } = useLanguage();
  // useSortable est toujours appelé (règle des hooks), même hors mode réorganisation — seul le handle
  // reçoit alors les listeners de drag, donc rien n'est réellement déplaçable tant que reorderMode est faux.
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({ id: item.id, disabled: !reorderMode });
  const sortableStyle = { transform: CSS.Transform.toString(transform), transition, zIndex: isDragging ? 1 : undefined };
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

  const [togglingAvailable, setTogglingAvailable] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [galleryOpen, setGalleryOpen] = useState(false);

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

  async function toggleAvailable() {
    setTogglingAvailable(true);
    try {
      await onSave(item.id, { available: item.available === false });
    } finally {
      setTogglingAvailable(false);
    }
  }

  async function remove() {
    setDeleting(true);
    try {
      await onDelete(item.id);
    } catch {
      setDeleting(false);
    }
  }

  if (editing && !reorderMode) {
    return (
      <div className="card" style={{ marginBottom: 10, gridColumn: '1 / -1' }}>
        <div className="field"><label>Nom</label><input value={name} onChange={(e) => setName(e.target.value)} /></div>
        <div className="field"><label>Description</label><input value={desc} onChange={(e) => setDesc(e.target.value)} placeholder="Ingrédients, préparation..." /></div>
        <div className="field"><label>Prix (€)</label><input type="number" step="0.5" value={price} onChange={(e) => setPrice(e.target.value)} /></div>
        <div className="field">
          <label>Catégorie</label>
          <select value={category} onChange={(e) => setCategory(e.target.value)}>
            {(sections.length ? sections.map((s) => s.name) : CATEGORIES.map((c) => c.value)).map((name) => (
              <option key={name} value={name}>{categoryLabel(name, t)}</option>
            ))}
          </select>
        </div>
        <div className="field">
          <label>Image (optionnel — une photo est choisie automatiquement sinon)</label>
          <div className="row" style={{ gap: 8, alignItems: 'center' }}>
            <img src={imageUrl || defaultItemImage({ name, category })} alt="" className="dish-thumb" style={{ flexShrink: 0 }} />
            <input style={{ flex: 1 }} value={imageUrl} onChange={(e) => setImageUrl(e.target.value)} placeholder="Colle une URL pour remplacer la photo automatique" />
          </div>
          {restoId && (
            <button type="button" className="btn-ghost" style={{ marginTop: 6 }} onClick={() => setGalleryOpen(true)}>
              📷 Depuis ma galerie
            </button>
          )}
        </div>
        {galleryOpen && (
          <GalleryPickerModal
            restoId={restoId}
            onSelect={(url) => { setImageUrl(url); setGalleryOpen(false); }}
            onCancel={() => setGalleryOpen(false)}
          />
        )}
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

        <div className="divider" />

        {item.activePromo && (
          <div className="row" style={{ gap: 8, marginBottom: 12 }}>
            <span className="pill teal">🏷️ {item.activePromo.label}</span>
            <span className="small">— gère les promotions depuis la page "Promotions"</span>
          </div>
        )}

        <div className="row" style={{ gap: 8, flexWrap: 'wrap' }}>
          <button className="btn-teal" disabled={saving} onClick={save}>{saving ? '...' : 'Enregistrer'}</button>
          <button className="btn-ghost" disabled={togglingAvailable} onClick={toggleAvailable}>
            {togglingAvailable ? '...' : item.available === false ? '✅ Rendre disponible' : '🚫 Marquer indisponible'}
          </button>
          <button className="btn-danger-ghost" disabled={deleting} onClick={remove}>{deleting ? '...' : 'Supprimer'}</button>
          <button className="btn-ghost" onClick={() => setEditing(false)}>Fermer</button>
        </div>
      </div>
    );
  }

  return (
    <div
      ref={setNodeRef}
      className={`menu-item-card${reorderMode ? ' menu-item-card-reordering' : ''}`}
      style={{
        cursor: reorderMode ? 'default' : 'pointer',
        position: 'relative',
        ...sortableStyle,
        ...(item.available === false ? { opacity: 0.5 } : {})
      }}
      onClick={reorderMode ? undefined : () => setEditing(true)}
      title={reorderMode ? '' : 'Cliquer pour modifier'}
    >
      {reorderMode && (
        <button
          type="button"
          className="menu-item-drag-handle"
          style={{ touchAction: 'none' }}
          aria-label="Déplacer ce plat"
          {...attributes}
          {...listeners}
        >
          ⠿
        </button>
      )}
      {item.activePromo && <span className="promo-badge">🏷️ {item.activePromo.label}</span>}
      <img src={item.imageUrl || defaultItemImage(item)} alt={item.name} className="dish-thumb-lg" />
      <div className="name">{item.name}</div>
      <div className="small desc">
        {item.available === false ? 'Indisponible' : (item.optionGroups?.length > 0 ? item.optionGroups.map((g) => g.name).join(', ') : '')}
      </div>
      <div className="bottom-row">
        <span className="price">{item.price.toFixed(2)}€</span>
        {!reorderMode && <span className="btn-ghost" style={{ padding: '6px 12px' }}>✏️</span>}
      </div>
    </div>
  );
}
