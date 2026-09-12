import { useState } from 'react';
import { api } from '../../../api';
import { periodRange } from '../../../components/admin/PeriodPicker';
import { useLanguage } from '../../../context/LanguageContext';
import { money, pct, fmtDate, downloadCsv, downloadPdf } from '../adminUtils';
import { useApiData, LoadState, SignedMoney, DeltaBadge } from './common';

// États financiers : compte de résultat (produits / charges), bilan (actif / passif) et déclaration
// TVA par grille. Tous calculés côté serveur depuis les écritures réellement comptabilisées.

function Statement({ title, lines, total, totalLabel, tone }) {
  return (
    <div className="fin-statement">
      <div className="fin-statement-head"><span>{title}</span><span>{money(total)}</span></div>
      {lines.length === 0 && <div className="fin-statement-line" style={{ opacity: 0.6 }}><span>-</span><span /></div>}
      {lines.map((l) => (
        <div key={l.code} className="fin-statement-line"><span><span className="code">{l.code}</span>{l.name}</span><span className={tone}>{money(l.amount)}</span></div>
      ))}
      <div className="fin-statement-total"><span>{totalLabel}</span><span>{money(total)}</span></div>
    </div>
  );
}

export function IncomeStatementTab({ token, toast, periodKey }) {
  const { t: tr } = useLanguage();
  const state = useApiData(() => api(`/admin/accounting/income-statement?${periodKey}`, { token }), [periodKey]);

  function exportCsv() {
    const d = state.data;
    if (!d) { toast(tr('adminCommon.nothingToExport')); return; }
    const rows = [...(d.revenue || []).map((l) => ({ ...l, kind: tr('adminAccounting.revenues') })), ...(d.expenses || []).map((l) => ({ ...l, kind: tr('adminAccounting.expenses') }))];
    downloadCsv(`compte-de-resultat-${Date.now()}.csv`, rows, [
      { label: tr('adminCommon.type'), get: (r) => r.kind }, { label: tr('adminCommon.code'), get: (r) => r.code }, { label: tr('adminCommon.name'), get: (r) => r.name }, { label: tr('adminCommon.amount'), get: (r) => r.amount }
    ]);
  }

  return (
    <LoadState state={state} skeleton={3}>
      {(d) => (
        <>
          <div className={`card fin-result${Number(d.result) < 0 ? ' negative' : ''}`}>
            <div className="row" style={{ justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: 8 }}>
              <div>
                <b>{tr('adminAccounting.resultOfPeriod')}</b>
                <div className="small" style={{ opacity: 0.7 }}>{tr('adminAccounting.resultFormula')}</div>
              </div>
              <div style={{ textAlign: 'right' }}>
                <div style={{ fontSize: 22, fontWeight: 700 }}><SignedMoney value={d.result} strong /></div>
                <div className="small">{tr('adminAccounting.previousPeriod')} : {money(d.previous?.result || 0)} <DeltaBadge current={d.result} previous={d.previous?.result} /></div>
              </div>
            </div>
          </div>
          <div className="stat-grid">
            <div className="stat-card"><div className="num">{money(d.totalRevenue)}</div><div className="label">{tr('adminAccounting.revenues')} <DeltaBadge current={d.totalRevenue} previous={d.previous?.totalRevenue} /></div></div>
            <div className="stat-card"><div className="num">{money(d.totalExpenses)}</div><div className="label">{tr('adminAccounting.expenses')} <DeltaBadge current={d.totalExpenses} previous={d.previous?.totalExpenses} /></div></div>
            <div className="stat-card"><div className="num">{money(d.vatCollected)}</div><div className="label">{tr('adminAccounting.vatCollected')}</div></div>
            <div className="stat-card"><div className="num">{money(d.vatDeductible)}</div><div className="label">{tr('adminAccounting.vatDeductible')}</div></div>
            <div className="stat-card highlight"><div className="num">{money(d.vatNet)}</div><div className="label">{tr('adminAccounting.kpiVatNet')}</div></div>
          </div>
          <div className="fin-toolbar"><span className="spacer" /><button type="button" className="btn-outline" onClick={exportCsv}>{tr('adminCommon.csv')}</button></div>
          <div className="fin-two-col">
            <Statement title={tr('adminAccounting.revenues')} lines={d.revenue || []} total={d.totalRevenue} totalLabel={tr('adminAccounting.totalRevenues')} tone="fin-credit" />
            <Statement title={tr('adminAccounting.expenses')} lines={d.expenses || []} total={d.totalExpenses} totalLabel={tr('adminAccounting.totalExpensesLabel')} tone="fin-debit" />
          </div>
        </>
      )}
    </LoadState>
  );
}

