import { useMemo, useState } from 'react';
import AdminDataTable, { useTableSort } from '../../../components/admin/AdminDataTable';
import { api } from '../../../api';
import { useAuth } from '../../../context/AuthContext';
import { useLanguage } from '../../../context/LanguageContext';
import { useApiData, LoadState, KpiCard } from './common';

function aujourdhui() {
  return new Date().toLocaleDateString('sv-SE'); // YYYY-MM-DD local
}

// Onglet Capacité : pour une date, commandes de livraison vs livreurs actifs heure par heure (histogramme
// CSS — AdminBarChart ne trace qu'une seule série), heures en tension (> 3 commandes par livreur, ou
// commandes sans livreur) et répartition par commune.
export default function CapacityTab() {
  const { t: tr } = useLanguage();
  const { token } = useAuth();
  const [date, setDate] = useState(aujourdhui);
  const cap = useApiData(() => api(`/admin/logistics/capacity?date=${encodeURIComponent(date)}`, { token }), [date]);
  const { sort, toggle } = useTableSort('orders', 'desc');

  const heuresActives = useMemo(() => (cap.data?.byHour || []).filter((h) => h.orders > 0 || h.driversActive > 0).map((h) => ({ ...h, id: h.hour })), [cap.data]);
  const communes = useMemo(() => (cap.data?.byCommune || []).map((c) => ({ ...c, id: c.commune })), [cap.data]);

  function decaler(jours) {
    const d = new Date(`${date}T12:00:00`);
    d.setDate(d.getDate() + jours);
    setDate(d.toLocaleDateString('sv-SE'));
  }

  const colonnesHeures = [
    { key: 'hour', label: tr('adminLogistics.colHour'), get: (h) => tr('adminLogistics.hourFmt', { h: String(h.hour).padStart(2, '0') }), sortValue: (h) => h.hour },
    { key: 'orders', label: tr('adminCommon.orders'), align: 'right', get: (h) => h.orders, sum: true },
    { key: 'driversActive', label: tr('adminLogistics.legendDrivers'), align: 'right', get: (h) => h.driversActive },
    { key: 'ratio', label: tr('adminLogistics.colRatio'), align: 'right', get: (h) => (h.ratio === null ? <span style={{ color: 'var(--red)' }}>∞</span> : h.ratio.toFixed(1)), sortValue: (h) => (h.ratio === null ? 999 : h.ratio) }
  ];
  const colonnesCommunes = [
    { key: 'commune', label: tr('adminCommon.commune'), get: (c) => <b>{c.commune}</b>, sortValue: (c) => c.commune },
    { key: 'orders', label: tr('adminCommon.orders'), align: 'right', get: (c) => c.orders, sum: true },
    { key: 'driversActive', label: tr('adminLogistics.legendDrivers'), align: 'right', get: (c) => c.driversActive },
    { key: 'ratio', label: tr('adminLogistics.colRatio'), align: 'right', get: (c) => (c.driversActive ? (c.orders / c.driversActive).toFixed(1) : <span style={{ color: 'var(--red)' }}>∞</span>), sortValue: (c) => (c.driversActive ? c.orders / c.driversActive : 999) }
  ];

  return (
    <>
      <div className="lg-toolbar">
        <label htmlFor="lg-date" style={{ margin: 0 }}>{tr('adminCommon.date')}</label>
        <button type="button" className="btn-ghost" onClick={() => decaler(-1)} aria-label={tr('adminCommon.previous')}>‹</button>
        <input id="lg-date" type="date" value={date} max={aujourdhui()} onChange={(e) => { if (e.target.value) setDate(e.target.value); }} />
        <button type="button" className="btn-ghost" onClick={() => decaler(1)} disabled={date >= aujourdhui()} aria-label={tr('adminCommon.next')}>›</button>
        <button type="button" className={`chip${date === aujourdhui() ? ' active' : ''}`} onClick={() => setDate(aujourdhui())}>{tr('adminCommon.today')}</button>
      </div>
      <LoadState state={cap} skeleton={3}>
        {(d) => {
          const max = Math.max(1, ...d.byHour.map((h) => Math.max(h.orders, h.driversActive)));
          const tension = d.byHour.filter((h) => h.overloaded).length;
          return (
            <>
              <div className="stat-grid">
                <KpiCard value={d.summary.ordersTotal} label={tr('adminLogistics.kpiOrdersTotal')} highlight />
                <KpiCard value={d.summary.driversDistinct} label={tr('adminLogistics.kpiDriversDistinct')} />
                <KpiCard value={d.summary.peakHour === null ? '—' : tr('adminLogistics.hourFmt', { h: String(d.summary.peakHour).padStart(2, '0') })} label={tr('adminLogistics.kpiPeakHour')} />
                <KpiCard value={tension} label={tr('adminLogistics.kpiOverloadedHours')} warn={tension > 0} />
              </div>

              <div className="card" style={{ marginBottom: 14 }}>
                <h3 style={{ margin: '0 0 6px', fontSize: 15 }}>{tr('adminLogistics.chartTitle')}</h3>
                <p className="small lg-muted" style={{ margin: '0 0 10px' }}>{tr('adminLogistics.overloadHint')}</p>
                {d.summary.ordersTotal === 0 && <div className="empty" style={{ padding: '16px 0' }}>{tr('adminLogistics.emptyCapacity')}</div>}
                <div className="lg-cap-chart" role="img" aria-label={tr('adminLogistics.chartTitle')}>
                  {d.byHour.map((h) => (
                    <div key={h.hour} className={`lg-cap-col${h.overloaded ? ' overloaded' : ''}`} title={`${tr('adminLogistics.hourFmt', { h: String(h.hour).padStart(2, '0') })} · ${tr('adminCommon.orders')} ${h.orders} · ${tr('adminLogistics.legendDrivers')} ${h.driversActive}`}>
                      <div className="lg-cap-bar orders" style={{ height: `${(h.orders / max) * 100}%` }} />
                      <div className="lg-cap-bar drivers" style={{ height: `${(h.driversActive / max) * 100}%` }} />
                    </div>
                  ))}
                </div>
                <div className="lg-cap-axis" aria-hidden="true">
                  {d.byHour.map((h) => <span key={h.hour}>{h.hour}</span>)}
                </div>
                <div className="lg-cap-legend">
                  <span><i className="orders" />{tr('adminCommon.orders')}</span>
                  <span><i className="drivers" />{tr('adminLogistics.legendDrivers')}</span>
                  <span><i className="overloaded" />{tr('adminLogistics.legendOverloaded')}</span>
                </div>
              </div>

              <div className="lg-two-col">
                <div className="card">
                  <h3 style={{ margin: '0 0 10px', fontSize: 15 }}>{tr('adminLogistics.hourTableTitle')}</h3>
                  <AdminDataTable columns={colonnesHeures} rows={heuresActives} sort={{ key: 'hour', dir: 'asc' }} rowClassName={(h) => (h.overloaded ? 'lg-row-overloaded' : '')} emptyLabel={tr('adminLogistics.emptyCapacity')} showTotals />
                </div>
                <div className="card">
                  <h3 style={{ margin: '0 0 10px', fontSize: 15 }}>{tr('adminLogistics.communeTableTitle')}</h3>
                  <AdminDataTable columns={colonnesCommunes} rows={communes} sort={sort} onSort={toggle} rowClassName={(c) => (c.orders > 0 && (c.driversActive === 0 || c.orders / c.driversActive > 3) ? 'lg-row-overloaded' : '')} emptyLabel={tr('adminLogistics.emptyCapacity')} showTotals />
                </div>
              </div>
            </>
          );
        }}
      </LoadState>
    </>
  );
}
