import { useState } from 'react';
import AdminBarChart from '../../../components/admin/AdminBarChart';
import AdminDataTable, { useTableSort } from '../../../components/admin/AdminDataTable';
import { useLanguage } from '../../../context/LanguageContext';
import { money, pct } from '../adminUtils';
import { LoadState } from '../accounting/common';
import { useReport, KpiCard, SectionCard, Heatmap, orderTypeLabel } from './common';

// Onglet Ventes : KPI (vs période précédente), courbe journalière, répartitions commune / cuisine /
// type de commande, heures de pointe.
const METRICS = ['orders', 'gmv', 'revenue'];

export default function SalesTab({ token, query }) {
  const { t: tr, locale } = useLanguage();
  const state = useReport('sales', token, query);
  const [metric, setMetric] = useState('orders');
  const triCommune = useTableSort('gmv');
  const triCuisine = useTableSort('gmv');
  const triType = useTableSort('gmv');

  const fmtMetric = metric === 'orders' ? (v) => String(v) : money;
  const metricLabels = { orders: tr('adminCommon.orders'), gmv: 'GMV', revenue: tr('adminReports.revenue') };
  const colonnes = (cle, libelle) => [
    { key: cle, label: libelle, get: (r) => r[cle] },
    { key: 'orders', label: tr('adminCommon.orders'), get: (r) => r.orders, align: 'right', sum: true },
    { key: 'gmv', label: 'GMV', get: (r) => money(r.gmv), sortValue: (r) => r.gmv, align: 'right', sum: true }
  ];
  const fmtSommes = { gmv: (v) => money(v) };

  return (
    <LoadState state={state} skeleton={4}>
      {(d) => (
        <>
          <div className="rep-kpis">
            <KpiCard label={tr('adminCommon.paidOrders')} value={d.totals.orders} changePct={d.change.orders} />
            <KpiCard label="GMV" value={money(d.totals.gmv)} changePct={d.change.gmv} highlight />
            <KpiCard label={tr('adminReports.revenue')} value={money(d.totals.revenue)} changePct={d.change.revenue} highlight />
            <KpiCard label={tr('adminCommon.avgBasket')} value={money(d.totals.avgBasket)} changePct={d.change.avgBasket} />
            <KpiCard label={tr('adminReports.deliveryShare')} value={pct(d.totals.deliveryShare)} changePct={d.change.deliveryShare} />
          </div>

          <SectionCard title={tr('adminReports.byDay')} actions={(
            <div className="rep-chips" style={{ margin: 0 }}>
              {METRICS.map((m) => <div key={m} className={`chip${metric === m ? ' active' : ''}`} onClick={() => setMetric(m)}>{metricLabels[m]}</div>)}
            </div>
          )}>
            <AdminBarChart
              data={d.byDay.map((x) => ({ label: new Date(x.date).toLocaleDateString(locale, { day: 'numeric', month: 'short' }), value: x[metric] }))}
              formatValue={fmtMetric}
              color={metric === 'orders' ? 'var(--teal)' : 'var(--iris)'}
            />
          </SectionCard>

          <div className="rep-grid">
            <SectionCard title={tr('adminReports.byCommune')}>
              <AdminDataTable columns={colonnes('commune', tr('adminCommon.commune'))} rows={d.byCommune} sort={triCommune.sort} onSort={triCommune.toggle} showTotals format={fmtSommes} emptyLabel={tr('adminCommon.noDataPeriod')} />
            </SectionCard>
            <SectionCard title={tr('adminReports.byCuisine')}>
              <AdminDataTable columns={colonnes('cuisine', tr('adminCommon.cuisine'))} rows={d.byCuisine} sort={triCuisine.sort} onSort={triCuisine.toggle} showTotals format={fmtSommes} emptyLabel={tr('adminCommon.noDataPeriod')} />
            </SectionCard>
            <SectionCard title={tr('adminReports.byType')}>
              <AdminDataTable
                columns={[{ key: 'type', label: tr('adminCommon.type'), get: (r) => orderTypeLabel(r.type, tr) }, ...colonnes('type', '').slice(1)]}
                rows={d.byOrderType} sort={triType.sort} onSort={triType.toggle} showTotals format={fmtSommes} emptyLabel={tr('adminCommon.noDataPeriod')}
              />
            </SectionCard>
          </div>

          <SectionCard title={tr('adminReports.heatmap')} help={tr('adminReports.heatmapHelp')}>
            <Heatmap cells={d.heatmap} />
          </SectionCard>
        </>
      )}
    </LoadState>
  );
}
