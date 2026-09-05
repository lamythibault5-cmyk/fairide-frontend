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
import { money, fmtDate, fmtDateTime, useDebouncedValue, downloadPdf, INVOICE_STATUS_LABELS, ACCOUNTING_ENTRY_TYPE_LABELS } from './adminUtils';
import { useLanguage } from '../../context/LanguageContext';

const TABS = ['Factures', 'Relevés livreurs', 'Autofacturation'];
const tabLabels = (tr) => ({ "Factures": tr('adminInvoices.tab_invoices'), "Relevés livreurs": tr('adminInvoices.tab_driverStatements'), "Autofacturation": tr('adminInvoices.tab_selfBilling') });
const PAGE_SIZE = 25;
const statusFilters = (tr) => [{ key: '', label: tr('adminInvoices.all') }, ...Object.entries(INVOICE_STATUS_LABELS).map(([key, v]) => ({ key, label: v.label }))];

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
  const [page, setPage] = useState(0);
  const [data, setData] = useState(null);
  const [selectedId, setSelectedId] = useState(null);
  const [showGenerate, setShowGenerate] = useState(false);
  const { sort, toggle } = useTableSort('issuedAt');

  function load() {
    setData(null);
    const params = new URLSearchParams();
    if (q) params.set('q', q);
    if (status) params.set('status', status);
    if (presetRestaurantId) params.set('restaurantId', presetRestaurantId);
    params.set('limit', PAGE_SIZE);
    params.set('offset', page * PAGE_SIZE);
    api(`/admin/invoices?${params.toString()}`, { token }).then(setData).catch((e) => toast(e.message));
  }

  useEffect(load, [q, status, page, presetRestaurantId]); // eslint-disable-line react-hooks/exhaustive-deps
  useEffect(() => { setPage(0); }, [q, status]);

  return (
    <>
      <div className="row" style={{ gap: 8, marginBottom: 10, flexWrap: 'wrap' }}>
        <input placeholder={tr('adminInvoices.phSearch')} value={qInput} onChange={(e) => setQInput(e.target.value)} style={{ flex: 1, minWidth: 200 }} />
        <button className="btn-teal" onClick={() => setShowGenerate(true)}>{tr('adminInvoices.generateInvoiceBtn')}</button>
      </div>
      <div className="role-pick" style={{ marginBottom: 14, flexWrap: 'wrap' }}>
        {statusFilters(tr).map((f) => <div key={f.key || 'all'} className={`chip${status === f.key ? ' active' : ''}`} onClick={() => setStatus(f.key)}>{f.label}</div>)}
      </div>

      {!data && <SkeletonCards count={4} />}
      {data && data.rows.length === 0 && <div className="empty">{tr('adminInvoices.noneForFilter')}</div>}
      {data && data.rows.length > 0 && (
        <AdminDataTable rows={data.rows} sort={sort} onSort={toggle} onRowClick={(inv) => setSelectedId(inv.id)} showTotals format={{ subtotalHt: money, vatAmount: money, totalTtc: money }} columns={[
          { key: 'invoiceNumber', label: tr('adminInvoices.colNumber'), get: (inv) => <b style={{ fontFamily: 'monospace' }}>{inv.invoiceNumber}</b>, sortValue: (inv) => inv.invoiceNumber },
          { key: 'restaurantName', label: tr('adminCommon.restaurant'), get: (inv) => inv.restaurantName },
          { key: 'periodStart', label: tr('adminInvoices.colPeriod'), get: (inv) => fmtDate(inv.periodStart), sortValue: (inv) => inv.periodStart },
          { key: 'status', label: tr('adminCommon.status'), get: (inv) => statusPill(inv.status), sortValue: (inv) => inv.status },
          { key: 'subtotalHt', label: tr('adminInvoices.colHt'), get: (inv) => money(inv.subtotalHt), sortValue: (inv) => inv.subtotalHt, align: 'right', sum: true },
          { key: 'vatAmount', label: tr('adminCommon.vat'), get: (inv) => money(inv.vatAmount), sortValue: (inv) => inv.vatAmount, align: 'right', sum: true },
          { key: 'totalTtc', label: tr('adminInvoices.colTtc'), get: (inv) => <b>{money(inv.totalTtc)}</b>, sortValue: (inv) => inv.totalTtc, align: 'right', sum: true },
          { key: 'issuedAt', label: tr('adminInvoices.colIssued'), get: (inv) => fmtDate(inv.issuedAt), sortValue: (inv) => inv.issuedAt }
        ]} />
      )}
      {data && data.total > PAGE_SIZE && (
        <div className="row" style={{ justifyContent: 'center', gap: 12, marginTop: 12 }}>
          <button className="btn-ghost" disabled={page === 0} onClick={() => setPage((p) => p - 1)}>{tr('adminCommon.previous')}</button>
          <span className="small">{tr('adminCommon.pageOf', { page: page + 1, pages: Math.ceil(data.total / PAGE_SIZE) })} {tr('adminInvoices.invoicesCount', { n: data.total })}</span>
          <button className="btn-ghost" disabled={(page + 1) * PAGE_SIZE >= data.total} onClick={() => setPage((p) => p + 1)}>{tr('adminCommon.next')}</button>
        </div>
      )}

      {selectedId && <InvoiceDetailModal id={selectedId} onClose={() => setSelectedId(null)} onChanged={load} />}
      {showGenerate && <GenerateInvoiceModal onClose={() => setShowGenerate(false)} onGenerated={() => { setShowGenerate(false); load(); }} />}
    </>
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
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal-box" onClick={(e) => e.stopPropagation()} style={{ maxWidth: 420 }}>
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
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal-box" onClick={(e) => e.stopPropagation()} style={{ maxWidth: 560 }}>
        {!inv && <div className="small">{tr('adminCommon.loading')}</div>}
        {inv && (
          <>
            <div className="row" style={{ justifyContent: 'space-between', alignItems: 'flex-start' }}>
              <h3 style={{ margin: '0 0 8px', fontFamily: 'monospace' }}>{inv.invoiceNumber}</h3>
              {statusPill(inv.status)}
            </div>
            <p className="small" style={{ margin: '2px 0' }}>{tr('adminInvoices.namePeriodRange', { name: inv.restaurant.name, start: fmtDate(inv.periodStart), end: fmtDate(inv.periodEnd) })}</p>
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
                      <button className="btn-ghost" style={{ padding: '2px 8px', fontSize: 11 }} onClick={() => downloadPdf(`/admin/credit-notes/${cn.id}/pdf`, token, `${cn.creditNoteNumber}.pdf`).catch((e) => toast(e.message))}>PDF</button>
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
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal-box" onClick={(e) => e.stopPropagation()} style={{ maxWidth: 420 }}>
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
          { key: 'subtotalHt', label: tr('adminInvoices.colHt'), get: (inv) => money(inv.subtotalHt), sortValue: (inv) => inv.subtotalHt, align: 'right', sum: true },
          { key: 'vatAmount', label: tr('adminCommon.vat'), get: (inv) => (inv.vatStatus === 'assujetti' ? money(inv.vatAmount) : '—'), sortValue: (inv) => inv.vatAmount, align: 'right', sum: true },
          { key: 'totalTtc', label: tr('adminInvoices.colTtc'), get: (inv) => <b>{money(inv.totalTtc)}</b>, sortValue: (inv) => inv.totalTtc, align: 'right', sum: true },
          { key: 'issuedAt', label: tr('adminInvoices.colIssued'), get: (inv) => fmtDate(inv.issuedAt), sortValue: (inv) => inv.issuedAt },
          { key: 'actions', label: '', get: (inv) => <span className="row" style={{ gap: 6, justifyContent: 'flex-end' }}><button className="btn-outline" style={{ padding: '4px 10px', fontSize: 12 }} onClick={(e) => { e.stopPropagation(); downloadInvoicePdf(inv); }}>{tr('adminInvoices.pdf')}</button><button className="btn-outline" style={{ padding: '4px 10px', fontSize: 12 }} onClick={(e) => { e.stopPropagation(); sendEmail(inv); }}>{tr('adminInvoices.send')}</button></span>, align: 'right' }
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
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal-box" onClick={(e) => e.stopPropagation()} style={{ maxWidth: 460 }}>
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
