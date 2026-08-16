import { useEffect, useState } from 'react';
import { api } from '../../api';
import { useAuth } from '../../context/AuthContext';
import { useToast } from '../../context/ToastContext';
import { SkeletonCards } from '../../components/Skeleton';

export default function TipsPage() {
  const { token } = useAuth();
  const toast = useToast();
  const [orders, setOrders] = useState(null);

  useEffect(() => {
    api('/orders/mine/deliveries', { token }).then(setOrders).catch((e) => toast(e.message));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  if (!orders) return <SkeletonCards count={3} />;

  const delivered = orders.filter((o) => o.status === 'livre');
  const tipped = delivered.filter((o) => o.tipAmount > 0).sort((a, b) => b.createdAt - a.createdAt);
  const totalTips = tipped.reduce((sum, o) => sum + o.tipAmount, 0);

  return (
    <div>
      <h2 className="section-title" style={{ marginTop: 0 }}>Pourboires</h2>
      <div className="card" style={{ marginBottom: 16 }}>
        <div className="stat-grid">
          <div className="stat-card highlight"><div className="num">{totalTips.toFixed(2)}€</div><div className="label">Total reçu</div></div>
          <div className="stat-card"><div className="num">{tipped.length}</div><div className="label">Livraisons avec pourboire</div></div>
        </div>
      </div>
      {tipped.length === 0 ? (
        <div className="empty">Pas encore de pourboire reçu.</div>
      ) : (
        tipped.map((o) => (
          <div className="card" key={o.id}>
            <div className="row" style={{ justifyContent: 'space-between' }}>
              <b>{o.restaurantName}</b>
              <span className="pill gold">+{o.tipAmount.toFixed(2)}€</span>
            </div>
            <div className="small" style={{ margin: '4px 0' }}>{o.clientName}</div>
            <div className="small">{new Date(o.createdAt).toLocaleDateString('fr-BE', { day: 'numeric', month: 'short', year: 'numeric' })}</div>
          </div>
        ))
      )}
    </div>
  );
}
