import { useEffect, useState } from 'react';
import { api } from '../../api';
import { useAuth } from '../../context/AuthContext';
import { useToast } from '../../context/ToastContext';
import { ProgressBar, statusLabel } from '../../orderStatus';

const COMMUNES = ['Ixelles', 'Saint-Gilles', 'Etterbeek', 'Schaerbeek', 'Uccle', 'Woluwe-Saint-Lambert', 'Woluwe-Saint-Pierre'];

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
  const [cuisine, setCuisine] = useState('');
  const [desc, setDesc] = useState('');

  const [itemName, setItemName] = useState('');
  const [itemPrice, setItemPrice] = useState('');

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
    } catch (e) {
      toast(e.message);
    }
  }

  function pickResto(id) {
    setRestoId(id);
    loadDashboard(id);
  }

  async function createResto() {
    if (!name.trim()) { toast('Donne un nom à ton restaurant.'); return; }
    try {
      const r = await api('/restaurants', { method: 'POST', token, body: { name: name.trim(), commune, cuisine: cuisine.trim(), desc: desc.trim() } });
      setMyRestos((prev) => [...prev, r]);
      setName(''); setCuisine(''); setDesc(''); setNewRestoOpen(false);
      pickResto(r.id);
      toast('Restaurant créé !');
    } catch (e) {
      toast(e.message);
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
      await api(`/restaurants/${restoId}/menu`, { method: 'POST', token, body: { name: itemName.trim(), price } });
      setItemName(''); setItemPrice('');
      loadDashboard(restoId);
      toast('Plat ajouté au menu.');
    } catch (e) {
      toast(e.message);
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

  if (!myRestos) return <div className="small">Chargement…</div>;

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
            <div className="field"><label>Type de cuisine</label><input value={cuisine} onChange={(e) => setCuisine(e.target.value)} placeholder="Ex: Belge, Italien..." /></div>
            <div className="field"><label>Description</label><input value={desc} onChange={(e) => setDesc(e.target.value)} /></div>
            <button className="btn-teal" onClick={createResto}>Créer</button>
          </div>
        )}
      </div>

      {restaurant && (
        <>
          <div className="stat-grid">
            <div className="stat-card"><div className="num">{orders.length}</div><div className="label">Commandes</div></div>
            <div className="stat-card"><div className="num">{delivered.length}</div><div className="label">Livrées</div></div>
            <div className="stat-card"><div className="num">{revenue.toFixed(0)}€</div><div className="label">CA plats</div></div>
            <div className="stat-card highlight"><div className="num">{saved > 0 ? saved.toFixed(0) : '0'}€</div><div className="label">Économisé vs Uber Eats</div></div>
          </div>

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
                  <div className="small" style={{ margin: '6px 0' }}>{o.items.map((i) => `${i.qty}× ${i.name}`).join(', ')}</div>
                  <div className="small">📍 {o.address}</div>
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
                {restaurant.menu.map((item) => (
                  <div className="menu-item" key={item.id}>
                    <span>{item.name}</span>
                    <div className="row" style={{ gap: 10 }}>
                      <span className="price">{item.price.toFixed(2)}€</span>
                      <button className="btn-danger-ghost" onClick={() => deleteMenuItem(item.id)}>Supprimer</button>
                    </div>
                  </div>
                ))}
              </div>
              <div className="card">
                <h3 style={{ margin: '0 0 10px', fontSize: 15 }}>Ajouter un plat</h3>
                <div className="field"><label>Nom</label><input value={itemName} onChange={(e) => setItemName(e.target.value)} placeholder="Poke bowl saumon" /></div>
                <div className="field"><label>Prix (€)</label><input type="number" step="0.5" value={itemPrice} onChange={(e) => setItemPrice(e.target.value)} placeholder="12.50" /></div>
                <button className="btn-teal" onClick={addMenuItem}>Ajouter au menu</button>
              </div>
            </div>
          </div>
        </>
      )}
    </div>
  );
}
