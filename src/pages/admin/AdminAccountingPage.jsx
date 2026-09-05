import { useEffect, useState } from 'react';
import { api } from '../../api';
import { useAuth } from '../../context/AuthContext';
import { useToast } from '../../context/ToastContext';
import { SkeletonCards } from '../../components/Skeleton';
import { money, pct, fmtDate, fmtDateTime, downloadCsv, ACCOUNTING_ENTRY_TYPE_LABELS } from './adminUtils';
import { useLanguage } from '../../context/LanguageContext';

const TABS = ['Vue d\'ensemble', 'Journal', 'Grand livre', 'Balance', 'TVA', 'Rapprochement', 'Plan comptable'];
const tabLabels = (tr) => ({ "Vue d'ensemble": tr('adminAccounting.tab_overview'), "Journal": tr('adminAccounting.tab_journal'), "Grand livre": tr('adminAccounting.tab_ledger'), "Balance": tr('adminAccounting.tab_balance'), "TVA": tr('adminAccounting.tab_vat'), "Rapprochement": tr('adminAccounting.tab_reconciliation'), "Plan comptable": tr('adminAccounting.tab_chart') });
const periodTypes = (tr) => [
  { key: 'month', label: tr('adminCommon.month') },
  { key: 'quarter', label: tr('adminCommon.quarter') },
  { key: 'year', label: tr('adminCommon.year') },
  { key: 'custom', label: tr('adminCommon.custom') }
];
const PAGE_SIZE = 50;

function currentMonthValue() {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
}

// Un seul point de construction des paramètres de période, partagé par les 4 sous-onglets qui
// interrogent tous /admin/accounting/* avec la même fenêtre temporelle (voir resolveAccountingPeriod
// côté backend, routes/admin.js).
function usePeriodParams() {
  const [periodType, setPeriodType] = useState('month');
  const [month, setMonth] = useState(currentMonthValue());
  const [quarter, setQuarter] = useState(Math.floor(new Date().getMonth() / 3) + 1);
  const [year, setYear] = useState(new Date().getFullYear());
  const [from, setFrom] = useState('');
  const [to, setTo] = useState('');

  function params() {
    const p = new URLSearchParams();
    p.set('period', periodType);
    if (periodType === 'month') p.set('month', month);
    if (periodType === 'quarter') { p.set('quarter', quarter); p.set('year', year); }
    if (periodType === 'year') p.set('year', year);
    if (periodType === 'custom') { if (from) p.set('from', from); if (to) p.set('to', to); }
    return p;
  }

  // Reproduit resolveAccountingPeriod (routes/admin.js) côté client : le journal filtre par
  // dateFrom/dateTo bruts (pas period=/month=/...), donc on résout ici la même fenêtre pour rester
  // cohérent avec les 3 autres sous-onglets qui, eux, laissent le backend résoudre la période.
  function resolvedRange() {
    const now = new Date();
    if (periodType === 'custom' && from) {
      const start = new Date(from);
      const end = to ? new Date(new Date(to).getTime() + 86400000) : new Date(start.getTime() + 86400000);
      return { start, end };
    }
    if (periodType === 'quarter') {
      const y = Number(year) || now.getFullYear();
      const q = Number(quarter) || Math.floor(now.getMonth() / 3) + 1;
      return { start: new Date(y, (q - 1) * 3, 1), end: new Date(y, q * 3, 1) };
    }
    if (periodType === 'year') {
      const y = Number(year) || now.getFullYear();
      return { start: new Date(y, 0, 1), end: new Date(y + 1, 0, 1) };
    }
    if (month && /^\d{4}-\d{2}$/.test(month)) {
      const [y, m] = month.split('-').map(Number);
      return { start: new Date(y, m - 1, 1), end: new Date(y, m, 1) };
    }
    return { start: new Date(now.getFullYear(), now.getMonth(), 1), end: new Date(now.getFullYear(), now.getMonth() + 1, 1) };
  }

  return { periodType, setPeriodType, month, setMonth, quarter, setQuarter, year, setYear, from, setFrom, to, setTo, params, resolvedRange };
}

function PeriodPicker(period) {
  return (
    <div className="row" style={{ gap: 8, alignItems: 'center', marginBottom: 14, flexWrap: 'wrap' }}>
      <div className="role-pick" style={{ margin: 0 }}>
        {periodTypes(tr).map((p) => (
          <div key={p.key} className={`chip${period.periodType === p.key ? ' active' : ''}`} onClick={() => period.setPeriodType(p.key)}>{p.label}</div>
        ))}
      </div>
      {period.periodType === 'month' && <input type="month" value={period.month} onChange={(e) => period.setMonth(e.target.value)} style={{ maxWidth: 160 }} />}
      {period.periodType === 'quarter' && (
        <>
          <select value={period.quarter} onChange={(e) => period.setQuarter(e.target.value)} style={{ maxWidth: 100 }}>
            {[1, 2, 3, 4].map((q) => <option key={q} value={q}>T{q}</option>)}
          </select>
          <input type="number" value={period.year} onChange={(e) => period.setYear(e.target.value)} style={{ maxWidth: 100 }} />
        </>
      )}
      {period.periodType === 'year' && <input type="number" value={period.year} onChange={(e) => period.setYear(e.target.value)} style={{ maxWidth: 100 }} />}
      {period.periodType === 'custom' && (
        <>
          <input type="date" value={period.from} onChange={(e) => period.setFrom(e.target.value)} style={{ maxWidth: 150 }} />
          <span className="small">à</span>
          <input type="date" value={period.to} onChange={(e) => period.setTo(e.target.value)} style={{ maxWidth: 150 }} />
        </>
      )}
    </div>
  );
}

