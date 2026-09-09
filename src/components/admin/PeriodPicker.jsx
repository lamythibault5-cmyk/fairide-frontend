import { useCallback, useEffect, useMemo, useState } from 'react';
import { useLanguage } from '../../context/LanguageContext';

// Sélecteur de période unique du groupe Finance (Comptabilité, Finance, Paiements, Factures) :
// Mois / Trimestre / Année / Personnalisé, flèches ‹ › pour passer à la période précédente/suivante,
// libellé lisible (« Septembre 2026 », « T3 2026 », « 2026 »). Le dernier choix est mémorisé dans
// localStorage sous une clé commune, pour retrouver la même période en passant d'une application
// financière à l'autre.
//
// Convention de requête (resolveAccountingPeriod côté backend, accountingPeriod.js) :
//   period=month&month=YYYY-MM | period=quarter&year=YYYY&quarter=N | period=year&year=YYYY |
//   period=custom&from=YYYY-MM-DD&to=YYYY-MM-DD
// Les endpoints qui ne parlent que from/to (Finance, Factures) utilisent periodRange().

const STORAGE_KEY = 'fairide_admin_period';
const DAY_MS = 24 * 60 * 60 * 1000;

function pad2(n) { return String(n).padStart(2, '0'); }
function isoDay(d) { return `${d.getFullYear()}-${pad2(d.getMonth() + 1)}-${pad2(d.getDate())}`; }

export function defaultPeriod() {
  const now = new Date();
  return {
    type: 'month',
    month: `${now.getFullYear()}-${pad2(now.getMonth() + 1)}`,
    quarter: Math.floor(now.getMonth() / 3) + 1,
    year: now.getFullYear(),
    from: isoDay(new Date(now.getFullYear(), now.getMonth(), 1)),
    to: isoDay(now)
  };
}

function lirePeriodeMemorisee(allowAll) {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return null;
    const p = JSON.parse(raw);
    if (!p || typeof p !== 'object') return null;
    if (p.type === 'all' && !allowAll) p.type = 'month';
    return { ...defaultPeriod(), ...p };
  } catch {
    return null;
  }
}

// Fenêtre [start, end) en dates locales. `null` pour « Tout » (aucune borne).
export function periodRange(period) {
  const now = new Date();
  if (!period || period.type === 'all') return null;
  if (period.type === 'custom') {
    const start = period.from ? new Date(period.from) : new Date(now.getFullYear(), now.getMonth(), 1);
    const end = period.to ? new Date(new Date(period.to).getTime() + DAY_MS) : new Date(start.getTime() + DAY_MS);
    return { start, end };
  }
  if (period.type === 'quarter') {
    const y = Number(period.year) || now.getFullYear();
    const q = Number(period.quarter) || 1;
    return { start: new Date(y, (q - 1) * 3, 1), end: new Date(y, q * 3, 1) };
  }
  if (period.type === 'year') {
    const y = Number(period.year) || now.getFullYear();
    return { start: new Date(y, 0, 1), end: new Date(y + 1, 0, 1) };
  }
  const m = /^(\d{4})-(\d{2})$/.exec(period.month || '');
  const y = m ? Number(m[1]) : now.getFullYear();
  const mo = m ? Number(m[2]) : now.getMonth() + 1;
  return { start: new Date(y, mo - 1, 1), end: new Date(y, mo, 1) };
}

// Paramètres de requête selon la convention backend (objet simple, à passer à URLSearchParams).
export function periodParams(period) {
  if (!period || period.type === 'all') return {};
  if (period.type === 'month') return { period: 'month', month: period.month };
  if (period.type === 'quarter') return { period: 'quarter', year: String(period.year), quarter: String(period.quarter) };
  if (period.type === 'year') return { period: 'year', year: String(period.year) };
  const out = { period: 'custom' };
  if (period.from) out.from = period.from;
  if (period.to) out.to = period.to;
  return out;
}

export function periodQueryString(period) {
  return new URLSearchParams(periodParams(period)).toString();
}

