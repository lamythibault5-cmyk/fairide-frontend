import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { api } from '../../api';
import AdminPageHeader from '../../components/admin/AdminPageHeader';
import useAdminOverview from '../../hooks/useAdminOverview';
import { useAuth } from '../../context/AuthContext';
import { useToast } from '../../context/ToastContext';
import { SkeletonCards } from '../../components/Skeleton';
import AdminBarChart from '../../components/admin/AdminBarChart';
import { money, pct } from './adminUtils';
import { useLanguage, getLocale } from '../../context/LanguageContext';

const periods = (tr) => [
  { key: 'today', label: tr('adminCommon.today') },
  { key: '7d', label: tr('adminCommon.days7') },
  { key: '30d', label: tr('adminCommon.days30') },
  { key: 'custom', label: tr('adminCommon.custom') }
];

export default function AdminDashboardPage() {
  const { t: tr } = useLanguage();
  const { token } = useAuth();
  const toast = useToast();
  const [period, setPeriod] = useState('30d');
  const [customFrom, setCustomFrom] = useState('');
  const [customTo, setCustomTo] = useState('');
  const [data, setData] = useState(null);
  const { overview } = useAdminOverview();

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
      <AdminPageHeader module="dashboard" />
      <p className="small" style={{ marginTop: -8, marginBottom: 12 }}>
        {tr('adminDash.ratesLine', { rate: (data.commissionRate * 100).toFixed(0), share: (data.deliveryFairideRate * 100).toFixed(0) })}
      </p>

      <div className="role-pick" style={{ marginBottom: 8, flexWrap: 'wrap' }}>
        {periods(tr).map((p) => <div key={p.key} className={`chip${period === p.key ? ' active' : ''}`} onClick={() => setPeriod(p.key)}>{p.label}</div>)}
      </div>
      {period === 'custom' && (
        <div className="row" style={{ gap: 8, marginBottom: 14 }}>
          <input type="date" value={customFrom} onChange={(e) => setCustomFrom(e.target.value)} />
          <input type="date" value={customTo} onChange={(e) => setCustomTo(e.target.value)} />
        </div>
      )}

      {(alerts.noDriver > 0 || alerts.late > 0 || alerts.stalePayments > 0 || alerts.abnormalCancellations) && (
        <div className="card" style={{ border: '1px solid var(--red)', marginBottom: 16 }}>
          <h3 style={{ margin: '0 0 8px', fontSize: 15, color: 'var(--red)' }}>{tr('adminDash.alerts')}</h3>
          {alerts.noDriver > 0 && <AlertLine to="/admin/orders?noDriver=1" text={`${alerts.noDriver} commande(s) sans livreur`} />}
          {alerts.late > 0 && <AlertLine to="/admin/orders?late=1" text={tr('adminDash.alertLate', { n: alerts.late })} />}
          {alerts.stalePayments > 0 && <AlertLine to="/admin/orders" text={tr('adminDash.alertStale', { n: alerts.stalePayments })} />}
          {alerts.abnormalCancellations && <AlertLine to="/admin/orders?status=annule" text={tr('adminDash.alertCancellation')} />}
        </div>
      )}

      <div className="stat-grid">
        <KpiCard label={tr('adminCommon.orders')} kpi={kpi.ordersTotal} />
        <KpiCard label={tr('adminCommon.paidOrders')} kpi={kpi.paidOrderCount} />
        <KpiCard label="GMV" kpi={kpi.gmv} format={money} highlight />
        <KpiCard label={tr('adminDash.fairideRevenue')} kpi={kpi.fairideRevenue} format={money} highlight />
        <KpiCard label={tr('adminDash.restoCommissions')} kpi={kpi.commission} format={money} />
        <KpiCard label={tr('adminDash.deliveryShare')} kpi={kpi.deliveryFairideShare} format={money} />
        <KpiCard label={tr('adminCommon.avgBasket')} kpi={kpi.avgBasket} format={money} />
        <KpiCard label={tr('adminCommon.cancellationRate')} kpi={kpi.cancellationRate} format={(v) => pct(v)} invert />
        <div className="stat-card"><div className="num">{pct(kpi.deliverySuccessRate)}</div><div className="label">{tr('adminDash.deliverySuccess')}</div></div>
        <div className="stat-card"><div className="num">{kpi.avgDeliveryMinutes !== null ? tr('adminRestos.minutes', { n: kpi.avgDeliveryMinutes }) : '—'}</div><div className="label">{tr('adminDash.avgDeliveryTime')}</div></div>
        <div className="stat-card"><div className="num">{kpi.activeRestaurants}</div><div className="label">{tr('adminDash.activeRestaurants')}</div></div>
        <div className="stat-card"><div className="num">{kpi.activeDrivers}</div><div className="label">{tr('adminDash.activeDrivers')}</div></div>
        <div className="stat-card"><div className="num">{kpi.activeClients}</div><div className="label">{tr('adminDash.activeClients')}</div></div>
      </div>

      <div className="row" style={{ gap: 16, flexWrap: 'wrap', marginTop: 20 }}>
        <div className="card" style={{ flex: '1 1 300px' }}>
          <h3 style={{ margin: '0 0 10px', fontSize: 15 }}>{tr('adminDash.ordersPerDay')}</h3>
          <AdminBarChart data={dailySeries.map((d) => ({ label: new Date(d.day).toLocaleDateString(getLocale(), { day: 'numeric', month: 'short' }), value: d.orders }))} color="var(--blue)" />
        </div>
        <div className="card" style={{ flex: '1 1 300px' }}>
          <h3 style={{ margin: '0 0 10px', fontSize: 15 }}>{tr('adminDash.revenuePerDay')}</h3>
          <AdminBarChart data={dailySeries.map((d) => ({ label: new Date(d.day).toLocaleDateString(getLocale(), { day: 'numeric', month: 'short' }), value: d.revenue }))} formatValue={money} color="var(--teal)" />
        </div>
      </div>

      <div className="row" style={{ gap: 16, flexWrap: 'wrap', marginTop: 16 }}>
        <div className="card" style={{ flex: '1 1 300px' }}>
          <h3 style={{ margin: '0 0 10px', fontSize: 15 }}>{tr('adminDash.topRestaurants')}</h3>
          {topRestaurants.length === 0 && <div className="empty">{tr('adminDash.noData')}</div>}
          {topRestaurants.map((r) => (
            <div key={r.id} className="row" style={{ justifyContent: 'space-between', padding: '4px 0' }}>
              <span className="small">{r.name} <span style={{ opacity: 0.6 }}>({r.orderCount})</span></span>
              <b className="small">{money(r.commission)}</b>
            </div>
          ))}
        </div>
        <div className="card" style={{ flex: '1 1 300px' }}>
          <h3 style={{ margin: '0 0 10px', fontSize: 15 }}>{tr('adminDash.topDrivers')}</h3>
          {topDrivers.length === 0 && <div className="empty">{tr('adminDash.noData')}</div>}
          {topDrivers.map((d) => (
            <div key={d.id} className="row" style={{ justifyContent: 'space-between', padding: '4px 0' }}>
              <span className="small">{d.name} <span style={{ opacity: 0.6 }}>({d.deliveryCount})</span></span>
              <b className="small">{money(d.revenue)}</b>
            </div>
          ))}
        </div>
      </div>

      <h3 style={{ margin: '20px 0 10px', fontSize: 15 }}>{tr('adminDash.realtime')}</h3>
      <div className="stat-grid">
        <RealtimeCard num={realtime.pending} label={tr('adminCommon.pending')} to="/admin/orders?status=nouveau" warn={realtime.pending > 0} />
        <RealtimeCard num={realtime.preparing} label={tr('adminCommon.preparing')} to="/admin/orders?status=preparation" />
        <RealtimeCard num={realtime.noDriver} label={tr('adminDash.noDriver')} to="/admin/orders?noDriver=1" warn={realtime.noDriver > 0} />
        <RealtimeCard num={realtime.late} label={tr('adminCommon.late')} to="/admin/orders?late=1" warn={realtime.late > 0} />
        <RealtimeCard num={realtime.driversAvailable} label={tr('adminDash.availableDrivers')} to="/admin/drivers" />
        {overview && (
          <>
            <RealtimeCard num={overview.reservations.today} label={tr('adminDash.reservationsToday')} to="/admin/orders?type=dine_in" />
            <RealtimeCard num={overview.reservations.pending} label={tr('adminDash.reservationsPending')} to="/admin/orders?type=dine_in&status=nouveau" warn={overview.reservations.pending > 0} />
            <RealtimeCard num={overview.support.open} label={tr('adminDash.openTickets')} to="/admin/support" warn={overview.support.slaBreached > 0} />
            <RealtimeCard num={overview.tasks.overdue} label={tr('adminDash.overdueTasks')} to="/admin/tasks" warn={overview.tasks.overdue > 0} />
            <RealtimeCard num={overview.restaurants.pending + overview.drivers.pending} label={tr('adminDash.pendingValidations')} to={overview.restaurants.pending > 0 ? '/admin/restaurants' : '/admin/drivers'} warn={overview.restaurants.pending + overview.drivers.pending > 0} />
          </>
        )}
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
  const { t: tr } = useLanguage();
  const { value, changePct } = kpi;
  const isUp = changePct !== null && changePct > 0;
  const isGood = invert ? !isUp : isUp;
  return (
    <div className={`stat-card${highlight ? ' highlight' : ''}`}>
      <div className="num">{format(value)}</div>
      <div className="label">{label}</div>
      {changePct !== null && changePct !== 0 && (
        <div className="small" style={{ color: isGood ? 'var(--teal-deep)' : 'var(--red)', marginTop: 2 }}>
          {isUp ? '▲' : '▼'} {tr('adminDash.vsPrevious', { pct: Math.abs(changePct) })}
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
