import { useEffect, useState } from 'react';
import { api } from '../../api';
import AdminPageHeader from '../../components/admin/AdminPageHeader';
import AdminDataTable, { useTableSort } from '../../components/admin/AdminDataTable';
import { useAuth } from '../../context/AuthContext';
import { useToast } from '../../context/ToastContext';
import { SkeletonCards } from '../../components/Skeleton';
import { money, fmtDate, fmtDateTime, downloadCsv } from './adminUtils';
import { useLanguage } from '../../context/LanguageContext';

const TABS = ['Vue d\'ensemble', 'Paiements clients', 'Payouts', 'Rapprochement'];
const tabLabels = (tr) => ({ "Vue d'ensemble": tr('adminPayments.tab_overview'), "Paiements clients": tr('adminPayments.tab_customerPayments'), "Payouts": tr('adminPayments.tab_payouts'), "Rapprochement": tr('adminPayments.tab_reconciliation') });
const periodTypes = (tr) => [{ key: 'month', label: tr('adminCommon.month') }, { key: 'quarter', label: tr('adminCommon.quarter') }, { key: 'year', label: tr('adminCommon.year') }];
const PAGE_SIZE = 50;

function currentMonthValue() {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
}

function usePeriod() {
  const [periodType, setPeriodType] = useState('month');
  const [month, setMonth] = useState(currentMonthValue());
  const [year, setYear] = useState(new Date().getFullYear());
  const params = new URLSearchParams();
  params.set('period', periodType);
  if (periodType === 'month') params.set('month', month);
  else params.set('year', year);
  return { periodType, setPeriodType, month, setMonth, year, setYear, queryString: params.toString() };
}

function PeriodPicker(period) {
  return (
    <div className="row" style={{ gap: 8, alignItems: 'center', marginBottom: 14, flexWrap: 'wrap' }}>
      <div className="role-pick" style={{ margin: 0 }}>
        {periodTypes(tr).map((p) => <div key={p.key} className={`chip${period.periodType === p.key ? ' active' : ''}`} onClick={() => period.setPeriodType(p.key)}>{p.label}</div>)}
      </div>
      {period.periodType === 'month' && <input type="month" value={period.month} onChange={(e) => period.setMonth(e.target.value)} style={{ maxWidth: 160 }} />}
      {period.periodType === 'year' && <input type="number" value={period.year} onChange={(e) => period.setYear(e.target.value)} style={{ maxWidth: 100 }} />}
    </div>
  );
}

export default function AdminPaymentsPage() {
  const { t: tr } = useLanguage();
  const { token } = useAuth();
  const toast = useToast();
  const [tab, setTab] = useState('Vue d\'ensemble');
  const period = usePeriod();

  return (
    <div>
      <AdminPageHeader module="payments" />
      <PeriodPicker {...period} />
      <div className="role-pick" style={{ marginBottom: 14, flexWrap: 'wrap' }}>
        {TABS.map((t) => <div key={t} className={`chip${tab === t ? ' active' : ''}`} onClick={() => setTab(t)}>{tabLabels(tr)[t] || t}</div>)}
      </div>
      {tab === 'Vue d\'ensemble' && <OverviewTab token={token} toast={toast} periodQuery={period.queryString} />}
      {tab === 'Paiements clients' && <PaymentsListTab token={token} toast={toast} />}
      {tab === 'Payouts' && <PayoutsTab token={token} toast={toast} periodQuery={period.queryString} />}
      {tab === 'Rapprochement' && <ReconciliationTab token={token} toast={toast} periodQuery={period.queryString} />}
    </div>
  );
}

