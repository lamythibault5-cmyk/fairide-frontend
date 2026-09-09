import { useCallback, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { useLanguage } from '../../context/LanguageContext';

// Petits outils partagés par toutes les listes de l'ERP, pour que pagination, sélection multiple,
// compteur de résultats et état d'erreur se présentent partout de la même façon.

// --- État d'erreur d'une liste (chargement raté) : message + « Réessayer ». -------------------------
export function ErrorCard({ message, onRetry }) {
  const { t: tr } = useLanguage();
  return (
    <div className="admin-error-card" role="alert">
      <span className="admin-error-icon" aria-hidden="true">⚠️</span>
      <div className="admin-error-body">
        <h3>{tr('adminCommon.loadError')}</h3>
        {message && <p className="small">{message}</p>}
        {onRetry && <button type="button" className="btn-outline" onClick={onRetry}>{tr('adminCommon.retry')}</button>}
      </div>
    </div>
  );
}

// --- Pagination par pages (Précédent / Page x sur y (n) / Suivant). --------------------------------
export function Pager({ page, pageSize, total, onPage }) {
  const { t: tr } = useLanguage();
  if (!total || total <= pageSize) return null;
  const pages = Math.ceil(total / pageSize);
  return (
    <div className="admin-pager">
      <button type="button" className="btn-ghost" disabled={page === 0} onClick={() => onPage(page - 1)}>{tr('adminCommon.previous')}</button>
      <span className="small">{tr('adminCommon.pageOfCount', { page: page + 1, pages, n: total })}</span>
      <button type="button" className="btn-ghost" disabled={(page + 1) * pageSize >= total} onClick={() => onPage(page + 1)}>{tr('adminCommon.next')}</button>
    </div>
  );
}

// --- « Afficher plus » (listes qui s'allongent : restaurants, livreurs, clients). -------------------
export function LoadMore({ loaded, total, loading, onMore }) {
  const { t: tr } = useLanguage();
  if (total <= loaded) return null;
  return (
    <div className="admin-load-more">
      <button type="button" className="btn-outline" disabled={loading} onClick={onMore}>{loading ? '...' : tr('adminCommon.showMore', { n: Math.min(total - loaded, 100), total })}</button>
    </div>
  );
}

// --- « N résultat(s) » à droite des filtres. ---------------------------------------------------------
export function ResultCount({ n, total }) {
  const { t: tr } = useLanguage();
  if (total !== undefined && total !== null && total !== n) return <span className="small admin-result-count">{tr('adminCommon.countOf', { n, total })}</span>;
  return <span className="small admin-result-count">{tr('adminCommon.resultsCount', { n })}</span>;
}

// --- Sélection multiple. -----------------------------------------------------------------------------
// useSelection(rows) : ensemble d'identifiants cochés, borné aux lignes affichées (une ligne qui
// disparaît de la page est décochée d'elle-même).
export function useSelection(rows) {
  const [ids, setIds] = useState(() => new Set());
  const visibles = useMemo(() => new Set((rows || []).map((r) => r.id)), [rows]);
  const selected = useMemo(() => new Set([...ids].filter((id) => visibles.has(id))), [ids, visibles]);
  const toggle = useCallback((id) => setIds((s) => { const n = new Set(s); if (n.has(id)) n.delete(id); else n.add(id); return n; }), []);
  const toggleAll = useCallback(() => setIds((s) => {
    const tous = [...visibles];
    const toutCoche = tous.length > 0 && tous.every((id) => s.has(id));
    return toutCoche ? new Set() : new Set(tous);
  }), [visibles]);
  const clear = useCallback(() => setIds(new Set()), []);
  return { selected, ids: [...selected], count: selected.size, isSelected: (id) => selected.has(id), toggle, toggleAll, clear, allSelected: visibles.size > 0 && selected.size === visibles.size };
}

// Colonne « case à cocher » à mettre en tête des colonnes d'un AdminDataTable.
export function selectionColumn(sel, label = '') {
  return {
    key: '__select', width: 36,
    label: <input type="checkbox" className="admin-select-box" checked={sel.allSelected} onChange={sel.toggleAll} aria-label={label} onClick={(e) => e.stopPropagation()} />,
    get: (r) => <input type="checkbox" className="admin-select-box" checked={sel.isSelected(r.id)} onChange={() => sel.toggle(r.id)} onClick={(e) => e.stopPropagation()} aria-label={label} />,
    sortValue: (r) => (sel.isSelected(r.id) ? 1 : 0)
  };
}

// Case à cocher d'une carte (vue « fiches »).
export function SelectBox({ sel, id, label }) {
  return <input type="checkbox" className="admin-select-box" checked={sel.isSelected(id)} onChange={() => sel.toggle(id)} onClick={(e) => e.stopPropagation()} aria-label={label} />;
}

// Barre d'actions groupées : « N sélectionné(s) · [actions] · Tout désélectionner ».
export function SelectionBar({ sel, children }) {
  const { t: tr } = useLanguage();
  if (!sel.count) return null;
  return (
    <div className="admin-selection-bar" role="region" aria-live="polite">
      <b>{tr('adminCommon.selectedCount', { n: sel.count })}</b>
      <button type="button" className="btn-ghost" onClick={sel.clear}>{tr('adminCommon.clearSelection')}</button>
      <div className="admin-selection-actions">{children}</div>
    </div>
  );
}

// --- Lien vers une fiche d'une autre application. -------------------------------------------------
// Les fiches s'ouvrent par recherche pré-remplie (`presetSearch`, comme la recherche globale) : la
// page cible n'a pas de route /:id. `type` ∈ restaurant | driver | client | order | crm_prospect |
// ticket | document | invoice ; `id` sert aux applications qui savent ouvrir directement un
// enregistrement (commandes, tickets, tâches, documents via ?id=).
const CIBLES_FICHE = {
  restaurant: (id, name) => ({ to: '/admin/restaurants', state: { presetSearch: name || id } }),
  driver: (id, name) => ({ to: '/admin/drivers', state: { presetSearch: name || id } }),
  client: (id, name) => ({ to: '/admin/clients', state: { presetSearch: name || id } }),
  order: (id) => ({ to: `/admin/orders?id=${id}` }),
  crm_prospect: (id, name) => ({ to: '/admin/crm', state: { presetSearch: name || id } }),
  ticket: (id) => ({ to: `/admin/support?id=${id}` }),
  document: (id) => ({ to: `/admin/documents?id=${id}` }),
  invoice: (id, name) => ({ to: '/admin/invoices', state: { presetSearch: name || id } }),
  task: (id) => ({ to: `/admin/tasks?id=${id}` })
};
export function RecordLink({ type, id, name, label, className = 'admin-record-link' }) {
  const cible = CIBLES_FICHE[type];
  if (!cible || (!id && !name)) return label ? <span className="small">{label}</span> : null;
  const { to, state } = cible(id, name);
  return <Link to={to} state={state} className={className} onClick={(e) => e.stopPropagation()}>→ {label || name || id}</Link>;
}

// Exécute une action sur chaque identifiant (quand le serveur n'a pas de route « en lot ») et compte
// les réussites ; les échecs sont remontés en une seule fois à l'appelant.
export async function runForEach(ids, fn) {
  let ok = 0; const erreurs = [];
  for (const id of ids) {
    try { await fn(id); ok += 1; } catch (e) { erreurs.push(e.message); }
  }
  return { ok, erreurs };
}
