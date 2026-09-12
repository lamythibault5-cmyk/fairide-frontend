import { useEffect, useMemo, useState } from 'react';
import { createPortal } from 'react-dom';
import { useSearchParams } from 'react-router-dom';
import { api } from '../../api';
import AdminPageHeader from '../../components/admin/AdminPageHeader';
import AdminDataTable, { useTableSort } from '../../components/admin/AdminDataTable';
import RecordDrawer, { DrawerRow } from '../../components/admin/RecordDrawer';
import ConfirmDialog from '../../components/ConfirmDialog';
import PeriodPicker, { usePeriod, periodRange } from '../../components/admin/PeriodPicker';
import { useAuth } from '../../context/AuthContext';
import { useToast } from '../../context/ToastContext';
import { useLanguage } from '../../context/LanguageContext';
import { money, fmtDate, fmtDateTime, downloadCsv, downloadPdf, ACCOUNTING_ENTRY_TYPE_LABELS } from './adminUtils';
import { useApiData, LoadState, ErrorState, Pagination, RestaurantLink, DriverLink, OrderLink, SignedMoney, DeltaBadge, todayIso, toNumber, sortAccounts, StatusPill, ENTRY_STATUSES, entryStatusLabels } from './accounting/common';
import ExpensesTab from './accounting/ExpensesTab';
import LedgerTab from './accounting/LedgerTab';
import { IncomeStatementTab, BalanceSheetTab, VatTab } from './accounting/ReportsTabs';
import { ReconciliationTab, ClosingTab, ChartOfAccountsTab } from './accounting/OtherTabs';
import '../../admin-finance.css';

// Comptabilité — application du groupe Finance, dans l'esprit d'Odoo Comptabilité : une période
// partagée en haut, des onglets qui vont du pilotage (vue d'ensemble) aux documents légaux (compte de
// résultat, bilan, TVA) en passant par la saisie (journal, achats) et la clôture. L'onglet courant vit
// dans l'URL (?tab=) pour que les alertes et les autres applications puissent pointer dessus.

const TABS = ['overview', 'journal', 'expenses', 'ledger', 'income', 'balanceSheet', 'vat', 'reconciliation', 'closing', 'chart'];
const TAB_KEYS = { overview: 'adminAccounting.tab_overview', journal: 'adminAccounting.tab_journal', expenses: 'adminAccounting.tab_expenses', ledger: 'adminAccounting.tab_ledger', income: 'adminAccounting.tab_income', balanceSheet: 'adminAccounting.tab_balanceSheet', vat: 'adminAccounting.tab_vat', reconciliation: 'adminAccounting.tab_reconciliation', closing: 'adminAccounting.tab_closing', chart: 'adminAccounting.tab_chart' };
const PAGE_SIZE = 50;

export default function AdminAccountingPage() {
  const { t: tr } = useLanguage();
  const { token } = useAuth();
  const toast = useToast();
  const [searchParams, setSearchParams] = useSearchParams();
  const tab = TABS.includes(searchParams.get('tab')) ? searchParams.get('tab') : 'overview';
  const { period, setPeriod, queryString, range } = usePeriod();
  // Le journal filtre par dateFrom/dateTo bruts (pas period=) : même fenêtre, résolue côté client.
  const dateFrom = range.start.toISOString();
  const dateTo = new Date(range.end.getTime() - 1000).toISOString();

  function go(next, extra = {}) {
    const params = { tab: next, ...extra };
    setSearchParams(params);
  }

  const common = { token, toast, periodKey: queryString, period, dateFrom, dateTo, go, searchParams };

  return (
    <div>
      <AdminPageHeader module="accounting" />
      <PeriodPicker period={period} onChange={setPeriod} />
      <nav className="fin-tabs" aria-label={tr('adminAccounting.tabsAria')}>
        {TABS.map((k) => <div key={k} role="tab" aria-selected={tab === k} className={`chip${tab === k ? ' active' : ''}`} onClick={() => go(k)}>{tr(TAB_KEYS[k])}</div>)}
      </nav>
      {tab === 'overview' && <OverviewTab {...common} />}
      {tab === 'journal' && <JournalTab {...common} />}
      {tab === 'expenses' && <ExpensesTab {...common} />}
      {tab === 'ledger' && <LedgerTab {...common} />}
      {tab === 'income' && <IncomeStatementTab {...common} />}
      {tab === 'balanceSheet' && <BalanceSheetTab {...common} />}
      {tab === 'vat' && <VatTab {...common} />}
      {tab === 'reconciliation' && <ReconciliationTab {...common} />}
      {tab === 'closing' && <ClosingTab {...common} />}
      {tab === 'chart' && <ChartOfAccountsTab {...common} />}
    </div>
  );
}

