import { useEffect, useState } from 'react';
import { createPortal } from 'react-dom';
import { useLocation } from 'react-router-dom';
import { api } from '../../api';
import AdminPageHeader from '../../components/admin/AdminPageHeader';
import AdminDataTable, { useTableSort } from '../../components/admin/AdminDataTable';
import { useAuth } from '../../context/AuthContext';
import { useToast } from '../../context/ToastContext';
import { SkeletonCards } from '../../components/Skeleton';
import ConfirmDialog from '../../components/ConfirmDialog';
import CreateTaskButton from '../../components/admin/CreateTaskButton';
import PeriodPicker, { usePeriod, defaultPeriod } from '../../components/admin/PeriodPicker';
import { money, fmtDate, fmtDateTime, useDebouncedValue, downloadPdf, downloadCsv, INVOICE_STATUS_LABELS, ACCOUNTING_ENTRY_TYPE_LABELS } from './adminUtils';
import { useLanguage } from '../../context/LanguageContext';
import { useApiData, LoadState, Pagination, RestaurantLink } from './accounting/common';
import '../../admin-finance.css';

const TABS = ['Factures', 'Impayés', 'Relevés livreurs', 'Autofacturation'];
const tabLabels = (tr) => ({ "Factures": tr('adminInvoices.tab_invoices'), "Impayés": tr('adminInvoices.tab_aged'), "Relevés livreurs": tr('adminInvoices.tab_driverStatements'), "Autofacturation": tr('adminInvoices.tab_selfBilling') });
const PAGE_SIZE = 25;
const statusFilters = (tr) => [{ key: '', label: tr('adminInvoices.all') }, ...Object.entries(INVOICE_STATUS_LABELS).map(([key, v]) => ({ key, label: v.label }))];

import { peppolLabels } from '../../components/InvoiceArchive';

function peppolPill(status, tr) {
  const l = peppolLabels(tr)[status] || peppolLabels(tr).en_attente;
  return <span className={l.pill}>{l.texte}</span>;
}

// Carte d'état du point d'accès Peppol : configuré ou non, identifiant de Fairide, enregistrement dans
// l'annuaire, compteurs, et un bouton pour forcer un passage de la file d'attente.
function PeppolStatusCard({ token, toast, tr }) {
  const [etat, setEtat] = useState(null);
  const [busy, setBusy] = useState(false);
  function load() { api('/admin/peppol/status', { token }).then(setEtat).catch((e) => toast(e.message)); }
  useEffect(load, []); // eslint-disable-line react-hooks/exhaustive-deps
  async function process() {
    setBusy(true);
    try { const r = await api('/admin/peppol/process', { method: 'POST', token }); toast(tr('adminInvoices.peppolProcessed', { sent: r.envoyes || 0, errors: r.erreurs || 0, skipped: r.ignores || 0 })); load(); } catch (e) { toast(e.message); } finally { setBusy(false); }
  }
  async function test() {
    setBusy(true);
    try { const r = await api('/admin/peppol/test', { method: 'POST', token }); toast(tr('adminInvoices.peppolTestOk', { num: r.numero, id: r.recipient })); load(); } catch (e) { toast(e.message); } finally { setBusy(false); }
  }
  if (!etat) return <SkeletonCards count={1} />;
  const c = etat.counts?.commission || {};
  return (
    <div className="card" style={{ marginBottom: 12 }}>
      <div className="row" style={{ justifyContent: 'space-between', alignItems: 'flex-start', gap: 8, flexWrap: 'wrap' }}>
        <div>
          <h3 style={{ margin: '0 0 4px', fontSize: 15 }}>🧾 {tr('adminInvoices.peppolCardTitle')}</h3>
          <p className="small" style={{ margin: '0 0 4px' }}>
            {etat.configured ? tr('adminInvoices.peppolConfigured', { provider: etat.provider, id: etat.fairidePeppolId }) : tr('adminInvoices.peppolNotConfigured', { id: etat.fairidePeppolId || '—' })}
          </p>
          <p className="small" style={{ margin: '0 0 4px' }}>{etat.fairideRegistered ? '✅ ' + tr('adminInvoices.fairideRegistered') : '⚠️ ' + tr('adminInvoices.fairideNotRegistered')}</p>
          {etat.providerCheck && <p className="small" style={{ margin: '0 0 4px', color: etat.providerCheck.ok ? 'inherit' : 'var(--red)' }}>{etat.providerCheck.ok ? '✅ ' : '❌ '}{etat.providerCheck.message}{etat.keyHint ? ` — clé ${etat.keyHint}` : ''}</p>}
          <p className="small" style={{ margin: 0 }}>{tr('adminInvoices.peppolCounts', { a: c.en_attente || 0, b: c.envoye || 0, c: c.erreur || 0 })}</p>
        </div>
        {etat.configured && (
          <span className="row" style={{ gap: 6, flexWrap: 'wrap' }}>
            <button className="btn-outline" disabled={busy} onClick={test}>{tr('adminInvoices.peppolTest')}</button>
            <button className="btn-outline" disabled={busy} onClick={process}>{tr('adminInvoices.peppolProcess')}</button>
          </span>
        )}
      </div>
    </div>
  );
}

function statusPill(status) {
  const s = INVOICE_STATUS_LABELS[status];
  return <span className="pill" style={{ color: s?.color }}>{s?.label || status}</span>;
}

export default function AdminInvoicesPage() {
  const { t: tr } = useLanguage();
  const { token } = useAuth();
  const toast = useToast();
  const location = useLocation();
  const [tab, setTab] = useState('Factures');
  const [restaurantFilter, setRestaurantFilter] = useState(location.state?.restaurantId || '');

  return (
    <div>
      <AdminPageHeader module="invoices" />
      <div className="role-pick" style={{ marginBottom: 14 }}>
        {TABS.map((t) => <div key={t} className={`chip${tab === t ? ' active' : ''}`} onClick={() => setTab(t)}>{tabLabels(tr)[t] || t}</div>)}
      </div>
      {tab === 'Factures' && restaurantFilter && (
        <div className="row" style={{ gap: 8, alignItems: 'center', marginBottom: 10 }}>
          <span className="pill teal">{tr('adminInvoices.filteredOnRestaurant')}</span>
          <button className="btn-ghost" style={{ padding: '2px 8px', fontSize: 12 }} onClick={() => setRestaurantFilter('')}>{tr('adminInvoices.removeFilter')}</button>
        </div>
      )}
      {tab === 'Factures' && <InvoicesTab token={token} toast={toast} presetRestaurantId={restaurantFilter} />}
      {tab === 'Impayés' && <AgedTab token={token} toast={toast} />}
      {tab === 'Relevés livreurs' && <DriverStatementsTab token={token} toast={toast} />}
      {tab === 'Autofacturation' && <SelfBillingTab token={token} toast={toast} />}
    </div>
  );
}

