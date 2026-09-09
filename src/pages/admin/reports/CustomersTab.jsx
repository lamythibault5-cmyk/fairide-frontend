import { Link } from 'react-router-dom';
import AdminDataTable, { useTableSort } from '../../../components/admin/AdminDataTable';
import { useLanguage } from '../../../context/LanguageContext';
import { money, fmtDate } from '../adminUtils';
import { LoadState } from '../accounting/common';
import { useReport, KpiCard, SectionCard, BarList, deltaPct } from './common';

// Onglet Clients : acquisition / activité / fidélité, fréquence de commande, cohortes de rétention,
// risque de churn, meilleurs clients (libellés courts : prénom + initiale, jamais d'e-mail).
const COHORT_MONTHS = [0, 1, 2, 3, 4, 5];

function cohortCellStyle(v) {
  if (v === null || v === undefined) return undefined;
  const alpha = Math.min(1, 0.08 + (v / 100) * 0.9);
  return { background: `rgba(59,47,181,${alpha.toFixed(2)})`, color: v >= 45 ? '#fff' : 'var(--ink)' };
}

export default function CustomersTab({ token, query }) {
  const { t: tr, locale } = useLanguage();
  const state = useReport('customers', token, query);
  const tri = useTableSort('gmv');

  const colonnes = [
    { key: 'label', label: tr('adminReports.client'), get: (r) => <Link to="/admin/clients" state={{ presetSearch: r.name || r.label }} className="fin-link">{r.label}</Link>, sortValue: (r) => r.label },
    { key: 'orders', label: tr('adminCommon.orders'), get: (r) => r.orders, align: 'right' },
    { key: 'gmv', label: 'GMV', get: (r) => money(r.gmv), sortValue: (r) => r.gmv, align: 'right' },
    { key: 'lastOrder', label: tr('adminCommon.lastOrder'), get: (r) => fmtDate(r.lastOrder), sortValue: (r) => r.lastOrder || 0 }
  ];
  const moisLabel = (m) => {
    const [y, mo] = m.split('-').map(Number);
    return new Date(y, mo - 1, 1).toLocaleDateString(locale, { month: 'short', year: '2-digit' });
  };

  return (
    <LoadState state={state} skeleton={4}>
      {(d) => (
        <>
          <div className="rep-kpis">
            <KpiCard label={tr('adminReports.newClients')} value={d.newClients} changePct={deltaPct(d.newClients, d.newClientsPrevious)} highlight />
            <KpiCard label={tr('adminReports.activeClients')} value={d.activeClients} />
            <KpiCard label={tr('adminReports.returningClients')} value={d.returningClients} />
            <KpiCard label={tr('adminReports.ordersPerClient')} value={d.avgOrdersPerActiveClient} />
            <KpiCard label={tr('adminCommon.avgBasket')} value={money(d.avgBasket)} />
          </div>

          <div className="rep-grid">
            <SectionCard title={tr('adminReports.frequency')} help={tr('adminReports.frequencyHelp')}>
              <BarList rows={d.frequency.map((f) => ({ label: f.bucket, value: f.clients }))} emptyLabel={tr('adminCommon.noDataPeriod')} />
            </SectionCard>
            <div className={`card${d.churnRisk.count > 0 ? ' rep-churn' : ''}`}>
              <h3 className="rep-card-title">{tr('adminReports.churnTitle')}</h3>
              <div className="stat-card" style={{ background: 'transparent', padding: 0 }}>
                <div className="num" style={{ color: d.churnRisk.count > 0 ? 'var(--red)' : undefined }}>{d.churnRisk.count}</div>
              </div>
              <p className="small" style={{ margin: '6px 0 10px' }}>{tr('adminReports.churnText', { n: d.churnRisk.count })}</p>
              <Link to="/admin/clients" className="btn-outline" style={{ display: 'inline-block' }}>{tr('adminReports.churnLink')}</Link>
            </div>
          </div>

          <SectionCard title={tr('adminReports.cohorts')} help={tr('adminReports.cohortsHelp')}>
            {d.cohorts.length === 0 ? <div className="empty" style={{ padding: '24px 0' }}>{tr('adminReports.cohortsEmpty')}</div> : (
              <div className="table-scroll">
                <table className="admin-table rep-cohort">
                  <thead>
                    <tr>
                      <th>{tr('adminReports.cohortMonth')}</th>
                      <th style={{ textAlign: 'right' }}>{tr('adminReports.signups')}</th>
                      {COHORT_MONTHS.map((k) => <th key={k} style={{ textAlign: 'center' }}>{tr('adminReports.monthK', { k })}</th>)}
                    </tr>
                  </thead>
                  <tbody>
                    {d.cohorts.map((c) => (
                      <tr key={c.month}>
                        <td>{moisLabel(c.month)}</td>
                        <td style={{ textAlign: 'right' }}>{c.signups}</td>
                        {COHORT_MONTHS.map((k) => {
                          const v = c[`m${k}`];
                          return <td key={k} className={`cell${v === null ? ' empty' : ''}`} style={cohortCellStyle(v)}>{v === null ? '·' : `${v}%`}</td>;
                        })}
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </SectionCard>

          <SectionCard title={tr('adminReports.topClients')}>
            <AdminDataTable columns={colonnes} rows={d.topClients} sort={tri.sort} onSort={tri.toggle} emptyLabel={tr('adminCommon.noDataPeriod')} />
          </SectionCard>
        </>
      )}
    </LoadState>
  );
}
