import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { api } from '../../api';
import { useAuth } from '../../context/AuthContext';
import { useToast } from '../../context/ToastContext';
import { SkeletonCards } from '../../components/Skeleton';
import AdminBarChart from '../../components/admin/AdminBarChart';
import { money, pct } from './adminUtils';

const PERIODS = [
  { key: 'today', label: "Aujourd'hui" },
  { key: '7d', label: '7 jours' },
  { key: '30d', label: '30 jours' },
  { key: 'custom', label: 'Personnalisée' }
];

export default function AdminDashboardPage() {
  const { token } = useAuth();
  const toast = useToast();
  const [period, setPeriod] = useState('30d');
  const [customFrom, setCustomFrom] = useState('');
  const [customTo, setCustomTo] = useState('');
  const [data, setData] = useState(null);

  function load() {
    if (period === 'custom' && (!customFrom || !customTo)) return;
    const params = new URLSearchParams({ period });
    if (period === 'custom') { params.set('from', customFrom); params.set('to', customTo); }
    api(`/admin/dashboard?${params.toString()}`, { token }).then(setData).catch((e) => toast(e.message));
  }

  useEffect(() => {
    load();
    const interval = setInterval(load, 30000);
    return () => clearInterval(interval);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [period, customFrom, customTo]);

  if (!data) return <SkeletonCards count={3} />;
  const { kpi, realtime, alerts, dailySeries, topRestaurants, topDrivers } = data;

  return (
    <div>
      <h2 className="section-title" style={{ marginTop: 0 }}>Dashboard</h2>
      <p className="small" style={{ marginTop: -8, marginBottom: 12 }}>
        Commission resto {(data.commissionRate * 100).toFixed(0)}% · part Fairide livraison {(data.deliveryFairideRate * 100).toFixed(0)}%.
      </p>

      <div className="role-pick" style={{ marginBottom: 8, flexWrap: 'wrap' }}>
        {PERIODS.map((p) => <div key={p.key} className={`chip${period === p.key ? ' active' : ''}`} onClick={() => setPeriod(p.key)}>{p.label}</div>)}
      </div>
      {period === 'custom' && (
        <div className="row" style={{ gap: 8, marginBottom: 14 }}>
          <input type="date" value={customFrom} onChange={(e) => setCustomFrom(e.target.value)} />
          <input type="date" value={customTo} onChange={(e) => setCustomTo(e.target.value)} />
        </div>
      )}

      {(alerts.noDriver > 0 || alerts.late > 0 || alerts.stalePayments > 0 || alerts.abnormalCancellations) && (
        <div className="card" style={{ border: '1px solid var(--red)', marginBottom: 16 }}>
          <h3 style={{ margin: '0 0 8px', fontSize: 15, color: 'var(--red)' }}>⚠️ Alertes</h3>
          {alerts.noDriver > 0 && <AlertLine to="/admin/orders?noDriver=1" text={`${alerts.noDriver} commande(s) sans livreur`} />}
          {alerts.late > 0 && <AlertLine to="/admin/orders?late=1" text={`${alerts.late} commande(s) en retard`} />}
          {alerts.stalePayments > 0 && <AlertLine to="/admin/orders" text={`${alerts.stalePayments} commande(s) non payées depuis plus de 30 minutes (paiement problématique)`} />}
          {alerts.abnormalCancellations && <AlertLine to="/admin/orders?status=annule" text="Taux d'annulation anormalement élevé sur cette période" />}
        </div>
      )}

      <div className="stat-grid">
        <KpiCard label="Commandes" kpi={kpi.ordersTotal} />
        <KpiCard label="Commandes payées" kpi={kpi.paidOrderCount} />
        <KpiCard label="GMV" kpi={kpi.gmv} format={money} highlight />
        <KpiCard label="Revenus Fairide" kpi={kpi.fairideRevenue} format={money} highlight />
        <KpiCard label="Commissions restos" kpi={kpi.commission} format={money} />
        <KpiCard label="Part Fairide livraison" kpi={kpi.deliveryFairideShare} format={money} />
        <KpiCard label="Panier moyen" kpi={kpi.avgBasket} format={money} />
        <KpiCard label="Taux d'annulation" kpi={kpi.cancellationRate} format={(v) => pct(v)} invert />
        <div className="stat-card"><div className="num">{pct(kpi.deliverySuccessRate)}</div><div className="label">Livraison réussie</div></div>
        <div className="stat-card"><div className="num">{kpi.avgDeliveryMinutes !== null ? `${kpi.avgDeliveryMinutes} min` : '—'}</div><div className="label">Temps moyen de livraison</div></div>
        <div className="stat-card"><div className="num">{kpi.activeRestaurants}</div><div className="label">Restaurants actifs</div></div>
        <div className="stat-card"><div className="num">{kpi.activeDrivers}</div><div className="label">Livreurs actifs</div></div>
        <div className="stat-card"><div className="num">{kpi.activeClients}</div><div className="label">Clients actifs (30j)</div></div>
      </div>

      <div className="row" style={{ gap: 16, flexWrap: 'wrap', marginTop: 20 }}>
        <div className="card" style={{ flex: '1 1 300px' }}>
          <h3 style={{ margin: '0 0 10px', fontSize: 15 }}>Commandes par jour</h3>
          <AdminBarChart data={dailySeries.map((d) => ({ label: new Date(d.day).toLocaleDateString('fr-BE', { day: 'numeric', month: 'short' }), value: d.orders }))} color="var(--blue)" />
        </div>
        <div className="card" style={{ flex: '1 1 300px' }}>
          <h3 style={{ margin: '0 0 10px', fontSize: 15 }}>Revenu Fairide par jour</h3>
          <AdminBarChart data={dailySeries.map((d) => ({ label: new Date(d.day).toLocaleDateString('fr-BE', { day: 'numeric', month: 'short' }), value: d.revenue }))} formatValue={money} color="var(--teal)" />
        </div>
      </div>

      <div className="row" style={{ gap: 16, flexWrap: 'wrap', marginTop: 16 }}>
        <div className="card" style={{ flex: '1 1 300px' }}>
          <h3 style={{ margin: '0 0 10px', fontSize: 15 }}>🏆 Top restaurants</h3>
          {topRestaurants.length === 0 && <div className="empty">Aucune donnée sur cette période.</div>}
          {topRestaurants.map((r) => (
            <div key={r.id} className="row" style={{ justifyContent: 'space-between', padding: '4px 0' }}>
              <span className="small">{r.name} <span style={{ opacity: 0.6 }}>({r.orderCount})</span></span>
              <b className="small">{money(r.commission)}</b>
            </div>
          ))}
        </div>
        <div className="card" style={{ flex: '1 1 300px' }}>
          <h3 style={{ margin: '0 0 10px', fontSize: 15 }}>🏆 Top livreurs</h3>
          {topDrivers.length === 0 && <div className="empty">Aucune donnée sur cette période.</div>}
          {topDrivers.map((d) => (
            <div key={d.id} className="row" style={{ justifyContent: 'space-between', padding: '4px 0' }}>
              <span className="small">{d.name} <span style={{ opacity: 0.6 }}>({d.deliveryCount})</span></span>
              <b className="small">{money(d.revenue)}</b>
            </div>
          ))}
        </div>
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

function AlertLine({ to, text }) {
  return (
    <Link to={to} className="small" style={{ display: 'block', padding: '3px 0', color: 'var(--red)' }}>→ {text}</Link>
  );
}

function KpiCard({ label, kpi, format = (v) => v, highlight, invert }) {
  const { value, changePct } = kpi;
  const isUp = changePct !== null && changePct > 0;
  const isGood = invert ? !isUp : isUp;
  return (
    <div className={`stat-card${highlight ? ' highlight' : ''}`}>
      <div className="num">{format(value)}</div>
      <div className="label">{label}</div>
      {changePct !== null && changePct !== 0 && (
        <div className="small" style={{ color: isGood ? 'var(--teal-deep)' : 'var(--red)', marginTop: 2 }}>
          {isUp ? '▲' : '▼'} {Math.abs(changePct)}% vs période préc.
        </div>
      )}
      {changePct === null && <div className="small" style={{ opacity: 0.6, marginTop: 2 }}>nouveau</div>}
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
