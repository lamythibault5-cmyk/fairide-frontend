import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { api } from '../../api';
import AdminPageHeader from '../../components/admin/AdminPageHeader';
import AdminDataTable, { useTableSort } from '../../components/admin/AdminDataTable';
import PeriodPicker, { usePeriod } from '../../components/admin/PeriodPicker';
import { useAuth } from '../../context/AuthContext';
import { useToast } from '../../context/ToastContext';
import { money, fmtDate, fmtDateTime, downloadCsv, useDebouncedValue } from './adminUtils';
import { useLanguage } from '../../context/LanguageContext';
import { useApiData, LoadState, Pagination, RestaurantLink, DriverLink, OrderLink } from './accounting/common';
import { StripeBalanceCard } from './accounting/OtherTabs';
import '../../admin-finance.css';

// Paiements — encaissements Stripe, virements aux partenaires, rapprochement. Le sélecteur de période
// est celui du groupe Finance (corrige au passage l'ancien trimestre envoyé sans son numéro).

const TABS = ['overview', 'payments', 'payouts', 'reconciliation'];
const tabLabels = (tr) => ({ overview: tr('adminPayments.tab_overview'), payments: tr('adminPayments.tab_customerPayments'), payouts: tr('adminPayments.tab_payouts'), reconciliation: tr('adminPayments.tab_reconciliation') });
const PAGE_SIZE = 50;

export default function AdminPaymentsPage() {
  const { t: tr } = useLanguage();
  const { token } = useAuth();
  const toast = useToast();
  const [tab, setTab] = useState('overview');
  const { period, setPeriod, queryString } = usePeriod();
  const labels = tabLabels(tr);

  return (
    <div>
      <AdminPageHeader module="payments" />
      <PeriodPicker period={period} onChange={setPeriod} />
      <nav className="fin-tabs">
        {TABS.map((t) => <div key={t} role="tab" aria-selected={tab === t} className={`chip${tab === t ? ' active' : ''}`} onClick={() => setTab(t)}>{labels[t]}</div>)}
      </nav>
      {tab === 'overview' && <OverviewTab token={token} periodQuery={queryString} />}
      {tab === 'payments' && <PaymentsListTab token={token} toast={toast} />}
      {tab === 'payouts' && <PayoutsTab token={token} toast={toast} periodQuery={queryString} />}
      {tab === 'reconciliation' && <ReconciliationTab token={token} toast={toast} periodQuery={queryString} />}
    </div>
  );
}

function OverviewTab({ token, periodQuery }) {
  const { t: tr } = useLanguage();
  const state = useApiData(() => api(`/admin/payments/overview?${periodQuery}`, { token }), [periodQuery]);
  return (
    <LoadState state={state} skeleton={3}>
      {(data) => (
        <>
          <div className="stat-grid">
            <div className="stat-card highlight"><div className="num">{money(data.successful.total)}</div><div className="label">{tr('adminPayments.successfulPayments', { n: data.successful.count })}</div></div>
            {Object.entries(data.successful.byMode).map(([mode, v]) => (
              <div className="stat-card" key={mode}><div className="num">{money(v.total)}</div><div className="label">{tr('adminPayments.ofWhichMode', { mode, n: v.count })}</div></div>
            ))}
            <div className="stat-card"><div className="num">{data.unpaid.pendingCount}</div><div className="label">{tr('adminPayments.recentUnpaid', { n: data.unpaid.pendingThresholdMinutes })}</div></div>
            <div className="stat-card"><div className="num fin-neg">{data.unpaid.likelyAbandonedCount}</div><div className="label">{tr('adminPayments.likelyAbandonedAmount', { amount: money(data.unpaid.likelyAbandonedTotal) })}</div></div>
            <div className="stat-card"><div className="num fin-neg">{money(data.refunds.total)}</div><div className="label">{tr('adminPayments.refundsN', { n: data.refunds.count })}</div></div>
            <div className="stat-card"><div className="num">{data.payouts.restaurantDone}</div><div className="label">{tr('adminPayments.restoPayoutsDone')}</div></div>
            <div className="stat-card"><div className="num" style={{ color: 'var(--gold-deep)' }}>{data.payouts.restaurantPending}</div><div className="label">{tr('adminPayments.restoPayoutsPending')}</div></div>
            <div className="stat-card"><div className="num">{data.payouts.driverDone}</div><div className="label">{tr('adminPayments.driverPayoutsDone')}</div></div>
            <div className="stat-card"><div className="num" style={{ color: 'var(--gold-deep)' }}>{data.payouts.driverPending}</div><div className="label">{tr('adminPayments.driverPayoutsPending')}</div></div>
          </div>
          <StripeBalanceCard token={token} />
          <div className="card" style={{ borderLeft: '3px solid var(--gold-deep)' }}>
            <p className="small" style={{ margin: 0 }}>{tr('adminPayments.abandonedWarning', { reason: data.chargebacks.reason })}</p>
          </div>
        </>
      )}
    </LoadState>
  );
}

