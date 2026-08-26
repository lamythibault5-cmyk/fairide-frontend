import { useEffect, useState } from 'react';
import { createPortal } from 'react-dom';
import { useSearchParams } from 'react-router-dom';
import { api } from '../../api';
import { useAuth } from '../../context/AuthContext';
import { useToast } from '../../context/ToastContext';
import { SkeletonCards } from '../../components/Skeleton';
import { money, fmtDateTime, ORDER_STATUS_LABELS, ORDER_STATUSES } from './adminUtils';

const FILTERS = [
  { key: '', label: 'Toutes' },
  ...ORDER_STATUSES.map((s) => ({ key: s, label: ORDER_STATUS_LABELS[s] })),
  { key: 'noDriver', label: 'Sans livreur' },
  { key: 'refunded', label: 'Remboursées' },
  { key: 'late', label: 'En retard' }
];

export default function AdminOrdersPage() {
  const { token } = useAuth();
  const toast = useToast();
  const [searchParams, setSearchParams] = useSearchParams();
  const [orders, setOrders] = useState(null);
  const [selected, setSelected] = useState(null);
  const [detail, setDetail] = useState(null);

  const activeFilter = searchParams.get('status')
    || (searchParams.get('noDriver') ? 'noDriver' : searchParams.get('refunded') ? 'refunded' : searchParams.get('late') ? 'late' : '');

  function load() {
    setOrders(null);
    const params = new URLSearchParams();
    params.set('limit', '100');
    const status = searchParams.get('status');
    if (status) params.set('status', status);
    if (searchParams.get('noDriver')) params.set('noDriver', '1');
    if (searchParams.get('refunded')) params.set('refunded', '1');
    if (searchParams.get('late')) params.set('late', '1');
    api(`/admin/orders?${params.toString()}`, { token }).then(setOrders).catch((e) => toast(e.message));
  }

  useEffect(load, [searchParams.toString()]); // eslint-disable-line react-hooks/exhaustive-deps

  function setFilter(key) {
    if (!key) { setSearchParams({}); return; }
    if (key === 'noDriver') { setSearchParams({ noDriver: '1' }); return; }
    if (key === 'refunded') { setSearchParams({ refunded: '1' }); return; }
    if (key === 'late') { setSearchParams({ late: '1' }); return; }
    setSearchParams({ status: key });
  }

  function openOrder(o) {
    setSelected(o);
    setDetail(null);
    api(`/admin/orders/${o.id}`, { token }).then(setDetail).catch((e) => toast(e.message));
  }

  return (
    <div>
      <h2 className="section-title" style={{ marginTop: 0 }}>Commandes</h2>
      <div className="role-pick" style={{ marginBottom: 14, flexWrap: 'wrap' }}>
        {FILTERS.map((f) => (
          <div key={f.key || 'all'} className={`chip${activeFilter === f.key ? ' active' : ''}`} onClick={() => setFilter(f.key)}>{f.label}</div>
        ))}
      </div>

      {!orders && <SkeletonCards count={4} />}
      {orders && orders.length === 0 && <div className="empty">Aucune commande pour ce filtre.</div>}
      {orders && orders.map((o) => (
        <div className="card order-card-clickable" key={o.id} onClick={() => openOrder(o)}>
          <div className="row" style={{ justifyContent: 'space-between' }}>
            <b>{o.restaurantName}</b>
            <span className={`status-badge status-${o.status}`}>{ORDER_STATUS_LABELS[o.status] || o.status}</span>
          </div>
          <div className="small">
            {o.clientName} → {o.driverName ? `livré par ${o.driverName}` : (o.orderType === 'delivery' ? 'sans livreur assigné' : 'à emporter')}
          </div>
          <div className="row" style={{ justifyContent: 'space-between', marginTop: 6, flexWrap: 'wrap', gap: 4 }}>
            <span className="small">
              {o.paid ? '✅ Payée' : '⏳ Non payée'} · commission {money(o.commission)} · dû resto {money(o.restaurantDue)} · dû livreur {money(o.driverDue)}
              {o.hasRefund && <span style={{ color: 'var(--red)' }}> · remboursée</span>}
            </span>
            <b>{money(o.total)}</b>
          </div>
          <div className="small" style={{ opacity: 0.6, marginTop: 2 }}>{fmtDateTime(o.createdAt)}</div>
        </div>
      ))}

      {selected && createPortal(
        <div className="modal-overlay" onClick={() => setSelected(null)}>
          <div className="modal-box" onClick={(e) => e.stopPropagation()} style={{ maxWidth: 520 }}>
            <div className="row" style={{ justifyContent: 'space-between' }}>
              <h3 style={{ margin: '0 0 8px' }}>{selected.restaurantName}</h3>
              <span className={`status-badge status-${selected.status}`}>{ORDER_STATUS_LABELS[selected.status] || selected.status}</span>
            </div>
            {!detail && <div className="small">Chargement...</div>}
            {detail && (
              <>
                <p className="small" style={{ margin: '2px 0' }}>Client : {detail.clientName}{detail.clientPhone ? ` · ${detail.clientPhone}` : ''}</p>
                {detail.driverName && <p className="small" style={{ margin: '2px 0' }}>Livreur : {detail.driverName}{detail.driverPhone ? ` · ${detail.driverPhone}` : ''}</p>}
                {detail.address && <p className="small" style={{ margin: '2px 0' }}>📍 {detail.address}{detail.commune ? `, ${detail.commune}` : ''}</p>}
                <div className="divider" />
                <h4 style={{ margin: '0 0 6px' }}>Articles</h4>
                {(detail.items || []).map((it, i) => (
                  <div key={i} className="row" style={{ justifyContent: 'space-between', padding: '2px 0' }}>
                    <span className="small">{it.qty}× {it.name}</span>
                    <span className="small">{money(it.price * it.qty - (it.discount || 0))}</span>
                  </div>
                ))}
                <div className="divider" />
                <div className="row" style={{ justifyContent: 'space-between' }}><span className="small">Sous-total plats</span><span className="small">{money(detail.subtotal)}</span></div>
                <div className="row" style={{ justifyContent: 'space-between' }}><span className="small">Livraison</span><span className="small">{money(detail.deliveryFee)}</span></div>
                {detail.tipAmount > 0 && <div className="row" style={{ justifyContent: 'space-between' }}><span className="small">Pourboire</span><span className="small">{money(detail.tipAmount)}</span></div>}
                <div className="row" style={{ justifyContent: 'space-between' }}><b className="small">Total payé</b><b className="small">{money(detail.total)}</b></div>
                <div className="row" style={{ justifyContent: 'space-between' }}><span className="small">Commission Fairide (10%)</span><span className="small">{money(detail.commission)}</span></div>
                <div className="row" style={{ justifyContent: 'space-between' }}><span className="small">Dû au restaurant</span><span className="small">{money(detail.restaurantDue)}</span></div>
                <div className="row" style={{ justifyContent: 'space-between' }}><span className="small">Dû au livreur</span><span className="small">{money(detail.driverDue)}</span></div>
                {(detail.refunds || []).length > 0 && (
                  <>
                    <div className="divider" />
                    <h4 style={{ margin: '0 0 6px', color: 'var(--red)' }}>Remboursements</h4>
                    {detail.refunds.map((r) => (
                      <div key={r.id} className="row" style={{ justifyContent: 'space-between', padding: '2px 0' }}>
                        <span className="small">{r.reason || r.responsibility}</span>
                        <span className="small">{money(r.amount)}</span>
                      </div>
                    ))}
                  </>
                )}
                <div className="divider" />
                <h4 style={{ margin: '0 0 6px' }}>Timeline</h4>
                {(detail.timeline || []).map((step, i) => (
                  <div key={i} className="row" style={{ justifyContent: 'space-between', padding: '2px 0' }}>
                    <span className="small">{step.label}</span>
                    <span className="small" style={{ opacity: 0.6 }}>{fmtDateTime(step.at)}</span>
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