// ---------------------------------------------------------------------------------------------
// Vue d'ensemble
// ---------------------------------------------------------------------------------------------

function monthKey(d) { return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`; }

// Mois à tracer dans le graphique produits / charges : les mois de la période (année, trimestre) ou
// les six mois qui se terminent au mois choisi.
function chartMonths(period) {
  const r = periodRange(period);
  const out = [];
  if (period.type === 'year' || period.type === 'quarter') {
    for (let d = new Date(r.start); d < r.end; d = new Date(d.getFullYear(), d.getMonth() + 1, 1)) out.push(new Date(d));
  } else {
    const base = period.type === 'month' ? r.start : new Date(r.end.getFullYear(), r.end.getMonth(), 1);
    for (let i = 5; i >= 0; i--) out.push(new Date(base.getFullYear(), base.getMonth() - i, 1));
  }
  return out.slice(-12);
}

function DualBarChart({ data, labels }) {
  const { t: tr } = useLanguage();
  if (!data || data.length === 0) return <div className="empty" style={{ padding: '24px 0' }}>{tr('adminCommon.noDataPeriod')}</div>;
  const height = 150; const max = Math.max(1, ...data.flatMap((d) => [d.revenue, d.expenses]));
  const slot = 100 / data.length; const bw = slot * 0.32;
  return (
    <div className="fin-dualchart">
      <svg viewBox={`0 0 100 ${height}`} preserveAspectRatio="none">
        {data.map((d, i) => {
          const hr = (d.revenue / max) * (height - 20); const he = (d.expenses / max) * (height - 20);
          const x = i * slot + slot * 0.15;
          return (
            <g key={i}>
              <title>{`${d.label} : ${labels.revenue} ${money(d.revenue)} · ${labels.expenses} ${money(d.expenses)}`}</title>
              <rect x={x} y={height - 16 - hr} width={bw} height={Math.max(1, hr)} fill="var(--iris)" rx={1} opacity={0.85} />
              <rect x={x + bw + slot * 0.06} y={height - 16 - he} width={bw} height={Math.max(1, he)} fill="var(--orange)" rx={1} opacity={0.85} />
            </g>
          );
        })}
        <line x1="0" y1={height - 16} x2="100" y2={height - 16} stroke="var(--line)" strokeWidth="0.5" />
      </svg>
      <div className="fin-dualchart-axis"><span>{data[0].label}</span><span>{data[data.length - 1].label}</span></div>
      <div className="fin-dualchart-legend"><span><i style={{ background: 'var(--iris)' }} />{labels.revenue}</span><span><i style={{ background: 'var(--orange)' }} />{labels.expenses}</span></div>
    </div>
  );
}

function OverviewTab({ token, periodKey, period, go }) {
  const { t: tr, locale } = useLanguage();
  const income = useApiData(() => api(`/admin/accounting/income-statement?${periodKey}`, { token }), [periodKey]);
  const overview = useApiData(() => api(`/admin/accounting/overview?${periodKey}`, { token }), [periodKey]);
  const health = useApiData(() => api('/admin/accounting/health', { token }), []);
  const stripe = useApiData(() => api('/admin/accounting/stripe-balance', { token }), []);
  const asOf = useMemo(() => { const r = periodRange(period); const d = new Date(r.end.getTime() - 1); return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`; }, [period]);
  const sheet = useApiData(() => api(`/admin/accounting/balance-sheet?asOf=${asOf}`, { token }), [asOf]);
  const months = useMemo(() => chartMonths(period), [period]);
  const series = useApiData(() => Promise.all(months.map((m) => api(`/admin/accounting/income-statement?period=month&month=${monthKey(m)}`, { token }).then((r) => ({ label: m.toLocaleDateString(locale, { month: 'short', year: '2-digit' }), revenue: Number(r.totalRevenue || 0), expenses: Number(r.totalExpenses || 0) })))), [months.map(monthKey).join(',')]);

  const bank = sheet.data ? (sheet.data.assets || []).filter((a) => /^5/.test(a.code) && !/STRIPE/i.test(a.code)).reduce((s, a) => s + Number(a.amount || 0), 0) : null;

  const alerts = [];
  if (health.data) {
    const h = health.data;
    alerts.push({ key: 'unbalanced', count: h.unbalancedGroups, tone: 'danger', label: tr('adminAccounting.alertUnbalanced'), to: ['journal'] });
    alerts.push({ key: 'flagged', count: h.flaggedEntries, tone: 'warn', label: tr('adminAccounting.alertFlagged'), to: ['journal', { status: 'flagged' }] });
    alerts.push({ key: 'periods', count: h.openPeriodsBehind, tone: 'warn', label: tr('adminAccounting.alertPeriods'), to: ['closing'] });
    alerts.push({ key: 'stripe', count: Math.abs(Number(h.stripeDelta || 0)) >= 0.01 ? 1 : 0, amount: h.stripeDelta, tone: 'danger', label: tr('adminAccounting.alertStripe', { amount: money(Math.abs(Number(h.stripeDelta || 0))) }), to: ['reconciliation'] });
    alerts.push({ key: 'drafts', count: h.expensesDraft, tone: 'warn', label: tr('adminAccounting.alertDrafts'), to: ['expenses', { status: 'draft' }] });
  }
  const actives = alerts.filter((a) => a.count > 0);

  return (
    <>
      {income.error && !income.data && <ErrorState error={income.error} onRetry={income.reload} />}
      {income.data && (
        <div className="stat-grid">
          <div className={`stat-card highlight${Number(income.data.result) < 0 ? ' fin-result negative' : ''}`}><div className="num"><SignedMoney value={income.data.result} strong /></div><div className="label">{tr('adminAccounting.kpiResult')} <DeltaBadge current={income.data.result} previous={income.data.previous?.result} /></div></div>
          <div className="stat-card"><div className="num">{money(income.data.totalRevenue)}</div><div className="label">{tr('adminAccounting.kpiRevenue')} <DeltaBadge current={income.data.totalRevenue} previous={income.data.previous?.totalRevenue} /></div></div>
          <div className="stat-card"><div className="num">{money(income.data.totalExpenses)}</div><div className="label">{tr('adminAccounting.kpiExpenses')} <DeltaBadge current={income.data.totalExpenses} previous={income.data.previous?.totalExpenses} /></div></div>
          <div className="stat-card"><div className="num">{money(income.data.vatNet)}</div><div className="label">{tr('adminAccounting.kpiVatNet')}</div></div>
          <div className="stat-card"><div className="num">{stripe.data ? money(stripe.data.stripeAvailable) : '…'}</div><div className="label">{tr('adminAccounting.kpiStripe')}</div></div>
          <div className="stat-card"><div className="num">{bank === null ? (sheet.error ? '-' : '…') : money(bank)}</div><div className="label">{tr('adminAccounting.kpiBank')}</div></div>
          {overview.data && <div className="stat-card"><div className="num">{money(overview.data.restaurantDueBalance)}</div><div className="label">{tr('adminAccounting.dueRestaurants')}</div></div>}
          {overview.data && <div className="stat-card"><div className="num">{money(overview.data.driverDueBalance)}</div><div className="label">{tr('adminAccounting.dueDrivers')}</div></div>}
        </div>
      )}
      {!income.data && !income.error && <div className="stat-grid">{[1, 2, 3, 4].map((i) => <div key={i} className="skeleton skeleton-card" style={{ minHeight: 70 }} />)}</div>}

      <div className="card">
        <h3 style={{ margin: '0 0 10px', fontSize: 15 }}>{tr('adminAccounting.healthTitle')}</h3>
        {health.error && !health.data && <ErrorState error={health.error} onRetry={health.reload} />}
        {!health.data && !health.error && <div className="skeleton skeleton-card" style={{ minHeight: 50 }} />}
        {health.data && actives.length === 0 && <div className="fin-alert tone-ok"><b>✓</b><span>{tr('adminAccounting.healthOk')}</span></div>}
        {health.data && actives.length > 0 && (
          <div className="fin-alerts">
            {actives.map((a) => (
              <button type="button" key={a.key} className={`fin-alert tone-${a.tone}`} onClick={() => go(a.to[0], a.to[1] || {})}>
                <b>{a.key === 'stripe' ? '!' : a.count}</b><span>{a.label}</span><i>›</i>
              </button>
            ))}
          </div>
        )}
      </div>

      <div className="card">
        <h3 style={{ margin: '0 0 10px', fontSize: 15 }}>{tr('adminAccounting.quickActions')}</h3>
        <div className="fin-quick">
          <button type="button" className="btn-teal" onClick={() => go('journal', { new: '1' })}>{tr('adminAccounting.newEntry')}</button>
          <button type="button" className="btn-outline" onClick={() => go('expenses', { new: '1' })}>{tr('adminAccounting.newExpense')}</button>
          <button type="button" className="btn-outline" onClick={() => go('closing')}>{tr('adminAccounting.closeMonth')}</button>
          <button type="button" className="btn-outline" onClick={() => go('vat')}>{tr('adminAccounting.prepareVat')}</button>
        </div>
      </div>

      <div className="card">
        <h3 style={{ margin: '0 0 10px', fontSize: 15 }}>{tr('adminAccounting.chartTitle')}</h3>
        {series.error && !series.data && <ErrorState error={series.error} onRetry={series.reload} />}
        {!series.data && !series.error && <div className="skeleton skeleton-card" style={{ minHeight: 150 }} />}
        {series.data && <DualBarChart data={series.data} labels={{ revenue: tr('adminAccounting.kpiRevenue'), expenses: tr('adminAccounting.kpiExpenses') }} />}
      </div>
      {overview.data && (
        <p className="small" style={{ opacity: 0.6, marginTop: 10 }}>
          {tr('adminAccounting.periodLine', { start: fmtDate(overview.data.period.start), end: fmtDate(new Date(new Date(overview.data.period.end).getTime() - 86400000)) })}
        </p>
      )}
    </>
  );
}