export default function AdminAccountingPage() {
  const { t: tr } = useLanguage();
  const { token } = useAuth();
  const toast = useToast();
  const [tab, setTab] = useState('Vue d\'ensemble');
  const period = usePeriodParams();
  const periodKey = period.params().toString();
  const range = period.resolvedRange();
  const dateFrom = range.start.toISOString();
  const dateTo = new Date(range.end.getTime() - 1000).toISOString();

  return (
    <div>
      <h2 className="section-title" style={{ marginTop: 0 }}>{tr('adminAccounting.title')}</h2>
      <PeriodPicker {...period} />
      <div className="role-pick" style={{ marginBottom: 14, flexWrap: 'wrap' }}>
        {TABS.map((t) => <div key={t} className={`chip${tab === t ? ' active' : ''}`} onClick={() => setTab(t)}>{tabLabels(tr)[t] || t}</div>)}
      </div>
      {tab === 'Vue d\'ensemble' && <OverviewTab token={token} toast={toast} periodKey={periodKey} />}
      {tab === 'Journal' && <JournalTab token={token} toast={toast} dateFrom={dateFrom} dateTo={dateTo} />}
      {tab === 'Grand livre' && <LedgerTab token={token} toast={toast} periodKey={periodKey} />}
      {tab === 'Balance' && <BalanceTab token={token} toast={toast} periodKey={periodKey} />}
      {tab === 'TVA' && <VatTab token={token} toast={toast} periodKey={periodKey} />}
      {tab === 'Rapprochement' && <ReconciliationTab token={token} toast={toast} periodKey={periodKey} />}
      {tab === 'Plan comptable' && <ChartOfAccountsTab token={token} toast={toast} />}
    </div>
  );
}

