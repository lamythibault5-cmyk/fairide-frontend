import { useEffect, useState } from 'react';
import { api } from '../../api';
import { useAuth } from '../../context/AuthContext';
import { useToast } from '../../context/ToastContext';
import { SkeletonCards } from '../../components/Skeleton';
import { StarsDisplay } from '../../components/Stars';
import { DeliveryTiming, deliveryInstructionLabel } from '../../orderStatus';

export default function DriverDashboard() {
  const { token } = useAuth();
  const toast = useToast();
  const [available, setAvailable] = useState([]);
  const [mine, setMine] = useState([]);
  const [reviews, setReviews] = useState(null);
  const [loading, setLoading] = useState(true);
  const [codeInputs, setCodeInputs] = useState({});

  async function load() {
    try {
      const [availableData, mineData, reviewsData] = await Promise.all([
        api('/orders/available', { token }),
        api('/orders/mine/deliveries', { token }),
        api('/reviews/driver/mine', { token })
      ]);
      setAvailable(availableData);
      setMine(mineData);
      setReviews(reviewsData);
    } catch (e) {
      toast(e.message);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    load();
    const interval = setInterval(load, 15000);
    return () => clearInterval(interval);
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  async function claim(id) {
    try { await api(`/orders/${id}/claim`, { method: 'PATCH', token }); load(); }
    catch (e) { toast(e.message); }
  }

  async function deliver(id) {
    const code = (codeInputs[id] || '').trim();
    if (!code) { toast('Demande le code de livraison au client.'); return; }
    try {
      await api(`/orders/${id}/deliver`, { method: 'PATCH', token, body: { code } });
      setCodeInputs((prev) => { const next = { ...prev }; delete next[id]; return next; });
      toast('Livraison confirmée !');
      load();
    } catch (e) {
      toast(e.message);
    }
  }

  if (loading) return <SkeletonCards count={3} />;

  const active = mine.filter((o) => o.status === 'livraison');
  const delivered = mine.filter((o) => o.status === 'livre');

  return (
    <div>
      <div className="stat-grid">
        <div className="stat-card"><div className="num">{delivered.length}</div><div className="label">Livraisons faites</div></div>
        <div className="stat-card highlight"><div className="num">{(delivered.length * 4.5).toFixed(2)}€</div><div className="label">Gains estimés</div></div>
        <div className="stat-card">
          <div className="num" style={{ fontSize: 18 }}><StarsDisplay value={reviews?.avg || 0} size={18} /></div>
          <div className="label">{reviews?.count > 0 ? `${reviews.avg.toFixed(1)} (${reviews.count} avis)` : 'Pas encore d\'avis'}</div>
        </div>
      </div>

      {reviews && reviews.reviews.length > 0 && (
        <div className="card">
          <h3 style={{ margin: '0 0 10px', fontSize: 15 }}>Avis sur mes livraisons</h3>
          {reviews.reviews.map((r, i) => (
            <div key={i} style={{ padding: '6px 0', borderBottom: '1px solid var(--cream-dim)' }}>
              <div className="row" style={{ justifyContent: 'space-between' }}>
                <b style={{ fontSize: 13 }}>{r.clientName} · {r.restaurantName}</b>
                <StarsDisplay value={r.deliveryRating} />
              </div>
              {r.deliveryComment && <p className="small" style={{ margin: '4px 0 0' }}>{r.deliveryComment}</p>}
            </div>
          ))}
        </div>
      )}

      <h2 className="section-title" style={{ marginTop: 0 }}>Commandes prêtes à récupérer</h2>
      {available.length === 0 && <div className="empty">Aucune commande prête pour l'instant.</div>}
      {available.map((o) => (
        <div className="card" key={o.id}>
          <div className="row" style={{ justifyContent: 'space-between' }}>
            <b>{o.restaurantName}</b>
            <span className="pill teal">{o.commune}</span>
          </div>
          <div className="small" style={{ margin: '6px 0' }}>{o.items.map((i) => `${i.qty}× ${i.name}`).join(', ')}</div>
          {o.restaurantAddress && <div className="small">🏪 Retrait : {o.restaurantAddress}</div>}
          <div className="small" style={{ marginBottom: 4 }}>🏁 Livraison : {o.address}</div>
          <DeliveryTiming order={o} />
          <div className="row" style={{ justifyContent: 'space-between', marginTop: 6 }}>
            <span className="small">Course : 4.50€</span>
            <button className="btn-primary" style={{ padding: '8px 14px', fontSize: 13 }} onClick={() => claim(o.id)}>Prendre la course</button>
          </div>
        </div>
      ))}

      <h2 className="section-title">Mes livraisons en cours</h2>
      {active.length === 0 && <div className="empty">Pas de livraison en cours.</div>}
      {active.map((o) => (
        <div className="card" key={o.id}>
          <b>{o.restaurantName}</b> → {o.clientName}
          <div className="small" style={{ margin: '4px 0' }}>{o.items.map((i) => `${i.qty}× ${i.name}`).join(', ')}</div>
          {o.restaurantAddress && <div className="small">🏪 Retrait : {o.restaurantAddress}</div>}
          <div className="small">🏁 Livraison : {o.address}</div>
          {o.deliveryInstructions && (
            <div className="small" style={{ fontWeight: 600 }}>{deliveryInstructionLabel(o.deliveryInstructions)}{o.deliveryNote ? ` — ${o.deliveryNote}` : ''}</div>
          )}
          <DeliveryTiming order={o} />
          {o.clientPhone && <div className="small">📞 {o.clientPhone}</div>}
          <div className="row" style={{ marginTop: 8, gap: 8 }}>
            <input
              placeholder="Code du client"
              style={{ maxWidth: 140 }}
              value={codeInputs[o.id] || ''}
              onChange={(e) => setCodeInputs((prev) => ({ ...prev, [o.id]: e.target.value }))}
            />
            <button className="btn-teal" style={{ padding: '8px 14px', fontSize: 13 }} onClick={() => deliver(o.id)}>Confirmer la livraison</button>
          </div>
        </div>
      ))}
    </div>
  );
}