// ---------------------------------------------------------------------------------------------
// Journal
// ---------------------------------------------------------------------------------------------

// Regroupe les lignes en écritures (même groupe = mêmes lignes générées ensemble par un événement :
// paiement, remboursement, virement, écriture manuelle). Affichage uniquement, la pagination reste
// par ligne côté API.
function groupEntries(rows) {
  const map = new Map();
  for (const r of rows) {
    const k = r.groupId || r.reference;
    if (!map.has(k)) map.set(k, []);
    map.get(k).push(r);
  }
  return [...map.entries()].map(([key, lines]) => {
    const totalDebit = +lines.reduce((a, l) => a + Number(l.debit || 0), 0).toFixed(2);
    const totalCredit = +lines.reduce((a, l) => a + Number(l.credit || 0), 0).toFixed(2);
    return { key, reference: lines[0].reference, date: lines[0].date, lines, totalDebit, totalCredit, balanced: Math.abs(totalDebit - totalCredit) < 0.01, manual: lines.every((l) => l.entryType === 'manual') };
  }).sort((a, b) => b.date - a.date);
}

function JournalTab({ token, toast, dateFrom, dateTo, searchParams, go }) {
  const { t: tr } = useLanguage();
  const [entryType, setEntryType] = useState('');
  const [status, setStatus] = useState(searchParams.get('status') || '');
  const [q, setQ] = useState('');
  const [page, setPage] = useState(0);
  const [openGroup, setOpenGroup] = useState(null);
  const [showNew, setShowNew] = useState(searchParams.get('new') === '1');
  const { sort, toggle } = useTableSort('date');
  const statusLabels = entryStatusLabels(tr);

  useEffect(() => { setPage(0); }, [entryType, status, dateFrom, dateTo]);
  useEffect(() => { if (searchParams.get('new') === '1') setShowNew(true); }, [searchParams]);

  const state = useApiData(() => {
    const params = new URLSearchParams({ dateFrom, dateTo, limit: PAGE_SIZE, offset: page * PAGE_SIZE });
    if (entryType) params.set('entryType', entryType);
    if (status) params.set('status', status);
    return api(`/admin/accounting/journal?${params.toString()}`, { token });
  }, [entryType, status, page, dateFrom, dateTo]);

  const rows = useMemo(() => {
    if (!state.data) return [];
    const needle = q.trim().toLowerCase();
    const groups = groupEntries(state.data.rows);
    const byKey = new Map(groups.map((g) => [g.key, g]));
    return state.data.rows.filter((r) => !needle || [r.reference, r.accountCode, r.accountName, r.restaurantName, r.driverName, r.clientName, r.memo, r.orderId].some((v) => v && String(v).toLowerCase().includes(needle)))
      .map((r) => ({ ...r, _group: byKey.get(r.groupId || r.reference) }));
  }, [state.data, q]);

  function exportCsv() {
    if (!rows.length) { toast(tr('adminCommon.nothingToExport')); return; }
    downloadCsv(`journal-comptable-${Date.now()}.csv`, rows, [
      { label: tr('adminCommon.date'), get: (r) => fmtDateTime(r.date) }, { label: tr('adminAccounting.reference'), get: (r) => r.reference },
      { label: tr('adminCommon.type'), get: (r) => ACCOUNTING_ENTRY_TYPE_LABELS[r.entryType] || r.entryType },
      { label: tr('adminAccounting.account'), get: (r) => `${r.accountCode} ${r.accountName}` },
      { label: tr('adminCommon.restaurant'), get: (r) => r.restaurantName || '' }, { label: tr('adminCommon.driver'), get: (r) => r.driverName || '' }, { label: tr('adminCommon.client'), get: (r) => r.clientName || '' },
      { label: tr('adminAccounting.debit'), get: (r) => r.debit }, { label: tr('adminAccounting.credit'), get: (r) => r.credit }, { label: tr('adminCommon.vat'), get: (r) => r.vatAmount }, { label: tr('adminCommon.status'), get: (r) => statusLabels[r.status] || r.status }
    ]);
  }

  async function exportFull() {
    try {
      const params = new URLSearchParams({ format: 'csv', period: 'custom', from: dateFrom.slice(0, 10), to: dateTo.slice(0, 10) });
      await downloadPdf(`/admin/accounting/export?${params.toString()}`, token, `export-comptable-${Date.now()}.csv`);
    } catch (e) { toast(e.message); }
  }

  const columns = [
    { key: 'date', label: tr('adminCommon.date'), get: (r) => <span className="small">{fmtDateTime(r.date)}</span>, sortValue: (r) => r.date },
    { key: 'account', label: tr('adminAccounting.account'), get: (r) => <span><span className="fin-mono" style={{ opacity: 0.7 }}>{r.accountCode}</span> {r.accountName}</span>, sortValue: (r) => r.accountCode },
    { key: 'entryType', label: tr('adminCommon.type'), get: (r) => <span className="small">{ACCOUNTING_ENTRY_TYPE_LABELS[r.entryType] || r.entryType}</span>, sortValue: (r) => r.entryType },
    { key: 'partner', label: tr('adminAccounting.partner'), get: (r) => <span className="small">{[r.restaurantName, r.driverName, r.clientName].filter(Boolean).join(' · ') || '-'}</span>, sortValue: (r) => r.restaurantName || r.driverName || r.clientName || '' },
    { key: 'debit', label: tr('adminAccounting.debit'), get: (r) => (r.debit > 0 ? money(r.debit) : ''), sortValue: (r) => r.debit, align: 'right', sum: true },
    { key: 'credit', label: tr('adminAccounting.credit'), get: (r) => (r.credit > 0 ? <span className="fin-credit">{money(r.credit)}</span> : ''), sortValue: (r) => r.credit, align: 'right', sum: true },
    { key: 'status', label: tr('adminCommon.status'), get: (r) => <StatusPill status={r.status} labels={statusLabels} />, sortValue: (r) => r.status }
  ];

  return (
    <>
      <div className="fin-toolbar">
        <input type="search" placeholder={tr('adminAccounting.phSearchJournal')} value={q} onChange={(e) => setQ(e.target.value)} />
        <select value={entryType} onChange={(e) => setEntryType(e.target.value)} aria-label={tr('adminCommon.type')}>
          <option value="">{tr('adminAccounting.allTypes')}</option>
          {Object.entries(ACCOUNTING_ENTRY_TYPE_LABELS).map(([k, l]) => <option key={k} value={k}>{l}</option>)}
        </select>
        <div className="role-pick">
          {[{ key: '', label: tr('adminCommon.allF') }, ...ENTRY_STATUSES.map((s) => ({ key: s, label: statusLabels[s] }))].map((f) => (
            <div key={f.key || 'all'} className={`chip${status === f.key ? ' active' : ''}`} onClick={() => setStatus(f.key)}>{f.label}</div>
          ))}
        </div>
        <span className="spacer" />
        <button type="button" className="btn-outline" onClick={exportCsv}>{tr('adminCommon.csv')}</button>
        <button type="button" className="btn-outline" onClick={exportFull} title={tr('adminAccounting.exportFullHelp')}>{tr('adminAccounting.exportFull')}</button>
        <button type="button" className="btn-teal" onClick={() => setShowNew(true)}>{tr('adminAccounting.newEntry')}</button>
      </div>
      <LoadState state={state} skeleton={4}>
        {(data) => (
          <>
            {rows.length === 0 && <div className="empty">{tr('adminAccounting.noEntries')}</div>}
            {rows.length > 0 && (
              <div className="fin-table-wrap">
                <AdminDataTable rows={rows} columns={columns} sort={sort} onSort={toggle} showTotals format={{ debit: money, credit: money }}
                  onRowClick={(r) => setOpenGroup(r._group)}
                  groupBy={{ get: (r) => `${r.reference} · ${fmtDate(r.date)} ${r._group?.balanced ? '✅' : '⚠️'}` }}
                  emptyLabel={tr('adminAccounting.noEntries')} />
              </div>
            )}
            <Pagination page={page} total={data.total} pageSize={PAGE_SIZE} onPage={setPage} countLabel={tr('adminAccounting.entriesCount', { n: data.total })} />
          </>
        )}
      </LoadState>
      {openGroup && <EntryGroupDrawer group={openGroup} token={token} toast={toast} onClose={() => setOpenGroup(null)} onChanged={() => { setOpenGroup(null); state.reload(); }} />}
      {showNew && <NewEntryDrawer token={token} toast={toast} onClose={() => { setShowNew(false); if (searchParams.get('new')) go('journal'); }} onCreated={() => { setShowNew(false); if (searchParams.get('new')) go('journal'); state.reload(); }} />}
    </>
  );
}

