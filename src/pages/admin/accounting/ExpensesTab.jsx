import { useEffect, useState } from 'react';
import { createPortal } from 'react-dom';
import { api } from '../../../api';
import AdminDataTable, { useTableSort } from '../../../components/admin/AdminDataTable';
import RecordDrawer from '../../../components/admin/RecordDrawer';
import ConfirmDialog from '../../../components/ConfirmDialog';
import { useLanguage } from '../../../context/LanguageContext';
import { money, fmtDate, downloadCsv } from '../adminUtils';
import { useApiData, LoadState, ErrorState, Pagination, todayIso, toNumber, sortAccounts, StatusPill } from './common';

// Achats & frais : les dépenses de Fairide (abonnements logiciels, frais bancaires, matériel…), du
// brouillon à la comptabilisation puis au paiement. Comptabiliser génère l'écriture (charge + TVA
// déductible / fournisseur), marquer payée génère le règlement (fournisseur / banque).

const PAGE_SIZE = 50;
export const EXPENSE_STATUSES = ['draft', 'posted', 'paid'];
const VAT_RATES = [0, 6, 12, 21];
const CATEGORIES = ['software', 'bank', 'marketing', 'hardware', 'legal', 'travel', 'office', 'other'];
const PAYMENT_METHODS = ['bank', 'card', 'stripe', 'cash', 'other'];

export const expenseStatusLabels = (tr) => ({ draft: tr('adminAccounting.exp_draft'), posted: tr('adminAccounting.exp_posted'), paid: tr('adminAccounting.exp_paid') });
const categoryLabels = (tr) => ({ software: tr('adminAccounting.cat_software'), bank: tr('adminAccounting.cat_bank'), marketing: tr('adminAccounting.cat_marketing'), hardware: tr('adminAccounting.cat_hardware'), legal: tr('adminAccounting.cat_legal'), travel: tr('adminAccounting.cat_travel'), office: tr('adminAccounting.cat_office'), other: tr('adminAccounting.cat_other') });
const paymentLabels = (tr) => ({ bank: tr('adminAccounting.pay_bank'), card: tr('adminAccounting.pay_card'), stripe: tr('adminAccounting.pay_stripe'), cash: tr('adminAccounting.pay_cash'), other: tr('adminAccounting.pay_other') });

