import { useEffect, useState } from 'react';
import { api } from '../../api';
import AdminPageHeader from '../../components/admin/AdminPageHeader';
import AdminDataTable, { useTableSort } from '../../components/admin/AdminDataTable';
import PeriodPicker, { usePeriod } from '../../components/admin/PeriodPicker';
import { useAuth } from '../../context/AuthContext';
import { useToast } from '../../context/ToastContext';
import AdminBarChart from '../../components/admin/AdminBarChart';
import { money, fmtDate, fmtDateTime, downloadCsv } from './adminUtils';
import { useLanguage, getLocale } from '../../context/LanguageContext';
import { useApiData, LoadState, Pagination, RestaurantLink, DriverLink, OrderLink } from './accounting/common';
import '../../admin-finance.css';

// Finance — vue économique : ce que Fairide gagne sur la période, ce qu'elle doit reverser, détail par
// restaurant, par livreur, par transaction et par remboursement. Même sélecteur de période que la
// Comptabilité (les endpoints /admin/finance/* parlent en from/to, dérivés de la période).

const tableTabs = (tr) => [
  { key: 'by-restaurant', label: tr('adminFinance.byRestaurant') },
  { key: 'by-driver', label: tr('adminFinance.byDriver') },
  { key: 'transactions', label: tr('adminCommon.transactions') },
  { key: 'refunds', label: tr('adminCommon.refunds') }
];

const PAGE_SIZE = 25;