function OverviewTab({ token, toast, periodKey }) {
  const { t: tr } = useLanguage();
  const [data, setData] = useState(null);

  useEffect(() => {
    setData(null);
    api(`/admin/accounting/overview?${periodKey}`, { token }).then(setData).catch((e) => toast(e.message));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [periodKey]);

  if (!data) return <SkeletonCards count={3} />;

  return (
    <>
      <div className="stat-grid">
        <div className="stat-card highlight"><div className="num">{money(data.fairideRevenue)}</div><div className="label">{tr('adminAccounting.grossRevenue')}</div></div>
        <div className="stat-card"><div className="num">{money(data.commission)}</div><div className="label">{tr('adminAccounting.restoCommissions')}</div></div>
        <div className="stat-card"><div className="num">{money(data.deliveryShare)}</div><div className="label">{tr('adminAccounting.deliveryFeeRevenue')}</div></div>
        <div className="stat-card"><div className="num">{money(data.serviceFee)}</div><div className="label">{tr('adminAccounting.serviceFees')}</div></div>
        <div className="stat-card"><div className="num">{money(data.otherRevenue)}</div><div className="label">{tr('adminAccounting.otherItems')}</div></div>
        <div className="stat-card"><div className="num" style={{ color: 'var(--red)' }}>{money(data.refunds)}</div><div className="label">{tr('adminCommon.refunds')}</div></div>
        <div className="stat-card highlight"><div className="num">{money(data.netRevenue)}</div><div className="label">{tr('adminAccounting.netResult')}</div></div>
        <div className="stat-card"><div className="num">{money(data.vatCollected)}</div><div className="label">{tr('adminAccounting.vatCollected')}</div></div>
        <div className="stat-card"><div className="num">{money(data.restaurantDueBalance)}</div><div className="label">{tr('adminAccounting.dueRestaurants')}</div></div>
        <div className="stat-card"><div className="num">{money(data.restaurantPaid)}</div><div className="label">{tr('adminAccounting.paidRestaurants')}</div></div>
        <div className="stat-card"><div className="num">{money(data.driverDueBalance)}</div><div className="label">{tr('adminAccounting.dueDrivers')}</div></div>
        <div className="stat-card"><div className="num">{money(data.driverPaid)}</div><div className="label">{tr('adminAccounting.paidDrivers')}</div></div>
      </div>
      <p className="small" style={{ opacity: 0.6, marginTop: 10 }}>
        {tr('adminAccounting.periodLine', { start: fmtDate(data.period.start), end: fmtDate(new Date(new Date(data.period.end).getTime() - 86400000)) })}
      </p>
    </>
  );
}

const ENTRY_TYPE_FILTERS = [{ key: '', label: 'Tous' }, ...Object.entries(ACCOUNTING_ENTRY_TYPE_LABELS).map(([key, label]) => ({ key, label }))];

// Regroupe les lignes en écritures (une écriture = toutes les lignes générées ensemble par un même
// événement réel : paiement, remboursement, virement — voir accountingService.js, qui donne à chacune
// de ses lignes la même référence). Uniquement pour l'affichage : la pagination reste par ligne côté API,
// une écriture à cheval sur deux pages (rare, uniquement en cas de gros volume) s'affiche donc coupée.
function groupByEcriture(rows) {
  const map = new Map();
  for (const r of rows) {
    if (!map.has(r.reference)) map.set(r.reference, []);
    map.get(r.reference).push(r);
  }
  return [...map.entries()].map(([reference, lines]) => {
    const totalDebit = +lines.reduce((a, l) => a + l.debit, 0).toFixed(2);
    const totalCredit = +lines.reduce((a, l) => a + l.credit, 0).toFixed(2);
    return { reference, date: lines[0].date, lines, totalDebit, totalCredit, balanced: Math.abs(totalDebit - totalCredit) < 0.01 };
  }).sort((a, b) => b.date - a.date);
}

function JournalTab({ token, toast, dateFrom, dateTo }) {
  const { t: tr } = useLanguage();
  const [entryType, setEntryType] = useState('');
  const [page, setPage] = useState(0);
  const [data, setData] = useState(null);

  useEffect(() => { setPage(0); }, [entryType, dateFrom, dateTo]);

  useEffect(() => {
    setData(null);
    const params = new URLSearchParams();
    params.set('dateFrom', dateFrom);
    params.set('dateTo', dateTo);
    if (entryType) params.set('entryType', entryType);
    params.set('limit', PAGE_SIZE);
    params.set('offset', page * PAGE_SIZE);
    api(`/admin/accounting/journal?${params.toString()}`, { token }).then(setData).catch((e) => toast(e.message));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [entryType, page, dateFrom, dateTo]);

  function exportCsv() {
    if (!data || !data.rows.length) { toast(tr('adminCommon.nothingToExport')); return; }
    downloadCsv(`journal-comptable-${Date.now()}.csv`, data.rows, [
      { label: tr('adminCommon.date'), get: (r) => fmtDateTime(r.date) }, { label: tr('adminAccounting.reference'), get: (r) => r.reference },
      { label: tr('adminCommon.type'), get: (r) => ACCOUNTING_ENTRY_TYPE_LABELS[r.entryType] || r.entryType },
      { label: 'Compte', get: (r) => `${r.accountCode} ${r.accountName}` },
      { label: 'Restaurant', get: (r) => r.restaurantName || '' }, { label: 'Livreur', get: (r) => r.driverName || '' }, { label: 'Client', get: (r) => r.clientName || '' },
      { label: tr('adminAccounting.debit'), get: (r) => r.debit }, { label: tr('adminAccounting.credit'), get: (r) => r.credit }, { label: 'TVA', get: (r) => r.vatAmount }, { label: 'Statut', get: (r) => r.status }
    ]);
  }

  return (
    <>
      <div className="row" style={{ justifyContent: 'space-between', gap: 8, marginBottom: 10, flexWrap: 'wrap' }}>
        <div className="role-pick" style={{ margin: 0, flexWrap: 'wrap' }}>
          {ENTRY_TYPE_FILTERS.map((f) => <div key={f.key || 'all'} className={`chip${entryType === f.key ? ' active' : ''}`} onClick={() => setEntryType(f.key)}>{f.label}</div>)}
        </div>
        <button className="btn-outline" onClick={exportCsv}>{tr('adminCommon.csv')}</button>
      </div>
      {!data && <SkeletonCards count={4} />}
      {data && data.rows.length === 0 && <div className="empty">{tr('adminAccounting.noEntries')}</div>}
      {data && groupByEcriture(data.rows).map((ecriture) => (
        <div className="card" key={ecriture.reference}>
          <div className="row" style={{ justifyContent: 'space-between' }}>
            <b>{ecriture.reference}</b>
            <div className="row" style={{ gap: 8 }}>
              <span className="small" style={{ opacity: 0.6 }}>{fmtDateTime(ecriture.date)}</span>
              <span className="pill" style={{ color: ecriture.balanced ? 'var(--teal-deep)' : 'var(--red)' }}>
                {ecriture.balanced ? tr('adminAccounting.balanced') : tr('adminAccounting.unbalanced')}
              </span>
            </div>
          </div>
          <div style={{ marginTop: 6, borderTop: '1px solid var(--line)', paddingTop: 6 }}>
            {ecriture.lines.map((r) => (
              <div key={r.id} className="row" style={{ justifyContent: 'space-between', padding: '3px 0', fontSize: 13 }}>
                <span>
                  <span style={{ fontFamily: 'monospace', opacity: 0.7 }}>{r.accountCode}</span> {r.accountName}
                  <span className="small" style={{ opacity: 0.6 }}> · {ACCOUNTING_ENTRY_TYPE_LABELS[r.entryType] || r.entryType}</span>
                </span>
                <span>
                  {r.debit > 0 ? money(r.debit) : ''}
                  <span style={{ display: 'inline-block', width: 70, textAlign: 'right', color: 'var(--teal-deep)' }}>{r.credit > 0 ? money(r.credit) : ''}</span>
                </span>
              </div>
            ))}
          </div>
          <div className="row" style={{ justifyContent: 'space-between', marginTop: 6, paddingTop: 6, borderTop: '1px solid var(--line)', fontWeight: 700, fontSize: 13 }}>
            <span>{[ecriture.lines[0].restaurantName, ecriture.lines[0].driverName, ecriture.lines[0].clientName].filter(Boolean).join(' · ')}</span>
            <span>{tr('adminCommon.total')} {money(ecriture.totalDebit)} / <span style={{ color: 'var(--teal-deep)' }}>{money(ecriture.totalCredit)}</span></span>
          </div>
        </div>
      ))}
      {data && data.total > PAGE_SIZE && (
        <div className="row" style={{ justifyContent: 'center', gap: 12, marginTop: 12 }}>
          <button className="btn-ghost" disabled={page === 0} onClick={() => setPage((p) => p - 1)}>{tr('adminCommon.previous')}</button>
          <span className="small">{tr('adminCommon.pageOf', { page: page + 1, pages: Math.ceil(data.total / PAGE_SIZE) })} {tr('adminAccounting.entriesCount', { n: data.total })}</span>
          <button className="btn-ghost" disabled={(page + 1) * PAGE_SIZE >= data.total} onClick={() => setPage((p) => p + 1)}>{tr('adminCommon.next')}</button>
        </div>
      )}
    </>
  );
}

// Ordre d'affichage classique d'un plan comptable : actifs, passifs, TVA, revenus, charges — plutôt que
// l'ordre alphabétique des codes, pour se lire comme un vrai plan comptable.
const ACCOUNT_KIND_ORDER = ['asset', 'liability', 'vat', 'revenue', 'expense'];
const ACCOUNT_KIND_LABELS = { revenue: 'Revenu', expense: 'Charge', asset: 'Actif', liability: 'Passif', vat: 'TVA' };

function LedgerTab({ token, toast, periodKey }) {
  const { t: tr } = useLanguage();
  const [accounts, setAccounts] = useState(null);
  const [accountCode, setAccountCode] = useState('');
  const [data, setData] = useState(null);

  useEffect(() => {
    api('/admin/accounting/accounts', { token }).then((rows) => {
      setAccounts(rows);
      if (rows.length && !accountCode) setAccountCode(rows[0].code);
    }).catch((e) => toast(e.message));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    if (!accountCode) return;
    setData(null);
    api(`/admin/accounting/ledger?accountCode=${encodeURIComponent(accountCode)}&${periodKey}`, { token }).then(setData).catch((e) => toast(e.message));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [accountCode, periodKey]);

  function exportCsv() {
    if (!data || !data.rows.length) { toast(tr('adminCommon.nothingToExport')); return; }
    downloadCsv(`grand-livre-${data.account.code}-${Date.now()}.csv`, data.rows, [
      { label: tr('adminCommon.date'), get: (r) => fmtDateTime(r.date) }, { label: tr('adminAccounting.reference'), get: (r) => r.reference },
      { label: tr('adminCommon.type'), get: (r) => ACCOUNTING_ENTRY_TYPE_LABELS[r.entryType] || r.entryType },
      { label: tr('adminAccounting.debit'), get: (r) => r.debit }, { label: tr('adminAccounting.credit'), get: (r) => r.credit }, { label: tr('adminAccounting.runningBalance'), get: (r) => r.runningBalance }
    ]);
  }

  const sortedAccounts = accounts ? [...accounts].sort((a, b) => ACCOUNT_KIND_ORDER.indexOf(a.kind) - ACCOUNT_KIND_ORDER.indexOf(b.kind) || a.code.localeCompare(b.code)) : [];

  return (
    <>
      <div className="row" style={{ justifyContent: 'space-between', gap: 8, marginBottom: 14, flexWrap: 'wrap' }}>
        <select value={accountCode} onChange={(e) => setAccountCode(e.target.value)} style={{ maxWidth: 320 }}>
          {sortedAccounts.map((a) => <option key={a.code} value={a.code}>{a.code} · {a.name}</option>)}
        </select>
        <button className="btn-outline" onClick={exportCsv}>{tr('adminCommon.csv')}</button>
      </div>
      {!data && <SkeletonCards count={3} />}
      {data && (
        <>
          <div className="stat-grid">
            <div className="stat-card"><div className="num">{money(data.openingBalance)}</div><div className="label">{tr('adminAccounting.openingBalance')}</div></div>
            <div className="stat-card"><div className="num">{money(data.totalDebit)}</div><div className="label">{tr('adminAccounting.totalDebitPeriod')}</div></div>
            <div className="stat-card"><div className="num" style={{ color: 'var(--teal-deep)' }}>{money(data.totalCredit)}</div><div className="label">{tr('adminAccounting.totalCreditPeriod')}</div></div>
            <div className="stat-card highlight"><div className="num">{money(data.closingBalance)}</div><div className="label">{tr('adminAccounting.closingBalance')}</div></div>
          </div>
          {data.rows.length === 0 && <div className="empty" style={{ marginTop: 14 }}>{tr('adminAccounting.noEntriesAccount')}</div>}
          {data.rows.length > 0 && (
            <div className="table-scroll" style={{ marginTop: 14, overflowX: 'auto' }}>
              <table className="admin-table">
                <thead>
                  <tr><th>{tr('adminCommon.date')}</th><th>{tr('adminAccounting.reference')}</th><th>{tr('adminCommon.type')}</th><th style={{ textAlign: 'right' }}>{tr('adminAccounting.debit')}</th><th style={{ textAlign: 'right' }}>{tr('adminAccounting.credit')}</th><th style={{ textAlign: 'right' }}>{tr('adminAccounting.balance')}</th></tr>
                </thead>
                <tbody>
                  <tr><td colSpan={5} className="small" style={{ opacity: 0.6 }}>{tr('adminAccounting.openingBalance')}</td><td style={{ textAlign: 'right', fontWeight: 700 }}>{money(data.openingBalance)}</td></tr>
                  {data.rows.map((r) => (
                    <tr key={r.id}>
                      <td className="small">{fmtDateTime(r.date)}</td>
                      <td className="small">{r.reference}</td>
                      <td className="small">{ACCOUNTING_ENTRY_TYPE_LABELS[r.entryType] || r.entryType}</td>
                      <td style={{ textAlign: 'right' }}>{r.debit > 0 ? money(r.debit) : ''}</td>
                      <td style={{ textAlign: 'right', color: 'var(--teal-deep)' }}>{r.credit > 0 ? money(r.credit) : ''}</td>
                      <td style={{ textAlign: 'right', fontWeight: 700 }}>{money(r.runningBalance)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </>
      )}
    </>
  );
}

function BalanceTab({ token, toast, periodKey }) {
  const { t: tr } = useLanguage();
  const [data, setData] = useState(null);

  useEffect(() => {
    setData(null);
    api(`/admin/accounting/balance?${periodKey}`, { token }).then(setData).catch((e) => toast(e.message));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [periodKey]);

  function exportCsv() {
    if (!data || !data.rows.length) { toast(tr('adminCommon.nothingToExport')); return; }
    downloadCsv(`balance-comptes-${Date.now()}.csv`, data.rows, [
      { label: tr('adminCommon.code'), get: (r) => r.code }, { label: tr('adminCommon.name'), get: (r) => r.name }, { label: tr('adminCommon.type'), get: (r) => ACCOUNT_KIND_LABELS[r.kind] },
      { label: tr('adminAccounting.debit'), get: (r) => r.debit }, { label: tr('adminAccounting.credit'), get: (r) => r.credit }, { label: tr('adminAccounting.balance'), get: (r) => r.balance }
    ]);
  }

  if (!data) return <SkeletonCards count={3} />;
  const sortedRows = [...data.rows].sort((a, b) => ACCOUNT_KIND_ORDER.indexOf(a.kind) - ACCOUNT_KIND_ORDER.indexOf(b.kind) || a.code.localeCompare(b.code));

  return (
    <>
      <div className="card" style={{ borderLeft: `3px solid ${data.balanced ? 'var(--teal-deep)' : 'var(--red)'}` }}>
        <div className="row" style={{ justifyContent: 'space-between', alignItems: 'center' }}>
          <b>{data.balanced ? tr('adminAccounting.journalBalanced') : tr('adminAccounting.journalUnbalanced')}</b>
          <span className="small">{tr('adminAccounting.totalsLine', { debit: money(data.totalDebit), credit: money(data.totalCredit) })}</span>
        </div>
        {!data.balanced && (
          <p className="small" style={{ margin: '6px 0 0', color: 'var(--red)' }}>
            {tr('adminAccounting.gapLine', { amount: money(Math.abs(data.totalDebit - data.totalCredit)) })}
          </p>
        )}
      </div>
      <div className="row" style={{ justifyContent: 'flex-end', margin: '10px 0' }}>
        <button className="btn-outline" onClick={exportCsv}>{tr('adminCommon.csv')}</button>
      </div>
      <div className="table-scroll" style={{ overflowX: 'auto' }}>
        <table className="admin-table">
          <thead>
            <tr><th>{tr('adminCommon.code')}</th><th>{tr('adminCommon.name')}</th><th>{tr('adminCommon.type')}</th><th style={{ textAlign: 'right' }}>{tr('adminAccounting.debit')}</th><th style={{ textAlign: 'right' }}>{tr('adminAccounting.credit')}</th><th style={{ textAlign: 'right' }}>{tr('adminAccounting.balance')}</th></tr>
          </thead>
          <tbody>
            {sortedRows.map((r) => (
              <tr key={r.code} style={{ opacity: r.active ? 1 : 0.5 }}>
                <td className="small" style={{ fontFamily: 'monospace' }}>{r.code}</td>
                <td className="small">{r.name}{!r.active ? tr('adminAccounting.disabledSuffix') : ''}</td>
                <td className="small">{ACCOUNT_KIND_LABELS[r.kind]}</td>
                <td style={{ textAlign: 'right' }}>{r.debit > 0 ? money(r.debit) : ''}</td>
                <td style={{ textAlign: 'right', color: 'var(--teal-deep)' }}>{r.credit > 0 ? money(r.credit) : ''}</td>
                <td style={{ textAlign: 'right', fontWeight: 700 }}>{money(r.balance)}</td>
              </tr>
            ))}
          </tbody>
          <tfoot>
            <tr style={{ fontWeight: 700 }}>
              <td colSpan={3}>{tr('adminCommon.total')}</td>
              <td style={{ textAlign: 'right' }}>{money(data.totalDebit)}</td>
              <td style={{ textAlign: 'right', color: 'var(--teal-deep)' }}>{money(data.totalCredit)}</td>
              <td />
            </tr>
          </tfoot>
        </table>
      </div>
    </>
  );
}

// Déclaration TVA par grille (voir GET /admin/accounting/vat-return, routes/admin.js) : grilles 03/54
// telles que précisées par l'utilisateur, calculées uniquement depuis des écritures déjà réellement
// comptabilisées. 59/49 restent à 0 avec un statut "non prêt" explicite plutôt qu'un chiffre inventé —
// jamais présentée comme prête à déposer telle quelle.
function VatReturnCard({ token, toast, periodKey }) {
  const { t: tr } = useLanguage();
  const [data, setData] = useState(null);

  useEffect(() => {
    setData(null);
    api(`/admin/accounting/vat-return?${periodKey}`, { token }).then(setData).catch((e) => toast(e.message));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [periodKey]);

  function exportCsv() {
    if (!data) { toast(tr('adminCommon.nothingToExport')); return; }
    const grilleRows = Object.entries(data.grilles).map(([code, g]) => ({ code, ...g }));
    downloadCsv(`declaration-tva-grilles-${Date.now()}.csv`, grilleRows, [
      { label: 'Grille', get: (r) => r.code }, { label: tr('adminAccounting.label'), get: (r) => r.label },
      { label: 'Montant', get: (r) => r.amount }, { label: tr('adminAccounting.ready'), get: (r) => r.ready ? 'Oui' : 'Non — ' + (r.reason || '') }
    ]);
  }

  if (!data) return <SkeletonCards count={1} />;

  return (
    <div className="card" style={{ marginBottom: 14 }}>
      <div className="row" style={{ justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: 8 }}>
        <b>{tr('adminAccounting.vatReturn')}</b>
        <button className="btn-outline" style={{ padding: '4px 10px', fontSize: 12 }} onClick={exportCsv}>{tr('adminCommon.csv')}</button>
      </div>
      {!data.fullyReady && (
        <p className="small" style={{ margin: '6px 0 10px', color: 'var(--red)' }}>
          {tr('adminAccounting.vatWarning')}
        </p>
      )}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: 8, marginTop: 8 }}>
        {Object.entries(data.grilles).map(([code, g]) => (
          <div key={code} style={{ background: 'var(--cream-dim)', borderRadius: 10, padding: '10px 12px' }}>
            <div className="row" style={{ justifyContent: 'space-between', alignItems: 'flex-start' }}>
              <span className="small" style={{ fontFamily: 'monospace', fontWeight: 700 }}>{tr('adminAccounting.box', { code })}</span>
              <span className="small" style={{ color: g.ready ? 'var(--teal-deep)' : 'var(--red)' }}>{g.ready ? '✓' : '✗'}</span>
            </div>
            <div className="small" style={{ margin: '2px 0 4px', opacity: 0.75 }}>{g.label}</div>
            <b>{money(g.amount)}</b>
            {!g.ready && <div className="small" style={{ marginTop: 4, color: 'var(--red)' }}>{g.reason}</div>}
          </div>
        ))}
      </div>
      <div className="row" style={{ justifyContent: 'space-between', marginTop: 12, paddingTop: 10, borderTop: '1px solid var(--line)' }}>
        <b>{tr('adminAccounting.dueToState')}</b>
        <b>{money(data.soldeDu)}</b>
      </div>
    </div>
  );
}

function VatTab({ token, toast, periodKey }) {
  const { t: tr } = useLanguage();
  const [data, setData] = useState(null);

  useEffect(() => {
    setData(null);
    api(`/admin/accounting/vat?${periodKey}`, { token }).then(setData).catch((e) => toast(e.message));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [periodKey]);

  function exportCsv() {
    if (!data || !data.rows.length) { toast(tr('adminCommon.nothingToExport')); return; }
    downloadCsv(`tva-${Date.now()}.csv`, data.rows, [
      { label: 'Origine', get: (r) => r.origin }, { label: 'Base HTVA', get: (r) => r.baseHt },
      { label: 'TVA', get: (r) => r.vatAmount }, { label: 'Taux effectif', get: (r) => r.rate }, { label: 'TVAC', get: (r) => r.totalTtc }
    ]);
  }

  if (!data) return <SkeletonCards count={2} />;

  return (
    <>
      <VatReturnCard token={token} toast={toast} periodKey={periodKey} />
      <div className="card" style={{ borderLeft: '3px solid var(--gold-deep)' }}>
        <p className="small" style={{ margin: 0 }}>
          {tr('adminAccounting.vatRateWarning')}
        </p>
      </div>
      <div className="row" style={{ justifyContent: 'flex-end', margin: '10px 0' }}>
        <button className="btn-outline" onClick={exportCsv}>{tr('adminCommon.csv')}</button>
      </div>
      {data.rows.length === 0 && <div className="empty">{tr('adminAccounting.noVatOps')}</div>}
      {data.rows.map((r, i) => (
        <div className="card" key={i}>
          <div className="row" style={{ justifyContent: 'space-between' }}><b>{r.origin}</b><span className="small">{tr('adminAccounting.effectiveRate', { rate: pct(r.rate, 1) })}</span></div>
          <div className="row" style={{ justifyContent: 'space-between', marginTop: 4 }}>
            <span className="small">{tr('adminAccounting.htVatLine', { ht: money(r.baseHt), vat: money(r.vatAmount) })}</span>
            <b className="small">{money(r.totalTtc)} TVAC</b>
          </div>
        </div>
      ))}
      {data.rows.length > 0 && (
        <div className="card" style={{ marginTop: 8 }}>
          <div className="row" style={{ justifyContent: 'space-between' }}><b>{tr('adminCommon.total')}</b><span />
          </div>
          <div className="row" style={{ justifyContent: 'space-between', marginTop: 4 }}>
            <span className="small">{tr('adminAccounting.htVatLine', { ht: money(data.totalHt), vat: money(data.totalVat) })}</span>
            <b className="small">{money(data.totalTtc)} TVAC</b>
          </div>
        </div>
      )}
    </>
  );
}

const reconciliationLabels = (tr) => ({ rapproche: tr('adminCommon.reconciledOne'), non_rapproche: tr('adminCommon.notReconciledOne'), problematique: tr('adminCommon.problematicOne') });

// Comparaison en direct avec l'API Stripe (pas dérivée des colonnes déjà en base comme le reste de cet
// onglet) : solde du compte 5500-STRIPE dans les livres vs solde Stripe réel à l'instant présent. Sur
// toute la durée de vie du compte, pas seulement la période choisie — un écart d'aujourd'hui vient d'un
// mouvement Stripe jamais traduit en écriture, peu importe quand il a eu lieu.
function StripeBalanceCard({ token, toast }) {
  const { t: tr } = useLanguage();
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(false);

  function check() {
    setLoading(true);
    api('/admin/accounting/stripe-balance', { token }).then(setData).catch((e) => toast(e.message)).finally(() => setLoading(false));
  }
  useEffect(check, []); // eslint-disable-line react-hooks/exhaustive-deps

  return (
    <div className="card" style={{ borderLeft: `3px solid ${!data ? 'var(--line)' : data.matched ? 'var(--teal-deep)' : 'var(--red)'}`, marginBottom: 14 }}>
      <div className="row" style={{ justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: 8 }}>
        <b>
          {!data ? tr('adminAccounting.stripeChecking') : data.matched ? tr('adminAccounting.stripeMatches') : tr('adminAccounting.stripeMismatch')}
        </b>
        <button className="btn-ghost" style={{ padding: '4px 10px', fontSize: 12 }} disabled={loading} onClick={check}>{loading ? '...' : tr('adminAccounting.recheck')}</button>
      </div>
      {data && (
        <>
          <div className="row" style={{ gap: 16, marginTop: 6, flexWrap: 'wrap' }}>
            <span className="small">{tr('adminAccounting.booksStripe')} <b>{money(data.booksBalance)}</b></span>
            <span className="small">{tr('adminAccounting.stripeAvailable')} <b>{money(data.stripeAvailable)}</b></span>
            <span className="small">{tr('adminAccounting.stripePending')} <b>{money(data.stripePending)}</b></span>
          </div>
          {!data.matched && (
            <p className="small" style={{ margin: '6px 0 0', color: 'var(--red)' }}>
              {tr('adminAccounting.stripeGapLine', { amount: money(Math.abs(data.delta)), direction: data.delta > 0 ? tr('adminAccounting.booksMore') : tr('adminAccounting.stripeMore'), time: fmtDateTime(data.checkedAt) })}
            </p>
          )}
        </>
      )}
    </div>
  );
}

function ReconciliationTab({ token, toast, periodKey }) {
  const { t: tr } = useLanguage();
  const [data, setData] = useState(null);
  const [filter, setFilter] = useState('non_rapproche');

  useEffect(() => {
    setData(null);
    api(`/admin/accounting/reconciliation?${periodKey}`, { token }).then(setData).catch((e) => toast(e.message));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [periodKey]);

  function exportCsv() {
    if (!data || !data.rows.length) { toast(tr('adminCommon.nothingToExport')); return; }
    downloadCsv(`rapprochement-${Date.now()}.csv`, data.rows, [
      { label: 'ID commande', get: (r) => r.id }, { label: 'Restaurant', get: (r) => r.restaurantName }, { label: 'Livreur', get: (r) => r.driverName || '' },
      { label: tr('adminCommon.total'), get: (r) => r.total }, { label: tr('adminAccounting.state'), get: (r) => r.state }, { label: tr('adminAccounting.problems'), get: (r) => r.issues.join(' | ') }, { label: tr('adminCommon.date'), get: (r) => fmtDate(r.paidAt) }
    ]);
  }

  if (!data) return (<><StripeBalanceCard token={token} toast={toast} /><SkeletonCards count={3} /></>);
  const rows = data.rows.filter((r) => !filter || r.state === filter);

  return (
    <>
      <StripeBalanceCard token={token} toast={toast} />
      <div className="stat-grid">
        <div className="stat-card"><div className="num">{data.counts.rapproche}</div><div className="label">{tr('adminCommon.reconciled')}</div></div>
        <div className="stat-card"><div className="num" style={{ color: 'var(--gold-deep)' }}>{data.counts.non_rapproche}</div><div className="label">{tr('adminCommon.notReconciled')}</div></div>
        <div className="stat-card"><div className="num" style={{ color: 'var(--red)' }}>{data.counts.problematique}</div><div className="label">{tr('adminCommon.problematic')}</div></div>
      </div>
      <div className="row" style={{ justifyContent: 'space-between', gap: 8, margin: '14px 0', flexWrap: 'wrap' }}>
        <div className="role-pick" style={{ margin: 0 }}>
          {[{ key: '', label: 'Toutes' }, { key: 'non_rapproche', label: 'Non rapprochées' }, { key: 'problematique', label: 'Problématiques' }, { key: 'rapproche', label: 'Rapprochées' }].map((f) => (
            <div key={f.key || 'all'} className={`chip${filter === f.key ? ' active' : ''}`} onClick={() => setFilter(f.key)}>{f.label}</div>
          ))}
        </div>
        <button className="btn-outline" onClick={exportCsv}>{tr('adminCommon.csv')}</button>
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
    </>
  );
}

function ChartOfAccountsTab({ token, toast }) {
  const { t: tr } = useLanguage();
  const [accounts, setAccounts] = useState(null);
  const [newCode, setNewCode] = useState('');
  const [newName, setNewName] = useState('');
  const [newKind, setNewKind] = useState('revenue');
  const [creating, setCreating] = useState(false);

  function load() {
    api('/admin/accounting/accounts', { token }).then(setAccounts).catch((e) => toast(e.message));
  }
  useEffect(load, []); // eslint-disable-line react-hooks/exhaustive-deps

  async function createAccount() {
    if (!newCode.trim() || !newName.trim()) { toast(tr('adminAccounting.toastCodeName')); return; }
    setCreating(true);
    try {
      const created = await api('/admin/accounting/accounts', { method: 'POST', token, body: { code: newCode.trim(), name: newName.trim(), kind: newKind } });
      setAccounts((prev) => [...prev, created].sort((a, b) => a.code.localeCompare(b.code)));
      setNewCode(''); setNewName('');
      toast(tr('adminAccounting.toastAccountCreated'));
    } catch (e) {
      toast(e.message);
    } finally {
      setCreating(false);
    }
  }

  async function toggleActive(a) {
    try {
      const updated = await api(`/admin/accounting/accounts/${a.id}`, { method: 'PATCH', token, body: { active: !a.active } });
      setAccounts((prev) => prev.map((x) => (x.id === a.id ? updated : x)));
    } catch (e) {
      toast(e.message);
    }
  }

  if (!accounts) return <SkeletonCards count={3} />;

  return (
    <>
      <div className="card">
        <h3 style={{ margin: '0 0 10px', fontSize: 15 }}>{tr('adminAccounting.addAccount')}</h3>
        <p className="small" style={{ margin: '0 0 10px', opacity: 0.7 }}>{tr('adminAccounting.chartExtensible')}</p>
        <div className="row" style={{ gap: 8, flexWrap: 'wrap' }}>
          <input placeholder={tr('adminAccounting.phCode')} value={newCode} onChange={(e) => setNewCode(e.target.value)} style={{ maxWidth: 160 }} />
          <input placeholder={tr('adminCommon.name')} value={newName} onChange={(e) => setNewName(e.target.value)} style={{ flex: 1, minWidth: 160 }} />
          <select value={newKind} onChange={(e) => setNewKind(e.target.value)} style={{ maxWidth: 140 }}>
            {Object.entries(ACCOUNT_KIND_LABELS).map(([k, l]) => <option key={k} value={k}>{l}</option>)}
          </select>
          <button className="btn-teal" disabled={creating} onClick={createAccount}>{creating ? '...' : tr('adminCommon.create')}</button>
        </div>
      </div>
      {accounts.map((a) => (
        <div className="card" key={a.id} style={{ opacity: a.active ? 1 : 0.5 }}>
          <div className="row" style={{ justifyContent: 'space-between' }}>
            <div><b style={{ fontFamily: 'monospace' }}>{a.code}</b> <span style={{ marginLeft: 6 }}>{a.name}</span></div>
            <div className="row" style={{ gap: 8 }}>
              <span className="pill">{ACCOUNT_KIND_LABELS[a.kind]}</span>
              <button className={a.active ? 'btn-danger-ghost' : 'btn-outline'} style={{ padding: '4px 10px', fontSize: 12 }} onClick={() => toggleActive(a)}>
                {a.active ? tr('adminCommon.disable') : 'Activer'}
              </button>
            </div>
          </div>
        </div>
      ))}
    </>
  );
}
