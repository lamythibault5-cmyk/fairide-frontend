import { useEffect, useState } from 'react';
import { createPortal } from 'react-dom';
import { api } from '../../../api';
import AdminDataTable, { useTableSort } from '../../../components/admin/AdminDataTable';
import RecordDrawer from '../../../components/admin/RecordDrawer';
import { useLanguage } from '../../../context/LanguageContext';
import { money, fmtDate, fmtDateTime, downloadCsv, ACCOUNTING_ENTRY_TYPE_LABELS } from '../adminUtils';
import { useApiData, LoadState, RestaurantLink, DriverLink, OrderLink, SignedMoney, sortAccounts } from './common';

// Grand livre : trois lectures des mêmes écritures — par compte (mouvements et solde progressif),
// par tiers (restaurants / livreurs : ce qui leur est dû, ce qui a été versé, solde) et la balance
// de tous les comptes sur la période.

const MODES = ['accounts', 'restaurant', 'driver', 'balance'];
const ACCOUNT_KIND_ORDER = ['asset', 'liability', 'vat', 'revenue', 'expense'];
const accountKindLabels = (tr) => ({ revenue: tr('adminAccounting.kind_revenue'), expense: tr('adminAccounting.kind_expense'), asset: tr('adminAccounting.kind_asset'), liability: tr('adminAccounting.kind_liability'), vat: tr('adminAccounting.kind_vat') });

export default function LedgerTab(props) {
  const { t: tr } = useLanguage();
  const [mode, setMode] = useState('accounts');
  const labels = { accounts: tr('adminAccounting.byAccount'), restaurant: tr('adminCommon.restaurants'), driver: tr('adminCommon.drivers'), balance: tr('adminAccounting.tab_balance') };
  return (
    <>
      <div className="fin-toolbar">
        <div className="fin-partner-toggle" role="tablist">
          {MODES.map((m) => <button key={m} type="button" role="tab" aria-selected={mode === m} className={mode === m ? 'active' : ''} onClick={() => setMode(m)}>{labels[m]}</button>)}
        </div>
      </div>
      {mode === 'accounts' && <AccountLedger {...props} />}
      {(mode === 'restaurant' || mode === 'driver') && <PartnerLedger {...props} type={mode} />}
      {mode === 'balance' && <TrialBalance {...props} />}
    </>
  );
}