export default function ExpensesTab({ token, toast, periodKey, searchParams, go }) {
  const { t: tr } = useLanguage();
  const [status, setStatus] = useState(searchParams.get('status') || '');
  const [q, setQ] = useState('');
  const [page, setPage] = useState(0);
  const [editing, setEditing] = useState(searchParams.get('new') === '1' ? {} : null); // {} = nouvelle
  const [confirm, setConfirm] = useState(null); // { kind, expense }
  const [busy, setBusy] = useState(false);
  const { sort, toggle } = useTableSort('expenseDate');
  const statusLabels = expenseStatusLabels(tr);
  const cats = categoryLabels(tr);

  useEffect(() => { setPage(0); }, [status, q, periodKey]);

  const state = useApiData(() => {
    const params = new URLSearchParams(periodKey);
    params.set('limit', PAGE_SIZE); params.set('offset', page * PAGE_SIZE);
    if (status) params.set('status', status);
    if (q.trim()) params.set('q', q.trim());
    return api(`/admin/accounting/expenses?${params.toString()}`, { token });
  }, [periodKey, status, q, page]);

  function closeForm() { setEditing(null); if (searchParams.get('new')) go('expenses'); }

  async function run(kind, expense) {
    setBusy(true);
    try {
      if (kind === 'post') await api(`/admin/accounting/expenses/${expense.id}/post`, { method: 'POST', token });
      if (kind === 'pay') await api(`/admin/accounting/expenses/${expense.id}/pay`, { method: 'POST', token, body: { paidAt: todayIso() } });
      if (kind === 'delete') await api(`/admin/accounting/expenses/${expense.id}`, { method: 'DELETE', token });
      toast(kind === 'post' ? tr('adminAccounting.toastExpensePosted') : kind === 'pay' ? tr('adminAccounting.toastExpensePaid') : tr('adminAccounting.toastExpenseDeleted'));
      state.reload();
    } catch (e) { toast(e.message); } finally { setBusy(false); setConfirm(null); }
  }

  function exportCsv() {
    const items = state.data?.items || [];
    if (!items.length) { toast(tr('adminCommon.nothingToExport')); return; }
    downloadCsv(`achats-frais-${Date.now()}.csv`, items, [
      { label: tr('adminCommon.date'), get: (r) => fmtDate(r.expenseDate) }, { label: tr('adminAccounting.supplier'), get: (r) => r.supplier },
      { label: tr('adminAccounting.description'), get: (r) => r.description }, { label: tr('adminCommon.category'), get: (r) => cats[r.category] || r.category },
      { label: tr('adminAccounting.account'), get: (r) => r.accountCode }, { label: tr('adminInvoices.colHt'), get: (r) => r.amountExclVat },
      { label: tr('adminAccounting.vatRate'), get: (r) => r.vatRate }, { label: tr('adminCommon.vat'), get: (r) => r.vatAmount }, { label: tr('adminInvoices.colTtc'), get: (r) => r.amountInclVat },
      { label: tr('adminCommon.status'), get: (r) => statusLabels[r.status] || r.status }, { label: tr('adminAccounting.paidOn'), get: (r) => (r.paidAt ? fmtDate(r.paidAt) : '') }
    ]);
  }

  const columns = [
    { key: 'expenseDate', label: tr('adminCommon.date'), get: (r) => <span className="small">{fmtDate(r.expenseDate)}</span>, sortValue: (r) => r.expenseDate },
    { key: 'supplier', label: tr('adminAccounting.supplier'), get: (r) => <b>{r.supplier || '-'}</b>, sortValue: (r) => r.supplier || '' },
    { key: 'description', label: tr('adminAccounting.description'), get: (r) => <span className="small">{r.description || '-'}</span> },
    { key: 'category', label: tr('adminCommon.category'), get: (r) => <span className="small">{cats[r.category] || r.category || '-'}</span>, sortValue: (r) => r.category || '' },
    { key: 'amountExclVat', label: tr('adminInvoices.colHt'), get: (r) => money(r.amountExclVat), sortValue: (r) => r.amountExclVat, align: 'right', sum: true },
    { key: 'vatAmount', label: tr('adminCommon.vat'), get: (r) => <span className="small">{money(r.vatAmount)} ({Number(r.vatRate || 0)}%)</span>, sortValue: (r) => r.vatAmount, align: 'right', sum: true },
    { key: 'amountInclVat', label: tr('adminInvoices.colTtc'), get: (r) => <b>{money(r.amountInclVat)}</b>, sortValue: (r) => r.amountInclVat, align: 'right', sum: true },
    { key: 'status', label: tr('adminCommon.status'), get: (r) => <StatusPill status={r.status} labels={statusLabels} />, sortValue: (r) => r.status },
    { key: 'actions', label: '', align: 'right', get: (r) => (
      <span className="fin-row-actions">
        {r.status === 'draft' && <button type="button" className="btn-outline" onClick={(e) => { e.stopPropagation(); setConfirm({ kind: 'post', expense: r }); }}>{tr('adminAccounting.postExpense')}</button>}
        {r.status === 'posted' && <button type="button" className="btn-outline" onClick={(e) => { e.stopPropagation(); setConfirm({ kind: 'pay', expense: r }); }}>{tr('adminAccounting.markPaidExpense')}</button>}
        {r.status !== 'paid' && <button type="button" className="btn-danger-ghost" onClick={(e) => { e.stopPropagation(); setConfirm({ kind: 'delete', expense: r }); }}>{tr('adminCommon.delete')}</button>}
      </span>
    ) }
  ];

  return (
    <>
      <div className="fin-toolbar">
        <input type="search" placeholder={tr('adminAccounting.phSearchExpense')} value={q} onChange={(e) => setQ(e.target.value)} />
        <div className="role-pick">
          {[{ key: '', label: tr('adminCommon.allF') }, ...EXPENSE_STATUSES.map((s) => ({ key: s, label: statusLabels[s] }))].map((f) => (
            <div key={f.key || 'all'} className={`chip${status === f.key ? ' active' : ''}`} onClick={() => setStatus(f.key)}>{f.label}</div>
          ))}
        </div>
        <span className="spacer" />
        <button type="button" className="btn-outline" onClick={exportCsv}>{tr('adminCommon.csv')}</button>
        <button type="button" className="btn-teal" onClick={() => setEditing({})}>{tr('adminAccounting.newExpense')}</button>
      </div>
      <LoadState state={state} skeleton={3}>
        {(data) => (
          <>
            {data.totals && (
              <div className="stat-grid">
                <div className="stat-card"><div className="num">{money(data.totals.excl)}</div><div className="label">{tr('adminAccounting.totalExcl')}</div></div>
                <div className="stat-card"><div className="num">{money(data.totals.vat)}</div><div className="label">{tr('adminAccounting.totalVatDeductible')}</div></div>
                <div className="stat-card highlight"><div className="num">{money(data.totals.incl)}</div><div className="label">{tr('adminAccounting.totalIncl')}</div></div>
                <div className="stat-card"><div className="num">{data.total}</div><div className="label">{tr('adminAccounting.expensesCount')}</div></div>
              </div>
            )}
            {(data.items || []).length === 0 && <div className="empty">{tr('adminAccounting.noExpenses')}</div>}
            {(data.items || []).length > 0 && (
              <div className="fin-table-wrap">
                <AdminDataTable rows={data.items} columns={columns} sort={sort} onSort={toggle} showTotals format={{ amountExclVat: money, vatAmount: money, amountInclVat: money }} onRowClick={(r) => setEditing(r)} />
              </div>
            )}
            <Pagination page={page} total={data.total} pageSize={PAGE_SIZE} onPage={setPage} />
          </>
        )}
      </LoadState>
      {editing && <ExpenseForm expense={editing} token={token} toast={toast} onClose={closeForm} onSaved={() => { closeForm(); state.reload(); }} />}
      <ConfirmDialog open={confirm?.kind === 'post'} title={tr('adminAccounting.confirmPostExpense')} message={tr('adminAccounting.confirmPostExpenseBody')} loading={busy} onConfirm={() => run('post', confirm.expense)} onCancel={() => setConfirm(null)} confirmLabel={tr('adminAccounting.postExpense')} />
      <ConfirmDialog open={confirm?.kind === 'pay'} title={tr('adminAccounting.confirmPayExpense')} message={tr('adminAccounting.confirmPayExpenseBody')} loading={busy} onConfirm={() => run('pay', confirm.expense)} onCancel={() => setConfirm(null)} confirmLabel={tr('adminAccounting.markPaidExpense')} />
      <ConfirmDialog open={confirm?.kind === 'delete'} title={tr('adminAccounting.confirmDeleteExpense')} message={tr('adminCommon.irreversible')} danger loading={busy} onConfirm={() => run('delete', confirm.expense)} onCancel={() => setConfirm(null)} confirmLabel={tr('adminCommon.delete')} />
    </>
  );
}

