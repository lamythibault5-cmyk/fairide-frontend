import AdminDataTable, { useTableSort } from '../../../components/admin/AdminDataTable';
import { useLanguage } from '../../../context/LanguageContext';
import { money, pct } from '../adminUtils';
import { LoadState, RestaurantLink, DriverLink } from '../accounting/common';
import { useReport, SectionCard } from './common';

// Onglet Partenaires : performance des restaurants et des livreurs sur la période, tables triables,
// liens vers les fiches (presetSearch, comme la page Commandes). Le bouton CSV de l'en-tête exporte
// les restaurants ; les livreurs ont leur propre bouton.
const note = (v) => (v === null || v === undefined ? '-' : `${v.toFixed(1)} ★`);
const tauxOuTiret = (v) => (v === null || v === undefined ? '-' : pct(v));

export default function PartnersTab({ token, query, onExport }) {
  const { t: tr } = useLanguage();
  const state = useReport('partners', token, query);
  const triRestos = useTableSort('gmv');
  const triLivreurs = useTableSort('deliveries');

  const colRestos = [
    { key: 'name', label: tr('adminCommon.restaurant'), get: (r) => <RestaurantLink id={r.id} name={r.name} />, sortValue: (r) => r.name },
    { key: 'commune', label: tr('adminCommon.commune'), get: (r) => r.commune },
    { key: 'cuisine', label: tr('adminCommon.cuisine'), get: (r) => r.cuisine },
    { key: 'orders', label: tr('adminCommon.paidOrders'), get: (r) => r.orders, align: 'right', sum: true },
    { key: 'gmv', label: 'GMV', get: (r) => money(r.gmv), sortValue: (r) => r.gmv, align: 'right', sum: true },
    { key: 'acceptanceRate', label: tr('adminReports.acceptance'), get: (r) => tauxOuTiret(r.acceptanceRate), sortValue: (r) => r.acceptanceRate ?? -1, align: 'right' },
    { key: 'avgPrepMinutes', label: tr('adminReports.prepTime'), get: (r) => (r.avgPrepMinutes === null ? '-' : tr('adminRestos.minutes', { n: r.avgPrepMinutes })), sortValue: (r) => r.avgPrepMinutes ?? -1, align: 'right' },
    { key: 'rating', label: tr('adminCommon.rating'), get: (r) => note(r.rating), sortValue: (r) => r.rating ?? -1, align: 'right' },
    { key: 'cancellationRate', label: tr('adminCommon.cancellationRate'), get: (r) => tauxOuTiret(r.cancellationRate), sortValue: (r) => r.cancellationRate ?? -1, align: 'right' },
    { key: 'refunds', label: tr('adminCommon.refunds'), get: (r) => money(r.refunds), sortValue: (r) => r.refunds, align: 'right', sum: true }
  ];
  const colLivreurs = [
    { key: 'name', label: tr('adminCommon.driver'), get: (r) => <DriverLink id={r.id} name={r.name} />, sortValue: (r) => r.name },
    { key: 'deliveries', label: tr('adminCommon.deliveries'), get: (r) => r.deliveries, align: 'right', sum: true },
    { key: 'onTimeRate', label: tr('adminReports.onTime'), get: (r) => tauxOuTiret(r.onTimeRate), sortValue: (r) => r.onTimeRate ?? -1, align: 'right' },
    { key: 'rating', label: tr('adminCommon.rating'), get: (r) => note(r.rating), sortValue: (r) => r.rating ?? -1, align: 'right' },
    { key: 'avgDistanceKm', label: tr('adminReports.avgDistance'), get: (r) => (r.avgDistanceKm === null ? '-' : r.avgDistanceKm.toFixed(1)), sortValue: (r) => r.avgDistanceKm ?? -1, align: 'right' },
    { key: 'earnings', label: tr('adminReports.earnings'), get: (r) => money(r.earnings), sortValue: (r) => r.earnings, align: 'right', sum: true }
  ];
  const fmt = { gmv: money, refunds: money, earnings: money };

  return (
    <LoadState state={state} skeleton={2}>
      {(d) => (
        <>
          <SectionCard title={`${tr('adminCommon.restaurants')} (${d.restaurants.length})`}>
            <AdminDataTable columns={colRestos} rows={d.restaurants} sort={triRestos.sort} onSort={triRestos.toggle} showTotals format={fmt} emptyLabel={tr('adminReports.noPartners')} />
          </SectionCard>
          <SectionCard
            title={`${tr('adminCommon.drivers')} (${d.couriers.length})`}
            actions={onExport && <button type="button" className="btn-ghost" onClick={() => onExport('couriers')}>{tr('adminCommon.csv')}</button>}
          >
            <AdminDataTable columns={colLivreurs} rows={d.couriers} sort={triLivreurs.sort} onSort={triLivreurs.toggle} showTotals format={fmt} emptyLabel={tr('adminReports.noPartners')} />
          </SectionCard>
        </>
      )}
    </LoadState>
  );
}