export default function AdminFinancePage() {
  const { t: tr } = useLanguage();
  const { token } = useAuth();
  const toast = useToast();
  const { period, setPeriod, bounds } = usePeriod({ allowAll: true });
  const [tableTab, setTableTab] = useState('by-restaurant');
  const [page, setPage] = useState(0);
  const { sort, toggle } = useTableSort('');
  const { from, to } = bounds;

  function rangeParams() {
    const params = new URLSearchParams();
    if (from) params.set('from', from);
    if (to) params.set('to', to);
    return params;
  }

  const data = useApiData(() => api(`/admin/finance?${rangeParams().toString()}`, { token }), [from, to]);
  // Série journalière du revenu : uniquement quand une période est choisie (le dashboard exige des bornes).
  const daily = useApiData(() => (from ? api(`/admin/dashboard?period=custom&from=${from.slice(0, 10)}&to=${to.slice(0, 10)}`, { token }).then((d) => d.dailySeries || []) : Promise.resolve(null)), [from, to]);

  useEffect(() => { setPage(0); }, [tableTab, from, to]);

  const table = useApiData(() => {
    const params = rangeParams();
    params.set('limit', PAGE_SIZE); params.set('offset', page * PAGE_SIZE);
    return api(`/admin/finance/${tableTab}?${params.toString()}`, { token });
  }, [tableTab, page, from, to]);

  function exportTableCsv() {
    const rows = table.data?.rows || [];
    if (!rows.length) { toast(tr('adminCommon.nothingToExport')); return; }
    const columnsByTab = {
      'by-restaurant': [
        { label: tr('adminCommon.restaurant'), get: (r) => r.name }, { label: tr('adminCommon.orders'), get: (r) => r.orderCount },
        { label: 'GMV', get: (r) => r.gmv }, { label: tr('adminCommon.commission'), get: (r) => r.commission }, { label: tr('adminFinance.dueResto'), get: (r) => r.restaurantDue }
      ],
      'by-driver': [
        { label: tr('adminCommon.driver'), get: (r) => r.name }, { label: tr('adminCommon.deliveries'), get: (r) => r.deliveryCount },
        { label: tr('adminCommon.deliveryFees'), get: (r) => r.deliveryFeesTotal }, { label: tr('adminFinance.fairideShareCol'), get: (r) => r.fairideShare }, { label: tr('adminFinance.dueDriver'), get: (r) => r.driverDue }
      ],
      transactions: [
        { label: 'ID', get: (r) => r.id }, { label: tr('adminCommon.date'), get: (r) => fmtDateTime(r.createdAt) },
        { label: tr('adminCommon.restaurant'), get: (r) => r.restaurantName }, { label: tr('adminCommon.driver'), get: (r) => r.driverName || '' }, { label: tr('adminCommon.client'), get: (r) => r.clientName },
        { label: tr('adminFinance.colSubtotal'), get: (r) => r.subtotal }, { label: tr('adminFinance.colDelivery'), get: (r) => r.deliveryFee }, { label: tr('adminCommon.commission'), get: (r) => r.commission },
        { label: tr('adminFinance.fairideShareCol'), get: (r) => r.deliveryFairideShare }, { label: tr('adminCommon.total'), get: (r) => r.total },
        { label: tr('adminFinance.dueResto'), get: (r) => r.restaurantDue }, { label: tr('adminFinance.dueDriver'), get: (r) => r.driverDue }
      ],
      refunds: [
        { label: tr('adminFinance.colOrder'), get: (r) => r.orderId }, { label: tr('adminCommon.restaurant'), get: (r) => r.restaurantName },
        { label: tr('adminCommon.amount'), get: (r) => r.amount }, { label: tr('adminFinance.responsibility'), get: (r) => r.responsibility },
        { label: tr('adminFinance.reasonCol'), get: (r) => r.reason }, { label: tr('adminCommon.date'), get: (r) => fmtDateTime(r.createdAt) }
      ]
    };
    downloadCsv(`finance-${tableTab}-${Date.now()}.csv`, rows, columnsByTab[tableTab]);
  }

  return (
    <div>
      <AdminPageHeader module="finance" />
      <PeriodPicker period={period} onChange={setPeriod} allowAll />

      <LoadState state={data} skeleton={3}>
        {(d) => (
          <>
            <div className="stat-grid">
              <div className="stat-card highlight"><div className="num">{money(d.gmv)}</div><div className="label">GMV</div></div>
              <div className="stat-card"><div className="num">{money(d.restaurantRevenue)}</div><div className="label">{tr('adminFinance.restoRevenue')}</div></div>
              <div className="stat-card"><div className="num">{money(d.commission)}</div><div className="label">{tr('adminFinance.restoCommissions', { rate: (d.commissionRate * 100).toFixed(0) })}</div></div>
              <div className="stat-card"><div className="num">{money(d.deliveryFeesTotal)}</div><div className="label">{tr('adminFinance.totalDeliveryFees')}</div></div>
              <div className="stat-card"><div className="num">{money(d.deliveryFairideShare)}</div><div className="label">{tr('adminFinance.deliveryShare', { rate: (d.deliveryFairideRate * 100).toFixed(0) })}</div></div>
              <div className="stat-card"><div className="num">{money(d.driverShare)}</div><div className="label">{tr('adminFinance.driversShare')}</div></div>
              <div className="stat-card"><div className="num">{money(d.otherFees)}</div><div className="label">{tr('adminFinance.otherServiceFees')}</div></div>
              <div className="stat-card highlight"><div className="num">{money(d.fairideRevenue)}</div><div className="label">{tr('adminFinance.totalRevenue')}</div></div>
              <div className="stat-card"><div className="num">{money(d.avgFairideRevenuePerOrder)}</div><div className="label">{tr('adminFinance.avgRevenuePerOrder')}</div></div>
              <div className="stat-card"><div className="num">{money(d.restaurantDue)}</div><div className="label">{tr('adminFinance.dueRestaurants')}</div></div>
              <div className="stat-card"><div className="num">{money(d.driverDue)}</div><div className="label">{tr('adminFinance.dueDrivers')}</div></div>
              <div className="stat-card"><div className="num">{d.paidOrderCount}</div><div className="label">{tr('adminCommon.paidOrders')}</div></div>
            </div>

            {daily.data && daily.data.length > 0 && (
              <div className="card" style={{ marginTop: 16 }}>
                <h3 style={{ margin: '0 0 10px', fontSize: 15 }}>{tr('adminFinance.revenuePerDay')}</h3>
                <AdminBarChart data={daily.data.map((x) => ({ label: new Date(x.day).toLocaleDateString(getLocale(), { day: 'numeric', month: 'short' }), value: x.revenue }))} formatValue={money} color="var(--teal)" />
              </div>
            )}

            <h3 style={{ margin: '20px 0 10px', fontSize: 15 }}>{tr('adminCommon.refunds')}</h3>
            <div className="card">
              <div className="row" style={{ justifyContent: 'space-between' }}><span className="small">{tr('adminFinance.totalRefunded', { n: d.refunds.count })}</span><b>{money(d.refunds.total)}</b></div>
              <div className="row" style={{ justifyContent: 'space-between', marginTop: 4 }}><span className="small">{tr('adminFinance.chargedRestaurant')}</span><span className="small">{money(d.refunds.byResponsibility.restaurant)}</span></div>
              <div className="row" style={{ justifyContent: 'space-between' }}><span className="small">{tr('adminFinance.chargedDriver')}</span><span className="small">{money(d.refunds.byResponsibility.driver)}</span></div>
              <div className="row" style={{ justifyContent: 'space-between' }}><span className="small">{tr('adminFinance.chargedFairide')}</span><span className="small">{money(d.refunds.byResponsibility.fairide)}</span></div>
            </div>
          </>
        )}
      </LoadState>

      <div className="fin-toolbar" style={{ marginTop: 20 }}>
        <div className="role-pick">
          {tableTabs(tr).map((t) => <div key={t.key} className={`chip${tableTab === t.key ? ' active' : ''}`} onClick={() => setTableTab(t.key)}>{t.label}</div>)}
        </div>
        <span className="spacer" />
        <button type="button" className="btn-outline" onClick={exportTableCsv}>{tr('adminCommon.csv')}</button>
      </div>

      <LoadState state={table} skeleton={3}>
        {(t) => (
          <>
            {t.rows.length === 0 && <div className="empty">{tr('adminFinance.noData')}</div>}
            {t.rows.length > 0 && (
              <div className="fin-table-wrap">
                {tableTab === 'by-restaurant' && (
                  <AdminDataTable rows={t.rows} sort={sort} onSort={toggle} showTotals format={{ gmv: money, commission: money, restaurantDue: money }} columns={[
                    { key: 'name', label: tr('adminCommon.restaurant'), get: (r) => <b><RestaurantLink id={r.id} name={r.name} /></b>, sortValue: (r) => r.name },
                    { key: 'orderCount', label: tr('adminCommon.orders'), get: (r) => r.orderCount, align: 'right', sum: true },
                    { key: 'gmv', label: 'GMV', get: (r) => money(r.gmv), sortValue: (r) => r.gmv, align: 'right', sum: true },
                    { key: 'commission', label: tr('adminCommon.commission'), get: (r) => money(r.commission), sortValue: (r) => r.commission, align: 'right', sum: true },
                    { key: 'restaurantDue', label: tr('adminFinance.dueResto'), get: (r) => money(r.restaurantDue), sortValue: (r) => r.restaurantDue, align: 'right', sum: true }
                  ]} />
                )}
                {tableTab === 'by-driver' && (
                  <AdminDataTable rows={t.rows} sort={sort} onSort={toggle} showTotals format={{ deliveryFeesTotal: money, fairideShare: money, driverDue: money }} columns={[
                    { key: 'name', label: tr('adminCommon.driver'), get: (r) => <b><DriverLink id={r.id} name={r.name} /></b>, sortValue: (r) => r.name },
                    { key: 'deliveryCount', label: tr('adminCommon.deliveries'), get: (r) => r.deliveryCount, align: 'right', sum: true },
                    { key: 'deliveryFeesTotal', label: tr('adminCommon.deliveryFees'), get: (r) => money(r.deliveryFeesTotal), sortValue: (r) => r.deliveryFeesTotal, align: 'right', sum: true },
                    { key: 'fairideShare', label: tr('adminFinance.fairideShareCol'), get: (r) => money(r.fairideShare), sortValue: (r) => r.fairideShare, align: 'right', sum: true },
                    { key: 'driverDue', label: tr('adminFinance.dueDriver'), get: (r) => money(r.driverDue), sortValue: (r) => r.driverDue, align: 'right', sum: true }
                  ]} />
                )}
                {tableTab === 'transactions' && (
                  <AdminDataTable rows={t.rows} sort={sort} onSort={toggle} showTotals format={{ total: money, commission: money, deliveryFairideShare: money, restaurantDue: money, driverDue: money }} columns={[
                    { key: 'createdAt', label: tr('adminCommon.date'), get: (r) => <span className="small">{fmtDateTime(r.createdAt)} · <OrderLink id={r.id} /></span>, sortValue: (r) => r.createdAt },
                    { key: 'restaurantName', label: tr('adminCommon.restaurant'), get: (r) => <b><RestaurantLink id={r.restaurantId} name={r.restaurantName} /></b>, sortValue: (r) => r.restaurantName },
                    { key: 'clientName', label: tr('adminCommon.client'), get: (r) => r.clientName },
                    { key: 'driverName', label: tr('adminCommon.driver'), get: (r) => (r.driverName ? <DriverLink id={r.driverId} name={r.driverName} /> : '—') },
                    { key: 'total', label: tr('adminCommon.total'), get: (r) => money(r.total), sortValue: (r) => r.total, align: 'right', sum: true },
                    { key: 'commission', label: tr('adminCommon.commission'), get: (r) => money(r.commission), sortValue: (r) => r.commission, align: 'right', sum: true },
                    { key: 'deliveryFairideShare', label: tr('adminFinance.fairideShareCol'), get: (r) => money(r.deliveryFairideShare), sortValue: (r) => r.deliveryFairideShare, align: 'right', sum: true },
                    { key: 'restaurantDue', label: tr('adminFinance.dueResto'), get: (r) => money(r.restaurantDue), sortValue: (r) => r.restaurantDue, align: 'right', sum: true },
                    { key: 'driverDue', label: tr('adminFinance.dueDriver'), get: (r) => money(r.driverDue), sortValue: (r) => r.driverDue, align: 'right', sum: true }
                  ]} />
                )}
                {tableTab === 'refunds' && (
                  <AdminDataTable rows={t.rows.map((r, i) => ({ ...r, id: r.id || `${r.orderId}-${i}` }))} sort={sort} onSort={toggle} showTotals format={{ amount: money }} columns={[
                    { key: 'createdAt', label: tr('adminCommon.date'), get: (r) => <span className="small">{fmtDate(r.createdAt)} · <OrderLink id={r.orderId} /></span>, sortValue: (r) => r.createdAt },
                    { key: 'restaurantName', label: tr('adminCommon.restaurant'), get: (r) => <b><RestaurantLink id={r.restaurantId} name={r.restaurantName} /></b>, sortValue: (r) => r.restaurantName },
                    { key: 'responsibility', label: tr('adminFinance.responsibility'), get: (r) => r.responsibility },
                    { key: 'reason', label: tr('adminFinance.reasonCol'), get: (r) => r.reason || '—' },
                    { key: 'amount', label: tr('adminCommon.amount'), get: (r) => <span className="fin-neg">{money(r.amount)}</span>, sortValue: (r) => r.amount, align: 'right', sum: true }
                  ]} />
                )}
              </div>
            )}
            <Pagination page={page} total={t.total} pageSize={PAGE_SIZE} onPage={setPage} />
          </>
        )}
      </LoadState>
    </div>
  );
}
