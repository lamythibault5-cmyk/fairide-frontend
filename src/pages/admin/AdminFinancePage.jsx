import { useEffect, useState } from 'react';
import { api } from '../../api';
import { useAuth } from '../../context/AuthContext';
import { useToast } from '../../context/ToastContext';
import { SkeletonCards } from '../../components/Skeleton';
import AdminBarChart from '../../components/admin/AdminBarChart';
import { money, fmtDate, fmtDateTime, downloadCsv } from './adminUtils';
import { useLanguage } from '../../context/LanguageContext';

const periods = (tr) => [
  { key: '', label: 'Tout' },
  { key: '7', label: tr('adminCommon.days7') },
  { key: '30', label: tr('adminCommon.days30') },
  { key: '90', label: '90 jours' }
];

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
  const [period, setPeriod] = useState('30');
  const [data, setData] = useState(null);
  const [dailySeries, setDailySeries] = useState(null);
  const [tableTab, setTableTab] = useState('by-restaurant');
  const [page, setPage] = useState(0);
  const [table, setTable] = useState(null);

  const from = period ? new Date(Date.now() - Number(period) * 24 * 60 * 60 * 1000).toISOString() : '';

  useEffect(() => {
    setData(null);
    const params = new URLSearchParams();
    if (from) params.set('from', from);
    api(`/admin/finance?${params.toString()}`, { token }).then(setData).catch((e) => toast(e.message));
    if (period) {
      api(`/admin/dashboard?period=custom&from=${from}&to=${new Date().toISOString()}`, { token }).then((d) => setDailySeries(d.dailySeries)).catch(() => {});
    } else {
      setDailySeries(null);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [period]);

  useEffect(() => { setPage(0); }, [tableTab, period]);

  useEffect(() => {
    setTable(null);
    const params = new URLSearchParams();
    if (from) params.set('from', from);
    params.set('limit', PAGE_SIZE);
    params.set('offset', page * PAGE_SIZE);
    api(`/admin/finance/${tableTab}?${params.toString()}`, { token }).then(setTable).catch((e) => toast(e.message));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [tableTab, page, period]);

  function exportTableCsv() {
    if (!table || !table.rows.length) { toast(tr('adminCommon.nothingToExport')); return; }
    const columnsByTab = {
      'by-restaurant': [
        { label: 'Restaurant', get: (r) => r.name }, { label: 'Commandes', get: (r) => r.orderCount },
        { label: 'GMV', get: (r) => r.gmv }, { label: 'Commission', get: (r) => r.commission }, { label: 'Dû', get: (r) => r.restaurantDue }
      ],
      'by-driver': [
        { label: 'Livreur', get: (r) => r.name }, { label: 'Livraisons', get: (r) => r.deliveryCount },
        { label: tr('adminCommon.deliveryFees'), get: (r) => r.deliveryFeesTotal }, { label: 'Part Fairide', get: (r) => r.fairideShare }, { label: 'Dû', get: (r) => r.driverDue }
      ],
      transactions: [
        { label: 'ID', get: (r) => r.id }, { label: 'Date', get: (r) => fmtDateTime(r.createdAt) },
        { label: 'Restaurant', get: (r) => r.restaurantName }, { label: 'Livreur', get: (r) => r.driverName || '' }, { label: 'Client', get: (r) => r.clientName },
        { label: 'Sous-total', get: (r) => r.subtotal }, { label: 'Livraison', get: (r) => r.deliveryFee }, { label: 'Commission', get: (r) => r.commission },
        { label: 'Part Fairide livraison', get: (r) => r.deliveryFairideShare }, { label: 'Total', get: (r) => r.total },
        { label: tr('adminFinance.dueResto'), get: (r) => r.restaurantDue }, { label: tr('adminFinance.dueDriver'), get: (r) => r.driverDue }
      ],
      refunds: [
        { label: 'ID commande', get: (r) => r.orderId }, { label: 'Restaurant', get: (r) => r.restaurantName },
        { label: 'Montant', get: (r) => r.amount }, { label: tr('adminFinance.responsibility'), get: (r) => r.responsibility },
        { label: 'Raison', get: (r) => r.reason }, { label: 'Date', get: (r) => fmtDateTime(r.createdAt) }
      ]
    };
    downloadCsv(`finance-${tableTab}-${Date.now()}.csv`, table.rows, columnsByTab[tableTab]);
  }

  return (
    <div>
      <h2 className="section-title" style={{ marginTop: 0 }}>{tr('adminFinance.title')}</h2>
      <div className="role-pick" style={{ marginBottom: 14 }}>
        {periods(tr).map((p) => (
          <div key={p.key || 'all'} className={`chip${period === p.key ? ' active' : ''}`} onClick={() => setPeriod(p.key)}>{p.label}</div>
        ))}
      </div>

      {!data && <SkeletonCards count={3} />}
      {data && (
        <>
          <div className="stat-grid">
            <div className="stat-card highlight"><div className="num">{money(data.gmv)}</div><div className="label">GMV</div></div>
            <div className="stat-card"><div className="num">{money(data.restaurantRevenue)}</div><div className="label">{tr('adminFinance.restoRevenue')}</div></div>
            <div className="stat-card"><div className="num">{money(data.commission)}</div><div className="label">{tr('adminFinance.restoCommissions', { rate: (data.commissionRate * 100).toFixed(0) })}</div></div>
            <div className="stat-card"><div className="num">{money(data.deliveryFeesTotal)}</div><div className="label">{tr('adminFinance.totalDeliveryFees')}</div></div>
            <div className="stat-card"><div className="num">{money(data.deliveryFairideShare)}</div><div className="label">{tr('adminFinance.deliveryShare', { rate: (data.deliveryFairideRate * 100).toFixed(0) })}</div></div>
            <div className="stat-card"><div className="num">{money(data.driverShare)}</div><div className="label">{tr('adminFinance.driversShare')}</div></div>
            <div className="stat-card"><div className="num">{money(data.otherFees)}</div><div className="label">{tr('adminFinance.otherServiceFees')}</div></div>
            <div className="stat-card highlight"><div className="num">{money(data.fairideRevenue)}</div><div className="label">{tr('adminFinance.totalRevenue')}</div></div>
            <div className="stat-card"><div className="num">{money(data.avgFairideRevenuePerOrder)}</div><div className="label">{tr('adminFinance.avgRevenuePerOrder')}</div></div>
            <div className="stat-card"><div className="num">{money(data.restaurantDue)}</div><div className="label">{tr('adminFinance.dueRestaurants')}</div></div>
            <div className="stat-card"><div className="num">{money(data.driverDue)}</div><div className="label">{tr('adminFinance.dueDrivers')}</div></div>
            <div className="stat-card"><div className="num">{data.paidOrderCount}</div><div className="label">{tr('adminCommon.paidOrders')}</div></div>
          </div>

          {dailySeries && (
            <div className="card" style={{ marginTop: 16 }}>
              <h3 style={{ margin: '0 0 10px', fontSize: 15 }}>{tr('adminFinance.revenuePerDay')}</h3>
              <AdminBarChart data={dailySeries.map((d) => ({ label: new Date(d.day).toLocaleDateString('fr-BE', { day: 'numeric', month: 'short' }), value: d.revenue }))} formatValue={money} color="var(--teal)" />
            </div>
          )}

          <h3 style={{ margin: '20px 0 10px', fontSize: 15 }}>{tr('adminCommon.refunds')}</h3>
          <div className="card">
            <div className="row" style={{ justifyContent: 'space-between' }}><span className="small">{tr('adminFinance.totalRefunded', { n: data.refunds.count })}</span><b>{money(data.refunds.total)}</b></div>
            <div className="row" style={{ justifyContent: 'space-between', marginTop: 4 }}><span className="small">{tr('adminFinance.chargedRestaurant')}</span><span className="small">{money(data.refunds.byResponsibility.restaurant)}</span></div>
            <div className="row" style={{ justifyContent: 'space-between' }}><span className="small">{tr('adminFinance.chargedDriver')}</span><span className="small">{money(data.refunds.byResponsibility.driver)}</span></div>
            <div className="row" style={{ justifyContent: 'space-between' }}><span className="small">{tr('adminFinance.chargedFairide')}</span><span className="small">{money(data.refunds.byResponsibility.fairide)}</span></div>
          </div>

          <div className="row" style={{ justifyContent: 'space-between', alignItems: 'center', margin: '20px 0 10px' }}>
            <div className="role-pick" style={{ margin: 0, flexWrap: 'wrap' }}>
              {tableTabs(tr).map((t) => <div key={t.key} className={`chip${tableTab === t.key ? ' active' : ''}`} onClick={() => setTableTab(t.key)}>{t.label}</div>)}
            </div>
            <button className="btn-outline" onClick={exportTableCsv}>{tr('adminCommon.csv')}</button>
          </div>

          {!table && <SkeletonCards count={3} />}
          {table && table.rows.length === 0 && <div className="empty">{tr('adminFinance.noData')}</div>}
          {table && tableTab === 'by-restaurant' && table.rows.map((r) => (
            <div className="card" key={r.id}>
              <div className="row" style={{ justifyContent: 'space-between' }}><b>{r.name}</b><span className="small">{tr('adminFinance.ordersCount', { n: r.orderCount })}</span></div>
              <div className="row" style={{ justifyContent: 'space-between', marginTop: 4 }}><span className="small">CA {money(r.gmv)}</span><b className="small">{tr('adminFinance.commissionDue', { commission: money(r.commission), due: money(r.restaurantDue) })}</b></div>
            </div>
          ))}
          {table && tableTab === 'by-driver' && table.rows.map((r) => (
            <div className="card" key={r.id}>
              <div className="row" style={{ justifyContent: 'space-between' }}><b>{r.name}</b><span className="small">{tr('adminFinance.deliveriesCount', { n: r.deliveryCount })}</span></div>
              <div className="row" style={{ justifyContent: 'space-between', marginTop: 4 }}><span className="small">{tr('adminFinance.deliveryFeesAmount', { amount: money(r.deliveryFeesTotal) })}</span><b className="small">{tr('adminFinance.amountDue', { amount: money(r.driverDue) })}</b></div>
            </div>
          ))}
          {table && tableTab === 'transactions' && table.rows.map((r) => (
            <div className="card" key={r.id}>
              <div className="row" style={{ justifyContent: 'space-between' }}><b>{r.restaurantName}</b><span className="small">{fmtDateTime(r.createdAt)}</span></div>
              <div className="small">{r.clientName}{r.driverName ? ` · ${r.driverName}` : ''}</div>
              <div className="row" style={{ justifyContent: 'space-between', marginTop: 4 }}><span className="small">{tr('adminFinance.commissionPlusDelivery', { commission: money(r.commission), delivery: money(r.deliveryFairideShare) })}</span><b className="small">{money(r.total)}</b></div>
            </div>
          ))}
          {table && tableTab === 'refunds' && table.rows.map((r) => (
            <div className="card" key={r.id}>
              <div className="row" style={{ justifyContent: 'space-between' }}><b>{r.restaurantName}</b><span className="small">{fmtDate(r.createdAt)}</span></div>
              <div className="row" style={{ justifyContent: 'space-between', marginTop: 4 }}><span className="small">{r.reason || r.responsibility}</span><b className="small" style={{ color: 'var(--red)' }}>{money(r.amount)}</b></div>
            </div>
          ))}
          {table && table.total > PAGE_SIZE && (
            <div className="row" style={{ justifyContent: 'center', gap: 12, marginTop: 12 }}>
              <button className="btn-ghost" disabled={page === 0} onClick={() => setPage((p) => p - 1)}>{tr('adminCommon.previous')}</button>
              <span className="small">{tr('adminCommon.pageOf', { page: page + 1, pages: Math.ceil(table.total / PAGE_SIZE) })}</span>
              <button className="btn-ghost" disabled={(page + 1) * PAGE_SIZE >= table.total} onClick={() => setPage((p) => p + 1)}>{tr('adminCommon.next')}</button>
            </div>
          )}
        </>
      )}
    </div>
  );
}
