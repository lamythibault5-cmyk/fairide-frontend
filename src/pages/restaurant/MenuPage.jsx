import { useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { useOutletContext, Link } from 'react-router-dom';
import { DndContext, closestCenter, PointerSensor, TouchSensor, useSensor, useSensors } from '@dnd-kit/core';
import { SortableContext, rectSortingStrategy, arrayMove } from '@dnd-kit/sortable';
import { api } from '../../api';
import { useAuth } from '../../context/AuthContext';
import { useToast } from '../../context/ToastContext';
import { useLanguage } from '../../context/LanguageContext';
import {
  categoryEmoji, categoryImage, categoryLabel, getStarterTemplate,
  fullTemplateItems, quickTemplateItems, CLASSIC_DRINKS, CLASSIC_DESSERTS, missingClassicItems, resolveItemImage,
  groupBySubsection
} from '../../menuCategories';
import MenuItemRow from '../../components/MenuItemRow';
import OptionGroupManager from '../../components/OptionGroupManager';
import TemplatePicker from '../../components/TemplatePicker';
import GalleryPickerModal from '../../components/GalleryPickerModal';
import { galleryForSection } from '../../menuCategories';
import MenuImportStaging, { MenuImportReport } from '../../components/MenuImportStaging';
import MenuConciergeRequest from '../../components/MenuConciergeRequest';
import MenuImportReview from '../../components/MenuImportReview';
import ConfirmDialog from '../../components/ConfirmDialog';

// `contexte` remplace le contexte de l'Outlet quand la page est montée ailleurs que dans le tableau de bord
// (console admin : AdminMenuPage) ; `modeAdmin` retire la demande « Fairide s'en occupe », sans objet pour l'équipe.
export default function MenuPage({ contexte = null, modeAdmin = false }) {
  const { token } = useAuth();
  const toast = useToast();
  const { t } = useLanguage();
  const contexteOutlet = useOutletContext();
  const { restaurant, restoId, loadDashboard } = contexte || contexteOutlet || {};
  const num = (n) => (modeAdmin ? n - 1 : n);

  const [translating, setTranslating] = useState(false);
  const [itemName, setItemName] = useState('');
  const [itemPrice, setItemPrice] = useState('');
  const [itemCategory, setItemCategory] = useState('plat');
  const [itemImageUrl, setItemImageUrl] = useState('');
  const [addSectionId, setAddSectionId] = useState(null);

  const [editingSectionId, setEditingSectionId] = useState(null);
  const [editSectionName, setEditSectionName] = useState('');
  const [creatingSection, setCreatingSection] = useState(false);
  const [newSectionName, setNewSectionName] = useState('');
  const [sectionGalleryFor, setSectionGalleryFor] = useState(null);
  const [sectionApplyPanel, setSectionApplyPanel] = useState(null);
  const [applySelectedIds, setApplySelectedIds] = useState(new Set());
  const [applyingImage, setApplyingImage] = useState(false);

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
  // Bilan page par page du dernier import de documents (✅ / ⚠️ trop de plats / ❌ illisible), gardé
  // visible au-dessus de la relecture pour que le restaurateur sache quelles pages re-photographier.
  const [importReport, setImportReport] = useState(null);
  const [submittingImport, setSubmittingImport] = useState(false);
  // Import depuis le web : site du restaurant, Uber Eats, Deliveroo, Takeaway. L'adresse relevée à
  // l'inscription (fairide_menu_source_url) est proposée d'office.
  const [importUrl, setImportUrl] = useState(() => { try { return localStorage.getItem('fairide_menu_source_url') || ''; } catch { return ''; } });
  const [importingUrl, setImportingUrl] = useState(false);
  const importUrlRef = useRef(null);
  const [importText, setImportText] = useState('');
  const [importTextOpen, setImportTextOpen] = useState(false);
  const [importingText, setImportingText] = useState(false);

  // Sélection/réorganisation activée section par section (id de la section concernée, ou null si aucune
  // n'est active) plutôt qu'un mode global sur tout le menu — plus simple à suivre quand le menu a
  // plusieurs sections, et le drag & drop comme la sélection restent naturellement scopés à une section.
  const [reorderSectionId, setReorderSectionId] = useState(null);
  const [selectSectionId, setSelectSectionId] = useState(null);
  const [selectedIds, setSelectedIds] = useState(() => new Set());
  const [bulkDeleting, setBulkDeleting] = useState(false);
  // Confirmation en attente : { title, message, confirmLabel, onConfirm } — null quand aucune modale
  // n'est ouverte. Un seul état pour toutes les suppressions de cette page, voir ConfirmDialog en bas.
  const [confirm, setConfirm] = useState(null);
  // Verrou du bouton de confirmation, distinct de bulkDeleting (qui ne couvre que la suppression en
  // lot). window.confirm se fermait de lui-même au clic ; la modale, elle, reste affichée pendant les
  // deux allers-retours réseau — sans ce verrou, un second clic envoyait une deuxième suppression et
  // le restaurateur récupérait une erreur pour une action qui avait pourtant réussi.
  const [confirmBusy, setConfirmBusy] = useState(false);
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

  // Les deux suppressions ci-dessous passent par ConfirmDialog et non plus par window.confirm() :
  // les dialogues natifs sont supprimés ou incohérents dans une PWA installée et dans les webviews,
  // c'est-à-dire exactement là où un restaurateur travaille. Une confirmation qui ne s'affiche pas
  // sur une suppression irréversible, c'est soit une perte de données, soit une action bloquée.
  function bulkDeleteSelected() {
    if (!selectedIds.size) return;
    setConfirm({
      title: `Supprimer ${selectedIds.size} plat(s) ?`,
      message: t('menuPage.irreversible'),
      confirmLabel: 'Supprimer',
      onConfirm: doBulkDelete
    });
  }

  async function doBulkDelete() {
    if (confirmBusy) return;
    setConfirmBusy(true);
    setBulkDeleting(true);
    try {
      await api(`/restaurants/${restoId}/menu/bulk-delete`, { method: 'POST', token, body: { itemIds: Array.from(selectedIds) } });
      toast(t('menuPage.toastDishesDeleted', { n: selectedIds.size }));
      setSelectedIds(new Set());
      setSelectSectionId(null);
      loadDashboard(restoId);
    } catch (e) {
      toast(e.message);
    } finally {
      setBulkDeleting(false);
      setConfirmBusy(false);
      setConfirm(null);
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
    if (!itemName.trim() || !price) { toast(t('menuPage.toastNamePrice')); return; }
    try {
      await api(`/restaurants/${restoId}/menu`, { method: 'POST', token, body: { name: itemName.trim(), price, category: itemCategory, imageUrl: itemImageUrl.trim() } });
      setItemName(''); setItemPrice(''); setItemImageUrl('');
      loadDashboard(restoId);
      toast(t('menuPage.toastDishAdded'));
    } catch (e) {
      toast(e.message);
    }
  }

  // Traduit toute la carte vers les deux langues autres que celle dans laquelle elle est écrite.
  // Le serveur saute les plats déjà à jour, on peut donc rappuyer après avoir ajouté trois plats
  // sans retraduire — ni repayer — les cent autres.
  async function translateMenu() {
    setTranslating(true);
    try {
      const r = await api(`/restaurants/${restoId}/menu/translate`, { method: 'POST', token });
      await loadDashboard(restoId);
      if (r.translated === 0) toast(t('menuPage.toastAlreadyTranslated'));
      else toast(t('menuPage.toastTranslated', { n: r.translated }));
    } catch (e) {
      toast(e.message);
    } finally {
      setTranslating(false);
    }
  }

  // Correction manuelle d'une traduction. Le serveur la marque comme retouchée : la génération
  // automatique ne la réécrira plus jamais.
  async function saveMenuItemTranslation(itemId, lang, value) {
    await api(`/restaurants/${restoId}/menu/${itemId}/translations`, {
      method: 'PATCH', token, body: { lang, name: value.name || '', desc: value.desc || '' }
    });
  }

  async function saveMenuItem(itemId, patch) {
    try {
      await api(`/restaurants/${restoId}/menu/${itemId}`, { method: 'PATCH', token, body: patch });
      await loadDashboard(restoId);
      toast(t('menuPage.toastDishUpdated'));
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
      toast(t('menuPage.toastGroupCreated'));
    } catch (e) {
      toast(e.message);
      throw e;
    }
  }

  async function updateOptionGroup(groupId, payload) {
    try {
      await api(`/restaurants/${restoId}/option-groups/${groupId}`, { method: 'PATCH', token, body: payload });
      await loadDashboard(restoId);
      toast(t('menuPage.toastGroupUpdated'));
    } catch (e) {
      toast(e.message);
      throw e;
    }
  }

  async function deleteOptionGroup(groupId) {
    try {
      await api(`/restaurants/${restoId}/option-groups/${groupId}`, { method: 'DELETE', token });
      await loadDashboard(restoId);
      toast(t('menuPage.toastGroupDeleted'));
    } catch (e) {
      toast(e.message);
    }
  }

  async function createSection(name) {
    try {
      await api(`/restaurants/${restoId}/sections`, { method: 'POST', token, body: { name } });
      await loadDashboard(restoId);
      toast(t('menuPage.toastSectionCreated'));
    } catch (e) {
      toast(e.message);
      throw e;
    }
  }

  async function renameSection(sectionId, name) {
    try {
      await api(`/restaurants/${restoId}/sections/${sectionId}`, { method: 'PATCH', token, body: { name } });
      await loadDashboard(restoId);
      toast(t('menuPage.toastSectionRenamed'));
    } catch (e) {
      toast(e.message);
      throw e;
    }
  }

  // Photo utilisée par défaut pour les plats de cette section qui n'ont pas déjà leur propre photo
  // (voir resolveItemImage) — évite au restaurateur de devoir uploader la même photo plat par plat (ex:
  // une section "Mitraillettes" avec plusieurs variantes qui se ressemblent visuellement). Juste après
  // l'avoir choisie, on lui propose en plus de l'appliquer explicitement à des plats précis (voir
  // applyImageToItems ci-dessous) — utile par exemple pour écraser une photo déjà présente sur un plat.
  async function saveSectionImage(section, imageUrl) {
    const sectionItems = restaurant.menu.filter((i) => (i.category || 'plat') === section.name);
    try {
      await api(`/restaurants/${restoId}/sections/${section.id}`, { method: 'PATCH', token, body: { imageUrl } });
      await loadDashboard(restoId);
      toast(imageUrl ? t('menuPage.toastSectionPhotoSaved') : t('menuPage.toastSectionPhotoRemoved'));
      if (imageUrl && sectionItems.length > 0) {
        setSectionApplyPanel({ section: { ...section, imageUrl }, items: sectionItems });
        setApplySelectedIds(new Set(sectionItems.map((i) => i.id)));
      }
    } catch (e) {
      toast(e.message);
    } finally {
      setSectionGalleryFor(null);
    }
  }

  async function applyImageToItems() {
    if (!sectionApplyPanel || applySelectedIds.size === 0) return;
    setApplyingImage(true);
    try {
      const res = await api(`/restaurants/${restoId}/sections/${sectionApplyPanel.section.id}/apply-image`, {
        method: 'POST', token, body: { itemIds: [...applySelectedIds] }
      });
      await loadDashboard(restoId);
      toast(t('menuPage.toastPhotoApplied', { n: res.count }));
      setSectionApplyPanel(null);
    } catch (e) {
      toast(e.message);
    } finally {
      setApplyingImage(false);
    }
  }

  function toggleApplyItem(itemId) {
    setApplySelectedIds((prev) => {
      const next = new Set(prev);
      if (next.has(itemId)) next.delete(itemId); else next.add(itemId);
      return next;
    });
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
    setTimeout(() => document.getElementById(`ajout-plat-${section.id}`)?.scrollIntoView({ behavior: 'smooth', block: 'center' }), 50);
    setItemCategory(section.name);
    setItemName('');
    setItemPrice('');
    setItemImageUrl('');
  }

  function deleteSection(section) {
    const count = restaurant.menu.filter((i) => (i.category || 'plat') === section.name).length;
    // Section vide : rien à perdre, donc pas de confirmation — comme avant.
    if (count === 0) { doDeleteSection(section); return; }
    setConfirm({
      title: t('menuPage.deleteSectionConfirmTitle', { name: categoryLabel(section.name, t) }),
      message: t('menuPage.deleteSectionConfirmBody', { n: count }),
      confirmLabel: t('menuPage.deleteSection'),
      onConfirm: () => doDeleteSection(section)
    });
  }

  async function doDeleteSection(section) {
    if (confirmBusy) return;
    setConfirmBusy(true);
    try {
      await api(`/restaurants/${restoId}/sections/${section.id}`, { method: 'DELETE', token });
      await loadDashboard(restoId);
      toast(t('menuPage.toastSectionDeleted'));
    } catch (e) {
      toast(e.message);
    } finally {
      setConfirmBusy(false);
      setConfirm(null);
    }
  }

  async function addStarterTemplateItems(items) {
    if (!items.length) { toast(t('menuPage.toastPickOne')); return; }
    setAddingTemplate(true);
    try {
      await api(`/restaurants/${restoId}/menu/bulk`, { method: 'POST', token, body: { items } });
      setTemplateOpen(false);
      loadDashboard(restoId);
      toast(t('menuPage.toastDishesAdded', { n: items.length }));
    } catch (e) {
      toast(e.message);
    } finally {
      setAddingTemplate(false);
    }
  }

  // « Démarrer en 1 clic » : ajoute d'un coup la sélection rapide de plats typiques de la cuisine du commerce
  // (prix indicatifs) ; tout se corrige ensuite dans « Ton menu », plus bas.
  const platsUnClic = quickTemplateItems(restaurant.cuisine);
  function demarrerEnUnClic() { applyStarterItems(platsUnClic); }

  async function applyStarterItems(items) {
    if (!items.length) { toast(t('menuPage.toastPickOne')); return; }
    setApplyingStarter(true);
    try {
      await api(`/restaurants/${restoId}/menu/bulk`, { method: 'POST', token, body: { items } });
      setStartChoiceMade(true);
      setStarterPickerOpen(false);
      loadDashboard(restoId);
      toast(t('menuPage.toastDishesAddedEdit', { n: items.length }));
    } catch (e) {
      toast(e.message);
    } finally {
      setApplyingStarter(false);
    }
  }

  // Copier-coller guidé : les plateformes (Uber Eats, Deliveroo, Takeaway) bloquent la lecture automatique par lien,
  // mais le restaurateur, lui, a accès à sa page. On l'ouvre pour lui dans un nouvel onglet, il sélectionne tout,
  // copie, revient et colle : l'agent IA reconstruit la carte depuis le texte (import-text).
  const tactile = typeof window !== 'undefined' && window.matchMedia && window.matchMedia('(pointer: coarse)').matches;
  function urlDeMaPage() {
    const saisie = importUrl.trim();
    if (saisie) return /^https?:\/\//i.test(saisie) ? saisie : `https://${saisie}`;
    try { return localStorage.getItem('fairide_menu_source_url') || restaurant?.website || ''; } catch { return restaurant?.website || ''; }
  }
  function ouvrirMaPage() {
    const url = urlDeMaPage();
    if (!url) { toast(t('menuPage.toastUrlRequired')); importUrlRef.current?.focus(); return; }
    if (!importUrl.trim()) setImportUrl(url);
    window.open(url, '_blank', 'noopener');
  }
  function ouvrirCollage() {
    setImportTextOpen(true);
    setTimeout(() => { const el = document.getElementById('menu-import-textarea'); el?.scrollIntoView({ behavior: 'smooth', block: 'center' }); el?.focus(); }, 80);
  }
  async function collerDepuisPressePapiers() {
    try {
      const texte = await navigator.clipboard.readText();
      if (!texte || texte.trim().length < 40) { toast(t('menuPage.toastClipboardEmpty')); return; }
      setImportText(texte);
      toast(t('menuPage.toastPasted', { n: texte.length }));
    } catch { toast(t('menuPage.toastClipboardDenied')); }
  }

  async function handleImportUrl() {
    const url = importUrl.trim();
    if (!url) { toast(t('menuPage.toastUrlRequired')); importUrlRef.current?.focus(); return; }
    setImportingUrl(true);
    setImportedItems(null);
    try {
      const r = await api(`/restaurants/${restoId}/menu/import-url`, { method: 'POST', token, body: { url } });
      setImportedItems(r.items);
      try { localStorage.setItem('fairide_menu_source_url', url); } catch { /* rien */ }
    } catch (err) {
      toast(err.message);
      // Plateforme qui bloque la lecture : on ouvre tout de suite le plan B (copier-coller), sans rien redemander.
      if (/bloque|blocks|blokkeert|403|429/i.test(err.message || '')) { try { localStorage.setItem('fairide_menu_source_url', url); } catch { /* rien */ } ouvrirCollage(); }
    } finally {
      setImportingUrl(false);
    }
  }

  async function handleImportText() {
    const text = importText.trim();
    if (text.length < 40) { toast(t('menuPage.toastTextTooShort')); return; }
    setImportingText(true);
    setImportedItems(null);
    try {
      const r = await api(`/restaurants/${restoId}/menu/import-text`, { method: 'POST', token, body: { text } });
      setImportedItems(r.items);
      setImportText(''); setImportTextOpen(false);
    } catch (err) {
      toast(err.message);
    } finally {
      setImportingText(false);
    }
  }

  function allerALImportWeb() {
    setStartChoiceMade(true);
    setTimeout(() => { importUrlRef.current?.scrollIntoView({ behavior: 'smooth', block: 'center' }); importUrlRef.current?.focus(); }, 50);
  }
  function allerAuConcierge() {
    setStartChoiceMade(true);
    setTimeout(() => { document.getElementById('menu-concierge')?.scrollIntoView({ behavior: 'smooth', block: 'start' }); }, 50);
  }

  // « Geste prix » sur la carte déjà en ligne : tous les prix ± X % (arrondi au 0,10 €), après confirmation.
  const [ajustPct, setAjustPct] = useState('');
  const [ajustConfirm, setAjustConfirm] = useState(false);
  const [ajusting, setAjusting] = useState(false);
  async function ajusterTousLesPrix() {
    const percent = Number(ajustPct);
    if (!Number.isFinite(percent) || percent === 0) { toast(t('menuPage.adjustInvalid')); return; }
    setAjusting(true);
    try {
      const r = await api(`/restaurants/${restoId}/menu/adjust-prices`, { method: 'POST', token, body: { percent } });
      await loadDashboard(restoId);
      setAjustConfirm(false); setAjustPct('');
      toast(t('menuPage.adjustDone', { n: r.updated, p: `${percent > 0 ? '+' : ''}${percent} %` }));
    } catch (e) { toast(e.message); } finally { setAjusting(false); }
  }

  async function submitImportedItems(items, replaceExisting) {
    if (!items.length) { toast(t('menuPage.toastPickOne')); return; }
    setSubmittingImport(true);
    try {
      await api(`/restaurants/${restoId}/menu/bulk`, { method: 'POST', token, body: { items, replaceExisting } });
      setImportedItems(null); setImportReport(null);
      loadDashboard(restoId);
      toast(replaceExisting ? t('menuPage.toastMenuReplaced', { n: items.length }) : t('menuPage.toastImportedAdded', { n: items.length }));
    } catch (e) {
      toast(e.message);
    } finally {
      setSubmittingImport(false);
    }
  }

  async function addClassics(list, category, setBusy) {
    const items = missingClassicItems(restaurant.menu, list).map((it) => ({ ...it, category }));
    if (!items.length) { toast(t('menuPage.toastAllPresent')); return; }
    setBusy(true);
    try {
      await api(`/restaurants/${restoId}/menu/bulk`, { method: 'POST', token, body: { items } });
      loadDashboard(restoId);
      toast(t('menuPage.toastProductsAdded', { n: items.length }));
    } catch (e) {
      toast(e.message);
    } finally {
      setBusy(false);
    }
  }

  return (
    <div>
      {/* Bloc de traduction, placé avant l'import : un restaurateur qui vient d'importer sa carte
          enchaîne naturellement dessus. Le bouton est réutilisable — le serveur ne retraduit que
          les plats dont le texte a bougé depuis la dernière fois. */}
      {restaurant.menu.length > 0 && (
        <div className="card">
          <h3 style={{ margin: '0 0 6px', fontSize: 15 }}>{t('menuPage.translateTitle')}</h3>
          <p className="small" style={{ margin: '0 0 12px' }}>
            {t('menuPage.translateIntro')}
          </p>
          <button type="button" className="btn-teal" disabled={translating} onClick={translateMenu}>
            {translating ? t('menuPage.translating') : t('menuPage.translateButton')}
          </button>
        </div>
      )}
      {restaurant.menu.length > 0 && !modeAdmin && (
        <div className="card geste-prix-carte" id="menu-geste-prix">
          <h3 style={{ margin: '0 0 6px', fontSize: 15 }}>💚 {t('menuPage.adjustTitle')}</h3>
          <p className="small" style={{ margin: '0 0 10px' }}>{t('menuPage.adjustIntro')}</p>
          <div className="row" style={{ gap: 6, flexWrap: 'wrap', alignItems: 'center' }}>
            {[-20, -15, -10, -5, 5, 10].map((v) => (
              <button key={v} type="button" className={`chip${Number(ajustPct) === v ? ' active' : ''}`} onClick={() => setAjustPct(String(v))}>{v > 0 ? '+' : ''}{v} %</button>
            ))}
            <input type="number" step="1" min="-50" max="50" value={ajustPct} onChange={(e) => setAjustPct(e.target.value)} placeholder="%" style={{ width: 90 }} aria-label={t('menuPage.adjustCustom')} />
            <button type="button" className="btn-teal" style={{ padding: '6px 12px', fontSize: 13 }} disabled={!ajustPct || Number(ajustPct) === 0} onClick={() => setAjustConfirm(true)}>{t('menuPage.adjustButton')}</button>
          </div>
          {ajustConfirm && (
            <div className="card" style={{ marginTop: 10, padding: 12, border: '1px solid var(--line)' }}>
              <p className="small" style={{ margin: '0 0 8px' }}>{t('menuPage.adjustConfirm', { n: restaurant.menu.length, p: `${Number(ajustPct) > 0 ? '+' : ''}${Number(ajustPct)} %` })}</p>
              <div className="row" style={{ gap: 8 }}>
                <button type="button" className="btn-teal" disabled={ajusting} onClick={ajusterTousLesPrix}>{ajusting ? '…' : t('menuPage.adjustYes')}</button>
                <button type="button" className="btn-ghost" onClick={() => setAjustConfirm(false)}>{t('menuPage.adjustNo')}</button>
              </div>
            </div>
          )}
          <p className="small" style={{ margin: '8px 0 0', opacity: 0.75 }}>{t('menuPage.adjustAlt')} <Link to="/dashboard/promotions">{t('menuPage.adjustAltLink')}</Link></p>
        </div>
      )}
      <div className="card" id="menu-methodes">
        <h3 style={{ margin: '0 0 6px', fontSize: 15 }}>{t(modeAdmin ? 'menuPage.methodsTitleAdmin' : 'menuPage.methodsTitle')}</h3>
        <p className="small" style={{ margin: '0 0 14px' }}>{t(modeAdmin ? 'menuPage.methodsIntroAdmin' : 'menuPage.methodsIntro')}</p>
        {!importedItems && restaurant.menu.length === 0 && platsUnClic.length > 0 && (
          <div className="methode methode-un-clic">
            <div className="methode-tete"><span className="methode-num">🚀</span><h4>{t('menuPage.oneClickTitle')}</h4><span className="pill teal">{t('menuPage.oneClickFastest')}</span></div>
            <p className="small methode-sous">{t('menuPage.oneClickSub', { n: platsUnClic.length, cuisine: restaurant.cuisine })}</p>
            <div className="row" style={{ gap: 8, flexWrap: 'wrap' }}>
              <button type="button" className="btn-teal" disabled={applyingStarter} onClick={demarrerEnUnClic}>{applyingStarter ? '…' : t('menuPage.oneClickButton', { n: platsUnClic.length })}</button>
              <button type="button" className="btn-outline" onClick={() => { setStartChoiceMade(false); setStarterPickerOpen(true); setTimeout(() => document.getElementById('menu-demarrage')?.scrollIntoView({ behavior: 'smooth', block: 'start' }), 80); }}>{t('menuPage.oneClickChoose')}</button>
            </div>
          </div>
        )}

        {!importedItems && !modeAdmin && (
          <div className="methode" id="menu-concierge">
            <div className="methode-tete"><span className="methode-num">1</span><h4>{t('menuPage.method1Title')}</h4><span className="pill gold">{t('menuPage.recommended')}</span></div>
            <p className="small methode-sous">{t('menuPage.method1Sub')}</p>
            <MenuConciergeRequest restoId={restoId} urlSuggeree={importUrl} />
          </div>
        )}

        {!importedItems && (
          <div className="methode">
            <div className="methode-tete"><span className="methode-num">{num(2)}</span><h4>{t('menuPage.method2Title')}</h4></div>
            <p className="small methode-sous">{t('menuPage.method2Sub')}</p>
            <MenuImportStaging restoId={restoId} token={token} disabled={importingUrl || importingText}
              onBusy={setImporting}
              onDone={(items, bilans) => { setImportReport(bilans); setImportedItems(items); }} />
          </div>
        )}
        {!importedItems && (
          <div className="menu-import-web methode">
            <div className="methode-tete"><span className="methode-num">{num(3)}</span><h4>{t('menuPage.method3Title')}</h4></div>
            <p className="small" style={{ margin: '0 0 8px' }}>{t('menuPage.importUrlIntro')}</p>
            <div className="menu-import-web-row">
              <input ref={importUrlRef} id="menu-import-url" type="url" inputMode="url" value={importUrl} onChange={(e) => setImportUrl(e.target.value)}
                placeholder={t('menuPage.importUrlPlaceholder')} disabled={importingUrl} onKeyDown={(e) => { if (e.key === 'Enter') { e.preventDefault(); handleImportUrl(); } }} />
              <button type="button" className="btn-teal" disabled={importingUrl || importing} onClick={handleImportUrl}>
                {importingUrl ? t('menuPage.importUrlReading') : t('menuPage.importUrlButton')}
              </button>
            </div>
            <p className="small" style={{ margin: '6px 0 0', opacity: 0.8 }}>{t('menuPage.importUrlHint')}</p>
            <div className="copier-coller">
              <b>📋 {t('menuPage.copyPasteTitle')}</b>
              <p className="small" style={{ margin: '4px 0 8px' }}>{t('menuPage.copyPasteIntro')}</p>
              <ol className="copier-coller-etapes">
                <li>{t('menuPage.copyPasteStep1')} <button type="button" className="btn-outline" style={{ padding: '4px 10px', fontSize: 13, marginLeft: 6 }} onClick={ouvrirMaPage}>{t('menuPage.openMyPage')} ↗</button></li>
                <li>{tactile ? t('menuPage.copyPasteStep2Mobile') : t('menuPage.copyPasteStep2Desktop')}</li>
                <li>{t('menuPage.copyPasteStep3')} <button type="button" className="btn-teal" style={{ padding: '4px 10px', fontSize: 13, marginLeft: 6 }} onClick={ouvrirCollage}>{t('menuPage.copyPasteGo')}</button></li>
              </ol>
            </div>
          </div>
        )}
        {!importedItems && (
          <div className="methode">
            <div className="methode-tete"><span className="methode-num">{num(4)}</span><h4>{t('menuPage.method4Title')}</h4></div>
            <p className="small methode-sous">{t('menuPage.method4Sub')}</p>
            <div className="menu-import-text">
              {!importTextOpen ? (
                <button type="button" className="btn-outline" onClick={() => setImportTextOpen(true)}>{t('menuPage.importTextOpen2')}</button>
              ) : (
                <>
                  <p className="small" style={{ margin: '0 0 8px' }}>{t('menuPage.importTextIntro')}</p>
                  <textarea id="menu-import-textarea" rows={8} value={importText} onChange={(e) => setImportText(e.target.value)} placeholder={t('menuPage.importTextPlaceholder')} disabled={importingText} style={{ width: '100%' }} />
                  <div className="row" style={{ gap: 8, flexWrap: 'wrap', marginTop: 8 }}>
                    {typeof navigator !== 'undefined' && navigator.clipboard?.readText && (
                      <button type="button" className="btn-outline" disabled={importingText} onClick={collerDepuisPressePapiers}>📋 {t('menuPage.pasteFromClipboard')}</button>
                    )}
                    <button type="button" className="btn-teal" disabled={importingText} onClick={handleImportText}>{importingText ? t('menuPage.importUrlReading') : t('menuPage.importTextButton')}</button>
                    <button type="button" className="btn-ghost" disabled={importingText} onClick={() => { setImportTextOpen(false); setImportText(''); }}>{t('menuPage.cancel')}</button>
                  </div>
                </>
              )}
            </div>
          </div>
        )}
        {!importedItems && (
          <div className="methode">
            <div className="methode-tete"><span className="methode-num">{num(5)}</span><h4>{t('menuPage.method5Title')}</h4></div>
            <p className="small methode-sous">{t('menuPage.method5Sub')}</p>
            <div className="row" style={{ gap: 8, flexWrap: 'wrap' }}>
              {restaurant.menu.length === 0 && <button type="button" className="btn-outline" onClick={() => { setStartChoiceMade(false); setStarterPickerOpen(true); setTimeout(() => document.getElementById('menu-demarrage')?.scrollIntoView({ behavior: 'smooth', block: 'start' }), 80); }}>{t('menuPage.chooseStarterDishes', { n: fullTemplateItems(restaurant.cuisine).length })}</button>}
              <button type="button" className="btn-outline" onClick={() => { setStartChoiceMade(true); setTimeout(() => document.getElementById('menu-liste')?.scrollIntoView({ behavior: 'smooth', block: 'start' }), 80); }}>{t('menuPage.method5Button')}</button>
            </div>
          </div>
        )}
        {importedItems && importReport && <MenuImportReport bilans={importReport} />}
        {importedItems && (
          <MenuImportReview
            items={importedItems}
            existingItemCount={restaurant.menu.length}
            restoId={restoId}
            restaurant={restaurant}
            submitting={submittingImport}
            onSubmit={submitImportedItems}
            onCancel={() => { setImportedItems(null); setImportReport(null); }}
          />
        )}
      </div>

      {restaurant.menu.length === 0 && !startChoiceMade && (
        <div className="card" id="menu-demarrage" style={{ border: '2px solid var(--teal)' }}>
          <h3 style={{ margin: '0 0 6px', fontSize: 16 }}>{t('menuPage.quickStartTitle')}</h3>
          <p className="small" style={{ margin: '0 0 12px' }}>
            {t('menuPage.quickStart1')} <b>{restaurant.cuisine}</b>{t('menuPage.quickStart2')}
          </p>
          {!starterPickerOpen ? (
            <div className="row" style={{ gap: 8, flexWrap: 'wrap' }}>
              {platsUnClic.length > 0 && <button className="btn-teal" disabled={applyingStarter} onClick={demarrerEnUnClic}>{applyingStarter ? '…' : t('menuPage.oneClickButton', { n: platsUnClic.length })}</button>}
              <button className="btn-gold" onClick={allerAuConcierge}>{t('menuPage.quickStartConcierge')}</button>
              <button className="btn-teal" onClick={allerALImportWeb}>{t('menuPage.quickStartFromWeb')}</button>
              <button className="btn-teal" onClick={() => setStarterPickerOpen(true)}>
                {t('menuPage.chooseStarterDishes', { n: fullTemplateItems(restaurant.cuisine).length })}
              </button>
              <button className="btn-ghost" onClick={() => setStartChoiceMade(true)}>{t('menuPage.createMyself')}</button>
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

      <div className="card" id="menu-liste">
        <div className="row" style={{ justifyContent: 'space-between', alignItems: 'center', gap: 8 }}>
          <h3 style={{ margin: '0 0 4px', fontSize: 15 }}>{t('menuPage.yourMenu')}</h3>
          {!reorderSectionId && !selectSectionId && !creatingSection && (
            <button type="button" className="btn-teal menu-plus" onClick={() => setCreatingSection(true)} title={t('menuPage.newSection')} aria-label={t('menuPage.newSection')}>＋ <span>{t('menuPage.newSectionShort')}</span></button>
          )}
        </div>
        <p className="small" style={{ margin: '0 0 6px', fontWeight: 600 }}>{t('menuPage.afterCreateHelp')}</p>
        <p className="small" style={{ margin: '0 0 12px' }}>
          {t('menuPage.menuHelp')}
        </p>
        {restaurant.menu.length === 0 && (restaurant.sections || []).length === 0 && startChoiceMade && (
          <div className="small" style={{ marginBottom: 10 }}>{t('menuPage.noSection')}</div>
        )}
        {(restaurant.sections || []).map((section) => {
          const rawItems = restaurant.menu.filter((i) => (i.category || 'plat') === section.name);
          const order = localOrder[section.id];
          const items = order ? order.map((id) => rawItems.find((i) => i.id === id)).filter(Boolean) : rawItems;
          const image = section.imageUrl || categoryImage(section.name);
          const sectionSubsections = [...new Set(rawItems.map((i) => i.subsection).filter(Boolean))];
          const inReorder = reorderSectionId === section.id;
          const subsectionGroups = inReorder ? null : groupBySubsection(items, section.name, t);
          return (
            <div key={section.id} style={{ marginBottom: 16 }}>
              <div className="category-header" style={{ justifyContent: 'space-between' }}>
                <div className="row" style={{ gap: 8, alignItems: 'center' }}>
                  {image && <img loading="lazy" src={image} alt={section.name} />}
                  {editingSectionId === section.id ? (
                    <div className="row" style={{ gap: 6 }}>
                      <input style={{ width: 180 }} value={editSectionName} onChange={(e) => setEditSectionName(e.target.value)} />
                      <button className="btn-teal" style={{ padding: '4px 10px' }} onClick={() => handleSectionRename(section.id)}>OK</button>
                      <button className="btn-ghost" style={{ padding: '4px 10px' }} onClick={() => setEditingSectionId(null)}>{t('menuPage.cancel')}</button>
                    </div>
                  ) : (
                    <span>{categoryLabel(section.name, t)}</span>
                  )}
                </div>
                {editingSectionId !== section.id && (
                  <div className="row" style={{ gap: 4 }}>
                    {reorderSectionId === section.id ? (
                      <button type="button" className="btn-teal" style={{ padding: '4px 10px', fontSize: 12 }} onClick={() => toggleReorderSection(section.id)}>{t('menuPage.doneCheck')}</button>
                    ) : selectSectionId === section.id ? (
                      <button type="button" className="btn-teal" style={{ padding: '4px 10px', fontSize: 12 }} onClick={() => toggleSelectSection(section.id)}>{t('menuPage.doneCheck')}</button>
                    ) : !reorderSectionId && !selectSectionId && (
                      <>
                        <button type="button" className="btn-teal menu-plus" onClick={() => openAddItemTile(section)} title={t('menuPage.addItemTo', { section: categoryLabel(section.name, t) })} aria-label={t('menuPage.addItemTo', { section: categoryLabel(section.name, t) })}>＋</button>
                        <button type="button" className="btn-ghost" style={{ padding: '4px 8px' }} onClick={() => toggleSelectSection(section.id)} title={t('menuPage.selectSeveral')}>☑️</button>
                        <button type="button" className="btn-ghost" style={{ padding: '4px 8px' }} onClick={() => toggleReorderSection(section.id)} title={t('menuPage.reorder')}>↕️</button>
                        <button type="button" className="btn-ghost" style={{ padding: '4px 8px' }} onClick={() => setSectionGalleryFor(section)} title={t('menuPage.sectionPhoto')}>🖼️</button>
                        {section.imageUrl && (
                          <button type="button" className="btn-ghost" style={{ padding: '4px 8px' }} onClick={() => saveSectionImage(section, '')} title={t('menuPage.removeSectionPhoto')}>🖼️✕</button>
                        )}
                        <button type="button" className="btn-ghost" style={{ padding: '4px 8px' }} onClick={() => { setEditingSectionId(section.id); setEditSectionName(section.name); }} title={t('menuPage.renameSection')}>✏️</button>
                        <button type="button" className="btn-danger-ghost" style={{ padding: '4px 8px' }} onClick={() => deleteSection(section)} title={t('menuPage.deleteSection')}>🗑️</button>
                      </>
                    )}
                  </div>
                )}
              </div>
              {selectSectionId === section.id && (
                <div className="row" style={{ gap: 8, alignItems: 'center', margin: '6px 0 10px', flexWrap: 'wrap' }}>
                  <span className="small">{t('menuPage.nSelected', { n: selectedIds.size })}</span>
                  <button type="button" className="btn-danger-ghost" disabled={!selectedIds.size || bulkDeleting} onClick={bulkDeleteSelected}>
                    {bulkDeleting ? '...' : t('menuPage.deleteSelection')}
                  </button>
                </div>
              )}
              {reorderSectionId === section.id && (
                <p className="small" style={{ margin: '2px 0 10px' }}>{t('menuPage.dragHelp')}</p>
              )}
              <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={(e) => handleDragEnd(section, items, e)}>
                <SortableContext items={items.map((i) => i.id)} strategy={rectSortingStrategy}>
                  {inReorder ? (
                    <div className="menu-grid dashboard-menu-grid">
                      {items.map((item) => (
                        <MenuItemRow
                          key={item.id} item={item} onSave={saveMenuItem} onDelete={deleteMenuItem}
                          allOptionGroups={restaurant.optionGroups || []} onSetOptionGroups={saveMenuItemOptionGroups}
                          sections={restaurant.sections || []} reorderMode restoId={restoId} cuisine={restaurant.cuisine}
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
                              sections={restaurant.sections || []} reorderMode={false} restoId={restoId} cuisine={restaurant.cuisine}
                              selectMode={selectSectionId === section.id} selected={selectedIds.has(item.id)} onToggleSelect={toggleItemSelected}
                              existingSubsections={sectionSubsections}
                              onSaveTranslations={saveMenuItemTranslation}
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
                  <div className="card" id={`ajout-plat-${section.id}`} style={{ gridColumn: '1 / -1', marginBottom: 0 }}>
                    <div className="field"><label>{t('menuPage.name')}</label><input value={itemName} onChange={(e) => setItemName(e.target.value)} placeholder={t('menuPage.phDishName')} /></div>
                    <div className="field"><label>{t('menuPage.price')}</label><input type="number" step="0.5" value={itemPrice} onChange={(e) => setItemPrice(e.target.value)} placeholder="12.50" /></div>
                    <div className="field">
                      <label>{t('menuPage.imageOptional')}</label>
                      <div className="row" style={{ gap: 8, alignItems: 'center' }}>
                        {itemName.trim() && (
                          resolveItemImage({ name: itemName, category: itemCategory, imageUrl: itemImageUrl }, restaurant.sections) ? (
                            <img loading="lazy" src={resolveItemImage({ name: itemName, category: itemCategory, imageUrl: itemImageUrl }, restaurant.sections)} alt="" className="dish-thumb" style={{ flexShrink: 0 }} />
                          ) : (
                            <span className="dish-thumb-empty">{categoryEmoji(itemCategory)}</span>
                          )
                        )}
                        <input style={{ flex: 1 }} value={itemImageUrl} onChange={(e) => setItemImageUrl(e.target.value)} placeholder={t('menuPage.phPhotoUrl')} />
                      </div>
                      <button type="button" className="btn-ghost" style={{ marginTop: 6 }} onClick={() => setAddItemGalleryOpen(true)}>
                        {t('menuPage.fromGallery')}
                      </button>
                    </div>
                    <div className="row" style={{ gap: 8 }}>
                      <button className="btn-teal" onClick={addMenuItem}>{t('menuPage.add')}</button>
                      <button className="btn-ghost" onClick={() => setAddSectionId(null)}>{t('menuPage.close')}</button>
                    </div>
                    {addItemGalleryOpen && (
                      <GalleryPickerModal
                        restoId={restoId}
                        suggestions={galleryForSection(restaurant.cuisine, itemCategory)}
                        suggestionsTitle={t('menuPage.suggestedPhotos', { section: categoryLabel(itemCategory, t) })}
                        onSelect={(url) => { setItemImageUrl(url); setAddItemGalleryOpen(false); }}
                        onCancel={() => setAddItemGalleryOpen(false)}
                      />
                    )}
                  </div>
                ) : (
                  <button type="button" className="menu-item-card menu-item-card-add" onClick={() => openAddItemTile(section)}>
                    <span className="menu-item-card-add-plus" aria-hidden="true">＋</span>
                    {t('menuPage.addItem').replace(/^\+\s*/, '')}
                  </button>
                ))}
              </div>
            </div>
          );
        })}
        {!reorderSectionId && !selectSectionId && (creatingSection ? (
          <div className="row" style={{ gap: 8 }}>
            <input style={{ flex: 1 }} value={newSectionName} onChange={(e) => setNewSectionName(e.target.value)} placeholder={t('menuPage.phSectionName')} />
            <button className="btn-teal" style={{ padding: '4px 10px' }} onClick={handleSectionCreate}>{t('menuPage.create')}</button>
            <button className="btn-ghost" style={{ padding: '4px 10px' }} onClick={() => setCreatingSection(false)}>{t('menuPage.cancel')}</button>
          </div>
        ) : (
          <button type="button" className="btn-ghost" onClick={() => setCreatingSection(true)}>{t('menuPage.newSection')}</button>
        ))}
      </div>

      {sectionGalleryFor && (
        <GalleryPickerModal
          restoId={restoId}
          title={t('menuPage.sectionPhotoTitle', { section: categoryLabel(sectionGalleryFor.name, t) })}
          suggestions={galleryForSection(restaurant.cuisine, sectionGalleryFor.name)}
          suggestionsTitle={t('menuPage.suggestedPhotos', { section: categoryLabel(sectionGalleryFor.name, t) })}
          currentImageUrl={sectionGalleryFor.imageUrl}
          onSelect={(url) => saveSectionImage(sectionGalleryFor, url)}
          onCancel={() => setSectionGalleryFor(null)}
        />
      )}

      {sectionApplyPanel && createPortal(
        <div className="modal-overlay" onClick={() => setSectionApplyPanel(null)}>
          <div className="modal-box" onClick={(e) => e.stopPropagation()}>
            <h3 style={{ margin: '0 0 4px', fontSize: 16 }}>{t('menuPage.applyPhotoTo')}</h3>
            <p className="small" style={{ margin: '0 0 12px' }}>
              {t('menuPage.applyPanelHelp', { section: categoryLabel(sectionApplyPanel.section.name, t) })}
            </p>
            <div className="row" style={{ gap: 8, marginBottom: 10 }}>
              <button type="button" className="btn-ghost" style={{ padding: '4px 10px', fontSize: 12 }} onClick={() => setApplySelectedIds(new Set(sectionApplyPanel.items.map((i) => i.id)))}>
                {t('menuPage.selectAll')}
              </button>
              <button type="button" className="btn-ghost" style={{ padding: '4px 10px', fontSize: 12 }} onClick={() => setApplySelectedIds(new Set())}>
                {t('menuPage.deselectAll')}
              </button>
            </div>
            <div style={{ maxHeight: 260, overflowY: 'auto', marginBottom: 14 }}>
              {sectionApplyPanel.items.map((item) => (
                <label key={item.id} className="row" style={{ gap: 8, marginBottom: 6, cursor: 'pointer' }}>
                  <input
                    type="checkbox"
                    style={{ width: 'auto' }}
                    checked={applySelectedIds.has(item.id)}
                    onChange={() => toggleApplyItem(item.id)}
                  />
                  <span>{item.name}</span>
                  {item.imageUrl && item.imageUrl !== sectionApplyPanel.section.imageUrl && (
                    <span className="small" style={{ opacity: 0.7 }}>{t('menuPage.hasOwnPhoto')}</span>
                  )}
                </label>
              ))}
            </div>
            <div className="row" style={{ gap: 8 }}>
              <button className="btn-teal" disabled={applyingImage || applySelectedIds.size === 0} onClick={applyImageToItems}>
                {applyingImage ? '...' : t('menuPage.applyToN', { n: applySelectedIds.size })}
              </button>
              <button className="btn-ghost" disabled={applyingImage} onClick={() => setSectionApplyPanel(null)}>{t('menuPage.skip')}</button>
            </div>
          </div>
        </div>,
        document.body
      )}

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
              {addingClassicDrinks ? '...' : t('menuPage.addClassicDrinks')}
            </button>
            <button type="button" className="btn-ghost" disabled={addingClassicDesserts} onClick={() => addClassics(CLASSIC_DESSERTS, 'dessert', setAddingClassicDesserts)}>
              {addingClassicDesserts ? '...' : t('menuPage.addClassicDesserts')}
            </button>
          </div>

          {!templateOpen && (
            <button type="button" className="btn-ghost" onClick={() => setTemplateOpen(true)}>{t('menuPage.pickMoreTemplate')}</button>
          )}
          {templateOpen && (
            <div className="card">
              <h3 style={{ margin: '0 0 6px', fontSize: 15 }}>{t('menuPage.typicalDishes', { cuisine: restaurant.cuisine })}</h3>
              <p className="small" style={{ margin: '0 0 10px' }}>{t('menuPage.pickHelp')}</p>
              <TemplatePicker
                template={getStarterTemplate(restaurant.cuisine)}
                submitting={addingTemplate}
                submitLabel={t('menuPage.addSelection')}
                onSubmit={addStarterTemplateItems}
                onCancel={() => setTemplateOpen(false)}
              />
            </div>
          )}
        </>
      )}

      <ConfirmDialog
        open={!!confirm}
        title={confirm?.title}
        message={confirm?.message}
        confirmLabel={confirm?.confirmLabel}
        danger
        loading={confirmBusy}
        onConfirm={() => confirm?.onConfirm?.()}
        onCancel={() => { if (!confirmBusy) setConfirm(null); }}
      />
    </div>
  );
}