function InvoicesTab({ token, toast, presetRestaurantId }) {
  const { t: tr } = useLanguage();
  const [qInput, setQInput] = useState('');
  const q = useDebouncedValue(qInput, 350);
  const [status, setStatus] = useState('');
  const [minAmount, setMinAmount] = useState('');
  const [maxAmount, setMaxAmount] = useState('');
  const [page, setPage] = useState(0);
  const [selectedId, setSelectedId] = useState(null);
  const [showGenerate, setShowGenerate] = useState(false);
  const { sort, toggle } = useTableSort('issuedAt');
  // Période sur la date d'émission ; « Tout » par défaut pour retrouver le comportement historique.
  const { period, setPeriod, bounds } = usePeriod({ allowAll: true, initial: { ...defaultPeriod(), type: 'all' } });
  const { from, to } = bounds;

  const state = useApiData(() => {
    const params = new URLSearchParams();
    if (q) params.set('q', q);
    if (status) params.set('status', status);
    if (presetRestaurantId) params.set('restaurantId', presetRestaurantId);
    if (from) params.set('dateFrom', from);
    if (to) params.set('dateTo', to);
    if (minAmount) params.set('minAmount', minAmount);
    if (maxAmount) params.set('maxAmount', maxAmount);
    params.set('limit', PAGE_SIZE);
    params.set('offset', page * PAGE_SIZE);
    return api(`/admin/invoices?${params.toString()}`, { token });
  }, [q, status, page, presetRestaurantId, from, to, minAmount, maxAmount]);
  const load = state.reload;

  useEffect(() => { setPage(0); }, [q, status, from, to, minAmount, maxAmount]);

  function exportCsv() {
    const rows = state.data?.rows || [];
    if (!rows.length) { toast(tr('adminCommon.nothingToExport')); return; }
    downloadCsv(`factures-${Date.now()}.csv`, rows, [
      { label: tr('adminInvoices.colNumber'), get: (i) => i.invoiceNumber }, { label: tr('adminCommon.restaurant'), get: (i) => i.restaurantName },
      { label: tr('adminInvoices.colPeriod'), get: (i) => fmtDate(i.periodStart) }, { label: tr('adminCommon.status'), get: (i) => INVOICE_STATUS_LABELS[i.status]?.label || i.status },
      { label: tr('adminInvoices.colHt'), get: (i) => i.subtotalHt }, { label: tr('adminCommon.vat'), get: (i) => i.vatAmount }, { label: tr('adminInvoices.colTtc'), get: (i) => i.totalTtc },
      { label: tr('adminInvoices.colIssued'), get: (i) => fmtDate(i.issuedAt) }
    ]);
  }

  return (
    <>
      <PeppolStatusCard token={token} toast={toast} tr={tr} />
      <PeriodPicker period={period} onChange={setPeriod} allowAll compact />
      <div className="fin-toolbar">
        <input type="search" placeholder={tr('adminInvoices.phSearch')} value={qInput} onChange={(e) => setQInput(e.target.value)} />
        <label className="small admin-inline-field">{tr('adminOrders.minAmount')} <input type="number" min={0} step={1} value={minAmount} onChange={(e) => setMinAmount(e.target.value)} style={{ width: 80 }} /></label>
        <label className="small admin-inline-field">{tr('adminOrders.maxAmount')} <input type="number" min={0} step={1} value={maxAmount} onChange={(e) => setMaxAmount(e.target.value)} style={{ width: 80 }} /></label>
        {(minAmount || maxAmount) && <button type="button" className="btn-ghost" onClick={() => { setMinAmount(''); setMaxAmount(''); }}>✕ {tr('adminOrders.clearFilters')}</button>}
        <span className="spacer" />
        <button type="button" className="btn-outline" onClick={exportCsv}>{tr('adminCommon.csv')}</button>
        <button type="button" className="btn-teal" onClick={() => setShowGenerate(true)}>{tr('adminInvoices.generateInvoiceBtn')}</button>
      </div>
      <div className="role-pick" style={{ marginBottom: 14, flexWrap: 'wrap' }}>
        {statusFilters(tr).map((f) => <div key={f.key || 'all'} className={`chip${status === f.key ? ' active' : ''}`} onClick={() => setStatus(f.key)}>{f.label}</div>)}
      </div>

      <LoadState state={state} skeleton={4}>
        {(data) => (
          <>
            {data.rows.length === 0 && <div className="empty">{tr('adminInvoices.noneForFilter')}</div>}
            {data.rows.length > 0 && (
              <div className="fin-table-wrap">
                <AdminDataTable rows={data.rows} sort={sort} onSort={toggle} onRowClick={(inv) => setSelectedId(inv.id)} showTotals format={{ subtotalHt: money, vatAmount: money, totalTtc: money }} columns={[
                  { key: 'invoiceNumber', label: tr('adminInvoices.colNumber'), get: (inv) => <b style={{ fontFamily: 'monospace' }}>{inv.invoiceNumber}</b>, sortValue: (inv) => inv.invoiceNumber },
                  { key: 'restaurantName', label: tr('adminCommon.restaurant'), get: (inv) => <RestaurantLink id={inv.restaurantId} name={inv.restaurantName} />, sortValue: (inv) => inv.restaurantName },
                  { key: 'periodStart', label: tr('adminInvoices.colPeriod'), get: (inv) => fmtDate(inv.periodStart), sortValue: (inv) => inv.periodStart },
                  { key: 'status', label: tr('adminCommon.status'), get: (inv) => statusPill(inv.status), sortValue: (inv) => inv.status },
                  { key: 'peppolStatus', label: 'Peppol', get: (inv) => peppolPill(inv.peppolStatus, tr), sortValue: (inv) => inv.peppolStatus },
                  { key: 'subtotalHt', label: tr('adminInvoices.colHt'), get: (inv) => money(inv.subtotalHt), sortValue: (inv) => inv.subtotalHt, align: 'right', sum: true },
                  { key: 'vatAmount', label: tr('adminCommon.vat'), get: (inv) => money(inv.vatAmount), sortValue: (inv) => inv.vatAmount, align: 'right', sum: true },
                  { key: 'totalTtc', label: tr('adminInvoices.colTtc'), get: (inv) => <b>{money(inv.totalTtc)}</b>, sortValue: (inv) => inv.totalTtc, align: 'right', sum: true },
                  { key: 'issuedAt', label: tr('adminInvoices.colIssued'), get: (inv) => fmtDate(inv.issuedAt), sortValue: (inv) => inv.issuedAt }
                ]} />
              </div>
            )}
            <Pagination page={page} total={data.total} pageSize={PAGE_SIZE} onPage={setPage} countLabel={tr('adminInvoices.invoicesCount', { n: data.total })} />
          </>
        )}
      </LoadState>

      {selectedId && <InvoiceDetailModal id={selectedId} onClose={() => setSelectedId(null)} onChanged={load} />}
      {showGenerate && <GenerateInvoiceModal onClose={() => setShowGenerate(false)} onGenerated={() => { setShowGenerate(false); load(); }} />}
    </>
  );
}