// Fiche d'une écriture (groupe de lignes) : lignes, totaux, liens vers commande / restaurant / livreur,
// et actions : extourner, changer le statut, supprimer (écritures manuelles uniquement).
function EntryGroupDrawer({ group, token, toast, onClose, onChanged }) {
  const { t: tr } = useLanguage();
  const [lines, setLines] = useState(group.lines);
  const [busy, setBusy] = useState(false);
  const [confirm, setConfirm] = useState(null); // 'reverse' | 'delete'
  const statusLabels = entryStatusLabels(tr);

  // Les lignes de la page suffisent à afficher la fiche ; on tente ensuite de recharger le groupe
  // complet (une écriture à cheval sur deux pages serait sinon tronquée).
  useEffect(() => {
    let cancelled = false;
    api(`/admin/accounting/entries/group/${encodeURIComponent(group.key)}`, { token }).then((r) => {
      const fresh = Array.isArray(r) ? r : r?.lines;
      if (!cancelled && Array.isArray(fresh) && fresh.length) setLines(fresh);
    }).catch(() => { /* on garde les lignes déjà chargées */ });
    return () => { cancelled = true; };
  }, [group.key, token]);

  const totalDebit = +lines.reduce((a, l) => a + Number(l.debit || 0), 0).toFixed(2);
  const totalCredit = +lines.reduce((a, l) => a + Number(l.credit || 0), 0).toFixed(2);
  const balanced = Math.abs(totalDebit - totalCredit) < 0.01;
  const manual = lines.every((l) => l.entryType === 'manual');
  const first = lines[0] || {};
  const status = lines.every((l) => l.status === first.status) ? first.status : 'posted';

  async function setStatus(next) {
    setBusy(true);
    try {
      await Promise.all(lines.map((l) => api(`/admin/accounting/entries/${l.id}/status`, { method: 'PATCH', token, body: { status: next } })));
      toast(tr('adminCommon.toastStatusUpdated'));
      onChanged();
    } catch (e) { toast(e.message); } finally { setBusy(false); }
  }
  async function reverse() {
    setBusy(true);
    try {
      await api(`/admin/accounting/entries/group/${encodeURIComponent(group.key)}/reverse`, { method: 'POST', token, body: { entryDate: todayIso() } });
      toast(tr('adminAccounting.toastReversed'));
      onChanged();
    } catch (e) { toast(e.message); } finally { setBusy(false); setConfirm(null); }
  }
  async function remove() {
    setBusy(true);
    try {
      await api(`/admin/accounting/entries/group/${encodeURIComponent(group.key)}`, { method: 'DELETE', token });
      toast(tr('adminAccounting.toastDeleted'));
      onChanged();
    } catch (e) { toast(e.message); } finally { setBusy(false); setConfirm(null); }
  }

  return createPortal(
    <>
      <RecordDrawer title={group.reference} subtitle={`${fmtDateTime(group.date)} · ${ACCOUNTING_ENTRY_TYPE_LABELS[first.entryType] || first.entryType || ''}`} onClose={onClose}
        badge={<span className="pill" style={{ color: balanced ? 'var(--teal-deep)' : 'var(--red)' }}>{balanced ? tr('adminAccounting.balanced') : tr('adminAccounting.unbalanced')}</span>}
        footer={
          <>
            <button type="button" className="btn-outline" disabled={busy} onClick={() => setConfirm('reverse')}>{tr('adminAccounting.reverse')}</button>
            {status !== 'reconciled' && <button type="button" className="btn-outline" disabled={busy} onClick={() => setStatus('reconciled')}>{tr('adminAccounting.markReconciled')}</button>}
            {status !== 'flagged' && <button type="button" className="btn-outline" disabled={busy} onClick={() => setStatus('flagged')}>{tr('adminAccounting.markFlagged')}</button>}
            {status !== 'posted' && <button type="button" className="btn-ghost" disabled={busy} onClick={() => setStatus('posted')}>{tr('adminAccounting.markPosted')}</button>}
            {manual && <button type="button" className="btn-danger-ghost" disabled={busy} onClick={() => setConfirm('delete')}>{tr('adminCommon.delete')}</button>}
          </>
        }>
        {first.memo && <p className="small" style={{ margin: '0 0 8px' }}>{first.memo}</p>}
        <DrawerRow label={tr('adminCommon.status')} value={<StatusPill status={status} labels={statusLabels} />} />
        {first.orderId && <DrawerRow label={tr('adminAccounting.order')} value={<OrderLink id={first.orderId} />} />}
        {(first.restaurantName || first.restaurantId) && <DrawerRow label={tr('adminCommon.restaurant')} value={<RestaurantLink id={first.restaurantId} name={first.restaurantName} />} />}
        {(first.driverName || first.driverId) && <DrawerRow label={tr('adminCommon.driver')} value={<DriverLink id={first.driverId} name={first.driverName} />} />}
        {first.clientName && <DrawerRow label={tr('adminCommon.client')} value={first.clientName} />}
        <div className="fin-drawer-section">{tr('adminAccounting.lines')}</div>
        <div className="fin-drawer-lines">
          {lines.map((l) => (
            <div key={l.id} className="fin-drawer-line">
              <span><span className="fin-mono" style={{ opacity: 0.7 }}>{l.accountCode}</span> {l.accountName}<br /><span className="small" style={{ opacity: 0.6 }}>{ACCOUNTING_ENTRY_TYPE_LABELS[l.entryType] || l.entryType}{l.vatAmount > 0 ? ` · ${tr('adminCommon.vat')} ${money(l.vatAmount)}` : ''}</span></span>
              <span className="amt">{l.debit > 0 ? money(l.debit) : ''}</span>
              <span className="amt fin-credit">{l.credit > 0 ? money(l.credit) : ''}</span>
            </div>
          ))}
          <div className="fin-drawer-total"><span>{tr('adminCommon.total')}</span><span>{money(totalDebit)} / <span className="fin-credit">{money(totalCredit)}</span></span></div>
        </div>
        {!balanced && <p className="small" style={{ color: 'var(--red)', marginTop: 8 }}>{tr('adminAccounting.gapLineShort', { amount: money(Math.abs(totalDebit - totalCredit)) })}</p>}
      </RecordDrawer>
      <ConfirmDialog open={confirm === 'reverse'} title={tr('adminAccounting.confirmReverse')} message={tr('adminAccounting.confirmReverseBody')} loading={busy} onConfirm={reverse} onCancel={() => setConfirm(null)} confirmLabel={tr('adminAccounting.reverse')} />
      <ConfirmDialog open={confirm === 'delete'} title={tr('adminAccounting.confirmDelete')} message={tr('adminCommon.irreversible')} danger loading={busy} onConfirm={remove} onCancel={() => setConfirm(null)} confirmLabel={tr('adminCommon.delete')} />
    </>,
    document.body
  );
}

