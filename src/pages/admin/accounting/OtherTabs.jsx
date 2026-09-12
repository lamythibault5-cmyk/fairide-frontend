import { useState } from 'react';
import { api } from '../../../api';
import ConfirmDialog from '../../../components/ConfirmDialog';
import { useLanguage } from '../../../context/LanguageContext';
import { money, fmtDate, fmtDateTime, downloadCsv } from '../adminUtils';
import { useApiData, LoadState, ErrorState, ReasonDialog, RestaurantLink, DriverLink, OrderLink } from './common';

// Rapprochement (paiements Stripe ↔ commandes ↔ remboursements ↔ virements), clôture des périodes
// (verrouillage mois par mois) et plan comptable.

const reconciliationLabels = (tr) => ({ rapproche: tr('adminCommon.reconciledOne'), non_rapproche: tr('adminCommon.notReconciledOne'), problematique: tr('adminCommon.problematicOne') });

// Comparaison en direct avec l'API Stripe : solde du compte 5500-STRIPE dans les livres vs solde
// Stripe réel, sur toute la vie du compte.
export function StripeBalanceCard({ token }) {
  const { t: tr } = useLanguage();
  const state = useApiData(() => api('/admin/accounting/stripe-balance', { token }), []);
  const data = state.data;
  return (
    <div className="card" style={{ borderLeft: `3px solid ${!data ? 'var(--line)' : data.matched ? 'var(--teal-deep)' : 'var(--red)'}` }}>
      <div className="row" style={{ justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: 8 }}>
        <b>{state.error && !data ? tr('adminAccounting.stripeUnavailable') : !data ? tr('adminAccounting.stripeChecking') : data.matched ? tr('adminAccounting.stripeMatches') : tr('adminAccounting.stripeMismatch')}</b>
        <button type="button" className="btn-ghost" disabled={state.loading} onClick={state.reload}>{state.loading ? '...' : tr('adminAccounting.recheck')}</button>
      </div>
      {state.error && !data && <p className="small" style={{ margin: '6px 0 0', color: 'var(--red)' }}>{state.error}</p>}
      {data && (
        <>
          <div className="row" style={{ gap: 16, marginTop: 6, flexWrap: 'wrap' }}>
            <span className="small">{tr('adminAccounting.booksStripe')} <b>{money(data.booksBalance)}</b></span>
            <span className="small">{tr('adminAccounting.stripeAvailable')} <b>{money(data.stripeAvailable)}</b></span>
            <span className="small">{tr('adminAccounting.stripePending')} <b>{money(data.stripePending)}</b></span>
          </div>
          {!data.matched && <p className="small" style={{ margin: '6px 0 0', color: 'var(--red)' }}>{tr('adminAccounting.stripeGapLine', { amount: money(Math.abs(data.delta)), direction: data.delta > 0 ? tr('adminAccounting.booksMore') : tr('adminAccounting.stripeMore'), time: fmtDateTime(data.checkedAt) })}</p>}
        </>
      )}
    </div>
  );
}

