import { useEffect, useState } from 'react';
import { api } from '../../api';
import { useAuth } from '../../context/AuthContext';
import { useToast } from '../../context/ToastContext';
import { DeliveryTiming, ProgressBar, deliveryInstructionLabel, statusLabel } from '../../orderStatus';
import { SkeletonCards } from '../../components/Skeleton';

export default function Orders() {
  const [orders, setOrders] = useState([]);
  const [loading, setLoading] = useState(true);
  const { token } = useAuth();
  const toast = useToast();

  useEffect(() => {
    api('/orders/mine', { token }).then(setOrders).catch((e) => toast(e.message)).finally(() => setLoading(false));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  if (loading) return <div><h2 className="section-title" style={{ marginTop: 0 }}>Mes commandes</h2><SkeletonCards count={3} /></div>;
  if (orders.length === 0) return <div className="empty">Tu n'as pas encore passé de commande.</div>;

  return (
    <div>
      <h2 className="section-title" style={{ marginTop: 0 }}>Mes commandes</h2>
      {orders.map((o) => (
        <div className="card" key={o.id}>
          <div className="row" style={{ justifyContent: 'space-between' }}>
            <b>{o.restaurantName}</b>
            <span className={`status-badge status-${o.status}`}>{statusLabel(o.status)}</span>
          </div>
          <ProgressBar status={o.status} />
          <DeliveryTiming order={o} />
          <div className="small" style={{ margin: '6px 0' }}>{o.items.map((i) => `${i.qty}× ${i.name}`).join(', ')}</div>
          <div className="small">📍 {o.address}</div>
          {o.deliveryInstructions && (
            <div className="small">{deliveryInstructionLabel(o.deliveryInstructions)}{o.deliveryNote ? ` — ${o.deliveryNote}` : ''}</div>
          )}
          {o.driverName && (
            <div className="small">🛵 Livreur : {o.driverName}{o.driverPhone ? ` · ${o.driverPhone}` : ''}</div>
          )}
          {o.paid && o.deliveryCode && o.status !== 'livre' && o.status !== 'refuse' && (
            <div style={{ background: 'var(--cream-dim)', borderRadius: 10, padding: '10px 14px', textAlign: 'center', margin: '8px 0' }}>
              <div className="small" style={{ marginBottom: 2 }}>Code à donner à ton livreur (envoyé aussi par email)</div>
              <div style={{ fontFamily: "'Fraunces', serif", fontWeight: 700, fontSize: 24, letterSpacing: 4, color: 'var(--ink)' }}>{o.deliveryCode}</div>
            </div>
          )}
          <div className="row" style={{ justifyContent: 'space-between', marginTop: 8 }}>
            <span className="small">{o.paid ? '✅ Payée' : '⏳ Paiement en attente'}</span>
            <b>{o.total.toFixed(2)}€</b>
          </div>
        </div>
      ))}
    </div>
  );
}
