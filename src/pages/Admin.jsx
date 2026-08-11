import { useEffect, useState } from 'react';
import { createPortal } from 'react-dom';
import { api } from '../api';
import { useAuth } from '../context/AuthContext';
import { useToast } from '../context/ToastContext';
import { SkeletonCards } from '../components/Skeleton';

const TABS = ['Stats', 'Clients', 'Livreurs', 'Restaurants', 'Commandes', 'Avis'];

export default function Admin() {
  const { token } = useAuth();
  const toast = useToast();
  const [tab, setTab] = useState('Stats');
  const [stats, setStats] = useState(null);
  const [users, setUsers] = useState(null);
  const [userSearch, setUserSearch] = useState('');
  const [orders, setOrders] = useState(null);
  const [reviews, setReviews] = useState(null);
  const [restaurants, setRestaurants] = useState(null);
  const [drivers, setDrivers] = useState(null);
  const [balanceInputs, setBalanceInputs] = useState({});

  const [selectedDriver, setSelectedDriver] = useState(null);
  const [driverOrders, setDriverOrders] = useState(null);
  const [selectedRestaurant, setSelectedRestaurant] = useState(null);
  const [restaurantDetail, setRestaurantDetail] = useState(null);
  const [restaurantOrders, setRestaurantOrders] = useState(null);

  useEffect(() => { api('/admin/stats', { token }).then(setStats).catch((e) => toast(e.message)); }, []); // eslint-disable-line

  function loadUsers() {
    setUsers(null);
    api(`/admin/users${userSearch ? `?search=${encodeURIComponent(userSearch)}` : ''}`, { token }).then(setUsers).catch((e) => toast(e.message));
  }

  useEffect(() => {
    if (tab === 'Clients' && users === null) loadUsers();
    if (tab === 'Commandes' && orders === null) api('/admin/orders', { token }).then(setOrders).catch((e) => toast(e.message));
    if (tab === 'Avis' && reviews === null) api('/admin/reviews', { token }).then(setReviews).catch((e) => toast(e.message));
    if (tab === 'Restaurants' && restaurants === null) api('/admin/restaurants', { token }).then(setRestaurants).catch((e) => toast(e.message));
    if (tab === 'Livreurs' && drivers === null) api('/admin/drivers', { token }).then(setDrivers).catch((e) => toast(e.message));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [tab]);

  function openDriver(d) {
    setSelectedDriver(d);
    setDriverOrders(null);
    api(`/admin/orders?driverId=${d.id}&limit=20`, { token }).then(setDriverOrders).catch((e) => toast(e.message));
  }

  function openRestaurant(r) {
    setSelectedRestaurant(r);
    setRestaurantDetail(null);
    setRestaurantOrders(null);
    api(`/restaurants/${r.id}`).then(setRestaurantDetail).catch((e) => toast(e.message));
    api(`/admin/orders?restaurantId=${r.id}&limit=20`, { token }).then(setRestaurantOrders).catch((e) => toast(e.message));
  }

  async function creditBalance(userId) {
    const raw = balanceInputs[userId];
    const delta = Number(raw);
    if (!delta) { toast('Entre un montant (positif pour créditer, négatif pour débiter).'); return; }
    try {
      const updated = await api(`/admin/users/${userId}/balance`, { method: 'PATCH', token, body: { delta } });
      setUsers((prev) => prev.map((u) => (u.id === userId ? { ...u, balance: updated.balance } : u)));
      setBalanceInputs((prev) => ({ ...prev, [userId]: '' }));
      toast(`Solde de ${updated.name} mis à jour : ${updated.balance.toFixed(2)}€`);
    } catch (e) {
      toast(e.message);
    }
  }

  async function deleteReview(id) {
    try {
      await api(`/admin/reviews/${id}`, { method: 'DELETE', token });
      setReviews((prev) => prev.filter((r) => r.id !== id));
      toast('Avis supprimé.');
    } catch (e) {
      toast(e.message);
    }
  }

  return (
    <div>
      <h2 className="section-title" style={{ marginTop: 0 }}>Administration Fairide</h2>
      <div className="role-pick" style={{ marginBottom: 16 }}>
        {TABS.map((t) => (
          <div key={t} className={`chip${tab === t ? ' active' : ''}`} onClick={() => setTab(t)}>{t}</div>
        ))}
      </div>

      {tab === 'Stats' && (
        !stats ? <SkeletonCards count={2} /> : (
          <div className="stat-grid">
            <div className="stat-card"><div className="num">{stats.usersByRole.client || 0}</div><div className="label">Clients</div></div>
            <div className="stat-card"><div className="num">{stats.usersByRole.restaurant || 0}</div><div className="label">Comptes commerce</div></div>
            <div className="stat-card"><div className="num">{stats.usersByRole.driver || 0}</div><div className="label">Livreurs</div></div>
            <div className="stat-card"><div className="num">{stats.restaurantCount}</div><div className="label">Restaurants</div></div>
            <div className="stat-card"><div className="num">{stats.paidOrderCount}</div><div className="label">Commandes payées</div></div>
            <div className="stat-card highlight"><div className="num">{stats.totalCommission.toFixed(2)}€</div><div className="label">Commission totale Fairide</div></div>
          </div>
        )
      )}

      {tab === 'Clients' && (
        <div>
          <div className="row" style={{ marginBottom: 14 }}>
            <input placeholder="Chercher par nom ou email" value={userSearch} onChange={(e) => setUserSearch(e.target.value)} style={{ flex: 1 }} />
            <button className="btn-teal" onClick={loadUsers}>Chercher</button>
          </div>
          {!users && <SkeletonCards count={3} />}
          {users && users.map((u) => (
            <div className="card" key={u.id}>
              <div className="row" style={{ justifyContent: 'space-between' }}>
                <div>
                  <b>{u.name}</b> <span className="pill teal" style={{ marginLeft: 6 }}>{u.role}</span>
                  {!u.emailVerified && <span className="pill" style={{ marginLeft: 6, color: 'var(--red)' }}>Email non vérifié</span>}
                  <div className="small">{u.email}{u.phone ? ` · ${u.phone}` : ''}</div>
                </div>
                {u.role === 'client' && <div className="small">Solde : <b>{u.balance.toFixed(2)}€</b></div>}
              </div>
              {u.role === 'client' && (
                <div className="row" style={{ gap: 8, marginTop: 8 }}>
                  <input
                    type="number" step="1" placeholder="Montant (ex: 50 ou -10)" style={{ maxWidth: 180 }}
                    value={balanceInputs[u.id] || ''} onChange={(e) => setBalanceInputs((prev) => ({ ...prev, [u.id]: e.target.value }))}
                  />
                  <button className="btn-outline" style={{ padding: '6px 14px', fontSize: 13 }} onClick={() => creditBalance(u.id)}>Ajuster le solde</button>
                </div>
              )}
              {(u.role === 'restaurant' || u.role === 'driver') && (u.payoutIban || u.payoutAccountHolder) && (
                <div className="small" style={{ marginTop: 6 }}>
                  💳 {u.payoutAccountHolder || '(titulaire non renseigné)'} — {u.payoutIban || '(IBAN non renseigné)'}
                </div>
              )}
            </div>
          ))}
        </div>
      )}

      {tab === 'Commandes' && (
        <div>
          {!orders && <SkeletonCards count={3} />}
          {orders && orders.map((o) => (
            <div className="card" key={o.id}>
              <div className="row" style={{ justifyContent: 'space-between' }}>
                <b>{o.restaurantName}</b>
                <span className={`status-badge status-${o.status}`}>{o.status}</span>
              </div>
              <div className="small">{o.clientName}{o.driverName ? ` · livré par ${o.driverName}` : ''}</div>
              <div className="row" style={{ justifyContent: 'space-between', marginTop: 6 }}>
                <span className="small">{o.paid ? '✅ Payée' : '⏳ Non payée'} · commission {o.commission.toFixed(2)}€</span>
                <b>{o.total.toFixed(2)}€</b>
              </div>
            </div>
          ))}
        </div>
      )}

      {tab === 'Avis' && (
        <div>
          {!reviews && <SkeletonCards count={3} />}
          {reviews && reviews.length === 0 && <div className="empty">Aucun avis pour l'instant.</div>}
          {reviews && reviews.map((r) => (
            <div className="card" key={r.id}>
              <div className="row" style={{ justifyContent: 'space-between' }}>
                <b>{r.clientName} → {r.restaurantName}</b>
                <button className="btn-danger-ghost" style={{ padding: '4px 10px', fontSize: 12 }} onClick={() => deleteReview(r.id)}>Supprimer</button>
              </div>
              <div className="small">Nourriture : {r.foodRating}/5 {r.foodComment && `— ${r.foodComment}`}</div>
              {r.deliveryRating && <div className="small">Livraison : {r.deliveryRating}/5 {r.deliveryComment && `— ${r.deliveryComment}`}</div>}
            </div>
          ))}
        </div>
      )}

      {tab === 'Restaurants' && (
        <div>
          {!restaurants && <SkeletonCards count={3} />}
          {restaurants && restaurants.map((r) => (
            <div className="card order-card-clickable" key={r.id} onClick={() => openRestaurant(r)}>
              <div className="row" style={{ justifyContent: 'space-between' }}>
                <b>{r.name}</b>
                <span className="pill teal">{r.open ? 'Ouvert' : 'Fermé'}</span>
              </div>
              <div className="small">{r.commune} · {r.cuisine} · {r.rating.toFixed(1)}★</div>
              <div className="small">Propriétaire : {r.ownerEmail}{r.ownerPhone ? ` · ${r.ownerPhone}` : ''}</div>
              <div className="small">{r.orderCount} commande(s) payée(s) · {r.revenue.toFixed(2)}€ de CA plats</div>
            </div>
          ))}
        </div>
      )}

      {tab === 'Livreurs' && (
        <div>
          {!drivers && <SkeletonCards count={3} />}
          {drivers && drivers.length === 0 && <div className="empty">Aucun livreur inscrit.</div>}
          {drivers && drivers.map((d) => (
            <div className="card order-card-clickable" key={d.id} onClick={() => openDriver(d)}>
              <div className="row" style={{ justifyContent: 'space-between' }}>
                <b>{d.name}</b>
                {!d.emailVerified && <span className="pill" style={{ color: 'var(--red)' }}>Email non vérifié</span>}
              </div>
              <div className="small">{d.email}{d.phone ? ` · ${d.phone}` : ''}</div>
              <div className="small">
                {d.deliveriesCount} livraison(s) terminée(s)
                {d.reviewCount > 0 ? ` · ${d.avgRating.toFixed(1)}★ (${d.reviewCount} avis)` : ' · pas encore d\'avis'}
              </div>
              {(d.payoutIban || d.payoutAccountHolder) && (
                <div className="small">💳 {d.payoutAccountHolder || '(titulaire non renseigné)'} — {d.payoutIban || '(IBAN non renseigné)'}</div>
              )}
            </div>
          ))}
        </div>
      )}

      {selectedDriver && createPortal(
        <div className="modal-overlay" onClick={() => setSelectedDriver(null)}>
          <div className="modal-box" onClick={(e) => e.stopPropagation()}>
            <h3 style={{ margin: '0 0 8px' }}>{selectedDriver.name}</h3>
            <p className="small" style={{ margin: '2px 0' }}>{selectedDriver.email}{selectedDriver.phone ? ` · ${selectedDriver.phone}` : ''}</p>
            <p className="small" style={{ margin: '2px 0' }}>
              {selectedDriver.deliveriesCount} livraison(s) terminée(s)
              {selectedDriver.reviewCount > 0 ? ` · ${selectedDriver.avgRating.toFixed(1)}★ (${selectedDriver.reviewCount} avis)` : ' · pas encore d\'avis'}
            </p>
            {(selectedDriver.payoutIban || selectedDriver.payoutAccountHolder) && (
              <p className="small" style={{ margin: '2px 0' }}>💳 {selectedDriver.payoutAccountHolder || '(titulaire non renseigné)'} — {selectedDriver.payoutIban || '(IBAN non renseigné)'}</p>
            )}
            <div className="divider" />
            <h4 style={{ margin: '0 0 6px' }}>Livraisons récentes</h4>
            {!driverOrders && <div className="small">Chargement...</div>}
            {driverOrders && driverOrders.length === 0 && <div className="small">Aucune commande pour l'instant.</div>}
            {driverOrders && driverOrders.map((o) => (
              <div key={o.id} className="row" style={{ justifyContent: 'space-between', padding: '4px 0' }}>
                <span className="small">{o.restaurantName} → {o.clientName}</span>
                <span className={`status-badge status-${o.status}`}>{o.status}</span>
              </div>
            ))}
            <button className="btn-ghost" style={{ marginTop: 12 }} onClick={() => setSelectedDriver(null)}>Fermer</button>
          </div>
        </div>,
        document.body
      )}

      {selectedRestaurant && createPortal(
        <div className="modal-overlay" onClick={() => setSelectedRestaurant(null)}>
          <div className="modal-box" onClick={(e) => e.stopPropagation()}>
            <h3 style={{ margin: '0 0 8px' }}>{selectedRestaurant.name}</h3>
            <p className="small" style={{ margin: '2px 0' }}>{selectedRestaurant.commune} · {selectedRestaurant.cuisine} · {selectedRestaurant.rating.toFixed(1)}★</p>
            <p className="small" style={{ margin: '2px 0' }}>Propriétaire : {selectedRestaurant.ownerEmail}{selectedRestaurant.ownerPhone ? ` · ${selectedRestaurant.ownerPhone}` : ''}</p>
            <p className="small" style={{ margin: '2px 0' }}>{selectedRestaurant.orderCount} commande(s) payée(s) · {selectedRestaurant.revenue.toFixed(2)}€ de CA plats</p>
            {restaurantDetail?.address && <p className="small" style={{ margin: '2px 0' }}>📍 {restaurantDetail.address}</p>}
            {restaurantDetail?.openingHours && <p className="small" style={{ margin: '2px 0' }}>🕐 {restaurantDetail.openingHours}</p>}
            <div className="divider" />
            <h4 style={{ margin: '0 0 6px' }}>Menu ({restaurantDetail?.menu?.length ?? '...'})</h4>
            {!restaurantDetail && <div className="small">Chargement...</div>}
            {restaurantDetail && restaurantDetail.menu.length === 0 && <div className="small">Aucun plat au menu.</div>}
            {restaurantDetail && restaurantDetail.menu.map((item) => (
              <div key={item.id} className="row" style={{ justifyContent: 'space-between', padding: '2px 0' }}>
                <span className="small">{item.name}</span>
                <span className="small">{Number(item.price).toFixed(2)}€</span>
              </div>
            ))}
            <div className="divider" />
            <h4 style={{ margin: '0 0 6px' }}>Commandes récentes</h4>
            {!restaurantOrders && <div className="small">Chargement...</div>}
            {restaurantOrders && restaurantOrders.length === 0 && <div className="small">Aucune commande pour l'instant.</div>}
            {restaurantOrders && restaurantOrders.map((o) => (
              <div key={o.id} className="row" style={{ justifyContent: 'space-between', padding: '4px 0' }}>
                <span className="small">{o.clientName}{o.driverName ? ` · livré par ${o.driverName}` : ''}</span>
                <span className={`status-badge status-${o.status}`}>{o.status}</span>
              </div>
            ))}
            <button className="btn-ghost" style={{ marginTop: 12 }} onClick={() => setSelectedRestaurant(null)}>Fermer</button>
          </div>
        </div>,
        document.body
      )}
    </div>
  );
}
