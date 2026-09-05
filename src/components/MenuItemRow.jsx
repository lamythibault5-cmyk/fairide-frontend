import { useState } from 'react';
import { useSortable } from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';
import { CATEGORIES, categoryEmoji, categoryLabel, categoryKind, resolveItemImage } from '../menuCategories';
import { useLanguage } from '../context/LanguageContext';
import GalleryPickerModal from './GalleryPickerModal';
import { galleryForSection } from '../menuCategories';

// La carte fermée reprend exactement le style des cartes vues par le client (image, nom, prix) — cliquer
// dessus ouvre l'édition. Plus simple visuellement pour un restaurateur : il gère son menu en regardant
// la même chose que ses clients, pas une liste administrative séparée.
export default function MenuItemRow({ item, onSave, onDelete, allOptionGroups = [], onSetOptionGroups, sections = [], reorderMode = false, restoId, selectMode = false, selected = false, onToggleSelect, existingSubsections = [], cuisine = '', onSaveTranslations }) {
  const { t } = useLanguage();
  // useSortable est toujours appelé (règle des hooks), même hors mode réorganisation — seul le handle
  // reçoit alors les listeners de drag, donc rien n'est réellement déplaçable tant que reorderMode est faux.
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({ id: item.id, disabled: !reorderMode });
  const sortableStyle = { transform: CSS.Transform.toString(transform), transition, zIndex: isDragging ? 1 : undefined };
  const [editing, setEditing] = useState(false);
  // Brouillons de traduction : saisis localement, envoyés avec le reste du plat à l'enregistrement.
  const [showTranslations, setShowTranslations] = useState(false);
  const [translationDrafts, setTranslationDrafts] = useState({});
  const [name, setName] = useState(item.name);
  const [desc, setDesc] = useState(item.desc || '');
  const [price, setPrice] = useState(String(item.price));
  const [category, setCategory] = useState(item.category || 'plat');
  const [subsection, setSubsection] = useState(item.subsection || '');
  const [imageUrl, setImageUrl] = useState(item.imageUrl || '');
  const [suggestAtCheckout, setSuggestAtCheckout] = useState(!!item.suggestAtCheckout);
  const [healthy, setHealthy] = useState(!!item.healthy);
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
      await onSave(item.id, { name: name.trim(), desc: desc.trim(), price: parseFloat(price), category, subsection: subsection.trim(), imageUrl: imageUrl.trim(), suggestAtCheckout, healthy });
      if (onSetOptionGroups) await onSetOptionGroups(item.id, Array.from(groupIds));
      // Les traductions partent APRÈS le plat lui-même : le serveur recalcule l'empreinte du texte
      // source à l'enregistrement d'une correction, elle doit donc refléter le nom qui vient d'être
      // écrit, pas le précédent — sinon la correction naîtrait déjà marquée périmée.
      if (onSaveTranslations) {
        for (const [lang, value] of Object.entries(translationDrafts)) {
          await onSaveTranslations(item.id, lang, value);
        }
      }
      setTranslationDrafts({});
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

  if (editing && !reorderMode && !selectMode) {
    return (
      <div className="card" style={{ marginBottom: 10, gridColumn: '1 / -1' }}>
        <div className="field"><label>Nom</label><input value={name} onChange={(e) => setName(e.target.value)} /></div>
        <div className="field"><label>Description</label><input value={desc} onChange={(e) => setDesc(e.target.value)} placeholder="Ingrédients, préparation..." /></div>
        <div className="field"><label>Prix (€)</label><input type="number" step="0.5" value={price} onChange={(e) => setPrice(e.target.value)} /></div>

        {/* Traductions : repliées par défaut, et volontairement placées APRÈS le prix. Le
            restaurateur n'a rien à y faire dans le cas normal — Claude les remplit quand il clique
            sur « Traduire ma carte ». Elles ne sont là que pour qu'il puisse corriger un nom mal
            rendu, ce qui reste rare mais doit rester possible : sans ce recours, une traduction
            ratée serait définitive. Une correction enregistrée ici n'est plus jamais réécrite. */}
        {item.translations && Object.keys(item.translations).length > 0 && (
          <div className="field">
            <button type="button" className="btn-ghost" style={{ padding: '2px 0', fontSize: 13 }} onClick={() => setShowTranslations((v) => !v)}>
              {showTranslations ? '▾' : '▸'} Traductions ({Object.keys(item.translations).join(', ').toUpperCase()})
            </button>
            {showTranslations && (
              <div style={{ borderLeft: '2px solid var(--line)', paddingLeft: 12, marginTop: 8 }}>
                <p className="small" style={{ margin: '0 0 10px' }}>
                  Générées automatiquement à partir de ta carte. Corrige seulement ce qui te semble faux —
                  ce que tu modifies ici ne sera plus jamais réécrit.
                </p>
                {Object.entries(item.translations).map(([lang, tr]) => (
                  <div key={lang} style={{ marginBottom: 12 }}>
                    <label style={{ textTransform: 'uppercase' }}>{lang}{tr.editedByOwner ? ' · corrigé par toi' : ''}</label>
                    <input
                      value={translationDrafts[lang]?.name ?? tr.name ?? ''}
                      onChange={(e) => setTranslationDrafts((d) => ({ ...d, [lang]: { ...(d[lang] || tr), name: e.target.value } }))}
                      placeholder="Nom du plat"
                      style={{ marginBottom: 6 }}
                    />
                    <input
                      value={translationDrafts[lang]?.desc ?? tr.desc ?? ''}
                      onChange={(e) => setTranslationDrafts((d) => ({ ...d, [lang]: { ...(d[lang] || tr), desc: e.target.value } }))}
                      placeholder="Description"
                    />
                  </div>
                ))}
              </div>
            )}
          </div>
        )}
        <div className="field">
          <label>Catégorie</label>
          <select value={category} onChange={(e) => setCategory(e.target.value)}>
            {(sections.length ? sections.map((s) => s.name) : CATEGORIES.map((c) => c.value)).map((name) => (
              <option key={name} value={name}>{categoryLabel(name, t)}</option>
            ))}
          </select>
        </div>
        <div className="field">
          <label>Sous-section (optionnel — ex: "Boissons froides" dans "Boissons")</label>
          <input
            value={subsection}
            onChange={(e) => setSubsection(e.target.value)}
            placeholder="Laisser vide pour ne pas sous-grouper ce plat"
            list="subsection-suggestions"
          />
          {existingSubsections.length > 0 && (
            <datalist id="subsection-suggestions">
              {existingSubsections.map((s) => <option key={s} value={s} />)}
            </datalist>
          )}
        </div>
        <div className="field">
          <label>Image (optionnel)</label>
          <div className="row" style={{ gap: 8, alignItems: 'center' }}>
            {resolveItemImage({ name, category, imageUrl }, sections) ? (
              <img loading="lazy" src={resolveItemImage({ name, category, imageUrl }, sections)} alt="" className="dish-thumb" style={{ flexShrink: 0 }} />
            ) : (
              <span className="dish-thumb-empty">{categoryEmoji(category)}</span>
            )}
            <input style={{ flex: 1 }} value={imageUrl} onChange={(e) => setImageUrl(e.target.value)} placeholder="Colle une URL de photo (optionnel)" />
          </div>
          {restoId && (
            <button type="button" className="btn-ghost" style={{ marginTop: 6 }} onClick={() => setGalleryOpen(true)}>
              📷 Depuis ma galerie
            </button>
          )}
        </div>
        {/* Galerie du type de commerce (voir galleryImages.js) : une trentaine de photos utilisables
            sans rien téléverser, la galerie personnelle restant affichée juste en dessous. */}
        {galleryOpen && (
          <GalleryPickerModal
            restoId={restoId}
            suggestions={galleryForSection(cuisine, category)}
            suggestionsTitle={`Photos suggérées — ${categoryLabel(category, t)}`}
            currentImageUrl={imageUrl}
            onSelect={(url) => { setImageUrl(url); setGalleryOpen(false); }}
            onCancel={() => setGalleryOpen(false)}
          />
        )}
        {/* Hors du bloc categoryKind ci-dessous, volontairement : la suggestion avant paiement ne concerne
            que les desserts/boissons, alors que n'importe quel plat de la carte peut être healthy. */}
        <div className="field">
          <label className="row" style={{ gap: 8, cursor: 'pointer' }}>
            <input type="checkbox" style={{ width: 'auto' }} checked={healthy} onChange={(e) => setHealthy(e.target.checked)} />
            <span className="small">🥗 Marquer ce plat comme healthy (affiche l'emoji à côté du nom et fait apparaître le restaurant dans la section "Healthy")</span>
          </label>
        </div>
        {categoryKind(category) && (
          <div className="field">
            <label className="row" style={{ gap: 8, cursor: 'pointer' }}>
              <input type="checkbox" style={{ width: 'auto' }} checked={suggestAtCheckout} onChange={(e) => setSuggestAtCheckout(e.target.checked)} />
              <span className="small">⭐ Suggérer ce plat juste avant le paiement (au lieu du choix automatique)</span>
            </label>
          </div>
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
      className={`menu-item-card${reorderMode ? ' menu-item-card-reordering' : ''}${selectMode && selected ? ' menu-item-card-selected' : ''}`}
      style={{
        cursor: reorderMode ? 'default' : 'pointer',
        position: 'relative',
        ...sortableStyle,
        ...(item.available === false ? { opacity: 0.5 } : {})
      }}
      onClick={reorderMode ? undefined : selectMode ? () => onToggleSelect(item.id) : () => setEditing(true)}
      title={reorderMode ? '' : selectMode ? 'Cliquer pour sélectionner' : 'Cliquer pour modifier'}
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
      {selectMode && (
        <span className={`menu-item-select-check${selected ? ' checked' : ''}`} aria-hidden="true">
          {selected ? '✓' : ''}
        </span>
      )}
      {item.activePromo && <span className="promo-badge">🏷️ {item.activePromo.label}</span>}
      {resolveItemImage(item, sections) ? (
        <img loading="lazy" src={resolveItemImage(item, sections)} alt={item.name} className="dish-thumb-lg" />
      ) : (
        <div className="dish-thumb-lg-empty"><span className="icon">{categoryEmoji(item.category)}</span></div>
      )}
      <div className="name">
        {item.name}
        {item.healthy && <span className="dish-healthy" title={t('menuCategories.healthy')} aria-label={t('menuCategories.healthy')} role="img">{'\u00A0'}🥗</span>}
      </div>
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
