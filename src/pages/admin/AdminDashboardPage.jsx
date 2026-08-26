import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { api } from '../../api';
import { useAuth } from '../../context/AuthContext';
import { useToast } from '../../context/ToastContext';
import { SkeletonCards } from '../../components/Skeleton';
import { money } from './adminUtils';

export default function AdminDashboardPage() {
  const { token } = useAuth();
  const toast = useToast();
  const [data, setData] = useState(null);

  function load() {
    api('/admin/dashboard', { token }).then(setData).catch((e) => toast(e.message));
  }

  useEffect(() => {
    load();
    const interval = setInterval(load, 30000);
    return () => clearInterval(interval);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  if (!data) return <SkeletonCards count={3} />;
  const { kpi, realtime } = data;

  return (
    <div>
      <h2 className="section-title" style={{ marginTop: 0 }}>Dashboard</h2>
      <p className="small" style={{ marginTop: -8, marginBottom: 16 }}>Vue d'ensemble de l'activité Fairide, commission {(data.commissionRate * 100).toFixed(0)}%.</p>

      <div className="stat-grid">
        <div className="stat-card"><div className="num">{kpi.ordersToday}</div><div className="label">Commandes aujourd'hui</div></div>
        <div className="stat-card highlight"><div className="num">{money(kpi.gmv)}</div><div className="label">CA total (GMV)</div></div>
        <div className="stat-card highlight"><div className="num">{money(kpi.fairideRevenue)}</div><div className="label">Revenus Fairide</div></div>
        <div className="stat-card"><div className="num">{money(kpi.commission)}</div><div className="label">Commissions générées</div></div>
        <div className="stat-card"><div className="num">{money(kpi.avgBasket)}</div><div className="label">Panier moyen</div></div>
        <div className="stat-card"><div className="num">{kpi.ordersInProgress}</div><div className="label">Commandes en cours</div></div>
        <div className="stat-card"><div className="num">{kpi.ordersCancelled}</div><div className="label">Commandes annulées</div></div>
        <div className="stat-card"><div className="num">{kpi.activeRestaurants}</div><div className="label">Restaurants actifs</div></div>
        <div className="stat-card"><div className="num">{kpi.activeDrivers}</div><div className="label">Livreurs actifs</div></div>
        <div className="stat-card"><div className="num">{kpi.activeClients}</div><div className="label">Clients actifs (30j)</div></div>
      </div>

      <h3 style={{ margin: '20px 0 10px', fontSize: 15 }}>⚡ Temps réel</h3>
      <div className="stat-grid">
        <RealtimeCard num={realtime.pending} label="En attente" to="/admin/orders?status=nouveau" warn={realtime.pending > 0} />
        <RealtimeCard num={realtime.preparing} label="En préparation" to="/admin/orders?status=preparation" />
        <RealtimeCard num={realtime.noDriver} label="Sans livreur" to="/admin/orders?noDriver=1" warn={realtime.noDriver > 0} />
        <RealtimeCard num={realtime.late} label="En retard" to="/admin/orders?late=1" warn={realtime.late > 0} />
        <RealtimeCard num={realtime.driversAvailable} label="Livreurs disponibles" to="/admin/drivers" />
      </div>
    </div>
  );
}

function RealtimeCard({ num, label, to, warn }) {
  return (
    <Link to={to} className="stat-card" style={{ textDecoration: 'none', color: 'inherit', border: warn ? '1px solid var(--red)' : 'none' }}>
      <div className="num" style={{ color: warn ? 'var(--red)' : undefined }}>{num}</div>
      <div className="label">{label}</div>
    </Link>
  );
}