// Impayés par ancienneté : factures émises non payées, ventilées par tranche de retard, avec relance
// (e-mail au restaurant) et marquage « payée » confirmés.
const BUCKETS = ['notDue', 'd0_30', 'd31_60', 'd61_90', 'd90plus'];
const bucketLabels = (tr) => ({ notDue: tr('adminInvoices.bucketNotDue'), d0_30: tr('adminInvoices.bucket0_30'), d31_60: tr('adminInvoices.bucket31_60'), d61_90: tr('adminInvoices.bucket61_90'), d90plus: tr('adminInvoices.bucket90plus') });
const BUCKET_TONE = { notDue: '', d0_30: 'b1', d31_60: 'b2', d61_90: 'b3', d90plus: 'b3' };

function AgedTab({ token, toast }) {
  const { t: tr } = useLanguage();
  const state = useApiData(() => api('/admin/invoices/aged', { token }), []);
  const [confirm, setConfirm] = useState(null); // { kind: 'remind'|'paid', inv }
  const [busy, setBusy] = useState(false);
  const { sort, toggle } = useTableSort('daysOverdue');
  const labels = bucketLabels(tr);

  async function run() {
    const { kind, inv } = confirm;
    setBusy(true);
    try {
      if (kind === 'remind') { await api(`/admin/invoices/${inv.id}/reminder`, { method: 'POST', token }); toast(tr('adminInvoices.toastReminderSent')); }
      else { await api(`/admin/invoices/${inv.id}/mark-paid`, { method: 'POST', token, body: {} }); toast(tr('adminInvoices.toastMarkedPaid')); }
      state.reload();
    } catch (e) { toast(e.message); } finally { setBusy(false); setConfirm(null); }
  }

  function exportCsv() {
    const items = state.data?.items || [];
    if (!items.length) { toast(tr('adminCommon.nothingToExport')); return; }
    downloadCsv(`impayes-${Date.now()}.csv`, items, [
      { label: tr('adminInvoices.colNumber'), get: (i) => i.number }, { label: tr('adminCommon.restaurant'), get: (i) => i.restaurantName },
      { label: tr('adminCommon.total'), get: (i) => i.total }, { label: tr('adminInvoices.colDueDate'), get: (i) => fmtDate(i.dueDate) },
      { label: tr('adminInvoices.colDaysOverdue'), get: (i) => i.daysOverdue }, { label: tr('adminInvoices.colReminders'), get: (i) => i.reminderCount }
    ]);
  }

  return (
    <LoadState state={state} skeleton={3}>
      {(d) => {
        const items = d.items || [];
        const totalDue = BUCKETS.reduce((s, b) => s + Number(d.buckets?.[b]?.amount || 0), 0);
        return (
          <>
            <div className="fin-buckets">
              {BUCKETS.map((b) => (
                <div key={b} className={`fin-bucket ${BUCKET_TONE[b]}`}>
                  <div className="num">{money(d.buckets?.[b]?.amount || 0)}</div>
                  <div className="label">{labels[b]} · {d.buckets?.[b]?.count || 0}</div>
                </div>
              ))}
              <div className="fin-bucket" style={{ background: 'rgba(59,47,181,0.12)' }}><div className="num">{money(totalDue)}</div><div className="label">{tr('adminInvoices.totalOutstanding')}</div></div>
            </div>
            <div className="fin-toolbar"><span className="spacer" /><button type="button" className="btn-outline" onClick={exportCsv}>{tr('adminCommon.csv')}</button></div>
            {items.length === 0 && <div className="empty">{tr('adminInvoices.noOutstanding')}</div>}
            {items.length > 0 && (
              <div className="fin-table-wrap">
                <AdminDataTable rows={items} sort={sort} onSort={toggle} showTotals format={{ total: money }} columns={[
                  { key: 'number', label: tr('adminInvoices.colNumber'), get: (i) => <b style={{ fontFamily: 'monospace' }}>{i.number}</b>, sortValue: (i) => i.number },
                  { key: 'restaurantName', label: tr('adminCommon.restaurant'), get: (i) => <RestaurantLink id={i.restaurantId} name={i.restaurantName} />, sortValue: (i) => i.restaurantName },
                  { key: 'dueDate', label: tr('adminInvoices.colDueDate'), get: (i) => fmtDate(i.dueDate), sortValue: (i) => i.dueDate },
                  { key: 'daysOverdue', label: tr('adminInvoices.colDaysOverdue'), get: (i) => <span className={Number(i.daysOverdue) > 30 ? 'fin-neg' : ''}>{Number(i.daysOverdue) > 0 ? i.daysOverdue : '—'}</span>, sortValue: (i) => i.daysOverdue, align: 'right' },
                  { key: 'reminderCount', label: tr('adminInvoices.colReminders'), get: (i) => i.reminderCount || 0, sortValue: (i) => i.reminderCount || 0, align: 'right' },
                  { key: 'total', label: tr('adminInvoices.colTtc'), get: (i) => <b>{money(i.total)}</b>, sortValue: (i) => i.total, align: 'right', sum: true },
                  { key: 'actions', label: '', align: 'right', get: (i) => (
                    <span className="fin-row-actions">
                      <button type="button" className="btn-outline" onClick={(e) => { e.stopPropagation(); setConfirm({ kind: 'remind', inv: i }); }}>{tr('adminInvoices.remind')}</button>
                      <button type="button" className="btn-outline" onClick={(e) => { e.stopPropagation(); setConfirm({ kind: 'paid', inv: i }); }}>{tr('adminInvoices.markPaid')}</button>
                    </span>
                  ) }
                ]} />
              </div>
            )}
            <ConfirmDialog open={confirm?.kind === 'remind'} title={tr('adminInvoices.confirmRemind', { n: confirm?.inv?.number || '' })} message={tr('adminInvoices.confirmRemindBody')} loading={busy} onConfirm={run} onCancel={() => setConfirm(null)} confirmLabel={tr('adminInvoices.remind')} />
            <ConfirmDialog open={confirm?.kind === 'paid'} title={tr('adminInvoices.confirmMarkPaid', { n: confirm?.inv?.number || '' })} message={tr('adminInvoices.confirmMarkPaidBody')} loading={busy} onConfirm={run} onCancel={() => setConfirm(null)} confirmLabel={tr('adminInvoices.markPaid')} />
          </>
        );
      }}
    </LoadState>
  );
}

