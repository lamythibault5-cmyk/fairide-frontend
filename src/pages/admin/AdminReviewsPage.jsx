import { useEffect, useMemo, useState } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import { api, totalDepuisEntetes } from '../../api';
import { useAuth } from '../../context/AuthContext';
import { useToast } from '../../context/ToastContext';
import { SkeletonCards } from '../../components/Skeleton';
import ConfirmDialog from '../../components/ConfirmDialog';
import AdminPageHeader from '../../components/admin/AdminPageHeader';
import AdminDataTable, { useTableSort } from '../../components/admin/AdminDataTable';
import { useViewMode, ViewSwitcher } from '../../components/admin/KanbanBoard';
import { ErrorCard, Pager, ResultCount } from '../../components/admin/AdminListTools';
import { fmtDateTime, filterBySearch, downloadCsv } from './adminUtils';
import { useLanguage } from '../../context/LanguageContext';

// Application Avis : modération des avis clients (plats et livraison), avec recherche, filtre par note,
// notes moyennes, et suppression d'un avis abusif. Pagination côté serveur (limit/offset + X-Total-Count) ;
// les filtres par note et la recherche affinent la page affichée.
const PAGE_SIZE = 50;
const MODES = (tr) => [{ key: 'cards', icon: '▤', label: tr('adminCommon.viewCards') }, { key: 'table', icon: '☰', label: tr('adminCommon.viewTable') }];
const estBas = (r) => r.foodRating <= 2 || (r.deliveryRating && r.deliveryRating <= 2);

function Etoiles({ n }) {
  if (!n) return <span className="small">-</span>;
  return <span className="admin-stars" aria-label={`${n}/5`}>{'★'.repeat(n)}<span>{'★'.repeat(5 - n)}</span></span>;
}

// Liens vers les fiches liées : l'avis ne porte que des noms, la page cible pré-remplit sa recherche.
function LiensAvis({ r, tr }) {
  const stop = (e) => e.stopPropagation();
  return (
    <span className="admin-record-links" style={{ margin: 0 }}>
      <Link to="/admin/restaurants" state={{ presetSearch: r.restaurantName }} className="admin-record-link" onClick={stop}>→ {tr('adminCommon.restaurant')}</Link>
      <Link to="/admin/clients" state={{ presetSearch: r.clientName }} className="admin-record-link" onClick={stop}>→ {tr('adminCommon.client')}</Link>
      <Link to={`/admin/orders?q=${encodeURIComponent(r.clientName || '')}`} className="admin-record-link" onClick={stop}>→ {tr('adminCommon.orders')}</Link>
    </span>
  );
}

