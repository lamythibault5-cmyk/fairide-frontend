import { useEffect, useState } from 'react';
import { createPortal } from 'react-dom';
import { api } from '../../api';
import { useAuth } from '../../context/AuthContext';
import { useToast } from '../../context/ToastContext';
import { SkeletonCards } from '../../components/Skeleton';
import { isTestAccount, TestBadge, filterBySearch, money, fmtDate, BUSINESS_STATUS_LABELS } from './adminUtils';

export default function AdminRestaurantsPage() {
  const { token } = useAuth();
  const toast = useToast();
  const [restaurants, setRestaurants] = useState(null);
  const [search, setSearch] = useState('');
  const [selected, setSelected] = useState(null);
  const [detail, setDetail] = useState(null);
  const [orders, setOrders] = useState(null);

  useEffect(() => {
    api('/admin/restaurants', { token }).then(setRestaurants).catch((e) => toast(e.message));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  function openRestaurant(r) {
    setSelected(r);
    setDetail(null);
    setOrders(null);
    api(`/admin/restaurants/${r.id}`, { token }).then(setDetail).catch((e) => toast(e.message));
    api(`/admin/orders?restaurantId=${r.id}&limit=20`, { token }).then(setOrders).catch((e) => toast(e.message));
  }

  async function setStatus(id, status) {
    try {
      await api(`/admin/restaurants/${id}/status`, { method: 'PATCH', token, body: { status } });
      setRestaurants((prev) => prev.map((r) => (r.id === id ? { ...r, adminStatus: status } : r)));
      if (selected?.id === id) setSelected((prev) => ({ ...prev, adminStatus: status }));
      toast(status === 'approved' ? 'Restaurant approuvé.' : status === 'blocked' ? 'Restaurant bloqué.' : 'Statut mis à jour.');
    } catch (e) {
      toast(e.message);
    }
  }

  const filtered = filterBySearch(restaurants, search, (r) => [r.name, r.commune, r.cuisine, r.ownerEmail]);

  return (
    <div>
      <h2 className="section-title" style={{ marginTop: 0 }}>Restaurants</h2>
      <div className="row" style={{ marginBottom: 14 }}>
        <input placeholder="Chercher un restaurant..." value={search} onChange={(e) => setSearch(e.target.value)} style={{ flex: 1 }} />
      </div>
      {!restaurants && <SkeletonCards count={3} />}
      {restaurants && filtered.length === 0 && <div className="empty">Aucun résultat.</div>}
      {filtered && filtered.map((r) => {
        const biz = BUSINESS_STATUS_LABELS[r.businessStatus];
        return (
          <div className={`card order-card-clickable${isTestAccount(r.ownerEmail) ? ' card-test-account' : ''}`} key={r.id} onClick={() => openRestaurant(r)}>
            <div className="row" style={{ justifyContent: 'space-between' }}>
              <b>{r.name}</b>
              <div className="row" style={{ gap: 6 }}>
                {isTestAccount(r.ownerEmail) && <TestBadge />}
                <span className="pill" style={{ color: biz?.color }}>{biz?.label}</span>
              </div>
            </div>
            <div className="small">{r.commune} · {r.cuisine} · {r.rating.toFixed(1)}★</div>
            <div className="small">Responsable : {r.responsibleName || r.ownerEmail}{r.phone ? ` · ${r.phone}` : ''}</div>
            {(r.companyNumber || r.vatNumber) && <div className="small">N° entreprise {r.companyNumber || '—'} · TVA {r.vatNumber || '—'}</div>}
            <div className="small">
              {r.orderCount} commande(s) · {money(r.revenue)} CA · {money(r.commissionGenerated)} commission · panier moyen {money(r.avgBasket)} · {(r.cancellationRate * 100).toFixed(0)}% annulation
            </div>
            <div className="row" style={{ gap: 8, marginTop: 8 }} onClick={(e) => e.stopPropagation()}>
              {r.adminStatus !== 'approved' && <button className="btn-teal" style={{ padding: '6px 14px', fontSize: 13 }} onClick={() => setStatus(r.id, 'approved')}>Approuver</button>}
              {r.adminStatus !== 'blocked' && <button className="btn-danger-ghost" style={{ padding: '6px 14px', fontSize: 13 }} onClick={() => setStatus(r.id, 'blocked')}>Bloquer</button>}
            </div>
          </div>
        );
      })}

      {selected && createPortal(
        <div className="modal-overlay" onClick={() => setSelected(null)}>
          <div className="modal-box" onClick={(e) => e.stopPropagation()} style={{ maxWidth: 520 }}>
            <div className="row" style={{ justifyContent: 'space-between', alignItems: 'flex-start' }}>
              <h3 style={{ margin: '0 0 8px' }}>{selected.name}</h3>
              <a href={`/restaurants/${selected.id}`} target="_blank" rel="noreferrer" className="small">Voir la page ↗</a>
            </div>
            {!detail && <div className="small">Chargement...</div>}
            {detail && (
              <>
                <p className="small" style={{ margin: '2px 0' }}>{detail.commune}{detail.neighborhood ? ` (${detail.neighborhood})` : ''} · {detail.cuisine} · {detail.rating.toFixed(1)}★</p>
                <p className="small" style={{ margin: '2px 0' }}>📍 {[detail.addressStreet, detail.addressNumber].filter(Boolean).join(' ')}{detail.addressCity ? `, ${detail.addressPostalCode} ${detail.addressCity}` : ''}</p>
                <p className="small" style={{ margin: '2px 0' }}>Responsable : {detail.responsibleName || '—'} · {detail.email}{detail.phone ? ` · ${detail.phone}` : ''}</p>
                <p className="small" style={{ margin: '2px 0' }}>Raison sociale : {detail.legalName || '—'} · N° entreprise {detail.companyNumber || '—'} · TVA {detail.vatNumber || '—'}</p>
                <p className="small" style={{ margin: '2px 0' }}>Abonnement : {detail.subscriptionStatus} · Mode de livraison : {detail.deliveryMode}</p>
                <p className="small" style={{ margin: '2px 0' }}>Inscrit le {fmtDate(detail.createdAt)}</p>
                <div className="divider" />
                <div className="row" style={{ justifyContent: 'space-between' }}><span className="small">Commandes payées</span><b className="small">{detail.orderCount}</b></div>
                <div className="row" style={{ justifyContent: 'space-between' }}><span className="small">CA plats</span><b className="small">{money(detail.revenue)}</b></div>
                <div className="row" style={{ justifyContent: 'space-between' }}><span className="small">Commission générée</span><b className="small">{money(detail.commissionGenerated)}</b></div>
                <div className="row" style={{ justifyContent: 'space-between' }}><span className="small">Panier moyen</span><b className="small">{money(detail.avgBasket)}</b></div>
                <div className="row" style={{ justifyContent: 'space-between' }}><span className="small">Taux d'annulation</span><b className="small">{(detail.cancellationRate * 100).toFixed(0)}%</b></div>
                <div className="divider" />
                <h4 style={{ margin: '0 0 6px' }}>Commandes récentes</h4>
                {!orders && <div className="small">Chargement...</div>}
                {orders && orders.length === 0 && <div className="small">Aucune commande pour l'instant.</div>}
                {orders && orders.map((o) => (
                  <div key={o.id} className="row" style={{ justifyContent: 'space-between', padding: '4px 0' }}>
                    <span className="small">{o.clientName}{o.driverName ? ` · livré par ${o.driverName}` : ''}</span>
                    <span className={`status-badge status-${o.status}`}>{o.status}</span>
                  </div>
                ))}
              </>
            )}
            <button className="btn-ghost" style={{ marginTop: 12 }} onClick={() => setSelected(null)}>Fermer</button>
          </div>
        </div>,
        document.body
      )}
    </div>
  );
}