// Bornes ISO inclusives pour les endpoints en from/to (Finance, Factures, Dashboard).
export function periodIsoBounds(period) {
  const r = periodRange(period);
  if (!r) return { from: '', to: '' };
  return { from: r.start.toISOString(), to: new Date(r.end.getTime() - 1000).toISOString() };
}

// Période précédente / suivante (delta ±1). Une période personnalisée glisse de sa propre longueur.
export function shiftPeriod(period, delta) {
  if (!period || period.type === 'all') return period;
  if (period.type === 'month') {
    const r = periodRange(period);
    const d = new Date(r.start.getFullYear(), r.start.getMonth() + delta, 1);
    return { ...period, month: `${d.getFullYear()}-${pad2(d.getMonth() + 1)}` };
  }
  if (period.type === 'quarter') {
    let q = Number(period.quarter) + delta; let y = Number(period.year);
    if (q < 1) { q = 4; y -= 1; }
    if (q > 4) { q = 1; y += 1; }
    return { ...period, quarter: q, year: y };
  }
  if (period.type === 'year') return { ...period, year: Number(period.year) + delta };
  const r = periodRange(period);
  const len = Math.max(DAY_MS, r.end.getTime() - r.start.getTime());
  const start = new Date(r.start.getTime() + delta * len);
  const end = new Date(start.getTime() + len - DAY_MS);
  return { ...period, from: isoDay(start), to: isoDay(end) };
}

function majuscule(s) { return s ? s.charAt(0).toUpperCase() + s.slice(1) : s; }

// Libellé lisible de la période, dans la langue de l'admin.
export function periodLabel(period, locale, tr) {
  if (!period || period.type === 'all') return tr('adminPeriod.all');
  if (period.type === 'month') {
    const r = periodRange(period);
    return majuscule(r.start.toLocaleDateString(locale, { month: 'long', year: 'numeric' }));
  }
  if (period.type === 'quarter') return tr('adminPeriod.quarterLabel', { n: period.quarter, year: period.year });
  if (period.type === 'year') return String(period.year);
  const r = periodRange(period);
  const fmt = (d) => d.toLocaleDateString(locale, { day: 'numeric', month: 'short', year: 'numeric' });
  return `${fmt(r.start)} → ${fmt(new Date(r.end.getTime() - DAY_MS))}`;
}

// Hook : état de période partagé + dérivés (query string, bornes, libellé). `allowAll` ajoute le
// choix « Tout » (aucune borne) pour les listes qui s'affichent par défaut sans filtre de date.
export function usePeriod({ allowAll = false, initial } = {}) {
  const [period, setPeriodState] = useState(() => initial || lirePeriodeMemorisee(allowAll) || defaultPeriod());
  const setPeriod = useCallback((next) => {
    setPeriodState((prev) => {
      const value = typeof next === 'function' ? next(prev) : next;
      try { localStorage.setItem(STORAGE_KEY, JSON.stringify(value)); } catch { /* stockage indisponible */ }
      return value;
    });
  }, []);
  const queryString = useMemo(() => periodQueryString(period), [period]);
  const range = useMemo(() => periodRange(period), [period]);
  const bounds = useMemo(() => periodIsoBounds(period), [period]);
  return { period, setPeriod, queryString, range, bounds, params: periodParams(period) };
}

const TYPES = ['month', 'quarter', 'year', 'custom'];