function OverviewTab({ token, toast, periodQuery }) {
  const { t: tr } = useLanguage();
  const [data, setData] = useState(null);

  useEffect(() => {
    setData(null);
    api(`/admin/payments/overview?${periodQuery}`, { token }).then(setData).catch((e) => toast(e.message));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [periodQuery]);

  if (!data) return <SkeletonCards count={3} />;

  return (
    <>
      <div className="stat-grid">
        <div className="stat-card highlight"><div className="num">{money(data.successful.total)}</div><div className="label">{tr('adminPayments.successfulPayments', { n: data.successful.count })}</div></div>
        {Object.entries(data.successful.byMode).map(([mode, v]) => (
          <div className="stat-card" key={mode}><div className="num">{money(v.total)}</div><div className="label">{tr('adminPayments.ofWhichMode', { mode, n: v.count })}</div></div>
        ))}
        <div className="stat-card"><div className="num">{data.unpaid.pendingCount}</div><div className="label">{tr('adminPayments.recentUnpaid', { n: data.unpaid.pendingThresholdMinutes })}</div></div>
        <div className="stat-card"><div className="num" style={{ color: 'var(--red)' }}>{data.unpaid.likelyAbandonedCount}</div><div className="label">{tr('adminPayments.likelyAbandonedAmount', { amount: money(data.unpaid.likelyAbandonedTotal) })}</div></div>
        <div className="stat-card"><div className="num" style={{ color: 'var(--red)' }}>{money(data.refunds.total)}</div><div className="label">{tr('adminPayments.refundsN', { n: data.refunds.count })}</div></div>
        <div className="stat-card"><div className="num">{data.payouts.restaurantDone}</div><div className="label">{tr('adminPayments.restoPayoutsDone')}</div></div>
        <div className="stat-card"><div className="num" style={{ color: 'var(--gold-deep)' }}>{data.payouts.restaurantPending}</div><div className="label">{tr('adminPayments.restoPayoutsPending')}</div></div>
        <div className="stat-card"><div className="num">{data.payouts.driverDone}</div><div className="label">{tr('adminPayments.driverPayoutsDone')}</div></div>
        <div className="stat-card"><div className="num" style={{ color: 'var(--gold-deep)' }}>{data.payouts.driverPending}</div><div className="label">{tr('adminPayments.driverPayoutsPending')}</div></div>
      </div>
      <div className="card" style={{ marginTop: 16, borderLeft: '3px solid var(--gold-deep)' }}>
        <p className="small" style={{ margin: 0 }}>
          {tr('adminPayments.abandonedWarning', { reason: data.chargebacks.reason })}
        </p>
      </div>
    </>
  );
}

function PaymentsListTab({ token, toast }) {
  const { t: tr } = useLanguage();
  const { sort, toggle } = useTableSort('createdAt');
  const [status, setStatus] = useState('');
  const [paymentMode, setPaymentMode] = useState('');
  const [q, setQ] = useState('');
  const [page, setPage] = useState(0);
  const [data, setData] = useState(null);

  useEffect(() => { setPage(0); }, [status, paymentMode, q]);

  useEffect(() => {
    setData(null);
    const params = new URLSearchParams();
    if (status) params.set('status', status);
    if (paymentMode) params.set('paymentMode', paymentMode);
    if (q) params.set('q', q);
    params.set('limit', PAGE_SIZE);
    params.set('offset', page * PAGE_SIZE);
    api(`/admin/payments/list?${params.toString()}`, { token }).then(setData).catch((e) => toast(e.message));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [status, paymentMode, q, page]);

  function exportCsv() {
    if (!data || !data.rows.length) { toast(tr('adminCommon.nothingToExport')); return; }
    downloadCsv(`paiements-${Date.now()}.csv`, data.rows, [
      { label: 'ID commande', get: (r) => r.id }, { label: 'Restaurant', get: (r) => r.restaurantName }, { label: 'Client', get: (r) => r.clientName },
      { label: tr('adminCommon.amount'), get: (r) => r.total }, { label: 'Mode', get: (r) => r.paymentMode || '' }, { label: 'Payée', get: (r) => r.paid },
      { label: 'Date paiement', get: (r) => (r.paidAt ? fmtDateTime(r.paidAt) : '') }, { label: 'Créée le', get: (r) => fmtDateTime(r.createdAt) }, { label: 'Remboursé', get: (r) => r.refundTotal }
    ]);
  }

  return (
    <>
      <div className="row" style={{ gap: 8, marginBottom: 10, flexWrap: 'wrap' }}>
        <input placeholder={tr('adminPayments.phSearch')} value={q} onChange={(e) => setQ(e.target.value)} style={{ flex: 1, minWidth: 200 }} />
        <select value={paymentMode} onChange={(e) => setPaymentMode(e.target.value)} style={{ maxWidth: 140 }}>
          <option value="">{tr('adminPayments.allModes')}</option>
          <option value="stripe">{tr('adminPayments.stripe')}</option>
          <option value="balance">{tr('adminPayments.balance')}</option>
        </select>
        <button className="btn-outline" onClick={exportCsv}>{tr('adminCommon.csv')}</button>
      </div>
      <div className="role-pick" style={{ marginBottom: 14 }}>
        {[{ key: '', label: tr('adminCommon.allF') }, { key: 'paid', label: tr('adminCommon.paidF') }, { key: 'unpaid', label: tr('adminCommon.unpaidF') }].map((f) => (
          <div key={f.key || 'all'} className={`chip${status === f.key ? ' active' : ''}`} onClick={() => setStatus(f.key)}>{f.label}</div>
        ))}
      </div>
      {!data && <SkeletonCards count={4} />}
      {data && data.rows.length === 0 && <div className="empty">{tr('adminPayments.noneForFilter')}</div>}
      {data && data.rows.length > 0 && (
        <AdminDataTable rows={data.rows} sort={sort} onSort={toggle} showTotals format={{ total: money, refundTotal: money }} columns={[
          { key: 'createdAt', label: tr('adminCommon.date'), get: (r) => fmtDateTime(r.paidAt || r.createdAt), sortValue: (r) => r.paidAt || r.createdAt },
          { key: 'restaurantName', label: tr('adminCommon.restaurant'), get: (r) => <b>{r.restaurantName}</b>, sortValue: (r) => r.restaurantName },
          { key: 'clientName', label: tr('adminCommon.client'), get: (r) => r.clientName },
          { key: 'paymentMode', label: tr('adminPayments.colMode'), get: (r) => r.paymentMode || tr('adminPayments.unknownMode') },
          { key: 'paid', label: tr('adminCommon.status'), get: (r) => <span className="pill" style={{ color: r.paid ? 'var(--teal-deep)' : 'var(--gold-deep)' }}>{r.paid ? tr('adminCommon.paidBadge') : tr('adminCommon.unpaidBadge')}</span>, sortValue: (r) => (r.paid ? 1 : 0) },
          { key: 'refundTotal', label: tr('adminPayments.colRefunded'), get: (r) => (r.refundTotal > 0 ? <span style={{ color: 'var(--red)' }}>{money(r.refundTotal)}</span> : '—'), sortValue: (r) => r.refundTotal || 0, align: 'right', sum: true },
          { key: 'total', label: tr('adminCommon.amount'), get: (r) => money(r.total), sortValue: (r) => r.total, align: 'right', sum: true }
        ]} />
      )}
      {data && data.total > PAGE_SIZE && (
        <div className="row" style={{ justifyContent: 'center', gap: 12, marginTop: 12 }}>
          <button className="btn-ghost" disabled={page === 0} onClick={() => setPage((p) => p - 1)}>{tr('adminCommon.previous')}</button>
          <span className="small">{tr('adminCommon.pageOfCount', { page: page + 1, pages: Math.ceil(data.total / PAGE_SIZE), n: data.total })}</span>
          <button className="btn-ghost" disabled={(page + 1) * PAGE_SIZE >= data.total} onClick={() => setPage((p) => p + 1)}>{tr('adminCommon.next')}</button>
        </div>
      )}
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
  const [data, setData] = useState(null);

  useEffect(() => { setPage(0); }, [recipientType, status, periodQuery]);

  useEffect(() => {
    setData(null);
    const params = new URLSearchParams(periodQuery);
    if (recipientType) params.set('recipientType', recipientType);
    if (status) params.set('status', status);
    params.set('limit', PAGE_SIZE);
    params.set('offset', page * PAGE_SIZE);
    api(`/admin/payments/payouts?${params.toString()}`, { token }).then(setData).catch((e) => toast(e.message));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [recipientType, status, page, periodQuery]);

  function exportCsv() {
    if (!data || !data.rows.length) { toast(tr('adminCommon.nothingToExport')); return; }
    downloadCsv(`payouts-${Date.now()}.csv`, data.rows, [
      { label: 'ID commande', get: (r) => r.orderId }, { label: 'Destinataire', get: (r) => r.recipientName }, { label: 'Type', get: (r) => r.recipientType },
      { label: tr('adminCommon.component'), get: (r) => payoutComponentLabels(tr)[r.component] }, { label: 'Montant', get: (r) => r.amount }, { label: 'Statut', get: (r) => r.status }, { label: 'Date', get: (r) => fmtDateTime(r.createdAt) }
    ]);
  }

  return (
    <>
      <div className="row" style={{ justifyContent: 'space-between', gap: 8, marginBottom: 10, flexWrap: 'wrap' }}>
        <div className="role-pick" style={{ margin: 0 }}>
          {[{ key: '', label: tr('adminCommon.allM') }, { key: 'restaurant', label: tr('adminCommon.restaurants') }, { key: 'driver', label: tr('adminCommon.drivers') }].map((f) => (
            <div key={f.key || 'all'} className={`chip${recipientType === f.key ? ' active' : ''}`} onClick={() => setRecipientType(f.key)}>{f.label}</div>
          ))}
          {[{ key: '', label: tr('adminCommon.allStatuses') }, { key: 'pending', label: tr('adminCommon.pending') }, { key: 'done', label: tr('adminPayments.doneF') }].map((f) => (
            <div key={`s-${f.key || 'all'}`} className={`chip${status === f.key ? ' active' : ''}`} onClick={() => setStatus(f.key)}>{f.label}</div>
          ))}
        </div>
        <button className="btn-outline" onClick={exportCsv}>{tr('adminCommon.csv')}</button>
      </div>
      {!data && <SkeletonCards count={4} />}
      {data && data.rows.length === 0 && <div className="empty">{tr('adminPayments.noPayoutForFilter')}</div>}
      {data && data.rows.length > 0 && (
        <AdminDataTable rows={data.rows.map((r) => ({ ...r, id: `${r.orderId}-${r.component}` }))} sort={sort} onSort={toggle} showTotals format={{ amount: money }} columns={[
          { key: 'createdAt', label: tr('adminCommon.date'), get: (r) => fmtDate(r.createdAt), sortValue: (r) => r.createdAt },
          { key: 'recipientName', label: tr('adminPayments.colRecipient'), get: (r) => <b>{r.recipientName || '—'}</b>, sortValue: (r) => r.recipientName || '' },
          { key: 'recipientType', label: tr('adminCommon.type'), get: (r) => (r.recipientType === 'driver' ? tr('adminCommon.driver') : tr('adminCommon.restaurant')) },
          { key: 'component', label: tr('adminCommon.component'), get: (r) => payoutComponentLabels(tr)[r.component] || r.component },
          { key: 'orderId', label: tr('adminCommon.orders'), get: (r) => <span style={{ fontFamily: 'monospace' }}>{r.orderId.slice(0, 8)}</span> },
          { key: 'status', label: tr('adminCommon.status'), get: (r) => <span className="pill" style={{ color: r.status === 'done' ? 'var(--teal-deep)' : 'var(--gold-deep)' }}>{r.status === 'done' ? tr('adminPayments.done') : tr('adminPayments.pendingBadge')}</span>, sortValue: (r) => r.status },
          { key: 'amount', label: tr('adminCommon.amount'), get: (r) => money(r.amount), sortValue: (r) => r.amount, align: 'right', sum: true }
        ]} />
      )}
      {data && data.total > PAGE_SIZE && (
        <div className="row" style={{ justifyContent: 'center', gap: 12, marginTop: 12 }}>
          <button className="btn-ghost" disabled={page === 0} onClick={() => setPage((p) => p - 1)}>{tr('adminCommon.previous')}</button>
          <span className="small">{tr('adminCommon.pageOfCount', { page: page + 1, pages: Math.ceil(data.total / PAGE_SIZE), n: data.total })}</span>
          <button className="btn-ghost" disabled={(page + 1) * PAGE_SIZE >= data.total} onClick={() => setPage((p) => p + 1)}>{tr('adminCommon.next')}</button>
        </div>
      )}
    </>
  );
}

const reconciliationLabels = (tr) => ({ rapproche: tr('adminCommon.reconciledOne'), non_rapproche: tr('adminCommon.notReconciledOne'), problematique: tr('adminCommon.problematicOne') });

// Réutilise directement GET /admin/accounting/reconciliation (déjà construit pour Comptabilité) — même
// logique de rapprochement paiement↔commande↔remboursement↔payout, pas dupliquée côté backend, juste
// re-présentée ici sous l'angle "Paiements".
function ReconciliationTab({ token, toast, periodQuery }) {
  const { t: tr } = useLanguage();
  const [data, setData] = useState(null);
  const [filter, setFilter] = useState('non_rapproche');

  useEffect(() => {
    setData(null);
    api(`/admin/accounting/reconciliation?${periodQuery}`, { token }).then(setData).catch((e) => toast(e.message));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [periodQuery]);

  if (!data) return <SkeletonCards count={3} />;
  const rows = data.rows.filter((r) => !filter || r.state === filter);

  return (
    <>
      <div className="stat-grid">
        <div className="stat-card"><div className="num">{data.counts.rapproche}</div><div className="label">{tr('adminCommon.reconciled')}</div></div>
        <div className="stat-card"><div className="num" style={{ color: 'var(--gold-deep)' }}>{data.counts.non_rapproche}</div><div className="label">{tr('adminCommon.notReconciled')}</div></div>
        <div className="stat-card"><div className="num" style={{ color: 'var(--red)' }}>{data.counts.problematique}</div><div className="label">{tr('adminCommon.problematic')}</div></div>
      </div>
      <div className="role-pick" style={{ margin: '14px 0' }}>
        {[{ key: '', label: tr('adminCommon.allF') }, { key: 'non_rapproche', label: tr('adminCommon.notReconciled') }, { key: 'problematique', label: tr('adminCommon.problematic') }, { key: 'rapproche', label: tr('adminCommon.reconciledF') }].map((f) => (
          <div key={f.key || 'all'} className={`chip${filter === f.key ? ' active' : ''}`} onClick={() => setFilter(f.key)}>{f.label}</div>
        ))}
      </div>
      {rows.length === 0 && <div className="empty">{tr('adminCommon.nothingForFilter')}</div>}
      {rows.map((r) => (
        <div className="card" key={r.id}>
          <div className="row" style={{ justifyContent: 'space-between' }}>
            <b>{r.restaurantName}{r.driverName ? ` · ${r.driverName}` : ''}</b>
            <span className="small">{reconciliationLabels(tr)[r.state]}</span>
          </div>
          <div className="row" style={{ justifyContent: 'space-between', marginTop: 4 }}>
            <span className="small">{fmtDate(r.paidAt)}{r.refundTotal > 0 ? tr('adminCommon.refundedSuffix', { amount: money(r.refundTotal) }) : ''}</span>
            <b className="small">{money(r.total)}</b>
          </div>
          {r.issues.length > 0 && <div className="small" style={{ color: 'var(--red)', marginTop: 2 }}>{r.issues.join(' · ')}</div>}
        </div>
      ))}
      <p className="small" style={{ opacity: 0.6, marginTop: 10 }}>{tr('adminPayments.seeAccounting')}</p>
    </>
  );
}
