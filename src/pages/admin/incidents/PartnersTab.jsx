import { useEffect, useState } from 'react';
import { api } from '../../../api';
import { useAuth } from '../../../context/AuthContext';
import { useToast } from '../../../context/ToastContext';
import { useLanguage } from '../../../context/LanguageContext';
import AdminDataTable, { useTableSort } from '../../../components/admin/AdminDataTable';
import { ErrorCard, RecordLink } from '../../../components/admin/AdminListTools';
import { SkeletonCards } from '../../../components/Skeleton';
import { money, pct, downloadCsv } from '../adminUtils';

// Onglet « Partenaires » : restaurants et livreurs classés par nombre d'incidents sur la période, avec le
// montant remboursé et le taux (incidents / commandes de la période). Clic sur une ligne → filtre la
// liste des incidents sur ce partenaire.
function TablePartenaires({ titre, rows, type, onPick, tr, csvName }) {
  const { t } = useLanguage();
  const toast = useToast();
  const { sort, toggle } = useTableSort('incidents', 'desc');
  const colonnes = [
    { key: 'name', label: tr('adminCommon.name'), get: (r) => <RecordLink type={type} id={r.id} name={r.name} label={r.name} /> , sortValue: (r) => r.name },
    { key: 'incidents', label: tr('adminIncidents.colIncidents'), get: (r) => r.incidents, align: 'right', sum: true },
    { key: 'open', label: tr('adminIncidents.colOpen'), get: (r) => r.open, align: 'right', sum: true },
    { key: 'orders', label: tr('adminCommon.orders'), get: (r) => r.orders, align: 'right' },
    { key: 'rate', label: tr('adminIncidents.colRate'), get: (r) => (r.rate === null ? '—' : <span className={r.rate >= 0.1 ? 'inc-rate-high' : ''}>{pct(r.rate, 1)}</span>), sortValue: (r) => (r.rate === null ? -1 : r.rate), align: 'right' },
    { key: 'refunded', label: tr('adminIncidents.colRefunded'), get: (r) => money(r.refunded), sortValue: (r) => r.refunded, align: 'right', sum: true }
  ];
  function exporter() {
    if (!rows.length) { toast(tr('adminCommon.nothingToExport')); return; }
    downloadCsv(csvName, rows, [
      { label: tr('adminCommon.name'), get: (r) => r.name }, { label: tr('adminIncidents.colIncidents'), get: (r) => r.incidents },
      { label: tr('adminIncidents.colOpen'), get: (r) => r.open }, { label: tr('adminCommon.orders'), get: (r) => r.orders },
      { label: tr('adminIncidents.colRate'), get: (r) => (r.rate === null ? '' : (r.rate * 100).toFixed(1)) }, { label: tr('adminIncidents.colRefunded'), get: (r) => Number(r.refunded).toFixed(2) }
    ]);
  }
  return (
    <div className="card">
      <div className="inc-partners-head">
        <h3>{titre} <span className="pill">{rows.length}</span></h3>
        <button type="button" className="btn-ghost" onClick={exporter}>{tr('adminCommon.csv')}</button>
      </div>
      <AdminDataTable columns={colonnes} rows={rows} sort={sort} onSort={toggle} onRowClick={onPick} emptyLabel={tr('adminIncidents.noPartners')} format={{ refunded: (v) => money(v) }} showTotals />
    </div>
  );
}

export default function PartnersTab({ queryString, onPickRestaurant, onPickDriver }) {
  const { t: tr } = useLanguage();
  const { token } = useAuth();
  const [data, setData] = useState(null);
  const [erreur, setErreur] = useState(null);

  function charger() {
    setData(null); setErreur(null);
    api(`/admin/incidents/partners${queryString ? `?${queryString}` : ''}`, { token }).then(setData).catch((e) => setErreur(e.message));
  }
  useEffect(charger, [queryString, token]); // eslint-disable-line react-hooks/exhaustive-deps

  if (erreur) return <ErrorCard message={erreur} onRetry={charger} />;
  if (!data) return <div className="stat-grid"><SkeletonCards count={2} /></div>;
  return (
    <>
      <p className="small" style={{ margin: '0 0 12px', opacity: 0.75 }}>{tr('adminIncidents.partnersHelp')}</p>
      <div className="inc-partners-grid">
        <TablePartenaires titre={tr('adminCommon.restaurants')} rows={data.restaurants || []} type="restaurant" onPick={(r) => onPickRestaurant(r)} tr={tr} csvName={`incidents-restaurants-${Date.now()}.csv`} />
        <TablePartenaires titre={tr('adminCommon.drivers')} rows={data.drivers || []} type="driver" onPick={(r) => onPickDriver(r)} tr={tr} csvName={`incidents-livreurs-${Date.now()}.csv`} />
      </div>
    </>
  );
}