function GenerateInvoiceModal({ onClose, onGenerated }) {
  const { t: tr } = useLanguage();
  const { token } = useAuth();
  const toast = useToast();
  const [restaurants, setRestaurants] = useState(null);
  const [restaurantId, setRestaurantId] = useState('');
  const [month, setMonth] = useState(() => { const d = new Date(); return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`; });
  const [generating, setGenerating] = useState(false);

  useEffect(() => { api('/admin/restaurants', { token }).then(setRestaurants).catch((e) => toast(e.message)); }, []); // eslint-disable-line react-hooks/exhaustive-deps

  async function generate() {
    if (!restaurantId) { toast(tr('adminCommon.toastChooseRestaurant')); return; }
    setGenerating(true);
    try {
      const inv = await api('/admin/invoices/generate', { method: 'POST', token, body: { restaurantId, month } });
      toast(tr('adminInvoices.toastGenerated', { n: inv.invoiceNumber }));
      onGenerated();
    } catch (e) {
      toast(e.message);
    } finally {
      setGenerating(false);
    }
  }

  return createPortal(
    <div className="modal-overlay drawer-overlay" onClick={onClose}>
      <div className="modal-box drawer-box" onClick={(e) => e.stopPropagation()} style={{ maxWidth: 520 }}>
        <h3 style={{ margin: '0 0 8px' }}>{tr('adminInvoices.generateCommissionInvoice')}</h3>
        <p className="small" style={{ margin: '0 0 12px' }}>{tr('adminInvoices.generateHelp')}</p>
        <div className="field">
          <label>{tr('adminCommon.restaurant')}</label>
          <select value={restaurantId} onChange={(e) => setRestaurantId(e.target.value)}>
            <option value="">{tr('adminCommon.choose')}</option>
            {restaurants && restaurants.map((r) => <option key={r.id} value={r.id}>{r.name}</option>)}
          </select>
        </div>
        <div className="field">
          <label>{tr('adminInvoices.month')}</label>
          <input type="month" value={month} onChange={(e) => setMonth(e.target.value)} />
        </div>
        <div className="row" style={{ gap: 8, marginTop: 8 }}>
          <button className="btn-teal" disabled={generating} onClick={generate}>{generating ? '...' : tr('adminInvoices.generate')}</button>
          <button className="btn-ghost" onClick={onClose}>{tr('adminCommon.cancel')}</button>
        </div>
      </div>
    </div>,
    document.body
  );
}

function InvoiceDetailModal({ id, onClose, onChanged }) {
  const { t: tr } = useLanguage();
  const { token } = useAuth();
  const toast = useToast();
  const [inv, setInv] = useState(null);
  const [busy, setBusy] = useState(false);
  const [confirmAction, setConfirmAction] = useState(null);
  const [creditNoteReason, setCreditNoteReason] = useState('');
  const [showCreditNoteForm, setShowCreditNoteForm] = useState(false);

  function load() {
    api(`/admin/invoices/${id}`, { token }).then(setInv).catch((e) => toast(e.message));
  }
  useEffect(load, [id]); // eslint-disable-line react-hooks/exhaustive-deps

  async function changeStatus(status) {
    setBusy(true);
    try {
      await api(`/admin/invoices/${id}/status`, { method: 'PATCH', token, body: { status } });
      toast(tr('adminCommon.toastStatusUpdated'));
      load(); onChanged();
    } catch (e) {
      toast(e.message);
    } finally {
      setBusy(false);
    }
  }

  async function sendEmail() {
    setBusy(true);
    try {
      await api(`/admin/invoices/${id}/send`, { method: 'POST', token });
      toast(tr('adminInvoices.toastSent'));
      load(); onChanged();
    } catch (e) {
      toast(e.message);
    } finally {
      setBusy(false);
    }
  }

  async function sendPeppol(kind = 'invoices', docId = id) {
    setBusy(true);
    try {
      const r = await api(`/admin/${kind}/${docId}/peppol`, { method: 'POST', token });
      toast(tr('adminInvoices.peppolResult', { status: (peppolLabels(tr)[r.status] || {}).texte || r.status }));
      load(); onChanged();
    } catch (e) {
      toast(e.message);
    } finally {
      setBusy(false);
    }
  }

  async function downloadInvoicePdf() {
    try {
      await downloadPdf(`/admin/invoices/${id}/pdf`, token, `${inv.invoiceNumber}.pdf`);
    } catch (e) {
      toast(e.message);
    }
  }

  async function downloadInvoiceUbl() {
    try {
      await downloadPdf(`/admin/invoices/${id}/ubl`, token, `${inv.invoiceNumber}.xml`);
    } catch (e) {
      toast(e.message);
    }
  }

  async function createCreditNote() {
    if (!creditNoteReason.trim()) { toast(tr('adminCommon.toastReasonRequired')); return; }
    setBusy(true);
    try {
      await api(`/admin/invoices/${id}/credit-note`, { method: 'POST', token, body: { reason: creditNoteReason.trim() } });
      toast(tr('adminInvoices.toastCreditNote'));
      setShowCreditNoteForm(false); setCreditNoteReason('');
      load(); onChanged();
    } catch (e) {
      toast(e.message);
    } finally {
      setBusy(false);
      setConfirmAction(null);
    }
  }

  return createPortal(
    <div className="modal-overlay drawer-overlay" onClick={onClose}>
      <div className="modal-box drawer-box" onClick={(e) => e.stopPropagation()} style={{ maxWidth: 560 }}>
        {!inv && <div className="small">{tr('adminCommon.loading')}</div>}
        {inv && (
          <>
            <div className="row" style={{ justifyContent: 'space-between', alignItems: 'flex-start' }}>
              <h3 style={{ margin: '0 0 8px', fontFamily: 'monospace' }}>{inv.invoiceNumber}</h3>
              <span className="row" style={{ gap: 6 }}>{statusPill(inv.status)}{peppolPill(inv.peppolStatus, tr)}</span>
            </div>
            <p className="small" style={{ margin: '2px 0' }}>{tr('adminInvoices.namePeriodRange', { name: inv.restaurant.name, start: fmtDate(inv.periodStart), end: fmtDate(inv.periodEnd) })} · <RestaurantLink id={inv.restaurant.id} name={tr('adminInvoices.openRestaurant')} /></p>
            <p className="small" style={{ margin: '2px 0' }}>{tr('adminInvoices.issuedOn', { date: fmtDateTime(inv.issuedAt) })}</p>
            {!inv.fairide.configured && (
              <p className="small" style={{ color: 'var(--red)' }}>{tr('adminInvoices.legalNotConfigured')}</p>
            )}
            <div className="divider" />
            <h4 style={{ margin: '0 0 6px' }}>{tr('adminInvoices.ordersN', { n: inv.items.length })}</h4>
            {inv.items.map((o) => (
              <div key={o.id} className="row" style={{ justifyContent: 'space-between', padding: '2px 0' }}>
                <span className="small">{fmtDate(o.createdAt)} · #{o.id.slice(0, 8)}</span>
                <span className="small">{money(o.commission)}</span>
              </div>
            ))}
            <div className="divider" />
            <div className="row" style={{ justifyContent: 'space-between' }}><span className="small">{tr('adminInvoices.totalExVat')}</span><span className="small">{money(inv.subtotalHt)}</span></div>
            <div className="row" style={{ justifyContent: 'space-between' }}><span className="small">{tr('adminInvoices.vatRate', { rate: (inv.vatRate * 100).toFixed(0) })}</span><span className="small">{money(inv.vatAmount)}</span></div>
            <div className="row" style={{ justifyContent: 'space-between' }}><b className="small">{tr('adminInvoices.totalIncVat')}</b><b className="small">{money(inv.totalTtc)}</b></div>

            {inv.entries.length > 0 && (
              <>
                <div className="divider" />
                <h4 style={{ margin: '0 0 6px' }}>{tr('adminInvoices.linkedEntries')}</h4>
                {inv.entries.map((e) => (
                  <div key={e.id} className="row" style={{ justifyContent: 'space-between', padding: '2px 0' }}>
                    <span className="small">{ACCOUNTING_ENTRY_TYPE_LABELS[e.entryType] || e.entryType}</span>
                    <span className="small">{e.debit > 0 ? `-${money(e.debit)}` : money(e.credit)}</span>
                  </div>
                ))}
              </>
            )}

            {inv.creditNotes.length > 0 && (
              <>
                <div className="divider" />
                <h4 style={{ margin: '0 0 6px' }}>{tr('adminInvoices.creditNotes')}</h4>
                {inv.creditNotes.map((cn) => (
                  <div key={cn.id} className="row" style={{ justifyContent: 'space-between', padding: '2px 0' }}>
                    <span className="small" style={{ fontFamily: 'monospace' }}>{cn.creditNoteNumber}</span>
                    <div className="row" style={{ gap: 8 }}>
                      <span className="small" style={{ color: 'var(--red)' }}>-{money(cn.totalTtc)}</span>
                      {peppolPill(cn.peppolStatus, tr)}
                      <button className="btn-ghost" style={{ padding: '2px 8px', fontSize: 11 }} onClick={() => downloadPdf(`/admin/credit-notes/${cn.id}/pdf`, token, `${cn.creditNoteNumber}.pdf`).catch((e) => toast(e.message))}>PDF</button>
                      <button className="btn-ghost" style={{ padding: '2px 8px', fontSize: 11 }} onClick={() => downloadPdf(`/admin/credit-notes/${cn.id}/ubl`, token, `${cn.creditNoteNumber}.xml`).catch((e) => toast(e.message))}>UBL</button>
                      <button className="btn-ghost" style={{ padding: '2px 8px', fontSize: 11 }} disabled={busy} onClick={() => sendPeppol('credit-notes', cn.id)}>Peppol</button>
                    </div>
                  </div>
                ))}
              </>
            )}

            <div className="divider" />
            <h4 style={{ margin: '0 0 6px' }}>{tr('adminCommon.actions')}</h4>
            <div className="row" style={{ gap: 8, marginBottom: 8, flexWrap: 'wrap' }}>
              <button className="btn-outline" onClick={downloadInvoicePdf}>{tr('adminInvoices.pdf')}</button>
              <button className="btn-outline" onClick={downloadInvoiceUbl} title={tr('adminInvoices.ublTitle')}>{tr('adminInvoices.ubl')}</button>
              <button className="btn-outline" disabled={busy} onClick={() => sendPeppol()}>{tr('adminInvoices.sendPeppol')}</button>
              <button className="btn-outline" disabled={busy} onClick={sendEmail}>{tr('adminInvoices.sendByEmail')}</button>
              {inv.status !== 'annulee' && inv.status !== 'payee' && (
                <button className="btn-outline" disabled={busy} onClick={() => changeStatus('payee')}>{tr('adminInvoices.markPaid')}</button>
              )}
              {inv.status !== 'annulee' && inv.status !== 'en_retard' && (
                <button className="btn-outline" disabled={busy} onClick={() => changeStatus('en_retard')}>{tr('adminInvoices.markOverdue')}</button>
              )}
              <CreateTaskButton targetType="invoice" targetId={id} label={inv.invoiceNumber} />
            </div>
            {inv.status !== 'annulee' && (
              !showCreditNoteForm ? (
                <button className="btn-danger-ghost" onClick={() => setShowCreditNoteForm(true)}>{tr('adminInvoices.cancelCreditNote')}</button>
              ) : (
                <div className="row" style={{ gap: 8, flexWrap: 'wrap' }}>
                  <input placeholder={tr('adminInvoices.phCancelReason')} value={creditNoteReason} onChange={(e) => setCreditNoteReason(e.target.value)} style={{ flex: 1, minWidth: 180 }} />
                  <button className="btn-danger-ghost" onClick={() => setConfirmAction(true)}>{tr('adminCommon.confirm')}</button>
                  <button className="btn-ghost" onClick={() => { setShowCreditNoteForm(false); setCreditNoteReason(''); }}>{tr('adminCommon.cancel')}</button>
                </div>
              )
            )}
          </>
        )}
        <button className="btn-ghost" style={{ marginTop: 12 }} onClick={onClose}>{tr('adminCommon.close')}</button>
      </div>
      <ConfirmDialog
        open={!!confirmAction}
        title={tr('adminInvoices.confirmCreditNote')}
        message={tr('adminInvoices.creditNoteBody')}
        danger
        loading={busy}
        onConfirm={createCreditNote}
        onCancel={() => setConfirmAction(null)}
      />
    </div>,
    document.body
  );
}

function DriverStatementsTab({ token, toast }) {
  const { t: tr } = useLanguage();
  const { sort, toggle } = useTableSort('issuedAt');
  const [page, setPage] = useState(0);
  const [data, setData] = useState(null);
  const [showGenerate, setShowGenerate] = useState(false);

  function load() {
    setData(null);
    const params = new URLSearchParams();
    params.set('limit', PAGE_SIZE);
    params.set('offset', page * PAGE_SIZE);
    api(`/admin/driver-statements?${params.toString()}`, { token }).then(setData).catch((e) => toast(e.message));
  }
  useEffect(load, [page]); // eslint-disable-line react-hooks/exhaustive-deps

  async function downloadStatementPdf(st) {
    try {
      await downloadPdf(`/admin/driver-statements/${st.id}/pdf`, token, `${st.statementNumber}.pdf`);
    } catch (e) {
      toast(e.message);
    }
  }

  return (
    <>
      <p className="small" style={{ margin: '0 0 10px', opacity: 0.7 }}>
        {tr('adminInvoices.statementsDisclaimer')}
      </p>
      <div className="row" style={{ justifyContent: 'flex-end', marginBottom: 10 }}>
        <button className="btn-teal" onClick={() => setShowGenerate(true)}>{tr('adminInvoices.generateStatementBtn')}</button>
      </div>
      {!data && <SkeletonCards count={3} />}
      {data && data.rows.length === 0 && <div className="empty">{tr('adminInvoices.noStatements')}</div>}
      {data && data.rows.length > 0 && (
        <AdminDataTable rows={data.rows} sort={sort} onSort={toggle} showTotals format={{ totalAmount: money }} columns={[
          { key: 'statementNumber', label: tr('adminInvoices.colNumber'), get: (st) => <b style={{ fontFamily: 'monospace' }}>{st.statementNumber}</b>, sortValue: (st) => st.statementNumber },
          { key: 'driverName', label: tr('adminCommon.driver'), get: (st) => st.driverName },
          { key: 'periodStart', label: tr('adminInvoices.colPeriod'), get: (st) => fmtDate(st.periodStart), sortValue: (st) => st.periodStart },
          { key: 'deliveriesCount', label: tr('adminCommon.deliveries'), get: (st) => st.deliveriesCount, align: 'right', sum: true },
          { key: 'totalAmount', label: tr('adminCommon.amount'), get: (st) => <b>{money(st.totalAmount)}</b>, sortValue: (st) => st.totalAmount, align: 'right', sum: true },
          { key: 'issuedAt', label: tr('adminInvoices.colIssued'), get: (st) => fmtDate(st.issuedAt), sortValue: (st) => st.issuedAt },
          { key: 'actions', label: '', get: (st) => <button className="btn-outline" style={{ padding: '4px 10px', fontSize: 12 }} onClick={(e) => { e.stopPropagation(); downloadStatementPdf(st); }}>{tr('adminInvoices.pdf')}</button>, align: 'right' }
        ]} />
      )}
      {data && data.total > PAGE_SIZE && (
        <div className="row" style={{ justifyContent: 'center', gap: 12, marginTop: 12 }}>
          <button className="btn-ghost" disabled={page === 0} onClick={() => setPage((p) => p - 1)}>{tr('adminCommon.previous')}</button>
          <span className="small">{tr('adminCommon.pageOf', { page: page + 1, pages: Math.ceil(data.total / PAGE_SIZE) })}</span>
          <button className="btn-ghost" disabled={(page + 1) * PAGE_SIZE >= data.total} onClick={() => setPage((p) => p + 1)}>{tr('adminCommon.next')}</button>
        </div>
      )}
      {showGenerate && <GenerateStatementModal onClose={() => setShowGenerate(false)} onGenerated={() => { setShowGenerate(false); load(); }} />}
    </>
  );
}

function GenerateStatementModal({ onClose, onGenerated }) {
  const { t: tr } = useLanguage();
  const { token } = useAuth();
  const toast = useToast();
  const [drivers, setDrivers] = useState(null);
  const [driverId, setDriverId] = useState('');
  const [month, setMonth] = useState(() => { const d = new Date(); return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`; });
  const [generating, setGenerating] = useState(false);

  useEffect(() => { api('/admin/drivers', { token }).then(setDrivers).catch((e) => toast(e.message)); }, []); // eslint-disable-line react-hooks/exhaustive-deps

  async function generate() {
    if (!driverId) { toast(tr('adminCommon.toastChooseDriver')); return; }
    setGenerating(true);
    try {
      const st = await api('/admin/driver-statements/generate', { method: 'POST', token, body: { driverId, month } });
      toast(tr('adminInvoices.toastStatementGenerated', { n: st.statementNumber }));
      onGenerated();
    } catch (e) {
      toast(e.message);
    } finally {
      setGenerating(false);
    }
  }

  return createPortal(
    <div className="modal-overlay drawer-overlay" onClick={onClose}>
      <div className="modal-box drawer-box" onClick={(e) => e.stopPropagation()} style={{ maxWidth: 520 }}>
        <h3 style={{ margin: '0 0 8px' }}>{tr('adminInvoices.generateDriverStatement')}</h3>
        <div className="field">
          <label>{tr('adminCommon.driver')}</label>
          <select value={driverId} onChange={(e) => setDriverId(e.target.value)}>
            <option value="">{tr('adminCommon.choose')}</option>
            {drivers && drivers.map((d) => <option key={d.id} value={d.id}>{d.name}</option>)}
          </select>
        </div>
        <div className="field">
          <label>{tr('adminInvoices.month')}</label>
          <input type="month" value={month} onChange={(e) => setMonth(e.target.value)} />
        </div>
        <div className="row" style={{ gap: 8, marginTop: 8 }}>
          <button className="btn-teal" disabled={generating} onClick={generate}>{generating ? '...' : tr('adminInvoices.generate')}</button>
          <button className="btn-ghost" onClick={onClose}>{tr('adminCommon.cancel')}</button>
        </div>
      </div>
    </div>,
    document.body
  );
}