export default function PeriodPicker({ period, onChange, allowAll = false, compact = false }) {
  const { t: tr, locale } = useLanguage();
  const [libre, setLibre] = useState({ from: period.from || '', to: period.to || '' });
  useEffect(() => { setLibre({ from: period.from || '', to: period.to || '' }); }, [period.from, period.to]);

  function setType(type) {
    if (type === period.type) return;
    // En changeant de granularité on reste centré sur la même date : le mois choisi donne son
    // trimestre et son année, et inversement.
    const r = periodRange(period) || { start: new Date() };
    const base = r.start;
    const next = { ...period, type };
    if (type === 'month') next.month = `${base.getFullYear()}-${pad2(base.getMonth() + 1)}`;
    if (type === 'quarter') { next.quarter = Math.floor(base.getMonth() / 3) + 1; next.year = base.getFullYear(); }
    if (type === 'year') next.year = base.getFullYear();
    if (type === 'custom' && period.type !== 'all') {
      const rr = periodRange(period);
      next.from = isoDay(rr.start); next.to = isoDay(new Date(rr.end.getTime() - DAY_MS));
    }
    onChange(next);
  }

  function validerLibre() {
    if (!libre.from) return;
    const to = libre.to && libre.to >= libre.from ? libre.to : libre.from;
    onChange({ ...period, type: 'custom', from: libre.from, to });
  }

  const types = allowAll ? ['all', ...TYPES] : TYPES;
  const labels = { all: tr('adminPeriod.all'), month: tr('adminCommon.month'), quarter: tr('adminCommon.quarter'), year: tr('adminCommon.year'), custom: tr('adminCommon.custom') };
  const now = new Date();
  const years = [];
  for (let y = now.getFullYear() + 1; y >= now.getFullYear() - 6; y--) years.push(y);

  return (
    <div className={`fin-period${compact ? ' compact' : ''}`} role="group" aria-label={tr('adminPeriod.aria')}>
      <div className="role-pick fin-period-types" style={{ margin: 0 }}>
        {types.map((k) => <div key={k} className={`chip${period.type === k ? ' active' : ''}`} onClick={() => setType(k)}>{labels[k]}</div>)}
      </div>
      {period.type !== 'all' && (
        <div className="fin-period-nav">
          <button type="button" className="fin-period-arrow" onClick={() => onChange(shiftPeriod(period, -1))} aria-label={tr('adminPeriod.previous')} title={tr('adminPeriod.previous')}>‹</button>
          <span className="fin-period-label">{periodLabel(period, locale, tr)}</span>
          <button type="button" className="fin-period-arrow" onClick={() => onChange(shiftPeriod(period, 1))} aria-label={tr('adminPeriod.next')} title={tr('adminPeriod.next')}>›</button>
        </div>
      )}
      <div className="fin-period-inputs">
        {period.type === 'month' && <input type="month" value={period.month} onChange={(e) => e.target.value && onChange({ ...period, month: e.target.value })} aria-label={tr('adminCommon.month')} />}
        {period.type === 'quarter' && (
          <>
            <select value={period.quarter} onChange={(e) => onChange({ ...period, quarter: Number(e.target.value) })} aria-label={tr('adminCommon.quarter')}>
              {[1, 2, 3, 4].map((q) => <option key={q} value={q}>{tr('adminPeriod.quarterShort', { n: q })}</option>)}
            </select>
            <select value={period.year} onChange={(e) => onChange({ ...period, year: Number(e.target.value) })} aria-label={tr('adminCommon.year')}>
              {years.map((y) => <option key={y} value={y}>{y}</option>)}
            </select>
          </>
        )}
        {period.type === 'year' && (
          <select value={period.year} onChange={(e) => onChange({ ...period, year: Number(e.target.value) })} aria-label={tr('adminCommon.year')}>
            {years.map((y) => <option key={y} value={y}>{y}</option>)}
          </select>
        )}
        {period.type === 'custom' && (
          <>
            <input type="date" value={libre.from} onChange={(e) => setLibre((l) => ({ ...l, from: e.target.value }))} onBlur={validerLibre} aria-label={tr('adminPeriod.from')} />
            <span className="small">→</span>
            <input type="date" value={libre.to} min={libre.from || undefined} onChange={(e) => setLibre((l) => ({ ...l, to: e.target.value }))} onBlur={validerLibre} aria-label={tr('adminPeriod.to')} />
            <button type="button" className="btn-ghost" onClick={validerLibre}>{tr('adminPeriod.apply')}</button>
          </>
        )}
        {period.type !== 'all' && (
          <button type="button" className="btn-ghost" onClick={() => onChange({ ...defaultPeriod(), type: period.type === 'custom' ? 'month' : period.type })} title={tr('adminPeriod.todayHelp')}>{tr('adminCommon.today')}</button>
        )}
      </div>
    </div>
  );
}