function PaymentsListTab({ token, toast }) {
  const { t: tr } = useLanguage();
  const { sort, toggle } = useTableSort('createdAt');
  const [status, setStatus] = useState('');
  const [paymentMode, setPaymentMode] = useState('');
  const [qInput, setQInput] = useState('');
  const q = useDebouncedValue(qInput, 350);
  const [page, setPage] = useState(0);

  useEffect(() => { setPage(0); }, [status, paymentMode, q]);

  const state = useApiData(() => {
    const params = new URLSearchParams();
    if (status) params.set('status', status);
    if (paymentMode) params.set('paymentMode', paymentMode);
    if (q) params.set('q', q);
    params.set('limit', PAGE_SIZE); params.set('offset', page * PAGE_SIZE);
    return api(`/admin/payments/list?${params.toString()}`, { token });
  }, [status, paymentMode, q, page]);

  function exportCsv() {
    const rows = state.data?.rows || [];
    if (!rows.length) { toast(tr('adminCommon.nothingToExport')); return; }
    downloadCsv(`paiements-${Date.now()}.csv`, rows, [
      { label: tr('adminFinance.colOrder'), get: (r) => r.id }, { label: tr('adminCommon.restaurant'), get: (r) => r.restaurantName }, { label: tr('adminCommon.client'), get: (r) => r.clientName },
      { label: tr('adminCommon.amount'), get: (r) => r.total }, { label: tr('adminPayments.colMode'), get: (r) => r.paymentMode || '' }, { label: tr('adminCommon.paidF'), get: (r) => r.paid },
      { label: tr('adminPayments.colPaidAt'), get: (r) => (r.paidAt ? fmtDateTime(r.paidAt) : '') }, { label: tr('adminPayments.colCreatedAt'), get: (r) => fmtDateTime(r.createdAt) }, { label: tr('adminPayments.colRefunded'), get: (r) => r.refundTotal }
    ]);
  }

  return (
    <>
      <div className="fin-toolbar">
        <input type="search" placeholder={tr('adminPayments.phSearch')} value={qInput} onChange={(e) => setQInput(e.target.value)} />
        <select value={paymentMode} onChange={(e) => setPaymentMode(e.target.value)} aria-label={tr('adminPayments.colMode')}>
          <option value="">{tr('adminPayments.allModes')}</option>
          <option value="stripe">{tr('adminPayments.stripe')}</option>
          <option value="balance">{tr('adminPayments.balance')}</option>
        </select>
        <div className="role-pick">
          {[{ key: '', label: tr('adminCommon.allF') }, { key: 'paid', label: tr('adminCommon.paidF') }, { key: 'unpaid', label: tr('adminCommon.unpaidF') }].map((f) => (
            <div key={f.key || 'all'} className={`chip${status === f.key ? ' active' : ''}`} onClick={() => setStatus(f.key)}>{f.label}</div>
          ))}
        </div>
        <span className="spacer" />
        <button type="button" className="btn-outline" onClick={exportCsv}>{tr('adminCommon.csv')}</button>
      </div>
      <LoadState state={state} skeleton={4}>
        {(data) => (
          <>
            {data.rows.length === 0 && <div className="empty">{tr('adminPayments.noneForFilter')}</div>}
            {data.rows.length > 0 && (
              <div className="fin-table-wrap">
                <AdminDataTable rows={data.rows} sort={sort} onSort={toggle} showTotals format={{ total: money, refundTotal: money }} columns={[
                  { key: 'createdAt', label: tr('adminCommon.date'), get: (r) => <span className="small">{fmtDateTime(r.paidAt || r.createdAt)} · <OrderLink id={r.id} /></span>, sortValue: (r) => r.paidAt || r.createdAt },
                  { key: 'restaurantName', label: tr('adminCommon.restaurant'), get: (r) => <b><RestaurantLink id={r.restaurantId} name={r.restaurantName} /></b>, sortValue: (r) => r.restaurantName },
                  { key: 'clientName', label: tr('adminCommon.client'), get: (r) => r.clientName },
                  { key: 'paymentMode', label: tr('adminPayments.colMode'), get: (r) => r.paymentMode || tr('adminPayments.unknownMode') },
                  { key: 'paid', label: tr('adminCommon.status'), get: (r) => <span className="pill" style={{ color: r.paid ? 'var(--teal-deep)' : 'var(--gold-deep)' }}>{r.paid ? tr('adminCommon.paidBadge') : tr('adminCommon.unpaidBadge')}</span>, sortValue: (r) => (r.paid ? 1 : 0) },
                  { key: 'refundTotal', label: tr('adminPayments.colRefunded'), get: (r) => (r.refundTotal > 0 ? <span className="fin-neg">{money(r.refundTotal)}</span> : '-'), sortValue: (r) => r.refundTotal || 0, align: 'right', sum: true },
                  { key: 'total', label: tr('adminCommon.amount'), get: (r) => money(r.total), sortValue: (r) => r.total, align: 'right', sum: true }
                ]} />
              </div>
            )}
            <Pagination page={page} total={data.total} pageSize={PAGE_SIZE} onPage={setPage} countLabel={`(${data.total})`} />
          </>
        )}
      </LoadState>
    </>
  );
}

