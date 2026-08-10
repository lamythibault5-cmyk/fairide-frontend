import { useEffect, useState } from 'react';
import { api } from '../../api';
import { useAuth } from '../../context/AuthContext';
import { useToast } from '../../context/ToastContext';

export default function DriverDashboard() {
  const { token } = useAuth();
  const toast = useToast();
  const [available, setAvailable] = useState([]);
  const [mine, setMine] = useState([]);
  const [loading, setLoading] = useState(true);

  async function load() {
    try {
      const [availableData, mineData] = await Promise.all([
        api('/orders/available', { token }),
        api('/orders/mine/deliveries', { token })
      ]);
      setAvailable(availableData);
      setMine(mineData);
    } catch (e) {
      toast(e.message);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => { load(); }, []); // eslint-disable-line react-hooks/exhaustive-deps

  async function claim(id) {
    try { await api(`/orders/${id}/claim`, { method: 'PATCH', token }); load(); }
    catch (e) { toast(e.message); }
  }

  async function deliver(id) {
    try { await api(`/orders/${id}/deliver`, { method: 'PATCH', token }); load(); }
    catch (e) { toast(e.message); }
  }

  if (loading) return <div className="small">Chargement…</div>;

  const active = mine.filter((o) => o.status === 'livraison');
  const delivered = mine.filter((o) => o.status === 'livre');

  return (
    <div>
      <div className="stat-grid">
        <div className="stat-card"><div className="num">{delivered.length}</div><div className="label">Livraisons faites</div></div>
        <div className="stat-card highlight"><div className="num">{(delivered.length * 2.5).toFixed(2)}€</div><div className="label">Gains estimés</div></div>
      </div>

      <h2 className="section-title" style={{ marginTop: 0 }}>Commandes prêtes à récupérer</h2>
      {available.length === 0 && <div className="empty">Aucune commande prête pour l'instant.</div>}
      {available.map((o) => (
        <div className="card" key={o.id}>
          <div className="row" style={{ justifyContent: 'space-between' }}>
            <b>{o.restaurantName}</b>
            <span className="pill teal">{o.commune}</span>
          </div>
          <div className="small" style={{ margin: '6px 0' }}>📍 {o.address}</div>
          <div className="row" style={{ justifyContent: 'space-between' }}>
            <span className="small">Course : 2.50€</span>
            <button className="btn-primary" style={{ padding: '8px 14px', fontSize: 13 }} onClick={() => claim(o.id)}>Prendre la course</button>
          </div>
        </div>
      ))}

      <h2 className="section-title">Mes livraisons en cours</h2>
      {active.length === 0 && <div className="empty">Pas de livraison en cours.</div>}
      {active.map((o) => (
        <div className="card" key={o.id}>
          <b>{o.restaurantName}</b> → {o.clientName}
          <div className="small">📍 {o.address}</div>
          <button className="btn-teal" style={{ marginTop: 8, padding: '8px 14px', fontSize: 13 }} onClick={() => deliver(o.id)}>Marquer livrée</button>
        </div>
      ))}
    </div>
  );
}