const vatStatusLabels = (tr) => ({ franchise: tr('adminInvoices.vatFranchise'), assujetti: tr('adminInvoices.vatSubject') });

function SelfBillingTab({ token, toast }) {
  const { t: tr } = useLanguage();
  const { sort, toggle } = useTableSort('issuedAt');
  const [page, setPage] = useState(0);
  const [data, setData] = useState(null);
  const [showGenerate, setShowGenerate] = useState(false);

  function load() {
    setData(null);
    const params = new URLSearchParams();
    params.set('limit', PAGE_SIZE);
    params.set('offset', page * PAGE_SIZE);
    api(`/admin/self-billing-invoices?${params.toString()}`, { token }).then(setData).catch((e) => toast(e.message));
  }
  useEffect(load, [page]); // eslint-disable-line react-hooks/exhaustive-deps

  async function downloadInvoicePdf(inv) {
    try {
      await downloadPdf(`/admin/self-billing-invoices/${inv.id}/pdf`, token, `${inv.invoiceNumber}.pdf`);
    } catch (e) {
      toast(e.message);
    }
  }
  async function downloadInvoiceUbl(inv) {
    try { await downloadPdf(`/admin/self-billing-invoices/${inv.id}/ubl`, token, `${inv.invoiceNumber}.xml`); } catch (e) { toast(e.message); }
  }
  async function sendPeppol(inv) {
    try {
      const r = await api(`/admin/self-billing-invoices/${inv.id}/peppol`, { method: 'POST', token });
      toast(tr('adminInvoices.peppolResult', { status: (peppolLabels(tr)[r.status] || {}).texte || r.status }));
      load();
    } catch (e) { toast(e.message); }
  }

  async function sendEmail(inv) {
    try {
      await api(`/admin/self-billing-invoices/${inv.id}/send`, { method: 'POST', token });
      toast(tr('adminInvoices.toastSelfBillingSent'));
    } catch (e) {
      toast(e.message);
    }
  }

  return (
    <>
      <p className="small" style={{ margin: '0 0 10px', opacity: 0.7 }}>
        {tr('adminInvoices.selfBillingHelp')}
      </p>
      <div className="row" style={{ justifyContent: 'flex-end', marginBottom: 10 }}>
        <button className="btn-teal" onClick={() => setShowGenerate(true)}>{tr('adminInvoices.generateSelfBillingBtn')}</button>
      </div>
      {!data && <SkeletonCards count={3} />}
      {data && data.rows.length === 0 && <div className="empty">{tr('adminInvoices.noSelfBilling')}</div>}
      {data && data.rows.length > 0 && (
        <AdminDataTable rows={data.rows} sort={sort} onSort={toggle} showTotals format={{ subtotalHt: money, vatAmount: money, totalTtc: money }} columns={[
          { key: 'invoiceNumber', label: tr('adminInvoices.colNumber'), get: (inv) => <b style={{ fontFamily: 'monospace' }}>{inv.invoiceNumber}</b>, sortValue: (inv) => inv.invoiceNumber },
          { key: 'driverName', label: tr('adminCommon.driver'), get: (inv) => inv.driverName },
          { key: 'periodStart', label: tr('adminInvoices.colPeriod'), get: (inv) => fmtDate(inv.periodStart), sortValue: (inv) => inv.periodStart },
          { key: 'vatStatus', label: tr('adminCommon.vat'), get: (inv) => <span className="pill">{vatStatusLabels(tr)[inv.vatStatus] || inv.vatStatus}</span>, sortValue: (inv) => inv.vatStatus },
          { key: 'peppolStatus', label: 'Peppol', get: (inv) => peppolPill(inv.peppolStatus, tr), sortValue: (inv) => inv.peppolStatus },
          { key: 'subtotalHt', label: tr('adminInvoices.colHt'), get: (inv) => money(inv.subtotalHt), sortValue: (inv) => inv.subtotalHt, align: 'right', sum: true },
          { key: 'vatAmount', label: tr('adminCommon.vat'), get: (inv) => (inv.vatStatus === 'assujetti' ? money(inv.vatAmount) : '—'), sortValue: (inv) => inv.vatAmount, align: 'right', sum: true },
          { key: 'totalTtc', label: tr('adminInvoices.colTtc'), get: (inv) => <b>{money(inv.totalTtc)}</b>, sortValue: (inv) => inv.totalTtc, align: 'right', sum: true },
          { key: 'issuedAt', label: tr('adminInvoices.colIssued'), get: (inv) => fmtDate(inv.issuedAt), sortValue: (inv) => inv.issuedAt },
          { key: 'actions', label: '', get: (inv) => <span className="row" style={{ gap: 6, justifyContent: 'flex-end' }}><button className="btn-outline" style={{ padding: '4px 10px', fontSize: 12 }} onClick={(e) => { e.stopPropagation(); downloadInvoicePdf(inv); }}>{tr('adminInvoices.pdf')}</button><button className="btn-outline" style={{ padding: '4px 10px', fontSize: 12 }} onClick={(e) => { e.stopPropagation(); sendEmail(inv); }}>{tr('adminInvoices.send')}</button><button className="btn-outline" style={{ padding: '4px 10px', fontSize: 12 }} onClick={(e) => { e.stopPropagation(); downloadInvoiceUbl(inv); }}>UBL</button><button className="btn-outline" style={{ padding: '4px 10px', fontSize: 12 }} onClick={(e) => { e.stopPropagation(); sendPeppol(inv); }}>Peppol</button></span>, align: 'right' }
        ]} />
      )}
      {data && data.total > PAGE_SIZE && (
        <div className="row" style={{ justifyContent: 'center', gap: 12, marginTop: 12 }}>
          <button className="btn-ghost" disabled={page === 0} onClick={() => setPage((p) => p - 1)}>{tr('adminCommon.previous')}</button>
          <span className="small">{tr('adminCommon.pageOf', { page: page + 1, pages: Math.ceil(data.total / PAGE_SIZE) })}</span>
          <button className="btn-ghost" disabled={(page + 1) * PAGE_SIZE >= data.total} onClick={() => setPage((p) => p + 1)}>{tr('adminCommon.next')}</button>
        </div>
      )}
      {showGenerate && <GenerateSelfBillingModal onClose={() => setShowGenerate(false)} onGenerated={() => { setShowGenerate(false); load(); }} />}
    </>
  );
}