const payoutComponentLabels = (tr) => ({ restaurant_share: tr('adminPayments.componentRestaurant'), driver_delivery_fee: tr('adminCommon.deliveryFees'), driver_tip: tr('adminCommon.tip') });

function PayoutsTab({ token, toast, periodQuery }) {
  const { t: tr } = useLanguage();
  const { sort, toggle } = useTableSort('createdAt');
  const [recipientType, setRecipientType] = useState('');
  const [status, setStatus] = useState('pending');
  const [page, setPage] = useState(0);
  const comp = payoutComponentLabels(tr);

  useEffect(() => { setPage(0); }, [recipientType, status, periodQuery]);

  const state = useApiData(() => {
    const params = new URLSearchParams(periodQuery);
    if (recipientType) params.set('recipientType', recipientType);
    if (status) params.set('status', status);
    params.set('limit', PAGE_SIZE); params.set('offset', page * PAGE_SIZE);
    return api(`/admin/payments/payouts?${params.toString()}`, { token });
  }, [recipientType, status, page, periodQuery]);

  function exportCsv() {
    const rows = state.data?.rows || [];
    if (!rows.length) { toast(tr('adminCommon.nothingToExport')); return; }
    downloadCsv(`payouts-${Date.now()}.csv`, rows, [
      { label: tr('adminFinance.colOrder'), get: (r) => r.orderId }, { label: tr('adminPayments.colRecipient'), get: (r) => r.recipientName }, { label: tr('adminCommon.type'), get: (r) => r.recipientType },
      { label: tr('adminCommon.component'), get: (r) => comp[r.component] || r.component }, { label: tr('adminCommon.amount'), get: (r) => r.amount }, { label: tr('adminCommon.status'), get: (r) => r.status }, { label: tr('adminCommon.date'), get: (r) => fmtDateTime(r.createdAt) }
    ]);
  }

  return (
    <>
      <div className="fin-toolbar">
        <div className="role-pick">
          {[{ key: '', label: tr('adminCommon.allM') }, { key: 'restaurant', label: tr('adminCommon.restaurants') }, { key: 'driver', label: tr('adminCommon.drivers') }].map((f) => (
            <div key={f.key || 'all'} className={`chip${recipientType === f.key ? ' active' : ''}`} onClick={() => setRecipientType(f.key)}>{f.label}</div>
          ))}
        </div>
        <div className="role-pick">
          {[{ key: '', label: tr('adminCommon.allStatuses') }, { key: 'pending', label: tr('adminCommon.pending') }, { key: 'done', label: tr('adminPayments.doneF') }].map((f) => (
            <div key={`s-${f.key || 'all'}`} className={`chip${status === f.key ? ' active' : ''}`} onClick={() => setStatus(f.key)}>{f.label}</div>
          ))}
        </div>
        <span className="spacer" />
        <button type="button" className="btn-outline" onClick={exportCsv}>{tr('adminCommon.csv')}</button>
      </div>
      <LoadState state={state} skeleton={4}>
        {(data) => (
          <>
            {data.rows.length === 0 && <div className="empty">{tr('adminPayments.noPayoutForFilter')}</div>}
            {data.rows.length > 0 && (
              <div className="fin-table-wrap">
                <AdminDataTable rows={data.rows.map((r) => ({ ...r, id: `${r.orderId}-${r.component}` }))} sort={sort} onSort={toggle} showTotals format={{ amount: money }} columns={[
                  { key: 'createdAt', label: tr('adminCommon.date'), get: (r) => fmtDate(r.createdAt), sortValue: (r) => r.createdAt },
                  { key: 'recipientName', label: tr('adminPayments.colRecipient'), get: (r) => <b>{r.recipientType === 'driver' ? <DriverLink id={r.recipientId} name={r.recipientName} /> : <RestaurantLink id={r.recipientId} name={r.recipientName} />}</b>, sortValue: (r) => r.recipientName || '' },
                  { key: 'recipientType', label: tr('adminCommon.type'), get: (r) => (r.recipientType === 'driver' ? tr('adminCommon.driver') : tr('adminCommon.restaurant')) },
                  { key: 'component', label: tr('adminCommon.component'), get: (r) => comp[r.component] || r.component },
                  { key: 'orderId', label: tr('adminCommon.orders'), get: (r) => <OrderLink id={r.orderId} /> },
                  { key: 'status', label: tr('adminCommon.status'), get: (r) => <span className="pill" style={{ color: r.status === 'done' ? 'var(--teal-deep)' : 'var(--gold-deep)' }}>{r.status === 'done' ? tr('adminPayments.done') : tr('adminPayments.pendingBadge')}</span>, sortValue: (r) => r.status },
                  { key: 'amount', label: tr('adminCommon.amount'), get: (r) => money(r.amount), sortValue: (r) => r.amount, align: 'right', sum: true }
                ]} />
              </div>
            )}
            <Pagination page={page} total={data.total} pageSize={PAGE_SIZE} onPage={setPage} countLabel={`(${data.total})`} />
          </>
        )}
      </LoadState>
    </>
  );
}

