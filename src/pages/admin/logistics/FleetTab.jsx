import { useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import AdminDataTable, { useTableSort } from '../../../components/admin/AdminDataTable';
import { api } from '../../../api';
import { useAuth } from '../../../context/AuthContext';
import { useLanguage } from '../../../context/LanguageContext';
import { useToast } from '../../../context/ToastContext';
import { downloadCsv, fmtDateTime } from '../adminUtils';
import { useApiData, LoadState, KpiCard, Freshness, useAutoRefresh, useDriverStatusLabels, useVehicleLabels } from './common';

const STATUTS = ['delivering', 'online', 'paused', 'offline'];

// Onglet Flotte : tous les livreurs approuvés avec leur état du moment (calculé côté serveur), leur
// dernière position connue, leurs livraisons du jour / 30 jours, leur note et la commande en cours.
// Rafraîchi toutes les 30 s.
export default function FleetTab() {
  const { t: tr } = useLanguage();
  const { token } = useAuth();
  const toast = useToast();
  const libelles = useDriverStatusLabels();
  const vehicules = useVehicleLabels();
  const fleet = useApiData(() => api('/admin/logistics/fleet', { token }), []);
  useAutoRefresh(fleet.reload, 30000);
  const { sort, toggle } = useTableSort('status', 'asc');
  const [search, setSearch] = useState('');
  const [filter, setFilter] = useState('');

  const rows = useMemo(() => {
    const q = search.trim().toLowerCase();
    return (fleet.data?.drivers || []).filter((d) => {
      if (filter && d.status !== filter) return false;
      if (!q) return true;
      return (d.name || '').toLowerCase().includes(q) || (d.phone || '').toLowerCase().includes(q) || (d.commune || '').toLowerCase().includes(q);
    });
  }, [fleet.data, search, filter]);

  function exportCsv() {
    if (!rows.length) { toast(tr('adminCommon.nothingToExport')); return; }
    downloadCsv(`flotte-${Date.now()}.csv`, rows, [
      { label: tr('adminCommon.driver'), get: (d) => d.name },
      { label: tr('adminCommon.phone'), get: (d) => d.phone },
      { label: tr('adminLogistics.colVehicle'), get: (d) => vehicules[d.vehicleType] || d.vehicleType || '' },
      { label: tr('adminCommon.status'), get: (d) => libelles[d.status] || d.status },
      { label: tr('adminLogistics.colLastSeen'), get: (d) => (d.lastSeen ? fmtDateTime(d.lastSeen) : '') },
      { label: tr('adminCommon.commune'), get: (d) => d.commune },
      { label: tr('adminLogistics.colToday'), get: (d) => d.deliveriesToday },
      { label: tr('adminLogistics.col30d'), get: (d) => d.deliveries30d },
      { label: tr('adminCommon.rating'), get: (d) => d.rating ?? '' },
      { label: tr('adminLogistics.colCurrentOrder'), get: (d) => d.currentOrderId || '' }
    ]);
  }

  const columns = [
    { key: 'name', label: tr('adminCommon.driver'), get: (d) => (<span><b>{d.name}</b>{d.phone && <span className="small lg-muted" style={{ display: 'block' }}>{d.phone}</span>}</span>), sortValue: (d) => d.name },
    { key: 'status', label: tr('adminCommon.status'), get: (d) => <span className={`lg-pill ${d.status}`}>{libelles[d.status] || d.status}</span>, sortValue: (d) => STATUTS.indexOf(d.status) },
    { key: 'vehicleType', label: tr('adminLogistics.colVehicle'), get: (d) => vehicules[d.vehicleType] || (d.vehicleType ? d.vehicleType : <span className="lg-muted">-</span>), sortValue: (d) => d.vehicleType || '' },
    { key: 'lastSeen', label: tr('adminLogistics.colLastSeen'), get: (d) => (d.lastSeen ? fmtDateTime(d.lastSeen) : <span className="lg-muted">{tr('adminLogistics.neverSeen')}</span>), sortValue: (d) => d.lastSeen || 0 },
    { key: 'commune', label: tr('adminCommon.commune'), get: (d) => d.commune || <span className="lg-muted">-</span>, sortValue: (d) => d.commune || '' },
    { key: 'deliveriesToday', label: tr('adminLogistics.colToday'), align: 'right', get: (d) => d.deliveriesToday, sum: true },
    { key: 'deliveries30d', label: tr('adminLogistics.col30d'), align: 'right', get: (d) => d.deliveries30d, sum: true },
    { key: 'rating', label: tr('adminCommon.rating'), align: 'right', get: (d) => (d.rating === null ? <span className="lg-muted">-</span> : `★ ${d.rating.toFixed(1)}`), sortValue: (d) => d.rating ?? -1 },
    {
      key: 'currentOrderId', label: tr('adminLogistics.colCurrentOrder'), sortValue: (d) => (d.currentOrderId ? 1 : 0),
      get: (d) => (d.currentOrderId
        ? <Link to={`/admin/orders?q=${encodeURIComponent(d.currentOrderId)}`} className="admin-record-link" onClick={(e) => e.stopPropagation()} title={tr('adminLogistics.viewOrder')}>#{d.currentOrderId.slice(0, 8)} →</Link>
        : <span className="lg-muted">-</span>)
    }
  ];

  return (
    <LoadState state={fleet} skeleton={4}>
      {(d) => (
        <>
          <Freshness at={d.generatedAt} onRefresh={fleet.reload} loading={fleet.loading} />
          <div className="stat-grid">
            <KpiCard value={d.counts.delivering} label={libelles.delivering} highlight />
            <KpiCard value={d.counts.online} label={libelles.online} />
            <KpiCard value={d.counts.paused} label={libelles.paused} />
            <KpiCard value={d.counts.offline} label={libelles.offline} />
          </div>
          <div className="lg-toolbar">
            <input type="search" value={search} onChange={(e) => setSearch(e.target.value)} placeholder={tr('adminLogistics.searchDriver')} aria-label={tr('adminLogistics.searchDriver')} />
            <button type="button" className={`chip${filter === '' ? ' active' : ''}`} onClick={() => setFilter('')}>{tr('adminCommon.allStatuses')}</button>
            {STATUTS.map((s) => (
              <button key={s} type="button" className={`chip${filter === s ? ' active' : ''}`} onClick={() => setFilter(s)}>{libelles[s]} <span className="pill">{d.counts[s]}</span></button>
            ))}
            <span className="spacer" />
            <button type="button" className="btn-ghost" onClick={exportCsv}>{tr('adminCommon.csv')}</button>
          </div>
          <div className="card">
            <AdminDataTable columns={columns} rows={rows} sort={sort} onSort={toggle} emptyLabel={tr('adminLogistics.emptyFleet')} showTotals />
          </div>
        </>
      )}
    </LoadState>
  );
}