function GenerateSelfBillingModal({ onClose, onGenerated }) {
  const { t: tr } = useLanguage();
  const { token } = useAuth();
  const toast = useToast();
  const [drivers, setDrivers] = useState(null);
  const [driverId, setDriverId] = useState('');
  const [driver, setDriver] = useState(null);
  const [vatStatus, setVatStatus] = useState('');
  const [vatNumber, setVatNumber] = useState('');
  const [confirmAgreement, setConfirmAgreement] = useState(false);
  const [month, setMonth] = useState(() => { const d = new Date(); return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`; });
  const [savingStatus, setSavingStatus] = useState(false);
  const [generating, setGenerating] = useState(false);

  useEffect(() => { api('/admin/drivers', { token }).then(setDrivers).catch((e) => toast(e.message)); }, []); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    if (!driverId) { setDriver(null); return; }
    api(`/admin/drivers/${driverId}`, { token }).then((d) => {
      setDriver(d);
      setVatStatus(d.vatStatus || '');
      setVatNumber(d.vatNumber || '');
    }).catch((e) => toast(e.message));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [driverId]);

  const agreementAlreadyConfirmed = !!driver?.selfBillingAgreedAt;
  const canGenerate = driver && vatStatus && (vatStatus === 'franchise' || vatNumber.trim()) && (agreementAlreadyConfirmed || confirmAgreement);

  async function saveVatStatus() {
    setSavingStatus(true);
    try {
      const updated = await api(`/admin/drivers/${driverId}/vat-status`, {
        method: 'PATCH', token, body: { vatStatus, vatNumber: vatStatus === 'assujetti' ? vatNumber.trim() : null, confirmAgreement }
      });
      setDriver((d) => ({ ...d, ...updated }));
      toast(tr('adminInvoices.toastRegimeSaved'));
    } catch (e) {
      toast(e.message);
    } finally {
      setSavingStatus(false);
    }
  }

  async function generate() {
    setGenerating(true);
    try {
      const inv = await api('/admin/self-billing-invoices/generate', { method: 'POST', token, body: { driverId, month } });
      toast(tr('adminInvoices.toastSelfBillingGenerated', { n: inv.invoiceNumber }));
      onGenerated();
    } catch (e) {
      toast(e.message);
    } finally {
      setGenerating(false);
    }
  }

  return createPortal(
    <div className="modal-overlay drawer-overlay" onClick={onClose}>
      <div className="modal-box drawer-box" onClick={(e) => e.stopPropagation()} style={{ maxWidth: 520 }}>
        <h3 style={{ margin: '0 0 8px' }}>{tr('adminInvoices.generateSelfBilling')}</h3>
        <div className="field">
          <label>{tr('adminCommon.driver')}</label>
          <select value={driverId} onChange={(e) => setDriverId(e.target.value)}>
            <option value="">{tr('adminCommon.choose')}</option>
            {drivers && drivers.map((d) => <option key={d.id} value={d.id}>{d.name}</option>)}
          </select>
        </div>
        {driver && (
          <div className="card" style={{ background: 'var(--cream-dim)', margin: '10px 0', padding: 12 }}>
            <p className="small" style={{ margin: '0 0 8px', fontWeight: 700 }}>{tr('adminInvoices.driverVatRegime')}</p>
            <div className="row" style={{ gap: 12, marginBottom: 8 }}>
              <label className="row" style={{ gap: 4, cursor: 'pointer' }}>
                <input type="radio" style={{ width: 'auto' }} checked={vatStatus === 'franchise'} onChange={() => setVatStatus('franchise')} /> {tr('adminInvoices.vatExempt')}
              </label>
              <label className="row" style={{ gap: 4, cursor: 'pointer' }}>
                <input type="radio" style={{ width: 'auto' }} checked={vatStatus === 'assujetti'} onChange={() => setVatStatus('assujetti')} /> {tr('adminInvoices.vatLiable')}
              </label>
            </div>
            {vatStatus === 'assujetti' && (
              <input placeholder={tr('adminInvoices.phVat')} value={vatNumber} onChange={(e) => setVatNumber(e.target.value)} style={{ marginBottom: 8 }} />
            )}
            {agreementAlreadyConfirmed ? (
              <p className="small" style={{ color: 'var(--teal-deep)', margin: 0 }}>{tr('adminInvoices.agreementConfirmed', { date: fmtDate(driver.selfBillingAgreedAt) })}</p>
            ) : (
              <label className="row" style={{ gap: 6, cursor: 'pointer' }}>
                <input type="checkbox" style={{ width: 'auto' }} checked={confirmAgreement} onChange={(e) => setConfirmAgreement(e.target.checked)} />
                <span className="small">{tr('adminInvoices.confirmAgreement')}</span>
              </label>
            )}
            <button className="btn-outline" style={{ marginTop: 8, padding: '4px 10px', fontSize: 12 }} disabled={savingStatus || !vatStatus} onClick={saveVatStatus}>
              {savingStatus ? '...' : tr('adminInvoices.saveVatRegime')}
            </button>
          </div>
        )}
        <div className="field">
          <label>{tr('adminInvoices.month')}</label>
          <input type="month" value={month} onChange={(e) => setMonth(e.target.value)} />
        </div>
        <div className="row" style={{ gap: 8, marginTop: 8 }}>
          <button className="btn-teal" disabled={generating || !canGenerate} onClick={generate}>{generating ? '...' : tr('adminInvoices.generate')}</button>
          <button className="btn-ghost" onClick={onClose}>{tr('adminCommon.cancel')}</button>
        </div>
        {driver && !canGenerate && (
          <p className="small" style={{ color: 'var(--red)', marginTop: 8 }}>{tr('adminInvoices.saveRegimeFirst')}</p>
        )}
      </div>
    </div>,
    document.body
  );
}