export function BalanceSheetTab({ token, toast, period }) {
  const { t: tr } = useLanguage();
  const r = periodRange(period);
  const end = new Date(r.end.getTime() - 1);
  const defaultAsOf = `${end.getFullYear()}-${String(end.getMonth() + 1).padStart(2, '0')}-${String(end.getDate()).padStart(2, '0')}`;
  const [asOf, setAsOf] = useState(defaultAsOf);
  const state = useApiData(() => api(`/admin/accounting/balance-sheet?asOf=${asOf}`, { token }), [asOf]);

  function exportCsv() {
    const d = state.data;
    if (!d) { toast(tr('adminCommon.nothingToExport')); return; }
    const rows = [...(d.assets || []).map((l) => ({ ...l, side: tr('adminAccounting.assets') })), ...(d.liabilities || []).map((l) => ({ ...l, side: tr('adminAccounting.liabilities') }))];
    downloadCsv(`bilan-${asOf}.csv`, rows, [
      { label: tr('adminAccounting.side'), get: (x) => x.side }, { label: tr('adminCommon.code'), get: (x) => x.code }, { label: tr('adminCommon.name'), get: (x) => x.name }, { label: tr('adminCommon.amount'), get: (x) => x.amount }
    ]);
  }

  return (
    <>
      <div className="fin-toolbar">
        <label className="small admin-inline-field">{tr('adminAccounting.asOf')} <input type="date" value={asOf} onChange={(e) => e.target.value && setAsOf(e.target.value)} /></label>
        <button type="button" className="btn-ghost" onClick={() => setAsOf(defaultAsOf)}>{tr('adminAccounting.endOfPeriod')}</button>
        <span className="spacer" />
        <button type="button" className="btn-outline" onClick={exportCsv}>{tr('adminCommon.csv')}</button>
      </div>
      <LoadState state={state} skeleton={3}>
        {(d) => {
          const equity = Number(d.equity?.resultToDate || 0);
          return (
            <>
              <div className="card" style={{ borderLeft: `3px solid ${d.balanced ? 'var(--teal-deep)' : 'var(--red)'}` }}>
                <div className="row" style={{ justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: 8 }}>
                  <b>{d.balanced ? tr('adminAccounting.sheetBalanced') : tr('adminAccounting.sheetUnbalanced')}</b>
                  <span className="small">{tr('adminAccounting.sheetTotals', { assets: money(d.totalAssets), liabilities: money(d.totalLiabilities), date: fmtDate(asOf) })}</span>
                </div>
                {!d.balanced && <p className="small" style={{ margin: '6px 0 0', color: 'var(--red)' }}>{tr('adminAccounting.sheetGap', { amount: money(Math.abs(Number(d.totalAssets) - Number(d.totalLiabilities))) })}</p>}
              </div>
              <div className="fin-two-col">
                <Statement title={tr('adminAccounting.assets')} lines={d.assets || []} total={d.totalAssets} totalLabel={tr('adminAccounting.totalAssets')} tone="fin-debit" />
                <div className="fin-statement">
                  <div className="fin-statement-head"><span>{tr('adminAccounting.liabilities')}</span><span>{money(d.totalLiabilities)}</span></div>
                  {(d.liabilities || []).map((l) => <div key={l.code} className="fin-statement-line"><span><span className="code">{l.code}</span>{l.name}</span><span className="fin-credit">{money(l.amount)}</span></div>)}
                  <div className="fin-statement-line" style={{ background: 'var(--cream-dim)' }}><span><b>{tr('adminAccounting.equityResult')}</b><br /><span className="small" style={{ opacity: 0.7 }}>{tr('adminAccounting.equityHelp')}</span></span><SignedMoney value={equity} strong /></div>
                  <div className="fin-statement-total"><span>{tr('adminAccounting.totalLiabilities')}</span><span>{money(d.totalLiabilities)}</span></div>
                </div>
              </div>
            </>
          );
        }}
      </LoadState>
    </>
  );
}

// Grilles de la déclaration périodique belge (Intervat) produites par le serveur. L'explication de
// chaque grille est là pour qu'un non-comptable comprenne ce qu'il regarde ; les numéros restent à
// faire valider par le comptable sur le formulaire en vigueur.
const GRID_ORDER = ['00', '01', '02', '03', '44', '45', '46', '47', '48', '49', '54', '55', '56', '57', '59', '61', '62', '63', '64', '71', '72', '81', '82', '83', '84', '85', '86', '87', '88'];
const gridExplanations = (tr) => ({ '00': tr('adminAccounting.grid_00'), '01': tr('adminAccounting.grid_01'), '02': tr('adminAccounting.grid_02'), '03': tr('adminAccounting.grid_03'), '49': tr('adminAccounting.grid_49'), '54': tr('adminAccounting.grid_54'), '59': tr('adminAccounting.grid_59'), '71': tr('adminAccounting.grid_71'), '72': tr('adminAccounting.grid_72'), '81': tr('adminAccounting.grid_81'), '82': tr('adminAccounting.grid_82'), '83': tr('adminAccounting.grid_83') });

