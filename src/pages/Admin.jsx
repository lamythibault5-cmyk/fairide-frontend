import { useEffect, useState } from 'react';
import { createPortal } from 'react-dom';
import { api } from '../api';
import { useAuth } from '../context/AuthContext';
import { useToast } from '../context/ToastContext';
import { SkeletonCards } from '../components/Skeleton';

const TABS = ['Stats', 'Utilisateurs', 'Clients', 'Livreurs', 'Restaurants', 'Commandes', 'Avis', 'Codes promo'];

const USER_TYPE_LABELS = { client: 'Clients', restaurant: 'Commerçants', driver: 'Livreurs' };
const USER_TYPE_ORDER = ['client', 'restaurant', 'driver'];

const PROMO_TYPES = [
  { value: 'client_balance', label: 'Solde client (€)' },
  { value: 'restaurant_trial_months', label: 'Mois d\'essai restaurateur' }
];

export default function Admin() {
  const { token } = useAuth();
  const toast = useToast();
  const [tab, setTab] = useState('Stats');
  const [stats, setStats] = useState(null);
  const [usersOverview, setUsersOverview] = useState(null);
  const [users, setUsers] = useState(null);
  const [userSearch, setUserSearch] = useState('');
  const [orders, setOrders] = useState(null);
  const [reviews, setReviews] = useState(null);
  const [restaurants, setRestaurants] = useState(null);
  const [drivers, setDrivers] = useState(null);
  const [balanceInputs, setBalanceInputs] = useState({});
  const [promoCodes, setPromoCodes] = useState(null);
  const [newPromoCode, setNewPromoCode] = useState('');
  const [newPromoType, setNewPromoType] = useState('client_balance');
  const [newPromoValue, setNewPromoValue] = useState('');
  const [newPromoMaxUses, setNewPromoMaxUses] = useState('');
  const [creatingPromo, setCreatingPromo] = useState(false);

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
    if (tab === 'Utilisateurs' && usersOverview === null) api('/admin/users/overview', { token }).then(setUsersOverview).catch((e) => toast(e.message));
    if (tab === 'Clients' && users === null) loadUsers();
    if (tab === 'Commandes' && orders === null) api('/admin/orders', { token }).then(setOrders).catch((e) => toast(e.message));
    if (tab === 'Avis' && reviews === null) api('/admin/reviews', { token }).then(setReviews).catch((e) => toast(e.message));
    if (tab === 'Restaurants' && restaurants === null) api('/admin/restaurants', { token }).then(setRestaurants).catch((e) => toast(e.message));
    if (tab === 'Livreurs' && drivers === null) api('/admin/drivers', { token }).then(setDrivers).catch((e) => toast(e.message));
    if (tab === 'Codes promo' && promoCodes === null) api('/admin/promo-codes', { token }).then(setPromoCodes).catch((e) => toast(e.message));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [tab]);

  async function createPromoCode() {
    if (!newPromoCode.trim() || !newPromoValue) { toast('Code et valeur requis.'); return; }
    setCreatingPromo(true);
    try {
      const created = await api('/admin/promo-codes', {
        method: 'POST', token,
        body: { code: newPromoCode.trim(), type: newPromoType, value: Number(newPromoValue), maxUses: newPromoMaxUses ? Number(newPromoMaxUses) : undefined }
      });
      setPromoCodes((prev) => [created, ...(prev || [])]);
      setNewPromoCode(''); setNewPromoValue(''); setNewPromoMaxUses('');
      toast(`Code ${created.code} créé.`);
    } catch (e) {
      toast(e.message);
    } finally {
      setCreatingPromo(false);
    }
  }

  async function togglePromoCode(id, active) {
    try {
      const updated = await api(`/admin/promo-codes/${id}`, { method: 'PATCH', token, body: { active } });
      setPromoCodes((prev) => prev.map((p) => (p.id === id ? updated : p)));
    } catch (e) {
      toast(e.message);
    }
  }

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

  async function setRestaurantStatus(id, status) {
    try {
      await api(`/admin/restaurants/${id}/status`, { method: 'PATCH', token, body: { status } });
      setRestaurants((prev) => prev.map((r) => (r.id === id ? { ...r, adminStatus: status } : r)));
      if (selectedRestaurant?.id === id) setSelectedRestaurant((prev) => ({ ...prev, adminStatus: status }));
      toast(status === 'approved' ? 'Restaurant approuvé.' : status === 'blocked' ? 'Restaurant bloqué.' : 'Statut mis à jour.');
    } catch (e) {
      toast(e.message);
    }
  }

  async function setDriverStatus(id, status) {
    try {
      await api(`/admin/drivers/${id}/status`, { method: 'PATCH', token, body: { status } });
      setDrivers((prev) => prev.map((d) => (d.id === id ? { ...d, adminStatus: status } : d)));
      if (selectedDriver?.id === id) setSelectedDriver((prev) => ({ ...prev, adminStatus: status }));
      toast(status === 'approved' ? 'Livreur approuvé.' : status === 'blocked' ? 'Livreur bloqué.' : 'Statut mis à jour.');
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

      {tab === 'Utilisateurs' && (
        !usersOverview ? <SkeletonCards count={2} /> : (
          <div>
            <UsersSubsection
              title="🆕 Nouveaux inscrits"
              subtitle="Comptes créés au cours des 30 derniers jours."
              groups={usersOverview.new}
              emptyText="Aucun nouvel inscrit sur cette période."
            />
            <div className="divider" />
            <UsersSubsection
              title="🚪 Comptes partis"
              subtitle="Comptes supprimés (clients/livreurs) et commerces supprimés (restaurateurs)."
              groups={usersOverview.departed}
              departed
              emptyText="Personne n'est parti pour l'instant."
            />
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
                <div className="row" style={{ gap: 6 }}>
                  <span className="pill teal">{r.open ? 'Ouvert' : 'Fermé'}</span>
                  <span className="pill" style={{ color: r.adminStatus === 'approved' ? 'var(--teal-deep)' : r.adminStatus === 'blocked' ? 'var(--red)' : 'inherit' }}>
                    {r.adminStatus === 'approved' ? '✅ Approuvé' : r.adminStatus === 'blocked' ? '🚫 Bloqué' : '🕐 En attente'}
                  </span>
                </div>
              </div>
              <div className="small">{r.commune} · {r.cuisine} · {r.rating.toFixed(1)}★</div>
              <div className="small">Propriétaire : {r.ownerEmail}{r.ownerPhone ? ` · ${r.ownerPhone}` : ''}</div>
              <div className="small">{r.orderCount} commande(s) payée(s) · {r.revenue.toFixed(2)}€ de CA plats</div>
              <div className="row" style={{ gap: 8, marginTop: 8 }} onClick={(e) => e.stopPropagation()}>
                {r.adminStatus !== 'approved' && (
                  <button className="btn-teal" style={{ padding: '6px 14px', fontSize: 13 }} onClick={() => setRestaurantStatus(r.id, 'approved')}>Approuver</button>
                )}
                {r.adminStatus !== 'blocked' && (
                  <button className="btn-danger-ghost" style={{ padding: '6px 14px', fontSize: 13 }} onClick={() => setRestaurantStatus(r.id, 'blocked')}>Bloquer</button>
                )}
              </div>
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
                <div className="row" style={{ gap: 6 }}>
                  {!d.emailVerified && <span className="pill" style={{ color: 'var(--red)' }}>Email non vérifié</span>}
                  <span className="pill" style={{ color: d.adminStatus === 'approved' ? 'var(--teal-deep)' : d.adminStatus === 'blocked' ? 'var(--red)' : 'inherit' }}>
                    {d.adminStatus === 'approved' ? '✅ Approuvé' : d.adminStatus === 'blocked' ? '🚫 Bloqué' : '🕐 En attente'}
                  </span>
                </div>
              </div>
              <div className="small">{d.email}{d.phone ? ` · ${d.phone}` : ''}</div>
              <div className="small">
                {d.deliveriesCount} livraison(s) terminée(s)
                {d.reviewCount > 0 ? ` · ${d.avgRating.toFixed(1)}★ (${d.reviewCount} avis)` : ' · pas encore d\'avis'}
              </div>
              {(d.payoutIban || d.payoutAccountHolder) && (
                <div className="small">💳 {d.payoutAccountHolder || '(titulaire non renseigné)'} — {d.payoutIban || '(IBAN non renseigné)'}</div>
              )}
              <div className="row" style={{ gap: 8, marginTop: 8 }} onClick={(e) => e.stopPropagation()}>
                {d.adminStatus !== 'approved' && (
                  <button className="btn-teal" style={{ padding: '6px 14px', fontSize: 13 }} onClick={() => setDriverStatus(d.id, 'approved')}>Approuver</button>
                )}
                {d.adminStatus !== 'blocked' && (
                  <button className="btn-danger-ghost" style={{ padding: '6px 14px', fontSize: 13 }} onClick={() => setDriverStatus(d.id, 'blocked')}>Bloquer</button>
                )}
              </div>
            </div>
          ))}
        </div>
      )}

      {tab === 'Codes promo' && (
        <div>
          <div className="card">
            <h3 style={{ margin: '0 0 10px', fontSize: 15 }}>Créer un code promo</h3>
            <div className="row" style={{ gap: 8 }}>
              <div className="field" style={{ flex: 1 }}>
                <label>Code</label>
                <input value={newPromoCode} onChange={(e) => setNewPromoCode(e.target.value)} placeholder="Ex: RESTO2MOIS" />
              </div>
              <div className="field" style={{ flex: 1 }}>
                <label>Type</label>
                <select value={newPromoType} onChange={(e) => setNewPromoType(e.target.value)}>
                  {PROMO_TYPES.map((t) => <option key={t.value} value={t.value}>{t.label}</option>)}
                </select>
              </div>
            </div>
            <div className="row" style={{ gap: 8 }}>
              <div className="field" style={{ flex: 1 }}>
                <label>Valeur ({newPromoType === 'client_balance' ? '€' : 'mois'})</label>
                <input type="number" step="1" value={newPromoValue} onChange={(e) => setNewPromoValue(e.target.value)} placeholder={newPromoType === 'client_balance' ? '20' : '2'} />
              </div>
              <div className="field" style={{ flex: 1 }}>
                <label>Utilisations max (optionnel)</label>
                <input type="number" step="1" value={newPromoMaxUses} onChange={(e) => setNewPromoMaxUses(e.target.value)} placeholder="Illimité si vide" />
              </div>
            </div>
            <button className="btn-teal" disabled={creatingPromo} onClick={createPromoCode}>{creatingPromo ? '...' : 'Créer le code'}</button>
          </div>

          {!promoCodes && <SkeletonCards count={3} />}
          {promoCodes && promoCodes.length === 0 && <div className="empty">Aucun code promo.</div>}
          {promoCodes && promoCodes.map((p) => (
            <div className="card" key={p.id}>
              <div className="row" style={{ justifyContent: 'space-between' }}>
                <div>
                  <b style={{ fontFamily: 'monospace', fontSize: 15 }}>{p.code}</b>{' '}
                  <span className="pill teal" style={{ marginLeft: 6 }}>
                    {p.type === 'client_balance' ? `${p.value}€ client` : `${p.value} mois offert(s) restaurateur`}
                  </span>
                  {!p.active && <span className="pill" style={{ marginLeft: 6, color: 'var(--red)' }}>Désactivé</span>}
                </div>
                <button className={p.active ? 'btn-danger-ghost' : 'btn-outline'} style={{ padding: '6px 14px', fontSize: 13 }} onClick={() => togglePromoCode(p.id, !p.active)}>
                  {p.active ? 'Désactiver' : 'Activer'}
                </button>
              </div>
              <div className="small" style={{ marginTop: 4 }}>
                {p.usesCount} utilisation(s){p.maxUses ? ` / ${p.maxUses} max` : ' (illimité)'}
              </div>
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

// Une sous-section (Nouveaux / Partis) de l'onglet "Utilisateurs" : un groupe par type de compte
// (client, commerçant, livreur), chacun listé, numéroté et cherchable séparément — voir USER_TYPE_ORDER.
function UsersSubsection({ title, subtitle, groups, departed, emptyText }) {
  const totalCount = USER_TYPE_ORDER.reduce((sum, type) => sum + (groups[type]?.length || 0), 0);
  return (
    <div style={{ marginBottom: 10 }}>
      <h3 style={{ margin: '0 0 4px', fontSize: 16 }}>
        {title} <span className="pill teal" style={{ marginLeft: 6 }}>{totalCount}</span>
      </h3>
      <p className="small" style={{ margin: '0 0 12px' }}>{subtitle}</p>
      {totalCount === 0 && <div className="empty">{emptyText}</div>}
      {USER_TYPE_ORDER.map((type) => {
        const items = groups[type] || [];
        if (!items.length) return null;
        return <UserTypeGroup key={type} type={type} items={items} departed={departed} />;
      })}
    </div>
  );
}

function statusPill(status) {
  if (status === 'approved') return <span className="pill teal">✅ Validé</span>;
  if (status === 'blocked') return <span className="pill" style={{ color: 'var(--red)' }}>🚫 Bloqué</span>;
  return <span className="pill">🕐 En attente</span>;
}

// Une seule liste "type de compte" (ex: Clients) au sein d'une sous-section — garde sa propre recherche
// locale, indépendante des autres groupes et de l'autre sous-section (Nouveaux vs Partis).
function UserTypeGroup({ type, items, departed }) {
  const [search, setSearch] = useState('');
  const q = search.trim().toLowerCase();
  const filtered = q
    ? items.filter((it) => [it.name, it.email, it.restaurantName, it.reason, it.comment].some((v) => v && v.toLowerCase().includes(q)))
    : items;
  return (
    <div style={{ marginBottom: 14 }}>
      <div className="row" style={{ justifyContent: 'space-between', alignItems: 'center', gap: 8, flexWrap: 'wrap', marginBottom: 8 }}>
        <h4 style={{ margin: 0, fontSize: 13, textTransform: 'uppercase', letterSpacing: 0.4, opacity: 0.6 }}>
          {USER_TYPE_LABELS[type]} <span className="pill" style={{ marginLeft: 6 }}>{items.length}</span>
        </h4>
        <input
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder={`Chercher un(e) ${USER_TYPE_LABELS[type].toLowerCase()}...`}
          style={{ maxWidth: 260, flex: '1 1 200px' }}
        />
      </div>
      {filtered.length === 0 && <div className="empty">Aucun résultat pour "{search}".</div>}
      {filtered.length > 0 && (
        <div className="card">
          {filtered.map((it, i) => (
            <div
              key={it.id}
              className="row"
              style={{ justifyContent: 'space-between', gap: 10, padding: '8px 0', borderBottom: i < filtered.length - 1 ? '1px solid var(--cream-dim)' : 'none', flexWrap: 'wrap' }}
            >
              <div>
                <span className="small" style={{ fontWeight: 700, marginRight: 8 }}>#{i + 1}</span>
                {departed ? (
                  <>
                    <b>{it.email}</b>
                    {it.restaurantName && <span className="small"> — {it.restaurantName}</span>}
                    {it.reason && <div className="small" style={{ opacity: 0.7 }}>{it.reason}{it.comment ? ` — ${it.comment}` : ''}</div>}
                  </>
                ) : (
                  <>
                    <b>{it.name}</b> <span className="small">{it.email}</span>
                    {it.phone && <div className="small">📞 {it.phone}</div>}
                    <div className="row" style={{ gap: 6, marginTop: 4, flexWrap: 'wrap' }}>
                      {type === 'driver' && statusPill(it.adminStatus)}
                      {type === 'restaurant' && (
                        it.restaurantName
                          ? <>🏪 {it.restaurantName} {statusPill(it.restaurantAdminStatus)}</>
                          : <span className="small" style={{ opacity: 0.6 }}>Pas encore de restaurant créé</span>
                      )}
                    </div>
                  </>
                )}
              </div>
              <span className="small" style={{ flexShrink: 0 }}>
                {new Date(it.createdAt).toLocaleDateString('fr-BE', { day: 'numeric', month: 'short', year: 'numeric' })}
              </span>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