function AccountLedger({ token, toast, periodKey }) {
  const { t: tr } = useLanguage();
  const accounts = useApiData(() => api('/admin/accounting/accounts', { token }), []);
  const [accountCode, setAccountCode] = useState('');
  const sorted = sortAccounts(accounts.data);
  useEffect(() => { if (!accountCode && sorted.length) setAccountCode(sorted[0].code); }, [accounts.data]); // eslint-disable-line react-hooks/exhaustive-deps
  const state = useApiData(() => (accountCode ? api(`/admin/accounting/ledger?accountCode=${encodeURIComponent(accountCode)}&${periodKey}`, { token }) : Promise.resolve(null)), [accountCode, periodKey]);

  function exportCsv() {
    const d = state.data;
    if (!d || !d.rows.length) { toast(tr('adminCommon.nothingToExport')); return; }
    downloadCsv(`grand-livre-${d.account.code}-${Date.now()}.csv`, d.rows, [
      { label: tr('adminCommon.date'), get: (r) => fmtDateTime(r.date) }, { label: tr('adminAccounting.reference'), get: (r) => r.reference },
      { label: tr('adminCommon.type'), get: (r) => ACCOUNTING_ENTRY_TYPE_LABELS[r.entryType] || r.entryType },
      { label: tr('adminAccounting.debit'), get: (r) => r.debit }, { label: tr('adminAccounting.credit'), get: (r) => r.credit }, { label: tr('adminAccounting.runningBalance'), get: (r) => r.runningBalance }
    ]);
  }

  return (
    <>
      <div className="fin-toolbar">
        <select value={accountCode} onChange={(e) => setAccountCode(e.target.value)} style={{ maxWidth: 360 }} aria-label={tr('adminAccounting.account')}>
          {sorted.map((a) => <option key={a.code} value={a.code}>{a.code} · {a.name}</option>)}
        </select>
        <span className="spacer" />
        <button type="button" className="btn-outline" onClick={exportCsv}>{tr('adminCommon.csv')}</button>
      </div>
      {accounts.error && !accounts.data && <LoadState state={accounts}>{() => null}</LoadState>}
      {accountCode && (
        <LoadState state={state} skeleton={3}>
          {(data) => (
            <>
              <div className="stat-grid">
                <div className="stat-card"><div className="num">{money(data.openingBalance)}</div><div className="label">{tr('adminAccounting.openingBalance')}</div></div>
                <div className="stat-card"><div className="num">{money(data.totalDebit)}</div><div className="label">{tr('adminAccounting.totalDebitPeriod')}</div></div>
                <div className="stat-card"><div className="num fin-credit">{money(data.totalCredit)}</div><div className="label">{tr('adminAccounting.totalCreditPeriod')}</div></div>
                <div className="stat-card highlight"><div className="num">{money(data.closingBalance)}</div><div className="label">{tr('adminAccounting.closingBalance')}</div></div>
              </div>
              {data.rows.length === 0 && <div className="empty">{tr('adminAccounting.noEntriesAccount')}</div>}
              {data.rows.length > 0 && (
                <div className="fin-table-wrap"><div className="table-scroll">
                  <table className="admin-table">
                    <thead><tr><th>{tr('adminCommon.date')}</th><th>{tr('adminAccounting.reference')}</th><th>{tr('adminCommon.type')}</th><th className="fin-num">{tr('adminAccounting.debit')}</th><th className="fin-num">{tr('adminAccounting.credit')}</th><th className="fin-num">{tr('adminAccounting.balance')}</th></tr></thead>
                    <tbody>
                      <tr><td colSpan={5} className="small" style={{ opacity: 0.6 }}>{tr('adminAccounting.openingBalance')}</td><td className="fin-num" style={{ fontWeight: 700 }}>{money(data.openingBalance)}</td></tr>
                      {data.rows.map((r) => (
                        <tr key={r.id}>
                          <td className="small">{fmtDateTime(r.date)}</td>
                          <td className="small fin-mono">{r.reference}</td>
                          <td className="small">{ACCOUNTING_ENTRY_TYPE_LABELS[r.entryType] || r.entryType}</td>
                          <td className="fin-num">{r.debit > 0 ? money(r.debit) : ''}</td>
                          <td className="fin-num fin-credit">{r.credit > 0 ? money(r.credit) : ''}</td>
                          <td className="fin-num" style={{ fontWeight: 700 }}>{money(r.runningBalance)}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div></div>
              )}
            </>
          )}
        </LoadState>
      )}
    </>
  );
}

// Grand livre des tiers : restaurants ou livreurs, avec dû / versé / solde. Un clic ouvre le détail.
function PartnerLedger({ token, toast, periodKey, type }) {
  const { t: tr } = useLanguage();
  const [q, setQ] = useState('');
  const [selected, setSelected] = useState(null);
  const { sort, toggle } = useTableSort('balance');
  const state = useApiData(() => api(`/admin/accounting/partners?type=${type}&${periodKey}`, { token }), [type, periodKey]);
  const rows = (Array.isArray(state.data) ? state.data : state.data?.partners || state.data?.items || []).filter((p) => !q.trim() || String(p.name || '').toLowerCase().includes(q.trim().toLowerCase()));

  function exportCsv() {
    if (!rows.length) { toast(tr('adminCommon.nothingToExport')); return; }
    downloadCsv(`tiers-${type}-${Date.now()}.csv`, rows, [
      { label: tr('adminCommon.name'), get: (r) => r.name }, { label: tr('adminAccounting.due'), get: (r) => r.due }, { label: tr('adminAccounting.paid'), get: (r) => r.paid },
      { label: tr('adminAccounting.balance'), get: (r) => r.balance }, { label: tr('adminAccounting.lastMovement'), get: (r) => (r.lastMovement ? fmtDate(r.lastMovement) : '') }
    ]);
  }

  const columns = [
    { key: 'name', label: type === 'restaurant' ? tr('adminCommon.restaurant') : tr('adminCommon.driver'), get: (r) => (type === 'restaurant' ? <RestaurantLink id={r.id} name={r.name} /> : <DriverLink id={r.id} name={r.name} />), sortValue: (r) => r.name },
    { key: 'due', label: tr('adminAccounting.due'), get: (r) => money(r.due), sortValue: (r) => r.due, align: 'right', sum: true },
    { key: 'paid', label: tr('adminAccounting.paid'), get: (r) => <span className="fin-credit">{money(r.paid)}</span>, sortValue: (r) => r.paid, align: 'right', sum: true },
    { key: 'balance', label: tr('adminAccounting.balance'), get: (r) => <SignedMoney value={r.balance} strong />, sortValue: (r) => r.balance, align: 'right', sum: true },
    { key: 'lastMovement', label: tr('adminAccounting.lastMovement'), get: (r) => <span className="small">{r.lastMovement ? fmtDate(r.lastMovement) : '—'}</span>, sortValue: (r) => r.lastMovement || 0 }
  ];

  return (
    <>
      <div className="fin-toolbar">
        <input type="search" placeholder={tr('adminAccounting.phSearchPartner')} value={q} onChange={(e) => setQ(e.target.value)} />
        <span className="spacer" />
        <button type="button" className="btn-outline" onClick={exportCsv}>{tr('adminCommon.csv')}</button>
      </div>
      <LoadState state={state} skeleton={3}>
        {() => (rows.length === 0 ? <div className="empty">{tr('adminAccounting.noPartners')}</div> : (
          <div className="fin-table-wrap">
            <AdminDataTable rows={rows} columns={columns} sort={sort} onSort={toggle} showTotals format={{ due: money, paid: money, balance: money }} onRowClick={setSelected} />
          </div>
        ))}
      </LoadState>
      {selected && <PartnerDrawer partner={selected} type={type} token={token} toast={toast} periodKey={periodKey} onClose={() => setSelected(null)} />}
    </>
  );
}

function PartnerDrawer({ partner, type, token, toast, periodKey, onClose }) {
  const { t: tr } = useLanguage();
  const state = useApiData(() => api(`/admin/accounting/partner-ledger?type=${type}&id=${encodeURIComponent(partner.id)}&${periodKey}`, { token }), [type, partner.id, periodKey]);
  const rows = Array.isArray(state.data) ? state.data : state.data?.movements || state.data?.rows || [];

  function exportCsv() {
    if (!rows.length) { toast(tr('adminCommon.nothingToExport')); return; }
    downloadCsv(`grand-livre-tiers-${partner.id}-${Date.now()}.csv`, rows, [
      { label: tr('adminCommon.date'), get: (r) => fmtDateTime(r.date) }, { label: tr('adminAccounting.reference'), get: (r) => r.reference },
      { label: tr('adminCommon.type'), get: (r) => ACCOUNTING_ENTRY_TYPE_LABELS[r.entryType] || r.entryType },
      { label: tr('adminAccounting.debit'), get: (r) => r.debit }, { label: tr('adminAccounting.credit'), get: (r) => r.credit }, { label: tr('adminAccounting.balance'), get: (r) => r.balance }
    ]);
  }

  return createPortal(
    <RecordDrawer title={partner.name} subtitle={tr('adminAccounting.partnerLedgerSubtitle', { due: money(partner.due), paid: money(partner.paid) })} onClose={onClose} width={720}
      badge={<SignedMoney value={partner.balance} strong />}
      actions={<>{type === 'restaurant' ? <RestaurantLink id={partner.id} name={tr('adminAccounting.openFile')} /> : <DriverLink id={partner.id} name={tr('adminAccounting.openFile')} />}<button type="button" className="btn-ghost" onClick={exportCsv}>{tr('adminCommon.csv')}</button></>}>
      <LoadState state={state} skeleton={2}>
        {() => (rows.length === 0 ? <div className="empty">{tr('adminAccounting.noEntriesAccount')}</div> : (
          <div className="fin-table-wrap"><div className="table-scroll">
            <table className="admin-table">
              <thead><tr><th>{tr('adminCommon.date')}</th><th>{tr('adminAccounting.reference')}</th><th>{tr('adminCommon.type')}</th><th className="fin-num">{tr('adminAccounting.debit')}</th><th className="fin-num">{tr('adminAccounting.credit')}</th><th className="fin-num">{tr('adminAccounting.balance')}</th></tr></thead>
              <tbody>
                {rows.map((r, i) => (
                  <tr key={r.id || i}>
                    <td className="small">{fmtDateTime(r.date)}</td>
                    <td className="small fin-mono">{r.reference}{r.orderId ? <> · <OrderLink id={r.orderId} /></> : null}</td>
                    <td className="small">{ACCOUNTING_ENTRY_TYPE_LABELS[r.entryType] || r.entryType}</td>
                    <td className="fin-num">{r.debit > 0 ? money(r.debit) : ''}</td>
                    <td className="fin-num fin-credit">{r.credit > 0 ? money(r.credit) : ''}</td>
                    <td className="fin-num" style={{ fontWeight: 700 }}>{money(r.balance)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div></div>
        ))}
      </LoadState>
    </RecordDrawer>,
    document.body
  );
}

function TrialBalance({ token, toast, periodKey }) {
  const { t: tr } = useLanguage();
  const state = useApiData(() => api(`/admin/accounting/balance?${periodKey}`, { token }), [periodKey]);
  const kinds = accountKindLabels(tr);

  function exportCsv() {
    const d = state.data;
    if (!d || !d.rows.length) { toast(tr('adminCommon.nothingToExport')); return; }
    downloadCsv(`balance-comptes-${Date.now()}.csv`, d.rows, [
      { label: tr('adminCommon.code'), get: (r) => r.code }, { label: tr('adminCommon.name'), get: (r) => r.name }, { label: tr('adminCommon.type'), get: (r) => kinds[r.kind] },
      { label: tr('adminAccounting.debit'), get: (r) => r.debit }, { label: tr('adminAccounting.credit'), get: (r) => r.credit }, { label: tr('adminAccounting.balance'), get: (r) => r.balance }
    ]);
  }

  return (
    <LoadState state={state} skeleton={3}>
      {(data) => {
        const sortedRows = [...data.rows].sort((a, b) => ACCOUNT_KIND_ORDER.indexOf(a.kind) - ACCOUNT_KIND_ORDER.indexOf(b.kind) || a.code.localeCompare(b.code));
        return (
          <>
            <div className="card" style={{ borderLeft: `3px solid ${data.balanced ? 'var(--teal-deep)' : 'var(--red)'}` }}>
              <div className="row" style={{ justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: 8 }}>
                <b>{data.balanced ? tr('adminAccounting.journalBalanced') : tr('adminAccounting.journalUnbalanced')}</b>
                <span className="small">{tr('adminAccounting.totalsLine', { debit: money(data.totalDebit), credit: money(data.totalCredit) })}</span>
              </div>
              {!data.balanced && <p className="small" style={{ margin: '6px 0 0', color: 'var(--red)' }}>{tr('adminAccounting.gapLine', { amount: money(Math.abs(data.totalDebit - data.totalCredit)) })}</p>}
            </div>
            <div className="fin-toolbar"><span className="spacer" /><button type="button" className="btn-outline" onClick={exportCsv}>{tr('adminCommon.csv')}</button></div>
            <div className="fin-table-wrap"><div className="table-scroll">
              <table className="admin-table">
                <thead><tr><th>{tr('adminCommon.code')}</th><th>{tr('adminCommon.name')}</th><th>{tr('adminCommon.type')}</th><th className="fin-num">{tr('adminAccounting.debit')}</th><th className="fin-num">{tr('adminAccounting.credit')}</th><th className="fin-num">{tr('adminAccounting.balance')}</th></tr></thead>
                <tbody>
                  {sortedRows.map((r) => (
                    <tr key={r.code} style={{ opacity: r.active ? 1 : 0.5 }}>
                      <td className="small fin-mono">{r.code}</td>
                      <td className="small">{r.name}{!r.active ? tr('adminAccounting.disabledSuffix') : ''}</td>
                      <td className="small">{kinds[r.kind]}</td>
                      <td className="fin-num">{r.debit > 0 ? money(r.debit) : ''}</td>
                      <td className="fin-num fin-credit">{r.credit > 0 ? money(r.credit) : ''}</td>
                      <td className="fin-num" style={{ fontWeight: 700 }}>{money(r.balance)}</td>
                    </tr>
                  ))}
                </tbody>
                <tfoot><tr style={{ fontWeight: 700 }}><td colSpan={3}>{tr('adminCommon.total')}</td><td className="fin-num">{money(data.totalDebit)}</td><td className="fin-num fin-credit">{money(data.totalCredit)}</td><td /></tr></tfoot>
              </table>
            </div></div>
          </>
        );
      }}
    </LoadState>
  );
}