// Formulaire de dépense : HT + taux de TVA → TVA et TTC calculés en direct. Une dépense déjà
// comptabilisée ne change plus de montants (l'écriture existe) : seuls notes et pièce jointe restent
// modifiables.
function ExpenseForm({ expense, token, toast, onClose, onSaved }) {
  const { t: tr } = useLanguage();
  const isNew = !expense.id;
  const locked = !isNew && expense.status !== 'draft';
  const accounts = useApiData(() => api('/admin/accounting/accounts', { token }), []);
  const [f, setF] = useState({
    expenseDate: expense.expenseDate ? String(expense.expenseDate).slice(0, 10) : todayIso(),
    supplier: expense.supplier || '', description: expense.description || '', category: expense.category || 'other',
    accountCode: expense.accountCode || '', amountExclVat: expense.amountExclVat ?? '', vatRate: expense.vatRate ?? 21,
    paymentMethod: expense.paymentMethod || 'bank', attachmentUrl: expense.attachmentUrl || '', notes: expense.notes || ''
  });
  const [busy, setBusy] = useState(false);
  const cats = categoryLabels(tr); const pays = paymentLabels(tr);

  const excl = toNumber(f.amountExclVat);
  const vat = +(excl * toNumber(f.vatRate) / 100).toFixed(2);
  const incl = +(excl + vat).toFixed(2);
  const set = (k) => (e) => setF((s) => ({ ...s, [k]: e.target.value }));
  const canSave = f.supplier.trim() && f.expenseDate && (locked || excl > 0) && !busy;

  // Par défaut, un compte de charge (6xx) ; le premier de la liste si aucun choisi.
  const expenseAccounts = sortAccounts(accounts.data).filter((a) => a.kind === 'expense');
  useEffect(() => { if (!f.accountCode && expenseAccounts.length) setF((s) => ({ ...s, accountCode: expenseAccounts[0].code })); }, [accounts.data]); // eslint-disable-line react-hooks/exhaustive-deps

  async function save() {
    if (!canSave) return;
    setBusy(true);
    try {
      const body = locked
        ? { notes: f.notes, attachmentUrl: f.attachmentUrl || null }
        : { expenseDate: f.expenseDate, supplier: f.supplier.trim(), description: f.description.trim(), category: f.category, accountCode: f.accountCode || undefined, amountExclVat: excl, vatRate: toNumber(f.vatRate), vatAmount: vat, amountInclVat: incl, paymentMethod: f.paymentMethod, attachmentUrl: f.attachmentUrl || null, notes: f.notes };
      if (isNew) await api('/admin/accounting/expenses', { method: 'POST', token, body });
      else await api(`/admin/accounting/expenses/${expense.id}`, { method: 'PATCH', token, body });
      toast(isNew ? tr('adminAccounting.toastExpenseCreated') : tr('adminAccounting.toastExpenseSaved'));
      onSaved();
    } catch (e) { toast(e.message); } finally { setBusy(false); }
  }

  return createPortal(
    <RecordDrawer title={isNew ? tr('adminAccounting.newExpenseTitle') : (expense.supplier || tr('adminAccounting.tab_expenses'))} subtitle={isNew ? tr('adminAccounting.newExpenseHelp') : `${fmtDate(expense.expenseDate)} · ${expenseStatusLabels(tr)[expense.status] || expense.status}`} onClose={onClose}
      footer={<><button type="button" className="btn-teal" disabled={!canSave} onClick={save}>{busy ? '...' : tr('adminCommon.save')}</button><button type="button" className="btn-ghost" onClick={onClose}>{tr('adminCommon.cancel')}</button></>}>
      {accounts.error && !accounts.data && <ErrorState error={accounts.error} onRetry={accounts.reload} />}
      {locked && <p className="small" style={{ margin: '0 0 10px', color: 'var(--gold-deep)' }}>{tr('adminAccounting.expenseLocked')}</p>}
      <div className="fin-form-grid">
        <div className="field"><label>{tr('adminCommon.date')}</label><input type="date" value={f.expenseDate} onChange={set('expenseDate')} disabled={locked} /></div>
        <div className="field"><label>{tr('adminAccounting.supplier')}</label><input value={f.supplier} onChange={set('supplier')} placeholder={tr('adminAccounting.phSupplier')} disabled={locked} /></div>
        <div className="field wide"><label>{tr('adminAccounting.description')}</label><input value={f.description} onChange={set('description')} placeholder={tr('adminAccounting.phDescription')} disabled={locked} /></div>
        <div className="field"><label>{tr('adminCommon.category')}</label>
          <select value={f.category} onChange={set('category')} disabled={locked}>{CATEGORIES.map((c) => <option key={c} value={c}>{cats[c]}</option>)}</select>
        </div>
        <div className="field"><label>{tr('adminAccounting.account')}</label>
          <select value={f.accountCode} onChange={set('accountCode')} disabled={locked}>
            <option value="">{tr('adminCommon.choose')}</option>
            {(expenseAccounts.length ? expenseAccounts : sortAccounts(accounts.data)).map((a) => <option key={a.code} value={a.code}>{a.code} · {a.name}</option>)}
          </select>
        </div>
        <div className="field"><label>{tr('adminAccounting.amountExcl')}</label><input type="number" min="0" step="0.01" inputMode="decimal" value={f.amountExclVat} onChange={set('amountExclVat')} disabled={locked} /></div>
        <div className="field"><label>{tr('adminAccounting.vatRate')}</label>
          <select value={f.vatRate} onChange={set('vatRate')} disabled={locked}>{VAT_RATES.map((r) => <option key={r} value={r}>{r}%</option>)}</select>
        </div>
        <div className="field"><label>{tr('adminAccounting.paymentMethod')}</label>
          <select value={f.paymentMethod} onChange={set('paymentMethod')} disabled={locked}>{PAYMENT_METHODS.map((p) => <option key={p} value={p}>{pays[p]}</option>)}</select>
        </div>
        <div className="field"><label>{tr('adminAccounting.attachment')}</label><input value={f.attachmentUrl} onChange={set('attachmentUrl')} placeholder="https://" /></div>
        <div className="field wide"><label>{tr('adminCommon.notes')}</label><textarea rows={2} value={f.notes} onChange={set('notes')} style={{ width: '100%' }} /></div>
      </div>
      <div className="fin-totals">
        <span>{tr('adminInvoices.colHt')} <b>{money(excl)}</b></span>
        <span>{tr('adminCommon.vat')} ({toNumber(f.vatRate)}%) <b>{money(vat)}</b></span>
        <span>{tr('adminInvoices.colTtc')} <b>{money(incl)}</b></span>
      </div>
    </RecordDrawer>,
    document.body
  );
}
