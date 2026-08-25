import { useRef, useState } from 'react';
import { useOutletContext } from 'react-router-dom';
import { DndContext, closestCenter, PointerSensor, TouchSensor, useSensor, useSensors } from '@dnd-kit/core';
import { SortableContext, rectSortingStrategy, arrayMove } from '@dnd-kit/sortable';
import { api, apiUpload } from '../../api';
import { useAuth } from '../../context/AuthContext';
import { useToast } from '../../context/ToastContext';
import { useLanguage } from '../../context/LanguageContext';
import {
  categoryImage, categoryLabel, getStarterTemplate,
  fullTemplateItems, quickTemplateItems, CLASSIC_DRINKS, CLASSIC_DESSERTS, missingClassicItems, defaultItemImage,
  groupBySubsection
} from '../../menuCategories';
import MenuItemRow from '../../components/MenuItemRow';
import OptionGroupManager from '../../components/OptionGroupManager';
import TemplatePicker from '../../components/TemplatePicker';
import GalleryPickerModal from '../../components/GalleryPickerModal';
import MenuImportReview from '../../components/MenuImportReview';

export default function MenuPage() {
  const { token } = useAuth();
  const toast = useToast();
  const { t } = useLanguage();
  const { restaurant, restoId, loadDashboard } = useOutletContext();

  const [itemName, setItemName] = useState('');
  const [itemPrice, setItemPrice] = useState('');
  const [itemCategory, setItemCategory] = useState('plat');
  const [itemImageUrl, setItemImageUrl] = useState('');
  const [addSectionId, setAddSectionId] = useState(null);

  const [editingSectionId, setEditingSectionId] = useState(null);
  const [editSectionName, setEditSectionName] = useState('');
  const [creatingSection, setCreatingSection] = useState(false);
  const [newSectionName, setNewSectionName] = useState('');

  const [templateOpen, setTemplateOpen] = useState(false);
  const [addingTemplate, setAddingTemplate] = useState(false);
  const [startChoiceMade, setStartChoiceMade] = useState(false);
  const [starterPickerOpen, setStarterPickerOpen] = useState(false);
  const [applyingStarter, setApplyingStarter] = useState(false);
  const [addingClassicDrinks, setAddingClassicDrinks] = useState(false);
  const [addingClassicDesserts, setAddingClassicDesserts] = useState(false);
  const [addItemGalleryOpen, setAddItemGalleryOpen] = useState(false);

  const [importing, setImporting] = useState(false);
  // Non-null dès qu'un brouillon d'import existe pour ce resto (voir MenuImportReview, qui sauvegarde son
  // état en continu dans sessionStorage) — rouvre directement l'écran de relecture au lieu du bouton
  // "+ Choisir un fichier" si le restaurateur avait rafraîchi la page en pleine relecture. Le contenu
  // exact (plats édités, mode remplacer/ajouter) est relu par MenuImportReview lui-même ; ce tableau vide
  // sert juste de déclencheur de rendu ici.
  const [importedItems, setImportedItems] = useState(() => (sessionStorage.getItem(`fairide_menu_import_draft_${restoId}`) ? [] : null));
  const [submittingImport, setSubmittingImport] = useState(false);
  const importFileRef = useRef(null);

  // Sélection/réorganisation activée section par section (id de la section concernée, ou null si aucune
  // n'est active) plutôt qu'un mode global sur tout le menu — plus simple à suivre quand le menu a
  // plusieurs sections, et le drag & drop comme la sélection restent naturellement scopés à une section.
  const [reorderSectionId, setReorderSectionId] = useState(null);
  const [selectSectionId, setSelectSectionId] = useState(null);
  const [selectedIds, setSelectedIds] = useState(() => new Set());
  const [bulkDeleting, setBulkDeleting] = useState(false);
  // Override d'affichage local le temps que loadDashboard confirme le nouvel ordre côté serveur — évite
  // l'aller-retour visible (retour à l'ancien ordre puis saut au nouveau) entre le lâcher et le rechargement.
  const [localOrder, setLocalOrder] = useState({});
  // distance/delay d'activation : un simple tap (souris ou tactile) ouvre encore le bouton "modifier" ou
  // fait défiler la page normalement, seul un vrai geste de glisser déclenche le drag.
  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 8 } }),
    useSensor(TouchSensor, { activationConstraint: { delay: 200, tolerance: 5 } })
  );

  function toggleReorderSection(sectionId) {
    setReorderSectionId((prev) => (prev === sectionId ? null : sectionId));
    setLocalOrder({});
    setSelectSectionId(null);
    setSelectedIds(new Set());
  }

  function toggleSelectSection(sectionId) {
    setSelectSectionId((prev) => (prev === sectionId ? null : sectionId));
    setSelectedIds(new Set());
    setReorderSectionId(null);
  }

  function toggleItemSelected(itemId) {
    setSelectedIds((prev) => {
      const next = new Set(prev);
      if (next.has(itemId)) next.delete(itemId); else next.add(itemId);
      return next;
    });
  }

  async function bulkDeleteSelected() {
    if (!selectedIds.size) return;
    if (!window.confirm(`Supprimer ${selectedIds.size} plat(s) sélectionné(s) ? Cette action est irréversible.`)) return;
    setBulkDeleting(true);
    try {
      await api(`/restaurants/${restoId}/menu/bulk-delete`, { method: 'POST', token, body: { itemIds: Array.from(selectedIds) } });
      toast(`${selectedIds.size} plat(s) supprimé(s).`);
      setSelectedIds(new Set());
      setSelectSectionId(null);
      loadDashboard(restoId);
    } catch (e) {
      toast(e.message);
    } finally {
      setBulkDeleting(false);
    }
  }

  async function handleDragEnd(section, items, event) {
    const { active, over } = event;
    if (!over || active.id === over.id) return;
    const ids = items.map((i) => i.id);
    const oldIndex = ids.indexOf(active.id);
    const newIndex = ids.indexOf(over.id);
    const newIds = arrayMove(ids, oldIndex, newIndex);
    setLocalOrder((prev) => ({ ...prev, [section.id]: newIds }));
    try {
      await api(`/restaurants/${restoId}/menu/reorder`, { method: 'PATCH', token, body: { category: section.name, itemIds: newIds } });
      await loadDashboard(restoId);
    } catch (e) {
      toast(e.message);
      setLocalOrder((prev) => ({ ...prev, [section.id]: undefined }));
    }
  }

  async function addMenuItem() {
    const price = parseFloat(itemPrice);
    if (!itemName.trim() || !price) { toast('Nom et prix requis.'); return; }
    try {
      await api(`/restaurants/${restoId}/menu`, { method: 'POST', token, body: { name: itemName.trim(), price, category: itemCategory, imageUrl: itemImageUrl.trim() } });
      setItemName(''); setItemPrice(''); setItemImageUrl('');
      loadDashboard(restoId);
      toast('Plat ajouté au menu.');
    } catch (e) {
      toast(e.message);
    }
  }

  async function saveMenuItem(itemId, patch) {
    try {
      await api(`/restaurants/${restoId}/menu/${itemId}`, { method: 'PATCH', token, body: patch });
      await loadDashboard(restoId);
      toast('Plat mis à jour.');
    } catch (e) {
      toast(e.message);
      throw e;
    }
  }

  async function deleteMenuItem(itemId) {
    try {
      await api(`/restaurants/${restoId}/menu/${itemId}`, { method: 'DELETE', token });
      loadDashboard(restoId);
    } catch (e) {
      toast(e.message);
    }
  }

  async function saveMenuItemOptionGroups(itemId, groupIds) {
    try {
      await api(`/restaurants/${restoId}/menu/${itemId}/option-groups`, { method: 'PATCH', token, body: { groupIds } });
      await loadDashboard(restoId);
    } catch (e) {
      toast(e.message);
      throw e;
    }
  }

  async function createOptionGroup(payload) {
    try {
      await api(`/restaurants/${restoId}/option-groups`, { method: 'POST', token, body: payload });
      await loadDashboard(restoId);
      toast('Groupe d\'options créé.');
    } catch (e) {
      toast(e.message);
      throw e;
    }
  }

  async function updateOptionGroup(groupId, payload) {
    try {
      await api(`/restaurants/${restoId}/option-groups/${groupId}`, { method: 'PATCH', token, body: payload });
      await loadDashboard(restoId);
      toast('Groupe d\'options mis à jour.');
    } catch (e) {
      toast(e.message);
      throw e;
    }
  }

  async function deleteOptionGroup(groupId) {
    try {
      await api(`/restaurants/${restoId}/option-groups/${groupId}`, { method: 'DELETE', token });
      await loadDashboard(restoId);
      toast('Groupe d\'options supprimé.');
    } catch (e) {
      toast(e.message);
    }
  }

  async function createSection(name) {
    try {
      await api(`/restaurants/${restoId}/sections`, { method: 'POST', token, body: { name } });
      await loadDashboard(restoId);
      toast('Section créée.');
    } catch (e) {
      toast(e.message);
      throw e;
    }
  }

  async function renameSection(sectionId, name) {
    try {
      await api(`/restaurants/${restoId}/sections/${sectionId}`, { method: 'PATCH', token, body: { name } });
      await loadDashboard(restoId);
      toast('Section renommée.');
    } catch (e) {
      toast(e.message);
      throw e;
    }
  }

  async function handleSectionRename(id) {
    if (!editSectionName.trim()) return;
    try {
      await renameSection(id, editSectionName.trim());
      setEditingSectionId(null);
    } catch {
      // toast déjà affiché par renameSection
    }
  }

  async function handleSectionCreate() {
    if (!newSectionName.trim()) return;
    try {
      await createSection(newSectionName.trim());
      setNewSectionName('');
      setCreatingSection(false);
    } catch {
      // toast déjà affiché par createSection
    }
  }

  function openAddItemTile(section) {
    setAddSectionId(section.id);
    setItemCategory(section.name);
    setItemName('');
    setItemPrice('');
    setItemImageUrl('');
  }

  async function deleteSection(section) {
    const count = restaurant.menu.filter((i) => (i.category || 'plat') === section.name).length;
    if (count > 0 && !window.confirm(`Cette section contient ${count} plat(s). Les supprimer aussi et retirer la section "${categoryLabel(section.name, t)}" ?`)) return;
    try {
      await api(`/restaurants/${restoId}/sections/${section.id}`, { method: 'DELETE', token });
      await loadDashboard(restoId);
      toast('Section supprimée.');
    } catch (e) {
      toast(e.message);
    }
  }

  async function addStarterTemplateItems(items) {
    if (!items.length) { toast('Choisis au moins un plat.'); return; }
    setAddingTemplate(true);
    try {
      await api(`/restaurants/${restoId}/menu/bulk`, { method: 'POST', token, body: { items } });
      setTemplateOpen(false);
      loadDashboard(restoId);
      toast(`${items.length} plat(s) ajouté(s) au menu.`);
    } catch (e) {
      toast(e.message);
    } finally {
      setAddingTemplate(false);
    }
  }

  async function applyStarterItems(items) {
    if (!items.length) { toast('Choisis au moins un plat.'); return; }
    setApplyingStarter(true);
    try {
      await api(`/restaurants/${restoId}/menu/bulk`, { method: 'POST', token, body: { items } });
      setStartChoiceMade(true);
      setStarterPickerOpen(false);
      loadDashboard(restoId);
      toast(`${items.length} plat(s) ajouté(s) — modifie ou supprime ce dont tu n'as pas besoin.`);
    } catch (e) {
      toast(e.message);
    } finally {
      setApplyingStarter(false);
    }
  }

  async function handleImportFile(e) {
    const file = e.target.files?.[0];
    e.target.value = '';
    if (!file) return;
    setImporting(true);
    setImportedItems(null);
    try {
      const r = await apiUpload(`/restaurants/${restoId}/menu/import-preview`, { file, token, fieldName: 'file' });
      setImportedItems(r.items);
    } catch (err) {
      toast(err.message);
    } finally {
      setImporting(false);
    }
  }

  async function submitImportedItems(items, replaceExisting) {
    if (!items.length) { toast('Choisis au moins un plat.'); return; }
    setSubmittingImport(true);
    try {
      await api(`/restaurants/${restoId}/menu/bulk`, { method: 'POST', token, body: { items, replaceExisting } });
      setImportedItems(null);
      loadDashboard(restoId);
      toast(replaceExisting
        ? `Menu remplacé — ${items.length} plat(s) importé(s) du document.`
        : `${items.length} plat(s) ajouté(s) au menu depuis le document importé.`);
    } catch (e) {
      toast(e.message);
    } finally {
      setSubmittingImport(false);
    }
  }

  async function addClassics(list, category, setBusy) {
    const items = missingClassicItems(restaurant.menu, list).map((it) => ({ ...it, category }));
    if (!items.length) { toast('Déjà tous présents dans ton menu.'); return; }
    setBusy(true);
    try {
      await api(`/restaurants/${restoId}/menu/bulk`, { method: 'POST', token, body: { items } });
      loadDashboard(restoId);
      toast(`${items.length} produit(s) ajouté(s).`);
    } catch (e) {
      toast(e.message);
    } finally {
      setBusy(false);
    }
  }

  return (
    <div>
      <div className="card">
        <h3 style={{ margin: '0 0 6px', fontSize: 15 }}>📄 Importer un menu (PDF ou photo)</h3>
        <p className="small" style={{ margin: '0 0 12px' }}>
          Envoie une carte existante — Fairide la lit et propose les plats à ajouter. Tu relis et corriges avant que rien ne soit ajouté à ton menu. La lecture peut prendre quelques minutes (1-2 min) selon la taille du document.
        </p>
        <input
          ref={importFileRef}
          type="file"
          accept="application/pdf,image/*"
          style={{ display: 'none' }}
          onChange={handleImportFile}
        />
        {!importedItems && (
          <button type="button" className="btn-teal" disabled={importing} onClick={() => importFileRef.current?.click()}>
            {importing ? 'Lecture du menu en cours...' : '+ Choisir un fichier'}
          </button>
        )}
        {importedItems && (
          <MenuImportReview
            items={importedItems}
            existingItemCount={restaurant.menu.length}
            restoId={restoId}
            restaurant={restaurant}
            submitting={submittingImport}
            onSubmit={submitImportedItems}
            onCancel={() => setImportedItems(null)}
          />
        )}
      </div>

      {restaurant.menu.length === 0 && !startChoiceMade && (
        <div className="card" style={{ border: '2px solid var(--teal)' }}>
          <h3 style={{ margin: '0 0 6px', fontSize: 16 }}>🚀 Démarrez en 1 clic</h3>
          <p className="small" style={{ margin: '0 0 12px' }}>
            Votre type de commerce est <b>{restaurant.cuisine}</b>. Fairide peut générer un menu complet tout de suite,
            avec photos incluses automatiquement — choisissez plat par plat ce que vous gardez, section par section.
          </p>
          {!starterPickerOpen ? (
            <div className="row" style={{ gap: 8, flexWrap: 'wrap' }}>
              <button className="btn-teal" onClick={() => setStarterPickerOpen(true)}>
                🍽 Choisir mes plats de départ ({fullTemplateItems(restaurant.cuisine).length} suggestions)
              </button>
              <button className="btn-ghost" onClick={() => setStartChoiceMade(true)}>✏️ Je crée moi-même mon menu</button>
            </div>
          ) : (
            <TemplatePicker
              template={getStarterTemplate(restaurant.cuisine)}
              quickItems={quickTemplateItems(restaurant.cuisine)}
              submitting={applyingStarter}
              onSubmit={applyStarterItems}
              onCancel={() => setStarterPickerOpen(false)}
            />
          )}
        </div>
      )}

      <div className="card">
        <h3 style={{ margin: '0 0 4px', fontSize: 15 }}>Ton menu</h3>
        <p className="small" style={{ margin: '0 0 12px' }}>
          Clique sur un plat pour le modifier. Sur chaque section : ☑️ pour sélectionner plusieurs plats et les supprimer d'un coup, ↕️ pour les réorganiser, ✏️ pour la renommer, 🗑️ pour la supprimer.
        </p>
        {restaurant.menu.length === 0 && (restaurant.sections || []).length === 0 && startChoiceMade && (
          <div className="small" style={{ marginBottom: 10 }}>Pas encore de section — crée-en une pour commencer à ajouter des plats.</div>
        )}
        {(restaurant.sections || []).map((section) => {
          const rawItems = restaurant.menu.filter((i) => (i.category || 'plat') === section.name);
          const order = localOrder[section.id];
          const items = order ? order.map((id) => rawItems.find((i) => i.id === id)).filter(Boolean) : rawItems;
          const image = categoryImage(section.name);
          const sectionSubsections = [...new Set(rawItems.map((i) => i.subsection).filter(Boolean))];
          const inReorder = reorderSectionId === section.id;
          const subsectionGroups = inReorder ? null : groupBySubsection(items, section.name, t);
          return (
            <div key={section.id} style={{ marginBottom: 16 }}>
              <div className="category-header" style={{ justifyContent: 'space-between' }}>
                <div className="row" style={{ gap: 8, alignItems: 'center' }}>
                  {image && <img src={image} alt={section.name} />}
                  {editingSectionId === section.id ? (
                    <div className="row" style={{ gap: 6 }}>
                      <input style={{ width: 180 }} value={editSectionName} onChange={(e) => setEditSectionName(e.target.value)} />
                      <button className="btn-teal" style={{ padding: '4px 10px' }} onClick={() => handleSectionRename(section.id)}>OK</button>
                      <button className="btn-ghost" style={{ padding: '4px 10px' }} onClick={() => setEditingSectionId(null)}>Annuler</button>
                    </div>
                  ) : (
                    <span>{categoryLabel(section.name, t)}</span>
                  )}
                </div>
                {editingSectionId !== section.id && (
                  <div className="row" style={{ gap: 4 }}>
                    {reorderSectionId === section.id ? (
                      <button type="button" className="btn-teal" style={{ padding: '4px 10px', fontSize: 12 }} onClick={() => toggleReorderSection(section.id)}>✅ Terminé</button>
                    ) : selectSectionId === section.id ? (
                      <button type="button" className="btn-teal" style={{ padding: '4px 10px', fontSize: 12 }} onClick={() => toggleSelectSection(section.id)}>✅ Terminé</button>
                    ) : !reorderSectionId && !selectSectionId && (
                      <>
                        <button type="button" className="btn-ghost" style={{ padding: '4px 8px' }} onClick={() => toggleSelectSection(section.id)} title="Sélectionner plusieurs plats">☑️</button>
                        <button type="button" className="btn-ghost" style={{ padding: '4px 8px' }} onClick={() => toggleReorderSection(section.id)} title="Réorganiser les plats">↕️</button>
                        <button type="button" className="btn-ghost" style={{ padding: '4px 8px' }} onClick={() => { setEditingSectionId(section.id); setEditSectionName(section.name); }} title="Renommer la section">✏️</button>
                        <button type="button" className="btn-danger-ghost" style={{ padding: '4px 8px' }} onClick={() => deleteSection(section)} title="Supprimer la section">🗑️</button>
                      </>
                    )}
                  </div>
                )}
              </div>
              {selectSectionId === section.id && (
                <div className="row" style={{ gap: 8, alignItems: 'center', margin: '6px 0 10px', flexWrap: 'wrap' }}>
                  <span className="small">{selectedIds.size} plat(s) sélectionné(s)</span>
                  <button type="button" className="btn-danger-ghost" disabled={!selectedIds.size || bulkDeleting} onClick={bulkDeleteSelected}>
                    {bulkDeleting ? '...' : '🗑️ Supprimer la sélection'}
                  </button>
                </div>
              )}
              {reorderSectionId === section.id && (
                <p className="small" style={{ margin: '2px 0 10px' }}>Glisse un plat par sa poignée ⠿ (souris ou doigt) pour changer son ordre, puis clique sur "Terminé".</p>
              )}
              <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={(e) => handleDragEnd(section, items, e)}>
                <SortableContext items={items.map((i) => i.id)} strategy={rectSortingStrategy}>
                  {inReorder ? (
                    <div className="menu-grid dashboard-menu-grid">
                      {items.map((item) => (
                        <MenuItemRow
                          key={item.id} item={item} onSave={saveMenuItem} onDelete={deleteMenuItem}
                          allOptionGroups={restaurant.optionGroups || []} onSetOptionGroups={saveMenuItemOptionGroups}
                          sections={restaurant.sections || []} reorderMode restoId={restoId}
                          existingSubsections={sectionSubsections}
                        />
                      ))}
                    </div>
                  ) : (
                    subsectionGroups.map((group) => (
                      <div key={group.key || '__none'} style={{ marginBottom: 10 }}>
                        {group.label && <div className="sub-category-header"><span>{group.label}</span></div>}
                        <div className="menu-grid dashboard-menu-grid">
                          {group.items.map((item) => (
                            <MenuItemRow
                              key={item.id} item={item} onSave={saveMenuItem} onDelete={deleteMenuItem}
                              allOptionGroups={restaurant.optionGroups || []} onSetOptionGroups={saveMenuItemOptionGroups}
                              sections={restaurant.sections || []} reorderMode={false} restoId={restoId}
                              selectMode={selectSectionId === section.id} selected={selectedIds.has(item.id)} onToggleSelect={toggleItemSelected}
                              existingSubsections={sectionSubsections}
                            />
                          ))}
                        </div>
                      </div>
                    ))
                  )}
                </SortableContext>
              </DndContext>
              <div className="menu-grid dashboard-menu-grid">
                {reorderSectionId !== section.id && selectSectionId !== section.id && (addSectionId === section.id ? (
                  <div className="card" style={{ gridColumn: '1 / -1', marginBottom: 0 }}>
                    <div className="field"><label>Nom</label><input value={itemName} onChange={(e) => setItemName(e.target.value)} placeholder="Poke bowl saumon" /></div>
                    <div className="field"><label>Prix (€)</label><input type="number" step="0.5" value={itemPrice} onChange={(e) => setItemPrice(e.target.value)} placeholder="12.50" /></div>
                    <div className="field">
                      <label>Image (optionnel — une photo est choisie automatiquement sinon)</label>
                      <div className="row" style={{ gap: 8, alignItems: 'center' }}>
                        {itemName.trim() && (
                          <img src={itemImageUrl || defaultItemImage({ name: itemName, category: itemCategory })} alt="" className="dish-thumb" style={{ flexShrink: 0 }} />
                        )}
                        <input style={{ flex: 1 }} value={itemImageUrl} onChange={(e) => setItemImageUrl(e.target.value)} placeholder="Colle une URL pour remplacer la photo automatique" />
                      </div>
                      <button type="button" className="btn-ghost" style={{ marginTop: 6 }} onClick={() => setAddItemGalleryOpen(true)}>
                        📷 Depuis ma galerie
                      </button>
                    </div>
                    <div className="row" style={{ gap: 8 }}>
                      <button className="btn-teal" onClick={addMenuItem}>Ajouter</button>
                      <button className="btn-ghost" onClick={() => setAddSectionId(null)}>Fermer</button>
                    </div>
                    {addItemGalleryOpen && (
                      <GalleryPickerModal
                        restoId={restoId}
                        onSelect={(url) => { setItemImageUrl(url); setAddItemGalleryOpen(false); }}
                        onCancel={() => setAddItemGalleryOpen(false)}
                      />
                    )}
                  </div>
                ) : (
                  <button type="button" className="menu-item-card menu-item-card-add" onClick={() => openAddItemTile(section)}>
                    + Ajouter un élément
                  </button>
                ))}
              </div>
            </div>
          );
        })}
        {!reorderSectionId && !selectSectionId && (creatingSection ? (
          <div className="row" style={{ gap: 8 }}>
            <input style={{ flex: 1 }} value={newSectionName} onChange={(e) => setNewSectionName(e.target.value)} placeholder="Menu enfants, Formules midi..." />
            <button className="btn-teal" style={{ padding: '4px 10px' }} onClick={handleSectionCreate}>Créer</button>
            <button className="btn-ghost" style={{ padding: '4px 10px' }} onClick={() => setCreatingSection(false)}>Annuler</button>
          </div>
        ) : (
          <button type="button" className="btn-ghost" onClick={() => setCreatingSection(true)}>+ Nouvelle section</button>
        ))}
      </div>

      <OptionGroupManager
        groups={restaurant.optionGroups || []}
        onCreate={createOptionGroup}
        onUpdate={updateOptionGroup}
        onDelete={deleteOptionGroup}
      />

      {(restaurant.menu.length > 0 || startChoiceMade) && (
        <>
          <div className="row" style={{ gap: 8, flexWrap: 'wrap', marginBottom: 10 }}>
            <button type="button" className="btn-ghost" disabled={addingClassicDrinks} onClick={() => addClassics(CLASSIC_DRINKS, 'boisson', setAddingClassicDrinks)}>
              {addingClassicDrinks ? '...' : '+ Ajouter les boissons classiques'}
            </button>
            <button type="button" className="btn-ghost" disabled={addingClassicDesserts} onClick={() => addClassics(CLASSIC_DESSERTS, 'dessert', setAddingClassicDesserts)}>
              {addingClassicDesserts ? '...' : '+ Ajouter les desserts classiques'}
            </button>
          </div>

          {!templateOpen && (
            <button type="button" className="btn-ghost" onClick={() => setTemplateOpen(true)}>+ Piocher d'autres plats types dans le menu de démarrage</button>
          )}
          {templateOpen && (
            <div className="card">
              <h3 style={{ margin: '0 0 6px', fontSize: 15 }}>Plats types — {restaurant.cuisine}</h3>
              <p className="small" style={{ margin: '0 0 10px' }}>Coche les plats à ajouter à ton menu (avec photos automatiques) — tu pourras ensuite les modifier ou les supprimer.</p>
              <TemplatePicker
                template={getStarterTemplate(restaurant.cuisine)}
                submitting={addingTemplate}
                submitLabel="Ajouter la sélection"
                onSubmit={addStarterTemplateItems}
                onCancel={() => setTemplateOpen(false)}
              />
            </div>
          )}
        </>
      )}
    </div>
  );
}