export function ReconciliationTab({ token, toast, periodKey }) {
  const { t: tr } = useLanguage();
  const [filter, setFilter] = useState('non_rapproche');
  const state = useApiData(() => api(`/admin/accounting/reconciliation?${periodKey}`, { token }), [periodKey]);
  const labels = reconciliationLabels(tr);

  function exportCsv() {
    const d = state.data;
    if (!d || !d.rows.length) { toast(tr('adminCommon.nothingToExport')); return; }
    downloadCsv(`rapprochement-${Date.now()}.csv`, d.rows, [
      { label: tr('adminAccounting.order'), get: (r) => r.id }, { label: tr('adminCommon.restaurant'), get: (r) => r.restaurantName }, { label: tr('adminCommon.driver'), get: (r) => r.driverName || '' },
      { label: tr('adminCommon.total'), get: (r) => r.total }, { label: tr('adminAccounting.state'), get: (r) => labels[r.state] || r.state }, { label: tr('adminAccounting.problems'), get: (r) => r.issues.join(' | ') }, { label: tr('adminCommon.date'), get: (r) => fmtDate(r.paidAt) }
    ]);
  }

  return (
    <>
      <StripeBalanceCard token={token} />
      <LoadState state={state} skeleton={3}>
        {(data) => {
          const rows = data.rows.filter((r) => !filter || r.state === filter);
          return (
            <>
              <div className="stat-grid">
                <div className="stat-card"><div className="num">{data.counts.rapproche}</div><div className="label">{tr('adminCommon.reconciled')}</div></div>
                <div className="stat-card"><div className="num" style={{ color: 'var(--gold-deep)' }}>{data.counts.non_rapproche}</div><div className="label">{tr('adminCommon.notReconciled')}</div></div>
                <div className="stat-card"><div className="num" style={{ color: 'var(--red)' }}>{data.counts.problematique}</div><div className="label">{tr('adminCommon.problematic')}</div></div>
              </div>
              <div className="fin-toolbar">
                <div className="role-pick">
                  {[{ key: '', label: tr('adminCommon.allF') }, { key: 'non_rapproche', label: tr('adminCommon.notReconciled') }, { key: 'problematique', label: tr('adminCommon.problematic') }, { key: 'rapproche', label: tr('adminCommon.reconciledF') }].map((f) => (
                    <div key={f.key || 'all'} className={`chip${filter === f.key ? ' active' : ''}`} onClick={() => setFilter(f.key)}>{f.label}</div>
                  ))}
                </div>
                <span className="spacer" />
                <button type="button" className="btn-outline" onClick={exportCsv}>{tr('adminCommon.csv')}</button>
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
    </>
  );
}

// Clôture : grille des 12 mois d'une année, verrouillage / déverrouillage (avec motif). Un mois
// verrouillé n'accepte plus d'écriture, même automatique : c'est le serveur qui refuse.
export function ClosingTab({ token, toast, period }) {
  const { t: tr, locale } = useLanguage();
  const [year, setYear] = useState(Number(period.year) || new Date().getFullYear());
  const state = useApiData(() => api(`/admin/accounting/periods?year=${year}`, { token }), [year]);
  const [confirm, setConfirm] = useState(null); // { kind: 'lock'|'unlock', month }
  const [busy, setBusy] = useState(false);
  const now = new Date();
  const years = []; for (let y = now.getFullYear() + 1; y >= now.getFullYear() - 6; y--) years.push(y);

  async function lock(month) {
    setBusy(true);
    try { await api('/admin/accounting/periods/lock', { method: 'POST', token, body: { year, month } }); toast(tr('adminAccounting.toastLocked')); state.reload(); }
    catch (e) { toast(e.message); } finally { setBusy(false); setConfirm(null); }
  }
  async function unlock(month, reason) {
    setBusy(true);
    try { await api('/admin/accounting/periods/unlock', { method: 'POST', token, body: { year, month, reason } }); toast(tr('adminAccounting.toastUnlocked')); state.reload(); }
    catch (e) { toast(e.message); } finally { setBusy(false); setConfirm(null); }
  }

  const list = Array.isArray(state.data) ? state.data : state.data?.months || state.data?.items || [];
  const byMonth = new Map(list.map((p) => [Number(p.month), p]));
  const nextToLock = list.filter((p) => p.status !== 'locked' && !p.isCurrent && new Date(year, Number(p.month), 1) <= now).sort((a, b) => a.month - b.month)[0];

  return (
    <>
      <div className="fin-toolbar">
        <select value={year} onChange={(e) => setYear(Number(e.target.value))} aria-label={tr('adminCommon.year')}>{years.map((y) => <option key={y} value={y}>{y}</option>)}</select>
        <span className="small" style={{ opacity: 0.7 }}>{tr('adminAccounting.closingHelp')}</span>
        <span className="spacer" />
        {nextToLock && <button type="button" className="btn-teal" onClick={() => setConfirm({ kind: 'lock', month: Number(nextToLock.month) })}>{tr('adminAccounting.lockMonth', { month: new Date(year, Number(nextToLock.month) - 1, 1).toLocaleDateString(locale, { month: 'long' }) })}</button>}
      </div>
      {state.error && !state.data && <ErrorState error={state.error} onRetry={state.reload} />}
      {!state.data && !state.error && <div className="skeleton skeleton-card" style={{ minHeight: 200 }} />}
      {state.data && (
        <div className="fin-months">
          {Array.from({ length: 12 }, (_, i) => i + 1).map((m) => {
            const p = byMonth.get(m) || { month: m, status: 'open', entryCount: 0 };
            const locked = p.status === 'locked';
            const date = new Date(year, m - 1, 1);
            const isCurrent = p.isCurrent || (date.getFullYear() === now.getFullYear() && date.getMonth() === now.getMonth());
            const future = date > now;
            const behind = !locked && !isCurrent && !future;
            return (
              <div key={m} className={`fin-month${locked ? ' locked' : ''}${isCurrent ? ' current' : ''}${behind ? ' behind' : ''}`}>
                <div className="row" style={{ justifyContent: 'space-between', alignItems: 'center' }}>
                  <span className="fin-month-name">{date.toLocaleDateString(locale, { month: 'long' })}</span>
                  <span className={`pill fin-status ${locked ? 'locked' : 'open'}`}>{locked ? tr('adminAccounting.periodLocked') : isCurrent ? tr('adminAccounting.periodCurrent') : future ? tr('adminAccounting.periodFuture') : tr('adminAccounting.periodOpen')}</span>
                </div>
                <span className="fin-month-meta">{tr('adminAccounting.entriesCount', { n: p.entryCount || 0 })}</span>
                {locked && p.lockedAt && <span className="fin-month-meta">{tr('adminAccounting.lockedOn', { date: fmtDate(p.lockedAt), by: p.lockedBy || '-' })}</span>}
                {locked
                  ? <button type="button" className="btn-danger-ghost" disabled={busy} onClick={() => setConfirm({ kind: 'unlock', month: m })}>{tr('adminAccounting.unlock')}</button>
                  : !future && <button type="button" className={behind ? 'btn-teal' : 'btn-outline'} disabled={busy} onClick={() => setConfirm({ kind: 'lock', month: m })}>{tr('adminAccounting.lock')}</button>}
              </div>
            );
          })}
        </div>
      )}
      <ConfirmDialog open={confirm?.kind === 'lock'} title={tr('adminAccounting.confirmLock', { month: confirm ? new Date(year, confirm.month - 1, 1).toLocaleDateString(locale, { month: 'long', year: 'numeric' }) : '' })} message={tr('adminAccounting.confirmLockBody')} loading={busy} onConfirm={() => lock(confirm.month)} onCancel={() => setConfirm(null)} confirmLabel={tr('adminAccounting.lock')} />
      <ReasonDialog open={confirm?.kind === 'unlock'} title={tr('adminAccounting.confirmUnlock', { month: confirm ? new Date(year, confirm.month - 1, 1).toLocaleDateString(locale, { month: 'long', year: 'numeric' }) : '' })} message={tr('adminAccounting.confirmUnlockBody')} placeholder={tr('adminAccounting.phUnlockReason')} danger loading={busy} onConfirm={(reason) => unlock(confirm.month, reason)} onCancel={() => setConfirm(null)} confirmLabel={tr('adminAccounting.unlock')} />
    </>
  );
}

const ACCOUNT_KINDS = ['asset', 'liability', 'vat', 'revenue', 'expense'];
const accountKindLabels = (tr) => ({ revenue: tr('adminAccounting.kind_revenue'), expense: tr('adminAccounting.kind_expense'), asset: tr('adminAccounting.kind_asset'), liability: tr('adminAccounting.kind_liability'), vat: tr('adminAccounting.kind_vat') });

export function ChartOfAccountsTab({ token, toast }) {
  const { t: tr } = useLanguage();
  const state = useApiData(() => api('/admin/accounting/accounts', { token }), []);
  const [newCode, setNewCode] = useState('');
  const [newName, setNewName] = useState('');
  const [newKind, setNewKind] = useState('revenue');
  const [creating, setCreating] = useState(false);
  const kinds = accountKindLabels(tr);

  async function createAccount() {
    if (!newCode.trim() || !newName.trim()) { toast(tr('adminAccounting.toastCodeName')); return; }
    setCreating(true);
    try {
      await api('/admin/accounting/accounts', { method: 'POST', token, body: { code: newCode.trim(), name: newName.trim(), kind: newKind } });
      setNewCode(''); setNewName('');
      toast(tr('adminAccounting.toastAccountCreated'));
      state.reload();
    } catch (e) { toast(e.message); } finally { setCreating(false); }
  }
  async function toggleActive(a) {
    try { await api(`/admin/accounting/accounts/${a.id}`, { method: 'PATCH', token, body: { active: !a.active } }); state.reload(); } catch (e) { toast(e.message); }
  }

  return (
    <>
      <div className="card">
        <h3 style={{ margin: '0 0 10px', fontSize: 15 }}>{tr('adminAccounting.addAccount')}</h3>
        <p className="small" style={{ margin: '0 0 10px', opacity: 0.7 }}>{tr('adminAccounting.chartExtensible')}</p>
        <div className="row" style={{ gap: 8, flexWrap: 'wrap' }}>
          <input placeholder={tr('adminAccounting.phCode')} value={newCode} onChange={(e) => setNewCode(e.target.value)} style={{ maxWidth: 160 }} />
          <input placeholder={tr('adminCommon.name')} value={newName} onChange={(e) => setNewName(e.target.value)} style={{ flex: 1, minWidth: 160 }} />
          <select value={newKind} onChange={(e) => setNewKind(e.target.value)} style={{ maxWidth: 140 }}>{ACCOUNT_KINDS.map((k) => <option key={k} value={k}>{kinds[k]}</option>)}</select>
          <button type="button" className="btn-teal" disabled={creating} onClick={createAccount}>{creating ? '...' : tr('adminCommon.create')}</button>
        </div>
      </div>
      <LoadState state={state} skeleton={3}>
        {(accounts) => (
          <div className="fin-table-wrap"><div className="table-scroll">
            <table className="admin-table">
              <thead><tr><th>{tr('adminCommon.code')}</th><th>{tr('adminCommon.name')}</th><th>{tr('adminCommon.type')}</th><th /></tr></thead>
              <tbody>
                {[...accounts].sort((a, b) => ACCOUNT_KINDS.indexOf(a.kind) - ACCOUNT_KINDS.indexOf(b.kind) || a.code.localeCompare(b.code)).map((a) => (
                  <tr key={a.id} style={{ opacity: a.active ? 1 : 0.5 }}>
                    <td className="fin-mono"><b>{a.code}</b></td>
                    <td>{a.name}</td>
                    <td><span className="pill">{kinds[a.kind] || a.kind}</span></td>
                    <td className="fin-num"><button type="button" className={a.active ? 'btn-danger-ghost' : 'btn-outline'} style={{ padding: '4px 10px', fontSize: 12 }} onClick={() => toggleActive(a)}>{a.active ? tr('adminCommon.disable') : tr('adminCommon.enable')}</button></td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div></div>
        )}
      </LoadState>
    </>
  );
}
