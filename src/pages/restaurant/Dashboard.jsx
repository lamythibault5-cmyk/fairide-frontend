import { useEffect, useState } from 'react';
import { createPortal } from 'react-dom';
import { api } from '../../api';
import { useAuth } from '../../context/AuthContext';
import { useToast } from '../../context/ToastContext';
import { DeliveryTiming, ProgressBar, statusLabel, deliveryInstructionLabel, formatOrderItem } from '../../orderStatus';
import {
  CATEGORIES, COMMUNES, RESTAURANT_TYPES, categoryImage, getStarterTemplate,
  fullTemplateItems, quickTemplateItems, CLASSIC_DRINKS, CLASSIC_DESSERTS, missingClassicItems
} from '../../menuCategories';
import { SkeletonCards } from '../../components/Skeleton';
import { StarsDisplay } from '../../components/Stars';
import MenuItemRow from '../../components/MenuItemRow';
import OptionGroupManager from '../../components/OptionGroupManager';

const RESTO_DELETION_REASONS = [
  'Je ferme mon commerce',
  'Je change de plateforme de livraison',
  'Trop peu de commandes',
  'Problème avec les commissions ou les livreurs',
  'Erreur de création, je recommence',
  'Autre raison'
];

export default function Dashboard() {
  const { token } = useAuth();
  const toast = useToast();
  const [myRestos, setMyRestos] = useState(null);
  const [restoId, setRestoId] = useState(null);
  const [restaurant, setRestaurant] = useState(null);
  const [orders, setOrders] = useState([]);

  const [newRestoOpen, setNewRestoOpen] = useState(false);
  const [name, setName] = useState('');
  const [commune, setCommune] = useState(COMMUNES[0]);
  const [neighborhood, setNeighborhood] = useState('');
  const [cuisine, setCuisine] = useState(RESTAURANT_TYPES[0].value);
  const [customCuisine, setCustomCuisine] = useState('');
  const [desc, setDesc] = useState('');
  const [addressStreet, setAddressStreet] = useState('');
  const [addressNumber, setAddressNumber] = useState('');
  const [addressPostalCode, setAddressPostalCode] = useState('');
  const [coverImageUrl, setCoverImageUrl] = useState('');
  const [openingHours, setOpeningHours] = useState('');

  const [editOpen, setEditOpen] = useState(false);
  const [editDesc, setEditDesc] = useState('');
  const [editCuisine, setEditCuisine] = useState('');
  const [editCustomCuisine, setEditCustomCuisine] = useState('');
  const [editCommune, setEditCommune] = useState('');
  const [editNeighborhood, setEditNeighborhood] = useState('');
  const [editAddressStreet, setEditAddressStreet] = useState('');
  const [editAddressNumber, setEditAddressNumber] = useState('');
  const [editAddressPostalCode, setEditAddressPostalCode] = useState('');
  const [editCover, setEditCover] = useState('');
  const [editOpeningHours, setEditOpeningHours] = useState('');
  const [editOpenFlag, setEditOpenFlag] = useState(true);
  const [savingResto, setSavingResto] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [confirmDelete, setConfirmDelete] = useState(false);
  const [deleteReason, setDeleteReason] = useState(RESTO_DELETION_REASONS[0]);
  const [deleteComment, setDeleteComment] = useState('');
  const [deleteCodeSent, setDeleteCodeSent] = useState(false);
  const [sendingDeleteCode, setSendingDeleteCode] = useState(false);
  const [deleteCode, setDeleteCode] = useState('');

  const [itemName, setItemName] = useState('');
  const [itemPrice, setItemPrice] = useState('');
  const [itemCategory, setItemCategory] = useState('plat');
  const [itemImageUrl, setItemImageUrl] = useState('');

  const [templateOpen, setTemplateOpen] = useState(false);
  const [templatePicked, setTemplatePicked] = useState(() => new Set());
  const [addingTemplate, setAddingTemplate] = useState(false);
  const [startChoiceMade, setStartChoiceMade] = useState(false);
  const [applyingStarter, setApplyingStarter] = useState(false);
  const [addingClassicDrinks, setAddingClassicDrinks] = useState(false);
  const [addingClassicDesserts, setAddingClassicDesserts] = useState(false);
  const [selectedOrder, setSelectedOrder] = useState(null);
  const [pickupCodeInputs, setPickupCodeInputs] = useState({});
  const [confirmingPickup, setConfirmingPickup] = useState(null);

  const [reviews, setReviews] = useState(null);
  const [subscribing, setSubscribing] = useState(false);
  const [pausingSub, setPausingSub] = useState(false);
  const [resumingSub, setResumingSub] = useState(false);
  const [cancelingSub, setCancelingSub] = useState(false);
  const [confirmCancelSub, setConfirmCancelSub] = useState(false);
  const [now, setNow] = useState(() => new Date());

  useEffect(() => {
    const clock = setInterval(() => setNow(new Date()), 30000);
    return () => clearInterval(clock);
  }, []);

  useEffect(() => {
    api('/restaurants/mine/dashboard', { token }).then(setMyRestos).catch((e) => toast(e.message));
    if (new URLSearchParams(window.location.search).get('subscribed')) {
      toast('Merci ! Ton abonnement est en cours d\'activation (quelques secondes).');
      window.history.replaceState({}, '', '/dashboard');
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    if (!restoId) return;
    const interval = setInterval(() => loadDashboard(restoId), 15000);
    return () => clearInterval(interval);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [restoId]);

  async function loadDashboard(id) {
    try {
      const [ordersData, restoData, reviewsData] = await Promise.all([
        api(`/orders/restaurant/${id}`, { token }),
        api(`/restaurants/${id}`),
        api(`/restaurants/${id}/reviews`)
      ]);
      setOrders(ordersData);
      setRestaurant(restoData);
      setReviews(reviewsData);
      setEditDesc(restoData.desc || '');
      const knownType = RESTAURANT_TYPES.some((t) => t.value === restoData.cuisine);
      setEditCuisine(knownType ? restoData.cuisine : 'Autre');
      setEditCustomCuisine(knownType ? '' : (restoData.cuisine || ''));
      setEditCommune(restoData.commune || COMMUNES[0]);
      setEditNeighborhood(restoData.neighborhood || '');
      setEditAddressStreet(restoData.addressStreet || '');
      setEditAddressNumber(restoData.addressNumber || '');
      setEditAddressPostalCode(restoData.addressPostalCode || '');
      setEditCover(restoData.coverImageUrl || '');
      setEditOpeningHours(restoData.openingHours || '');
      setEditOpenFlag(restoData.open);
    } catch (e) {
      toast(e.message);
    }
  }

  function pickResto(id) {
    setRestoId(id);
    setEditOpen(false);
    setConfirmDelete(false);
    setStartChoiceMade(false);
    loadDashboard(id);
  }

  async function createResto() {
    if (!name.trim()) { toast('Donne un nom à ton restaurant.'); return; }
    if (!addressStreet.trim() || !addressNumber.trim() || !addressPostalCode.trim()) {
      toast("Donne l'adresse complète du restaurant (rue, numéro, code postal) pour les livreurs et la carte.");
      return;
    }
    const finalCuisine = cuisine === 'Autre' ? customCuisine.trim() || 'Autre' : cuisine;
    try {
      const r = await api('/restaurants', {
        method: 'POST', token,
        body: {
          name: name.trim(), commune, neighborhood: neighborhood.trim(), cuisine: finalCuisine, desc: desc.trim(),
          addressStreet: addressStreet.trim(), addressNumber: addressNumber.trim(), addressPostalCode: addressPostalCode.trim(), addressCity: commune,
          coverImageUrl: coverImageUrl.trim(), openingHours: openingHours.trim()
        }
      });
      setMyRestos((prev) => [...prev, r]);
      setName(''); setCuisine(RESTAURANT_TYPES[0].value); setCustomCuisine(''); setNeighborhood(''); setDesc('');
      setAddressStreet(''); setAddressNumber(''); setAddressPostalCode('');
      setCoverImageUrl(''); setOpeningHours(''); setNewRestoOpen(false);
      pickResto(r.id);
      toast('Restaurant créé !');
    } catch (e) {
      toast(e.message);
    }
  }

  async function saveRestoInfo() {
    setSavingResto(true);
    const finalCuisine = editCuisine === 'Autre' ? editCustomCuisine.trim() || 'Autre' : editCuisine;
    try {
      const r = await api(`/restaurants/${restoId}`, {
        method: 'PATCH', token,
        body: {
          desc: editDesc.trim(), cuisine: finalCuisine, commune: editCommune, neighborhood: editNeighborhood.trim(),
          addressStreet: editAddressStreet.trim(), addressNumber: editAddressNumber.trim(), addressPostalCode: editAddressPostalCode.trim(), addressCity: editCommune,
          coverImageUrl: editCover.trim(), openingHours: editOpeningHours.trim(), open: editOpenFlag
        }
      });
      setRestaurant(r);
      setMyRestos((prev) => prev.map((x) => (x.id === r.id ? { ...x, name: r.name } : x)));
      toast('Restaurant mis à jour.');
    } catch (e) {
      toast(e.message);
    } finally {
      setSavingResto(false);
    }
  }

  async function sendDeleteCode() {
    setSendingDeleteCode(true);
    try {
      await api(`/restaurants/${restoId}/request-deletion`, { method: 'POST', token });
      setDeleteCodeSent(true);
      toast('Code envoyé par email.');
    } catch (e) {
      toast(e.message);
    } finally {
      setSendingDeleteCode(false);
    }
  }

  async function deleteRestaurant() {
    if (!deleteCode) { toast('Entre le code reçu par email.'); return; }
    setDeleting(true);
    try {
      await api(`/restaurants/${restoId}`, { method: 'DELETE', token, body: { code: deleteCode, reason: deleteReason, comment: deleteComment.trim() } });
      setMyRestos((prev) => prev.filter((x) => x.id !== restoId));
      setRestoId(null);
      setRestaurant(null);
      setEditOpen(false);
      setConfirmDelete(false);
      setDeleteCode('');
      setDeleteCodeSent(false);
      setDeleteComment('');
      toast('Restaurant supprimé.');
    } catch (e) {
      toast(e.message);
    } finally {
      setDeleting(false);
    }
  }

  async function orderAction(orderId, action) {
    try {
      await api(`/orders/${orderId}/${action}`, { method: 'PATCH', token });
      loadDashboard(restoId);
    } catch (e) {
      toast(e.message);
    }
  }

  async function confirmPickup(orderId) {
    const code = (pickupCodeInputs[orderId] || '').trim();
    if (!code) { toast('Demande le code de retrait au livreur.'); return; }
    setConfirmingPickup(orderId);
    try {
      await api(`/orders/${orderId}/confirm-pickup`, { method: 'PATCH', token, body: { code } });
      setPickupCodeInputs((prev) => { const next = { ...prev }; delete next[orderId]; return next; });
      toast('Retrait confirmé, le client est prévenu !');
      loadDashboard(restoId);
    } catch (e) {
      toast(e.message);
    } finally {
      setConfirmingPickup(null);
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

  async function subscribeNow() {
    setSubscribing(true);
    try {
      const r = await api(`/restaurants/${restoId}/subscription/checkout`, { method: 'POST', token });
      window.location.href = r.checkoutUrl;
    } catch (e) {
      toast(e.message);
      setSubscribing(false);
    }
  }

  async function pauseSubscription() {
    setPausingSub(true);
    try {
      await api(`/restaurants/${restoId}/subscription/pause`, { method: 'POST', token });
      await loadDashboard(restoId);
      toast('Abonnement mis en pause — ton restaurant n\'est plus visible aux clients.');
    } catch (e) {
      toast(e.message);
    } finally {
      setPausingSub(false);
    }
  }

  async function resumeSubscription() {
    setResumingSub(true);
    try {
      await api(`/restaurants/${restoId}/subscription/resume`, { method: 'POST', token });
      await loadDashboard(restoId);
      toast('Abonnement repris — ton restaurant est de nouveau visible aux clients.');
    } catch (e) {
      toast(e.message);
    } finally {
      setResumingSub(false);
    }
  }

  async function cancelSubscription() {
    setCancelingSub(true);
    try {
      await api(`/restaurants/${restoId}/subscription/cancel`, { method: 'POST', token });
      await loadDashboard(restoId);
      setConfirmCancelSub(false);
      toast('Abonnement résilié — ton restaurant n\'est plus visible aux clients.');
    } catch (e) {
      toast(e.message);
    } finally {
      setCancelingSub(false);
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

  function toggleTemplateCategory(cat) {
    setTemplatePicked((prev) => {
      const next = new Set(prev);
      if (next.has(cat)) next.delete(cat); else next.add(cat);
      return next;
    });
  }

  async function addStarterTemplate() {
    const template = getStarterTemplate(restaurant.cuisine);
    const items = [];
    templatePicked.forEach((cat) => {
      template[cat].forEach((it) => items.push({ ...it, category: cat }));
    });
    if (!items.length) { toast('Choisis au moins une catégorie.'); return; }
    setAddingTemplate(true);
    try {
      await api(`/restaurants/${restoId}/menu/bulk`, { method: 'POST', token, body: { items } });
      setTemplatePicked(new Set());
      setTemplateOpen(false);
      loadDashboard(restoId);
      toast(`${items.length} plat(s) ajouté(s) au menu.`);
    } catch (e) {
      toast(e.message);
    } finally {
      setAddingTemplate(false);
    }
  }

  async function applyStarter(size) {
    const items = size === 'complet' ? fullTemplateItems(restaurant.cuisine) : quickTemplateItems(restaurant.cuisine);
    setApplyingStarter(true);
    try {
      await api(`/restaurants/${restoId}/menu/bulk`, { method: 'POST', token, body: { items } });
      setStartChoiceMade(true);
      loadDashboard(restoId);
      toast(`${items.length} plat(s) ajouté(s) — modifie ou supprime ce dont tu n'as pas besoin.`);
    } catch (e) {
      toast(e.message);
    } finally {
      setApplyingStarter(false);
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

  async function deleteMenuItem(itemId) {
    try {
      await api(`/restaurants/${restoId}/menu/${itemId}`, { method: 'DELETE', token });
      loadDashboard(restoId);
    } catch (e) {
      toast(e.message);
    }
  }

  async function setItemPromo(itemId, body) {
    try {
      await api(`/restaurants/${restoId}/menu/${itemId}/promotions`, { method: 'POST', token, body });
      await loadDashboard(restoId);
      toast('Promotion activée sur ce plat !');
    } catch (e) {
      toast(e.message);
      throw e;
    }
  }

  async function clearItemPromo(promoId) {
    try {
      await api(`/promotions/${promoId}`, { method: 'DELETE', token });
      loadDashboard(restoId);
    } catch (e) {
      toast(e.message);
    }
  }

  if (!myRestos) return <SkeletonCards count={2} />;

  const delivered = orders.filter((o) => o.status === 'livre');
  const revenue = orders.reduce((a, o) => a + o.subtotal, 0);
  const commissionPaid = orders.reduce((a, o) => a + o.commission, 0);
  const saved = revenue * 0.30 - commissionPaid;

  return (
    <div>
      <div className="card">
        <h2 style={{ marginTop: 0 }}>Mon restaurant</h2>
        <div className="row" style={{ marginBottom: 10 }}>
          <select style={{ flex: 1 }} value={restoId || ''} onChange={(e) => e.target.value && pickResto(e.target.value)}>
            <option value="">— Choisir un restaurant —</option>
            {myRestos.map((r) => <option key={r.id} value={r.id}>{r.name}</option>)}
          </select>
        </div>
        {!newRestoOpen && myRestos.length === 0 && (
          <button type="button" className="btn-ghost" onClick={() => setNewRestoOpen(true)}>+ Créer mon restaurant</button>
        )}
        {myRestos.length > 0 && (
          <p className="small" style={{ margin: 0 }}>Un compte restaurateur ne peut gérer qu'un seul restaurant sur Fairide.</p>
        )}
        {newRestoOpen && (
          <div style={{ marginTop: 10 }}>
            <div className="field"><label>Nom</label><input value={name} onChange={(e) => setName(e.target.value)} /></div>
            <div className="field">
              <label>Commune</label>
              <select value={commune} onChange={(e) => setCommune(e.target.value)}>
                {COMMUNES.map((c) => <option key={c}>{c}</option>)}
              </select>
            </div>
            <div className="field"><label>Quartier (optionnel)</label><input value={neighborhood} onChange={(e) => setNeighborhood(e.target.value)} placeholder="Ex: Châtelain, Flagey..." /></div>
            <div className="field"><label>Rue / Avenue (pour les livreurs et la carte)</label><input value={addressStreet} onChange={(e) => setAddressStreet(e.target.value)} placeholder="Rue du Midi" /></div>
            <div className="row" style={{ gap: 8 }}>
              <div className="field" style={{ flex: 1 }}>
                <label>Numéro</label>
                <input value={addressNumber} onChange={(e) => setAddressNumber(e.target.value)} placeholder="12" />
              </div>
              <div className="field" style={{ flex: 1 }}>
                <label>Code postal</label>
                <input value={addressPostalCode} onChange={(e) => setAddressPostalCode(e.target.value)} placeholder="1000" />
              </div>
            </div>
            <div className="field">
              <label>Type de restaurant</label>
              <select value={cuisine} onChange={(e) => setCuisine(e.target.value)}>
                {RESTAURANT_TYPES.map((t) => <option key={t.value} value={t.value}>{t.emoji} {t.value}</option>)}
              </select>
            </div>
            {cuisine === 'Autre' && (
              <div className="field"><label>Précise le type</label><input value={customCuisine} onChange={(e) => setCustomCuisine(e.target.value)} placeholder="Ex: Grec, Mexicain..." /></div>
            )}
            <div className="field"><label>Description</label><input value={desc} onChange={(e) => setDesc(e.target.value)} /></div>
            <div className="field"><label>Image de couverture (URL)</label><input value={coverImageUrl} onChange={(e) => setCoverImageUrl(e.target.value)} placeholder="https://..." /></div>
            <div className="field"><label>Horaires d'ouverture (optionnel)</label><input value={openingHours} onChange={(e) => setOpeningHours(e.target.value)} placeholder="Ex: Lun-Ven 11h-22h, Sam-Dim 12h-23h" /></div>
            <button className="btn-teal" onClick={createResto}>Créer</button>
          </div>
        )}
      </div>

      {restaurant && (
        <div className="card" style={{ border: `2px solid ${['active', 'trialing'].includes(restaurant.subscriptionStatus) ? 'var(--teal)' : 'var(--red)'}` }}>
          <p className="small" style={{ margin: '0 0 10px', opacity: 0.7 }}>
            Aujourd'hui : {now.toLocaleDateString('fr-BE', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' })} à {now.toLocaleTimeString('fr-BE', { hour: '2-digit', minute: '2-digit' })}
          </p>

          {restaurant.subscriptionStatus === 'trialing' && (
            <>
              <h3 style={{ margin: '0 0 6px', fontSize: 16 }}>✅ Essai gratuit en cours</h3>
              <p className="small" style={{ margin: '0 0 12px' }}>
                Ton restaurant est visible aux clients. Premier mois offert
                {restaurant.subscriptionCurrentPeriodEnd ? ` — premier prélèvement (20€) le ${new Date(restaurant.subscriptionCurrentPeriodEnd).toLocaleDateString('fr-BE', { day: 'numeric', month: 'long', year: 'numeric' })}.` : '.'}
              </p>
            </>
          )}
          {restaurant.subscriptionStatus === 'active' && (
            <>
              <h3 style={{ margin: '0 0 6px', fontSize: 16 }}>✅ Abonnement actif</h3>
              <p className="small" style={{ margin: '0 0 12px' }}>
                Ton restaurant est visible aux clients.
                {restaurant.subscriptionCurrentPeriodEnd ? ` Prochain prélèvement (20€) le ${new Date(restaurant.subscriptionCurrentPeriodEnd).toLocaleDateString('fr-BE', { day: 'numeric', month: 'long', year: 'numeric' })}.` : ''}
              </p>
            </>
          )}
          {restaurant.subscriptionStatus === 'past_due' && (
            <>
              <h3 style={{ margin: '0 0 6px', fontSize: 16 }}>⚠️ Paiement de l'abonnement échoué</h3>
              <p className="small" style={{ margin: '0 0 12px' }}>
                Le dernier prélèvement de ton abonnement Fairide (20€/mois) a échoué. Ton restaurant n'est plus visible aux clients tant que ce n'est pas régularisé.
              </p>
            </>
          )}
          {restaurant.subscriptionStatus === 'paused' && (
            <>
              <h3 style={{ margin: '0 0 6px', fontSize: 16 }}>⏸️ Abonnement en pause</h3>
              <p className="small" style={{ margin: '0 0 12px' }}>
                Ton restaurant n'est plus visible aux clients et ne reçoit plus de commandes. Aucun prélèvement tant qu'il reste en pause.
              </p>
            </>
          )}
          {restaurant.subscriptionStatus === 'canceled' && (
            <>
              <h3 style={{ margin: '0 0 6px', fontSize: 16 }}>❌ Abonnement résilié</h3>
              <p className="small" style={{ margin: '0 0 12px' }}>Ton restaurant n'est plus visible aux clients.</p>
            </>
          )}
          {restaurant.subscriptionStatus === 'inactive' && (
            <>
              <h3 style={{ margin: '0 0 6px', fontSize: 16 }}>🔒 Restaurant pas encore visible aux clients</h3>
              <p className="small" style={{ margin: '0 0 12px' }}>
                Un abonnement Fairide à 20€/mois est nécessaire pour apparaître dans les résultats et recevoir des commandes —
                le premier mois est offert, tu ne seras débité qu'au mois suivant.
              </p>
            </>
          )}

          {['inactive', 'past_due', 'canceled'].includes(restaurant.subscriptionStatus) && (
            <button className="btn-gold" disabled={subscribing} onClick={subscribeNow}>
              {subscribing ? '...' : "S'abonner — 20€/mois (1er mois offert)"}
            </button>
          )}
          {['trialing', 'active', 'past_due'].includes(restaurant.subscriptionStatus) && (
            <div className="row" style={{ gap: 8, flexWrap: 'wrap' }}>
              <button className="btn-ghost" disabled={pausingSub} onClick={pauseSubscription}>{pausingSub ? '...' : '⏸️ Mettre en pause'}</button>
              {!confirmCancelSub && (
                <button className="btn-danger-ghost" onClick={() => setConfirmCancelSub(true)}>Résilier l'abonnement</button>
              )}
            </div>
          )}
          {restaurant.subscriptionStatus === 'paused' && (
            <div className="row" style={{ gap: 8, flexWrap: 'wrap' }}>
              <button className="btn-teal" disabled={resumingSub} onClick={resumeSubscription}>{resumingSub ? '...' : 'Reprendre l\'abonnement'}</button>
              {!confirmCancelSub && (
                <button className="btn-danger-ghost" onClick={() => setConfirmCancelSub(true)}>Résilier l'abonnement</button>
              )}
            </div>
          )}
          {confirmCancelSub && (
            <div style={{ marginTop: 10 }}>
              <p className="small" style={{ color: 'var(--red)', marginBottom: 8 }}>
                Es-tu sûr ? Ton restaurant disparaîtra immédiatement des résultats clients. Il faudra un nouvel abonnement pour redevenir visible.
              </p>
              <div className="row" style={{ gap: 8 }}>
                <button className="btn-outline" style={{ borderColor: 'var(--red)', color: 'var(--red)' }} disabled={cancelingSub} onClick={cancelSubscription}>
                  {cancelingSub ? '...' : 'Oui, résilier'}
                </button>
                <button className="btn-ghost" onClick={() => setConfirmCancelSub(false)}>Annuler</button>
              </div>
            </div>
          )}
        </div>
      )}

      {restaurant && (
        <>
          {restaurant.coverImageUrl && <img src={restaurant.coverImageUrl} alt={restaurant.name} className="cover-banner" />}

          <div className="row" style={{ gap: 6, marginBottom: 10 }}>
            <StarsDisplay value={restaurant.rating} size={16} />
            <span className="small">{restaurant.reviewCount > 0 ? `${restaurant.rating.toFixed(1)} (${restaurant.reviewCount} avis)` : 'Pas encore d\'avis'}</span>
          </div>

          <div className="stat-grid">
            <div className="stat-card"><div className="num">{orders.length}</div><div className="label">Commandes</div></div>
            <div className="stat-card"><div className="num">{delivered.length}</div><div className="label">Livrées</div></div>
            <div className="stat-card"><div className="num">{revenue.toFixed(0)}€</div><div className="label">CA plats</div></div>
            <div className="stat-card highlight"><div className="num">{saved > 0 ? saved.toFixed(0) : '0'}€</div><div className="label">Économisé vs les grandes plateformes</div></div>
          </div>

          {!editOpen && (
            <button type="button" className="btn-ghost" style={{ marginBottom: 14 }} onClick={() => setEditOpen(true)}>✏️ Modifier les infos du restaurant</button>
          )}
          {editOpen && (
            <div className="card">
              <h3 style={{ margin: '0 0 10px', fontSize: 15 }}>Infos du restaurant</h3>
              <div className="field">
                <label>Commune</label>
                <select value={editCommune} onChange={(e) => setEditCommune(e.target.value)}>
                  {COMMUNES.map((c) => <option key={c}>{c}</option>)}
                </select>
              </div>
              <div className="field"><label>Quartier (optionnel)</label><input value={editNeighborhood} onChange={(e) => setEditNeighborhood(e.target.value)} placeholder="Ex: Châtelain, Flagey..." /></div>
              <div className="field"><label>Rue / Avenue (pour les livreurs et la carte)</label><input value={editAddressStreet} onChange={(e) => setEditAddressStreet(e.target.value)} placeholder="Rue du Midi" /></div>
              <div className="row" style={{ gap: 8 }}>
                <div className="field" style={{ flex: 1 }}>
                  <label>Numéro</label>
                  <input value={editAddressNumber} onChange={(e) => setEditAddressNumber(e.target.value)} placeholder="12" />
                </div>
                <div className="field" style={{ flex: 1 }}>
                  <label>Code postal</label>
                  <input value={editAddressPostalCode} onChange={(e) => setEditAddressPostalCode(e.target.value)} placeholder="1000" />
                </div>
              </div>
              <div className="field">
                <label>Type de restaurant</label>
                <select value={editCuisine} onChange={(e) => setEditCuisine(e.target.value)}>
                  {RESTAURANT_TYPES.map((t) => <option key={t.value} value={t.value}>{t.emoji} {t.value}</option>)}
                </select>
              </div>
              {editCuisine === 'Autre' && (
                <div className="field"><label>Précise le type</label><input value={editCustomCuisine} onChange={(e) => setEditCustomCuisine(e.target.value)} placeholder="Ex: Grec, Mexicain..." /></div>
              )}
              <div className="field"><label>Description</label><input value={editDesc} onChange={(e) => setEditDesc(e.target.value)} /></div>
              <div className="field"><label>Image de couverture (URL)</label><input value={editCover} onChange={(e) => setEditCover(e.target.value)} placeholder="https://..." /></div>
              <div className="field"><label>Horaires d'ouverture (optionnel)</label><input value={editOpeningHours} onChange={(e) => setEditOpeningHours(e.target.value)} placeholder="Ex: Lun-Ven 11h-22h, Sam-Dim 12h-23h" /></div>
              <label className="row" style={{ gap: 8, marginBottom: 12, cursor: 'pointer' }}>
                <input type="checkbox" style={{ width: 'auto' }} checked={editOpenFlag} onChange={(e) => setEditOpenFlag(e.target.checked)} />
                <span className="small">Restaurant ouvert (visible aux clients)</span>
              </label>
              <div className="row" style={{ gap: 8 }}>
                <button className="btn-teal" disabled={savingResto} onClick={saveRestoInfo}>{savingResto ? '...' : 'Enregistrer'}</button>
                <button className="btn-ghost" onClick={() => setEditOpen(false)}>Fermer</button>
              </div>
              <div className="divider" />
              {!confirmDelete && (
                <button className="btn-danger-ghost" onClick={() => setConfirmDelete(true)}>🗑️ Supprimer ce restaurant</button>
              )}
              {confirmDelete && (
                <div>
                  <p className="small" style={{ color: 'var(--red)', marginBottom: 8 }}>
                    Es-tu sûr ? Cette action est irréversible (plats supprimés aussi). Impossible si des commandes existent déjà.
                  </p>
                  <div className="field">
                    <label>Pourquoi supprimes-tu ce restaurant ?</label>
                    <select value={deleteReason} onChange={(e) => setDeleteReason(e.target.value)}>
                      {RESTO_DELETION_REASONS.map((r) => <option key={r} value={r}>{r}</option>)}
                    </select>
                  </div>
                  <div className="field">
                    <label>Un commentaire (optionnel)</label>
                    <input value={deleteComment} onChange={(e) => setDeleteComment(e.target.value)} placeholder="Aide-nous à nous améliorer..." />
                  </div>
                  {!deleteCodeSent && (
                    <div className="row" style={{ gap: 8 }}>
                      <button className="btn-outline" style={{ borderColor: 'var(--red)', color: 'var(--red)' }} disabled={sendingDeleteCode} onClick={sendDeleteCode}>
                        {sendingDeleteCode ? '...' : 'Recevoir un code de validation de suppression'}
                      </button>
                      <button className="btn-ghost" onClick={() => setConfirmDelete(false)}>Annuler</button>
                    </div>
                  )}
                  {deleteCodeSent && (
                    <>
                      <p className="small" style={{ marginBottom: 10 }}>
                        Un code de validation de suppression vient de t'être envoyé par email. Entre-le ci-dessous pour finaliser la suppression.
                      </p>
                      <div className="field">
                        <label>Code reçu par email</label>
                        <input value={deleteCode} onChange={(e) => setDeleteCode(e.target.value)} placeholder="123456" maxLength={6} />
                      </div>
                      <div className="row" style={{ gap: 8 }}>
                        <button className="btn-outline" style={{ borderColor: 'var(--red)', color: 'var(--red)' }} disabled={deleting} onClick={deleteRestaurant}>
                          {deleting ? '...' : 'Oui, supprimer définitivement'}
                        </button>
                        <button className="btn-ghost" disabled={sendingDeleteCode} onClick={sendDeleteCode}>Renvoyer le code</button>
                        <button className="btn-ghost" onClick={() => { setConfirmDelete(false); setDeleteCodeSent(false); setDeleteCode(''); }}>Annuler</button>
                      </div>
                    </>
                  )}
                </div>
              )}
            </div>
          )}

          {reviews && reviews.reviews.length > 0 && (
            <div className="card">
              <h3 style={{ margin: '0 0 10px', fontSize: 15 }}>Avis clients</h3>
              {reviews.reviews.map((r, i) => (
                <div key={i} style={{ padding: '6px 0', borderBottom: '1px solid var(--cream-dim)' }}>
                  <div className="row" style={{ justifyContent: 'space-between' }}>
                    <b style={{ fontSize: 13 }}>{r.clientName}</b>
                    <StarsDisplay value={r.foodRating} />
                  </div>
                  {r.foodComment && <p className="small" style={{ margin: '4px 0 0' }}>{r.foodComment}</p>}
                </div>
              ))}
            </div>
          )}

          <div className="two-col">
            <div>
              <h2 className="section-title" style={{ marginTop: 0 }}>Commandes entrantes</h2>
              {orders.length === 0 && <div className="empty">Pas encore de commande.</div>}
              {orders.map((o) => (
                <div className="card order-card-clickable" key={o.id} onClick={() => setSelectedOrder(o)}>
                  <div className="row" style={{ justifyContent: 'space-between' }}>
                    <b>{o.clientName}</b>
                    <span className={`status-badge status-${o.status}`}>{statusLabel(o.status)}</span>
                  </div>
                  <ProgressBar status={o.status} />
                  <DeliveryTiming order={o} />
                  <div className="small" style={{ margin: '6px 0' }}>{o.items.map(formatOrderItem).join(', ')}</div>
                  <div className="small">📍 {o.address}</div>
                  {o.clientPhone && <div className="small">📞 {o.clientPhone}</div>}
                  {o.driverName && ['preparation', 'pret'].includes(o.status) && (
                    <div className="small" style={{ fontWeight: 600 }}>🛵 Livreur assigné : {o.driverName}</div>
                  )}
                  <div className="row" style={{ marginTop: 10, gap: 8 }} onClick={(e) => e.stopPropagation()}>
                    {o.status === 'nouveau' && (
                      <>
                        <button className="btn-teal" style={{ padding: '8px 14px', fontSize: 13 }} onClick={() => orderAction(o.id, 'accept')}>Accepter</button>
                        <button className="btn-outline" style={{ padding: '8px 14px', fontSize: 13 }} onClick={() => orderAction(o.id, 'refuse')}>Refuser</button>
                      </>
                    )}
                    {o.status === 'preparation' && (
                      <button className="btn-gold" style={{ padding: '8px 14px', fontSize: 13 }} onClick={() => orderAction(o.id, 'ready')}>Marquer prêt</button>
                    )}
                  </div>
                  {o.status === 'pret' && o.driverId && (
                    <div className="row" style={{ marginTop: 10, gap: 8 }} onClick={(e) => e.stopPropagation()}>
                      <input
                        placeholder="Code du livreur"
                        style={{ maxWidth: 140 }}
                        value={pickupCodeInputs[o.id] || ''}
                        onChange={(e) => setPickupCodeInputs((prev) => ({ ...prev, [o.id]: e.target.value }))}
                      />
                      <button className="btn-teal" style={{ padding: '8px 14px', fontSize: 13 }} disabled={confirmingPickup === o.id} onClick={() => confirmPickup(o.id)}>
                        {confirmingPickup === o.id ? '...' : 'Confirmer le retrait'}
                      </button>
                    </div>
                  )}
                  {o.status === 'pret' && !o.driverId && (
                    <p className="small" style={{ marginTop: 8, marginBottom: 0 }}>En attente qu'un livreur prenne en charge la commande...</p>
                  )}
                </div>
              ))}
            </div>
            <div>
              <h2 className="section-title" style={{ marginTop: 0 }}>Menu</h2>

              {restaurant.menu.length === 0 && !startChoiceMade && (
                <div className="card" style={{ border: '2px solid var(--teal)' }}>
                  <h3 style={{ margin: '0 0 6px', fontSize: 16 }}>🚀 Démarrez en 1 clic</h3>
                  <p className="small" style={{ margin: '0 0 12px' }}>
                    Votre type de commerce est <b>{restaurant.cuisine}</b>. Fairide peut générer un menu complet tout de suite —
                    vous n'aurez plus qu'à modifier les prix, les photos et supprimer ce que vous ne vendez pas.
                  </p>
                  <div className="row" style={{ gap: 8, flexWrap: 'wrap' }}>
                    <button className="btn-teal" disabled={applyingStarter} onClick={() => applyStarter('rapide')}>
                      {applyingStarter ? '...' : `⚡ Menu rapide (${quickTemplateItems(restaurant.cuisine).length} produits)`}
                    </button>
                    <button className="btn-gold" disabled={applyingStarter} onClick={() => applyStarter('complet')}>
                      {applyingStarter ? '...' : `🍽 Menu complet (${fullTemplateItems(restaurant.cuisine).length} produits)`}
                    </button>
                    <button className="btn-ghost" onClick={() => setStartChoiceMade(true)}>✏️ Je crée moi-même mon menu</button>
                  </div>
                </div>
              )}

              <div className="card">
                {restaurant.menu.length === 0 && startChoiceMade && <div className="small">Pas encore de plat au menu.</div>}
                {CATEGORIES.map((cat) => {
                  const items = restaurant.menu.filter((i) => (i.category || 'plat') === cat.value);
                  if (!items.length) return null;
                  return (
                    <div key={cat.value} style={{ marginBottom: 10 }}>
                      <div className="category-header">
                        {cat.image && <img src={cat.image} alt={cat.label} />}
                        <span>{cat.label}</span>
                      </div>
                      {items.map((item) => (
                        <MenuItemRow
                          key={item.id} item={item} onSave={saveMenuItem} onDelete={deleteMenuItem}
                          onSetPromo={setItemPromo} onClearPromo={clearItemPromo}
                          allOptionGroups={restaurant.optionGroups || []} onSetOptionGroups={saveMenuItemOptionGroups}
                        />
                      ))}
                    </div>
                  );
                })}
              </div>

              <OptionGroupManager
                groups={restaurant.optionGroups || []}
                onCreate={createOptionGroup}
                onUpdate={updateOptionGroup}
                onDelete={deleteOptionGroup}
              />

              {(restaurant.menu.length > 0 || startChoiceMade) && (
                <div className="row" style={{ gap: 8, flexWrap: 'wrap', marginBottom: 10 }}>
                  <button type="button" className="btn-ghost" disabled={addingClassicDrinks} onClick={() => addClassics(CLASSIC_DRINKS, 'boisson', setAddingClassicDrinks)}>
                    {addingClassicDrinks ? '...' : '+ Ajouter les boissons classiques'}
                  </button>
                  <button type="button" className="btn-ghost" disabled={addingClassicDesserts} onClick={() => addClassics(CLASSIC_DESSERTS, 'dessert', setAddingClassicDesserts)}>
                    {addingClassicDesserts ? '...' : '+ Ajouter les desserts classiques'}
                  </button>
                </div>
              )}

              {!templateOpen && (
                <button type="button" className="btn-ghost" onClick={() => setTemplateOpen(true)}>+ Utiliser un menu de démarrage (par catégorie)</button>
              )}
              {templateOpen && (
                <div className="card">
                  <h3 style={{ margin: '0 0 6px', fontSize: 15 }}>Menu de démarrage — {restaurant.cuisine}</h3>
                  <p className="small" style={{ margin: '0 0 10px' }}>Sélectionne des catégories pour ajouter des plats types adaptés à ton type de restaurant — tu pourras ensuite les modifier ou les supprimer.</p>
                  {CATEGORIES.map((cat) => (
                    <label key={cat.value} className="row" style={{ gap: 8, marginBottom: 6, cursor: 'pointer' }}>
                      <input type="checkbox" style={{ width: 'auto' }} checked={templatePicked.has(cat.value)} onChange={() => toggleTemplateCategory(cat.value)} />
                      <span>{cat.label}</span>
                      <span className="small">({getStarterTemplate(restaurant.cuisine)[cat.value].map((i) => i.name).join(', ')})</span>
                    </label>
                  ))}
                  <div className="row" style={{ marginTop: 10, gap: 8 }}>
                    <button className="btn-teal" disabled={addingTemplate} onClick={addStarterTemplate}>
                      {addingTemplate ? '...' : 'Ajouter la sélection'}
                    </button>
                    <button className="btn-ghost" onClick={() => setTemplateOpen(false)}>Annuler</button>
                  </div>
                </div>
              )}

              <div className="card">
                <h3 style={{ margin: '0 0 10px', fontSize: 15 }}>Ajouter un plat</h3>
                <div className="field"><label>Nom</label><input value={itemName} onChange={(e) => setItemName(e.target.value)} placeholder="Poke bowl saumon" /></div>
                <div className="field"><label>Prix (€)</label><input type="number" step="0.5" value={itemPrice} onChange={(e) => setItemPrice(e.target.value)} placeholder="12.50" /></div>
                <div className="field">
                  <label>Catégorie</label>
                  <select value={itemCategory} onChange={(e) => setItemCategory(e.target.value)}>
                    {CATEGORIES.map((c) => <option key={c.value} value={c.value}>{c.label}</option>)}
                  </select>
                </div>
                <div className="field"><label>Image (URL)</label><input value={itemImageUrl} onChange={(e) => setItemImageUrl(e.target.value)} placeholder="https://..." /></div>
                <button className="btn-teal" onClick={addMenuItem}>Ajouter au menu</button>
              </div>
            </div>
          </div>
        </>
      )}

      {selectedOrder && createPortal(
        <div className="modal-overlay" onClick={() => setSelectedOrder(null)}>
          <div className="modal-box" onClick={(e) => e.stopPropagation()}>
            <div className="row" style={{ justifyContent: 'space-between', marginBottom: 8 }}>
              <h3 style={{ margin: 0 }}>Commande de {selectedOrder.clientName}</h3>
              <span className={`status-badge status-${selectedOrder.status}`}>{statusLabel(selectedOrder.status)}</span>
            </div>
            <DeliveryTiming order={selectedOrder} />
            <div className="divider" />
            <h4 style={{ margin: '0 0 6px' }}>Articles</h4>
            {selectedOrder.items.map((i) => (
              <div key={i.itemId} className="row" style={{ justifyContent: 'space-between', padding: '4px 0', alignItems: 'flex-start' }}>
                <span>
                  {i.qty}× {i.name}{i.discount > 0 ? ' 🏷️' : ''}
                  {i.options?.length > 0 && <span className="small" style={{ display: 'block' }}>{i.options.map((o) => o.name).join(', ')}</span>}
                </span>
                <span>{(i.price * i.qty - (i.discount || 0)).toFixed(2)}€</span>
              </div>
            ))}
            <div className="divider" />
            <div className="breakdown">
              <div className="line"><span>Sous-total</span><span>{selectedOrder.subtotal.toFixed(2)}€</span></div>
              {selectedOrder.promoDiscount > 0 && <div className="line"><span>Promo {selectedOrder.promoLabel}</span><span>-{selectedOrder.promoDiscount.toFixed(2)}€</span></div>}
              <div className="line"><span>Livraison</span><span>{selectedOrder.deliveryFee.toFixed(2)}€</span></div>
              {selectedOrder.serviceFee > 0 && <div className="line"><span>Frais de service</span><span>{selectedOrder.serviceFee.toFixed(2)}€</span></div>}
              {selectedOrder.balanceUsed > 0 && <div className="line"><span>Solde client utilisé</span><span>-{selectedOrder.balanceUsed.toFixed(2)}€</span></div>}
              <div className="line total"><span>Total payé</span><span>{selectedOrder.total.toFixed(2)}€</span></div>
            </div>
            <div className="divider" />
            <h4 style={{ margin: '0 0 6px' }}>Livraison</h4>
            <p className="small" style={{ margin: '4px 0' }}>📍 {selectedOrder.address}</p>
            {selectedOrder.clientPhone && <p className="small" style={{ margin: '4px 0' }}>📞 {selectedOrder.clientPhone}</p>}
            {selectedOrder.deliveryInstructions && <p className="small" style={{ margin: '4px 0' }}>🔑 {deliveryInstructionLabel(selectedOrder.deliveryInstructions)}</p>}
            {selectedOrder.deliveryNote && <p className="small" style={{ margin: '4px 0' }}>📝 {selectedOrder.deliveryNote}</p>}
            {selectedOrder.driverName && <p className="small" style={{ margin: '4px 0' }}>🛵 Livreur : {selectedOrder.driverName}{selectedOrder.driverPhone ? ` · ${selectedOrder.driverPhone}` : ''}</p>}
            {selectedOrder.status === 'pret' && selectedOrder.driverId && (
              <div className="row" style={{ marginTop: 10, gap: 8 }}>
                <input
                  placeholder="Code du livreur"
                  style={{ maxWidth: 140 }}
                  value={pickupCodeInputs[selectedOrder.id] || ''}
                  onChange={(e) => setPickupCodeInputs((prev) => ({ ...prev, [selectedOrder.id]: e.target.value }))}
                />
                <button className="btn-teal" style={{ padding: '8px 14px', fontSize: 13 }} disabled={confirmingPickup === selectedOrder.id} onClick={() => confirmPickup(selectedOrder.id)}>
                  {confirmingPickup === selectedOrder.id ? '...' : 'Confirmer le retrait'}
                </button>
              </div>
            )}
            <button className="btn-ghost" style={{ marginTop: 12 }} onClick={() => setSelectedOrder(null)}>Fermer</button>
          </div>
        </div>,
        document.body
      )}
    </div>
  );
}