const reconciliationLabels = (tr) => ({ rapproche: tr('adminCommon.reconciledOne'), non_rapproche: tr('adminCommon.notReconciledOne'), problematique: tr('adminCommon.problematicOne') });

// Même source que Comptabilité › Rapprochement (GET /admin/accounting/reconciliation), présentée sous
// l'angle « Paiements » : compteurs, liste filtrable, CSV, et un lien vers la vue complète.
function ReconciliationTab({ token, toast, periodQuery }) {
  const { t: tr } = useLanguage();
  const [filter, setFilter] = useState('non_rapproche');
  const state = useApiData(() => api(`/admin/accounting/reconciliation?${periodQuery}`, { token }), [periodQuery]);
  const labels = reconciliationLabels(tr);

  function exportCsv() {
    const rows = state.data?.rows || [];
    if (!rows.length) { toast(tr('adminCommon.nothingToExport')); return; }
    downloadCsv(`rapprochement-${Date.now()}.csv`, rows, [
      { label: tr('adminFinance.colOrder'), get: (r) => r.id }, { label: tr('adminCommon.restaurant'), get: (r) => r.restaurantName }, { label: tr('adminCommon.driver'), get: (r) => r.driverName || '' },
      { label: tr('adminCommon.total'), get: (r) => r.total }, { label: tr('adminAccounting.state'), get: (r) => labels[r.state] || r.state }, { label: tr('adminAccounting.problems'), get: (r) => r.issues.join(' | ') }, { label: tr('adminCommon.date'), get: (r) => fmtDate(r.paidAt) }
    ]);
  }

  return (
    <LoadState state={state} skeleton={3}>
      {(data) => {
        const rows = data.rows.filter((r) => !filter || r.state === filter);
        return (
          <>
            <div className="stat-grid">
              <div className="stat-card"><div className="num">{data.counts.rapproche}</div><div className="label">{tr('adminCommon.reconciled')}</div></div>
              <div className="stat-card"><div className="num" style={{ color: 'var(--gold-deep)' }}>{data.counts.non_rapproche}</div><div className="label">{tr('adminCommon.notReconciled')}</div></div>
              <div className="stat-card"><div className="num fin-neg">{data.counts.problematique}</div><div className="label">{tr('adminCommon.problematic')}</div></div>
            </div>
            <div className="fin-toolbar">
              <div className="role-pick">
                {[{ key: '', label: tr('adminCommon.allF') }, { key: 'non_rapproche', label: tr('adminCommon.notReconciled') }, { key: 'problematique', label: tr('adminCommon.problematic') }, { key: 'rapproche', label: tr('adminCommon.reconciledF') }].map((f) => (
                  <div key={f.key || 'all'} className={`chip${filter === f.key ? ' active' : ''}`} onClick={() => setFilter(f.key)}>{f.label}</div>
                ))}
              </div>
              <span className="spacer" />
              <button type="button" className="btn-outline" onClick={exportCsv}>{tr('adminCommon.csv')}</button>
              <Link to="/admin/accounting?tab=reconciliation" className="btn-outline" style={{ textDecoration: 'none', padding: '8px 14px', fontSize: 13 }}>{tr('adminPayments.openAccountingReconciliation')}</Link>
            </div>
            {rows.length === 0 && <div className="empty">{tr('adminCommon.nothingForFilter')}</div>}
            {rows.map((r) => (
              <div className="card" key={r.id} style={{ padding: 14 }}>
                <div className="row" style={{ justifyContent: 'space-between', flexWrap: 'wrap', gap: 6 }}>
                  <b><RestaurantLink id={r.restaurantId} name={r.restaurantName} />{r.driverName ? <> · <DriverLink id={r.driverId} name={r.driverName} /></> : null}</b>
                  <span className="small">{labels[r.state]}</span>
                </div>
                <div className="row" style={{ justifyContent: 'space-between', marginTop: 4, flexWrap: 'wrap', gap: 6 }}>
                  <span className="small"><OrderLink id={r.id} /> · {fmtDate(r.paidAt)}{r.refundTotal > 0 ? tr('adminCommon.refundedSuffix', { amount: money(r.refundTotal) }) : ''}</span>
                  <b className="small">{money(r.total)}</b>
                </div>
                {r.issues.length > 0 && <div className="small" style={{ color: 'var(--red)', marginTop: 2 }}>{r.issues.join(' · ')}</div>}
              </div>
            ))}
          </>
        );
      }}
    </LoadState>
  );
}