export default function AdminReviewsPage() {
  const { t: tr } = useLanguage();
  const { token } = useAuth();
  const toast = useToast();
  const [searchParams] = useSearchParams();
  const [reviews, setReviews] = useState(null);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(0);
  const [erreur, setErreur] = useState(null);
  const [search, setSearch] = useState('');
  const [filtre, setFiltre] = useState(searchParams.get('low') ? 'low' : 'all'); // all | low | high | comments
  const [aSupprimer, setASupprimer] = useState(null);
  const [busy, setBusy] = useState(false);
  const [mode, setMode] = useViewMode('reviews', 'cards');
  const { sort, toggle } = useTableSort('createdAt');

  function load() {
    setReviews(null); setErreur(null);
    api(`/admin/reviews?limit=${PAGE_SIZE}&offset=${page * PAGE_SIZE}`, { token, withHeaders: true })
      .then(({ data, headers }) => { const l = Array.isArray(data) ? data : (data?.rows || []); setReviews(l); setTotal(totalDepuisEntetes(headers, l)); })
      .catch((e) => setErreur(e.message));
  }
  useEffect(load, [token, page]); // eslint-disable-line react-hooks/exhaustive-deps

  const filtres = useMemo(() => {
    let l = filterBySearch(reviews || [], search, (r) => [r.clientName, r.restaurantName, r.foodComment, r.deliveryComment]);
    if (filtre === 'low') l = l.filter(estBas);
    if (filtre === 'high') l = l.filter((r) => r.foodRating >= 4);
    if (filtre === 'comments') l = l.filter((r) => (r.foodComment && r.foodComment.trim()) || (r.deliveryComment && r.deliveryComment.trim()));
    return l;
  }, [reviews, search, filtre]);

  const stats = useMemo(() => {
    const l = reviews || [];
    const moy = (arr) => (arr.length ? (arr.reduce((s, v) => s + v, 0) / arr.length).toFixed(1) : '-');
    return {
      food: moy(l.map((r) => r.foodRating).filter(Boolean)),
      delivery: moy(l.map((r) => r.deliveryRating).filter(Boolean)),
      low: l.filter(estBas).length
    };
  }, [reviews]);

  async function supprimer() {
    if (!aSupprimer) return;
    setBusy(true);
    try {
      await api(`/admin/reviews/${aSupprimer.id}`, { method: 'DELETE', token });
      setReviews((prev) => prev.filter((r) => r.id !== aSupprimer.id));
      setTotal((t) => Math.max(0, t - 1));
      toast(tr('adminSettings.toastReviewDeleted'));
    } catch (e) { toast(e.message); } finally { setBusy(false); setASupprimer(null); }
  }

  function exportCsv() {
    if (!filtres.length) { toast(tr('adminCommon.nothingToExport')); return; }
    downloadCsv(`avis-${Date.now()}.csv`, filtres, [
      { label: tr('adminCommon.date'), get: (r) => fmtDateTime(r.createdAt) }, { label: tr('adminCommon.client'), get: (r) => r.clientName }, { label: tr('adminCommon.restaurant'), get: (r) => r.restaurantName },
      { label: tr('adminReviews.foodRating'), get: (r) => r.foodRating }, { label: tr('adminReviews.foodComment'), get: (r) => r.foodComment || '' },
      { label: tr('adminReviews.deliveryRating'), get: (r) => r.deliveryRating || '' }, { label: tr('adminReviews.deliveryComment'), get: (r) => r.deliveryComment || '' }
    ]);
  }

  const colonnes = [
    { key: 'createdAt', label: tr('adminCommon.date'), get: (r) => fmtDateTime(r.createdAt), sortValue: (r) => r.createdAt },
    { key: 'clientName', label: tr('adminCommon.client'), get: (r) => <b>{r.clientName}</b>, sortValue: (r) => r.clientName },
    { key: 'restaurantName', label: tr('adminCommon.restaurant'), get: (r) => r.restaurantName },
    { key: 'foodRating', label: tr('adminReviews.foodRating'), get: (r) => <Etoiles n={r.foodRating} />, sortValue: (r) => r.foodRating, align: 'right' },
    { key: 'deliveryRating', label: tr('adminReviews.deliveryRating'), get: (r) => <Etoiles n={r.deliveryRating} />, sortValue: (r) => r.deliveryRating || 0, align: 'right' },
    { key: 'comments', label: tr('adminReviews.filterComments'), get: (r) => <span className="small" style={{ whiteSpace: 'normal' }}>{[r.foodComment, r.deliveryComment].filter(Boolean).join(' · ') || '-'}</span>, sortValue: (r) => (r.foodComment || r.deliveryComment ? 1 : 0) },
    { key: 'links', label: tr('adminCommon.actions'), get: (r) => <span className="row" style={{ gap: 6 }}><LiensAvis r={r} tr={tr} /><button className="btn-danger-ghost" style={{ padding: '2px 8px', fontSize: 12 }} onClick={(e) => { e.stopPropagation(); setASupprimer(r); }}>{tr('adminCommon.delete')}</button></span>, sortValue: () => 0 }
  ];

  return (
    <div>
      <AdminPageHeader module="reviews" actions={<><ViewSwitcher mode={mode} onChange={setMode} labels={{ aria: tr('adminKanban.viewAria') }} modes={MODES(tr)} /><button className="btn-outline" onClick={exportCsv}>{tr('adminCommon.csv')}</button></>} />

      <div className="stat-grid">
        <div className="stat-card highlight"><div className="num">{stats.food}</div><div className="label">{tr('adminReviews.statFood')}</div></div>
        <div className="stat-card"><div className="num">{stats.delivery}</div><div className="label">{tr('adminReviews.statDelivery')}</div></div>
        <div className="stat-card"><div className="num">{total}</div><div className="label">{tr('adminReviews.statTotal')}</div></div>
        <div className="stat-card"><div className="num" style={{ color: stats.low > 0 ? 'var(--red)' : undefined }}>{stats.low}</div><div className="label">{tr('adminReviews.statLow')}</div></div>
      </div>
      {total > PAGE_SIZE && <p className="small" style={{ margin: '-8px 0 12px', opacity: 0.7 }}>{tr('adminCommon.kpiOnLoaded', { n: (reviews || []).length, total })}</p>}

      <div className="admin-control-panel">
        <input placeholder={tr('adminReviews.phSearch')} value={search} onChange={(e) => setSearch(e.target.value)} style={{ flex: 1, minWidth: 180 }} />
        <div className="role-pick" style={{ margin: 0 }}>
          {[['all', tr('adminCommon.allF')], ['low', tr('adminReviews.filterLow')], ['high', tr('adminReviews.filterHigh')], ['comments', tr('adminReviews.filterComments')]].map(([k, l]) => (
            <div key={k} className={`chip${filtre === k ? ' active' : ''}`} onClick={() => setFiltre(k)}>{l}</div>
          ))}
        </div>
        <ResultCount n={filtres.length} total={total} />
      </div>

      {erreur && <ErrorCard message={erreur} onRetry={load} />}
      {!reviews && !erreur && <SkeletonCards count={3} />}
      {reviews && filtres.length === 0 && <div className="empty">{tr('adminSettings.noReviews')}</div>}
      {reviews && mode === 'table' && filtres.length > 0 && (
        <AdminDataTable columns={colonnes} rows={filtres} sort={sort} onSort={toggle} rowClassName={(r) => (estBas(r) ? 'admin-review-low-row' : '')} emptyLabel={tr('adminSettings.noReviews')} />
      )}
      {reviews && mode === 'cards' && filtres.map((r) => (
        <div className={`card admin-review${estBas(r) ? ' low' : ''}`} key={r.id}>
          <div className="row" style={{ justifyContent: 'space-between', alignItems: 'flex-start' }}>
            <div>
              <b>{r.clientName}</b> <span className="small">→ {r.restaurantName}</span>
              <div className="small" style={{ opacity: 0.6 }}>{fmtDateTime(r.createdAt)}</div>
              <LiensAvis r={r} tr={tr} />
            </div>
            <button className="btn-danger-ghost" style={{ padding: '4px 10px', fontSize: 12 }} onClick={() => setASupprimer(r)}>{tr('adminCommon.delete')}</button>
          </div>
          <div className="admin-review-lines">
            <div><span className="small">{tr('adminReviews.foodRating')}</span> <Etoiles n={r.foodRating} /> {r.foodComment && <span className="admin-review-comment">“{r.foodComment}”</span>}</div>
            {r.deliveryRating && <div><span className="small">{tr('adminReviews.deliveryRating')}</span> <Etoiles n={r.deliveryRating} /> {r.deliveryComment && <span className="admin-review-comment">“{r.deliveryComment}”</span>}</div>}
          </div>
        </div>
      ))}
      <Pager page={page} pageSize={PAGE_SIZE} total={total} onPage={setPage} />

      <ConfirmDialog
        open={!!aSupprimer}
        title={tr('adminReviews.confirmDelete')}
        message={aSupprimer ? tr('adminReviews.confirmDeleteBody', { client: aSupprimer.clientName, resto: aSupprimer.restaurantName }) : ''}
        danger
        loading={busy}
        onConfirm={supprimer}
        onCancel={() => setASupprimer(null)}
      />
    </div>
  );
}