export function VatTab({ token, toast, periodKey }) {
  const { t: tr } = useLanguage();
  const summary = useApiData(() => api(`/admin/accounting/vat-summary?${periodKey}`, { token }), [periodKey]);
  const detail = useApiData(() => api(`/admin/accounting/vat?${periodKey}`, { token }), [periodKey]);
  const explain = gridExplanations(tr);
  const [busy, setBusy] = useState(false);

  async function downloadXml() {
    setBusy(true);
    try { await downloadPdf(`/admin/accounting/vat-summary/xml?${periodKey}`, token, `declaration-tva-${Date.now()}.xml`); } catch (e) { toast(e.message); } finally { setBusy(false); }
  }
  function exportCsv() {
    const g = summary.data?.grids;
    if (!g) { toast(tr('adminCommon.nothingToExport')); return; }
    const rows = Object.entries(g).map(([code, amount]) => ({ code, amount, label: explain[code] || '' }));
    downloadCsv(`declaration-tva-grilles-${Date.now()}.csv`, rows, [
      { label: tr('adminAccounting.grid'), get: (r) => r.code }, { label: tr('adminAccounting.label'), get: (r) => r.label }, { label: tr('adminCommon.amount'), get: (r) => r.amount }
    ]);
  }

  return (
    <>
      <div className="card" style={{ borderLeft: '3px solid var(--gold-deep)' }}>
        <p className="small" style={{ margin: 0 }}>{tr('adminAccounting.vatDisclaimer')}</p>
      </div>
      <div className="fin-toolbar">
        <span className="spacer" />
        <button type="button" className="btn-outline" onClick={exportCsv}>{tr('adminCommon.csv')}</button>
        <button type="button" className="btn-teal" disabled={busy} onClick={downloadXml}>{busy ? '...' : tr('adminAccounting.downloadXml')}</button>
      </div>
      <LoadState state={summary} skeleton={2}>
        {(d) => {
          const grids = d.grids || {};
          const codes = [...GRID_ORDER.filter((c) => c in grids), ...Object.keys(grids).filter((c) => !GRID_ORDER.includes(c))];
          const due = Number(grids['71'] || 0); const credit = Number(grids['72'] || 0);
          return (
            <>
              <div className="card" style={{ borderLeft: `3px solid ${due > 0 ? 'var(--red)' : 'var(--teal-deep)'}` }}>
                <div className="row" style={{ justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: 8 }}>
                  <b>{due > 0 ? tr('adminAccounting.vatToPay') : tr('adminAccounting.vatToRecover')}</b>
                  <b style={{ fontSize: 20 }}>{money(due > 0 ? due : credit)}</b>
                </div>
                <div className="small" style={{ marginTop: 4, opacity: 0.7 }}>{tr('adminAccounting.vatFormula')}</div>
              </div>
              {codes.length === 0 && <div className="empty">{tr('adminAccounting.noVatOps')}</div>}
              <div className="fin-grid-cards">
                {codes.map((code) => (
                  <div key={code} className="fin-grid-card">
                    <div className="code">{tr('adminAccounting.box', { code })}</div>
                    <div className="amount">{money(grids[code])}</div>
                    <div className="explain">{explain[code] || tr('adminAccounting.grid_other')}</div>
                  </div>
                ))}
              </div>
              {d.details && Array.isArray(d.details) && d.details.length > 0 && (
                <div className="card" style={{ marginTop: 14 }}>
                  <h3 style={{ margin: '0 0 8px', fontSize: 15 }}>{tr('adminAccounting.vatDetails')}</h3>
                  {d.details.map((x, i) => <div key={i} className="row small" style={{ justifyContent: 'space-between', padding: '3px 0' }}><span>{x.label || x.origin || x.entryType}</span><span>{money(x.amount ?? x.vatAmount)}</span></div>)}
                </div>
              )}
            </>
          );
        }}
      </LoadState>
      <div className="card" style={{ marginTop: 14 }}>
        <h3 style={{ margin: '0 0 8px', fontSize: 15 }}>{tr('adminAccounting.vatByOrigin')}</h3>
        <LoadState state={detail} skeleton={1}>
          {(d) => (
            <>
              {d.rows.length === 0 && <div className="small" style={{ opacity: 0.6 }}>{tr('adminAccounting.noVatOps')}</div>}
              {d.rows.map((r, i) => (
                <div key={i} className="row" style={{ justifyContent: 'space-between', padding: '4px 0', borderBottom: '1px dashed var(--line)', flexWrap: 'wrap', gap: 6 }}>
                  <span className="small"><b>{r.origin}</b> · {tr('adminAccounting.effectiveRate', { rate: pct(r.rate, 1) })}</span>
                  <span className="small">{tr('adminAccounting.htVatLine', { ht: money(r.baseHt), vat: money(r.vatAmount) })} · <b>{money(r.totalTtc)}</b></span>
                </div>
              ))}
              {d.rows.length > 0 && <div className="row" style={{ justifyContent: 'space-between', paddingTop: 8, fontWeight: 700 }}><span>{tr('adminCommon.total')}</span><span>{tr('adminAccounting.htVatLine', { ht: money(d.totalHt), vat: money(d.totalVat) })}</span></div>}
            </>
          )}
        </LoadState>
      </div>
    </>
  );
}
