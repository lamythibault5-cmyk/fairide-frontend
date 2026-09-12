import { useCallback, useEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { Link } from 'react-router-dom';
import { SkeletonCards } from '../../../components/Skeleton';
import { useLanguage } from '../../../context/LanguageContext';
import { money } from '../adminUtils';

// Briques communes des onglets du groupe Finance : chargement avec état d'erreur et réessai (jamais un
// squelette qui tourne pour toujours), pagination, liens vers les fiches, petit dialogue avec motif.

// Charge une ressource et expose { data, error, loading, reload }. Les données précédentes sont
// conservées pendant un rechargement (pas de clignotement après une action) ; une nouvelle requête
// annule logiquement la précédente (résultat ignoré si les dépendances ont changé entre-temps).
export function useApiData(fetcher, deps) {
  const [state, setState] = useState({ data: null, error: null, loading: true });
  const [tick, setTick] = useState(0);
  const fetcherRef = useRef(fetcher);
  fetcherRef.current = fetcher;
  useEffect(() => {
    let cancelled = false;
    setState((s) => ({ ...s, loading: true, error: null }));
    Promise.resolve().then(() => fetcherRef.current()).then((data) => {
      if (!cancelled) setState({ data, error: null, loading: false });
    }).catch((e) => {
      if (!cancelled) setState((s) => ({ data: s.data, error: e?.message || String(e), loading: false }));
    });
    return () => { cancelled = true; };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [...deps, tick]);
  const reload = useCallback(() => setTick((t) => t + 1), []);
  return { ...state, reload };
}

// État d'erreur avec bouton « Réessayer ».
export function ErrorState({ error, onRetry }) {
  const { t: tr } = useLanguage();
  return (
    <div className="fin-error" role="alert">
      <b>⚠️ {tr('adminAccounting.loadError')}</b>
      <p className="small">{error}</p>
      {onRetry && <button type="button" className="btn-outline" onClick={onRetry}>{tr('adminAccounting.retry')}</button>}
    </div>
  );
}

// Rend squelette / erreur / contenu selon l'état d'un useApiData. `children` est une fonction (data).
export function LoadState({ state, skeleton = 3, children }) {
  if (state.error && !state.data) return <ErrorState error={state.error} onRetry={state.reload} />;
  if (!state.data) return <SkeletonCards count={skeleton} />;
  return (
    <>
      {state.error && <ErrorState error={state.error} onRetry={state.reload} />}
      {children(state.data)}
    </>
  );
}

export function Pagination({ page, total, pageSize, onPage, countLabel }) {
  const { t: tr } = useLanguage();
  if (!total || total <= pageSize) return null;
  const pages = Math.ceil(total / pageSize);
  return (
    <div className="fin-pagination">
      <button type="button" className="btn-ghost" disabled={page === 0} onClick={() => onPage(page - 1)}>{tr('adminCommon.previous')}</button>
      <span className="small">{tr('adminCommon.pageOf', { page: page + 1, pages })}{countLabel ? ` ${countLabel}` : ''}</span>
      <button type="button" className="btn-ghost" disabled={(page + 1) * pageSize >= total} onClick={() => onPage(page + 1)}>{tr('adminCommon.next')}</button>
    </div>
  );
}

// Liens vers les fiches : mêmes chemins que le reste de l'ERP (recherche pré-remplie pour les listes
// restaurants / livreurs, paramètre q pour la commande).
export function RestaurantLink({ id, name, className = 'fin-link' }) {
  if (!name && !id) return '-';
  return <Link to="/admin/restaurants" state={{ presetSearch: name || id }} className={className} onClick={(e) => e.stopPropagation()}>{name || id}</Link>;
}
export function DriverLink({ id, name, className = 'fin-link' }) {
  if (!name && !id) return '-';
  return <Link to="/admin/drivers" state={{ presetSearch: name || id }} className={className} onClick={(e) => e.stopPropagation()}>{name || id}</Link>;
}
export function OrderLink({ id, className = 'fin-link' }) {
  if (!id) return '-';
  return <Link to={`/admin/orders?q=${encodeURIComponent(id)}`} className={className} onClick={(e) => e.stopPropagation()}>#{String(id).slice(0, 8)}</Link>;
}

// Montant signé coloré (résultat, solde, delta).
export function SignedMoney({ value, strong }) {
  const n = Number(value || 0);
  const cls = n < 0 ? 'fin-neg' : n > 0 ? 'fin-pos' : '';
  return strong ? <b className={cls}>{money(n)}</b> : <span className={cls}>{money(n)}</span>;
}

// Variation en % entre deux valeurs (null si la précédente est nulle).
export function deltaPct(current, previous) {
  const c = Number(current || 0); const p = Number(previous || 0);
  if (!p) return null;
  return ((c - p) / Math.abs(p)) * 100;
}

export function DeltaBadge({ current, previous }) {
  const { t: tr } = useLanguage();
  const d = deltaPct(current, previous);
  if (d === null) return <span className="fin-delta" style={{ opacity: 0.5 }}>{tr('adminAccounting.noPrevious')}</span>;
  const cls = d < 0 ? 'fin-neg' : d > 0 ? 'fin-pos' : '';
  return <span className={`fin-delta ${cls}`} title={tr('adminAccounting.vsPrevious')}>{d > 0 ? '+' : ''}{d.toFixed(1)}%</span>;
}

// Dialogue de confirmation avec champ « motif » obligatoire (déverrouillage d'une période, etc.).
export function ReasonDialog({ open, title, message, placeholder, confirmLabel, danger, loading, onConfirm, onCancel }) {
  const { t: tr } = useLanguage();
  const [reason, setReason] = useState('');
  useEffect(() => { if (open) setReason(''); }, [open]);
  if (!open) return null;
  return createPortal(
    <div className="modal-overlay" onClick={onCancel}>
      <div className="modal-box" onClick={(e) => e.stopPropagation()} style={{ maxWidth: 460 }}>
        <h3 style={{ margin: '0 0 8px' }}>{title}</h3>
        {message && <p className="small" style={{ margin: '0 0 12px' }}>{message}</p>}
        <textarea rows={3} value={reason} onChange={(e) => setReason(e.target.value)} placeholder={placeholder} style={{ width: '100%', marginBottom: 12 }} />
        <div className="row" style={{ gap: 8, justifyContent: 'flex-end' }}>
          <button type="button" className="btn-ghost" onClick={onCancel} disabled={loading}>{tr('adminCommon.cancel')}</button>
          <button type="button" className={danger ? 'btn-outline' : 'btn-teal'} style={danger ? { borderColor: 'var(--red)', color: 'var(--red)' } : undefined} disabled={loading || !reason.trim()} onClick={() => onConfirm(reason.trim())}>
            {loading ? '...' : (confirmLabel || tr('adminCommon.confirm'))}
          </button>
        </div>
      </div>
    </div>,
    document.body
  );
}

// Date « YYYY-MM-DD » du jour (valeur par défaut des champs date).
export function todayIso() {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}

export function toNumber(v) {
  const n = Number(String(v ?? '').replace(',', '.'));
  return Number.isFinite(n) ? n : 0;
}

// Statuts d'une ligne d'écriture et pastille associée.
export const ENTRY_STATUSES = ['posted', 'reconciled', 'flagged'];
export const entryStatusLabels = (tr) => ({ posted: tr('adminAccounting.status_posted'), reconciled: tr('adminAccounting.status_reconciled'), flagged: tr('adminAccounting.status_flagged') });
export function StatusPill({ status, labels }) {
  return <span className={`pill fin-status ${status}`}>{labels[status] || status}</span>;
}

// Ordre d'affichage classique d'un plan comptable : actifs, passifs, TVA, revenus, charges.
const ACCOUNT_KIND_ORDER = ['asset', 'liability', 'vat', 'revenue', 'expense'];
export function sortAccounts(accounts) {
  return [...(accounts || [])].filter((a) => a.active !== false).sort((a, b) => ACCOUNT_KIND_ORDER.indexOf(a.kind) - ACCOUNT_KIND_ORDER.indexOf(b.kind) || a.code.localeCompare(b.code));
}