function emptyLine() { return { accountCode: '', debit: '', credit: '', vatAmount: '' }; }

// Saisie d'une écriture manuelle : date, libellé, lignes compte / débit / crédit / TVA, contrôle
// d'équilibre en direct, envoi bloqué tant que débit ≠ crédit.
function NewEntryDrawer({ token, toast, onClose, onCreated }) {
  const { t: tr } = useLanguage();
  const accounts = useApiData(() => api('/admin/accounting/accounts', { token }), []);
  const [entryDate, setEntryDate] = useState(todayIso());
  const [reference, setReference] = useState('');
  const [memo, setMemo] = useState('');
  const [lines, setLines] = useState([emptyLine(), emptyLine()]);
  const [busy, setBusy] = useState(false);

  const totalDebit = +lines.reduce((a, l) => a + toNumber(l.debit), 0).toFixed(2);
  const totalCredit = +lines.reduce((a, l) => a + toNumber(l.credit), 0).toFixed(2);
  const filled = lines.filter((l) => l.accountCode && (toNumber(l.debit) > 0 || toNumber(l.credit) > 0));
  const balanced = filled.length >= 2 && Math.abs(totalDebit - totalCredit) < 0.005 && totalDebit > 0;
  const canSubmit = balanced && memo.trim() && entryDate && !busy;

  function update(i, patch) { setLines((ls) => ls.map((l, j) => (j === i ? { ...l, ...patch } : l))); }
  function remove(i) { setLines((ls) => (ls.length > 2 ? ls.filter((_, j) => j !== i) : ls)); }

  async function submit() {
    if (!canSubmit) return;
    setBusy(true);
    try {
      await api('/admin/accounting/entries', { method: 'POST', token, body: {
        entryDate, reference: reference.trim() || undefined, memo: memo.trim(),
        lines: filled.map((l) => ({ accountCode: l.accountCode, debit: toNumber(l.debit), credit: toNumber(l.credit), vatAmount: toNumber(l.vatAmount) || undefined }))
      } });
      toast(tr('adminAccounting.toastEntryCreated'));
      onCreated();
    } catch (e) { toast(e.message); } finally { setBusy(false); }
  }

  const sorted = sortAccounts(accounts.data);

  return createPortal(
    <RecordDrawer title={tr('adminAccounting.newEntryTitle')} subtitle={tr('adminAccounting.newEntryHelp')} onClose={onClose} width={720}
      footer={
        <>
          <button type="button" className="btn-teal" disabled={!canSubmit} onClick={submit}>{busy ? '...' : tr('adminAccounting.postEntry')}</button>
          <button type="button" className="btn-ghost" onClick={onClose}>{tr('adminCommon.cancel')}</button>
        </>
      }>
      {accounts.error && !accounts.data && <ErrorState error={accounts.error} onRetry={accounts.reload} />}
      <div className="fin-form-grid">
        <div className="field"><label>{tr('adminCommon.date')}</label><input type="date" value={entryDate} onChange={(e) => setEntryDate(e.target.value)} /></div>
        <div className="field"><label>{tr('adminAccounting.reference')}</label><input value={reference} onChange={(e) => setReference(e.target.value)} placeholder={tr('adminAccounting.phReference')} /></div>
        <div className="field wide"><label>{tr('adminAccounting.memo')}</label><input value={memo} onChange={(e) => setMemo(e.target.value)} placeholder={tr('adminAccounting.phMemo')} /></div>
      </div>
      <div className="fin-drawer-section">{tr('adminAccounting.lines')}</div>
      <div className="fin-lines">
        <div className="fin-line fin-line-head"><span>{tr('adminAccounting.account')}</span><span>{tr('adminAccounting.debit')}</span><span>{tr('adminAccounting.credit')}</span><span>{tr('adminCommon.vat')}</span><span /></div>
        {lines.map((l, i) => (
          <div key={i} className="fin-line">
            <select value={l.accountCode} onChange={(e) => update(i, { accountCode: e.target.value })} aria-label={tr('adminAccounting.account')}>
              <option value="">{tr('adminCommon.choose')}</option>
              {sorted.map((a) => <option key={a.code} value={a.code}>{a.code} · {a.name}</option>)}
            </select>
            <input type="number" min="0" step="0.01" inputMode="decimal" placeholder="0.00" value={l.debit} onChange={(e) => update(i, { debit: e.target.value, credit: e.target.value ? '' : l.credit })} aria-label={tr('adminAccounting.debit')} />
            <input type="number" min="0" step="0.01" inputMode="decimal" placeholder="0.00" value={l.credit} onChange={(e) => update(i, { credit: e.target.value, debit: e.target.value ? '' : l.debit })} aria-label={tr('adminAccounting.credit')} />
            <input type="number" min="0" step="0.01" inputMode="decimal" placeholder="0.00" value={l.vatAmount} onChange={(e) => update(i, { vatAmount: e.target.value })} aria-label={tr('adminCommon.vat')} />
            <button type="button" className="fin-line-remove" onClick={() => remove(i)} disabled={lines.length <= 2} aria-label={tr('adminAccounting.removeLine')} title={tr('adminAccounting.removeLine')}>✕</button>
          </div>
        ))}
      </div>
      <button type="button" className="btn-ghost" style={{ marginTop: 8 }} onClick={() => setLines((ls) => [...ls, emptyLine()])}>{tr('adminAccounting.addLine')}</button>
      <div className={`fin-balance ${balanced ? 'ok' : 'ko'}`}>
        <span>{tr('adminAccounting.debit')} <b>{money(totalDebit)}</b> · {tr('adminAccounting.credit')} <b>{money(totalCredit)}</b></span>
        <b>{balanced ? tr('adminAccounting.balanced') : tr('adminAccounting.gapLineShort', { amount: money(Math.abs(totalDebit - totalCredit)) })}</b>
      </div>
      {!memo.trim() && <p className="small" style={{ marginTop: 8, opacity: 0.7 }}>{tr('adminAccounting.memoRequired')}</p>}
    </RecordDrawer>,
    document.body
  );
}
