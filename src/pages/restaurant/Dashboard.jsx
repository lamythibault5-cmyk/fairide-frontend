import { useEffect, useState } from 'react';
import { api } from '../../api';
import { useAuth } from '../../context/AuthContext';
import { useToast } from '../../context/ToastContext';
import { DeliveryTiming, ProgressBar, statusLabel } from '../../orderStatus';
import { CATEGORIES, COMMUNES, RESTAURANT_TYPES, categoryImage, getStarterTemplate } from '../../menuCategories';
import { SkeletonCards } from '../../components/Skeleton';
import MenuItemRow from '../../components/MenuItemRow';

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
  const [address, setAddress] = useState('');
  const [coverImageUrl, setCoverImageUrl] = useState('');

  const [editOpen, setEditOpen] = useState(false);
  const [editDesc, setEditDesc] = useState('');
  const [editCuisine, setEditCuisine] = useState('');
  const [editCustomCuisine, setEditCustomCuisine] = useState('');
  const [editCommune, setEditCommune] = useState('');
  const [editNeighborhood, setEditNeighborhood] = useState('');
  const [editAddress, setEditAddress] = useState('');
  const [editCover, setEditCover] = useState('');
  const [editOpenFlag, setEditOpenFlag] = useState(true);
  const [savingResto, setSavingResto] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [confirmDelete, setConfirmDelete] = useState(false);

  const [itemName, setItemName] = useState('');
  const [itemPrice, setItemPrice] = useState('');
  const [itemCategory, setItemCategory] = useState('plat');
  const [itemImageUrl, setItemImageUrl] = useState('');

  const [templateOpen, setTemplateOpen] = useState(false);
  const [templatePicked, setTemplatePicked] = useState(() => new Set());
  const [addingTemplate, setAddingTemplate] = useState(false);

  useEffect(() => {
    api('/restaurants/mine/dashboard', { token }).then(setMyRestos).catch((e) => toast(e.message));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  async function loadDashboard(id) {
    try {
      const [ordersData, restoData] = await Promise.all([
        api(`/orders/restaurant/${id}`, { token }),
        api(`/restaurants/${id}`)
      ]);
      setOrders(ordersData);
      setRestaurant(restoData);
      setEditDesc(restoData.desc || '');
      const knownType = RESTAURANT_TYPES.some((t) => t.value === restoData.cuisine);
      setEditCuisine(knownType ? restoData.cuisine : 'Autre');
      setEditCustomCuisine(knownType ? '' : (restoData.cuisine || ''));
      setEditCommune(restoData.commune || COMMUNES[0]);
      setEditNeighborhood(restoData.neighborhood || '');
      setEditAddress(restoData.address || '');
      setEditCover(restoData.coverImageUrl || '');
      setEditOpenFlag(restoData.open);
    } catch (e) {
      toast(e.message);
    }
  }

  function pickResto(id) {
    setRestoId(id);
    setEditOpen(false);
    setConfirmDelete(false);
    loadDashboard(id);
  }

  async function createResto() {
    if (!name.trim()) { toast('Donne un nom à ton restaurant.'); return; }
    if (!address.trim()) { toast("Donne l'adresse du restaurant (pour les livreurs)."); return; }
    const finalCuisine = cuisine === 'Autre' ? customCuisine.trim() || 'Autre' : cuisine;
    try {
      const r = await api('/restaurants', {
        method: 'POST', token,
        body: { name: name.trim(), commune, neighborhood: neighborhood.trim(), cuisine: finalCuisine, desc: desc.trim(), address: address.trim(), coverImageUrl: coverImageUrl.trim() }
      });
      setMyRestos((prev) => [...prev, r]);
      setName(''); setCuisine(RESTAURANT_TYPES[0].value); setCustomCuisine(''); setNeighborhood(''); setDesc(''); setAddress(''); setCoverImageUrl(''); setNewRestoOpen(false);
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
        body: { desc: editDesc.trim(), cuisine: finalCuisine, commune: editCommune, neighborhood: editNeighborhood.trim(), address: editAddress.trim(), coverImageUrl: editCover.trim(), open: editOpenFlag }
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

  async function deleteRestaurant() {
    setDeleting(true);
    try {
      await api(`/restaurants/${restoId}`, { method: 'DELETE', token });
      setMyRestos((prev) => prev.filter((x) => x.id !== restoId));
      setRestoId(null);
      setRestaurant(null);
      setEditOpen(false);
      setConfirmDelete(false);
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

  async function deleteMenuItem(itemId) {
    try {
      await api(`/restaurants/${restoId}/menu/${itemId}`, { method: 'DELETE', token });
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
        {!newRestoOpen && (
          <button type="button" className="btn-ghost" onClick={() => setNewRestoOpen(true)}>+ Créer un nouveau restaurant</button>
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
            <div className="field"><label>Adresse (pour les livreurs)</label><input value={address} onChange={(e) => setAddress(e.target.value)} placeholder="Rue..., n°, commune" /></div>
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
            <button className="btn-teal" onClick={createResto}>Créer</button>
          </div>
        )}
      </div>

      {restaurant && (
        <>
          {restaurant.coverImageUrl && <img src={restaurant.coverImageUrl} alt={restaurant.name} className="cover-banner" />}

          <div className="stat-grid">
            <div className="stat-card"><div className="num">{orders.length}</div><div className="label">Commandes</div></div>
            <div className="stat-card"><div className="num">{delivered.length}</div><div className="label">Livrées</div></div>
            <div className="stat-card"><div className="num">{revenue.toFixed(0)}€</div><div className="label">CA plats</div></div>
            <div className="stat-card highlight"><div className="num">{saved > 0 ? saved.toFixed(0) : '0'}€</div><div className="label">Économisé vs Uber Eats</div></div>
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
              <div className="field"><label>Adresse (pour les livreurs)</label><input value={editAddress} onChange={(e) => setEditAddress(e.target.value)} placeholder="Rue..., n°, commune" /></div>
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
                  <div className="row" style={{ gap: 8 }}>
                    <button className="btn-outline" style={{ borderColor: 'var(--red)', color: 'var(--red)' }} disabled={deleting} onClick={deleteRestaurant}>
                      {deleting ? '...' : 'Oui, supprimer définitivement'}
                    </button>
                    <button className="btn-ghost" onClick={() => setConfirmDelete(false)}>Annuler</button>
                  </div>
                </div>
              )}
            </div>
          )}

          <div className="two-col">
            <div>
              <h2 className="section-title" style={{ marginTop: 0 }}>Commandes entrantes</h2>
              {orders.length === 0 && <div className="empty">Pas encore de commande.</div>}
              {orders.map((o) => (
                <div className="card" key={o.id}>
                  <div className="row" style={{ justifyContent: 'space-between' }}>
                    <b>{o.clientName}</b>
                    <span className={`status-badge status-${o.status}`}>{statusLabel(o.status)}</span>
                  </div>
                  <ProgressBar status={o.status} />
                  <DeliveryTiming order={o} />
                  <div className="small" style={{ margin: '6px 0' }}>{o.items.map((i) => `${i.qty}× ${i.name}`).join(', ')}</div>
                  <div className="small">📍 {o.address}</div>
                  {o.clientPhone && <div className="small">📞 {o.clientPhone}</div>}
                  <div className="row" style={{ marginTop: 10, gap: 8 }}>
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
                </div>
              ))}
            </div>
            <div>
              <h2 className="section-title" style={{ marginTop: 0 }}>Menu</h2>
              <div className="card">
                {restaurant.menu.length === 0 && <div className="small">Pas encore de plat au menu.</div>}
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
                        <MenuItemRow key={item.id} item={item} onSave={saveMenuItem} onDelete={deleteMenuItem} />
                      ))}
                    </div>
                  );
                })}
              </div>

              {!templateOpen && (
                <button type="button" className="btn-ghost" onClick={() => setTemplateOpen(true)}>+ Utiliser un menu de démarrage</button>
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
    </div>
  );
}
