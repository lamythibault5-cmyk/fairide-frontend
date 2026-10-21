import { useEffect, useMemo, useState } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import { api, totalDepuisEntetes } from '../../api';
import { useAuth } from '../../context/AuthContext';
import { useToast } from '../../context/ToastContext';
import { SkeletonCards } from '../../components/Skeleton';
import ReasonDialog from '../../components/admin/ReasonDialog';
import AdminPageHeader from '../../components/admin/AdminPageHeader';
import AdminDataTable, { useTableSort } from '../../components/admin/AdminDataTable';
import { useViewMode, ViewSwitcher } from '../../components/admin/KanbanBoard';
import { ErrorCard, Pager, ResultCount } from '../../components/admin/AdminListTools';
import { fmtDateTime, downloadCsv, useDebouncedValue } from './adminUtils';
import { useLanguage } from '../../context/LanguageContext';
import useEtatPage from '../../hooks/useEtatPage';

// Application Avis : modération des avis clients sur les commerces, avec recherche, filtre par note,
// note moyenne, et retrait d'un avis abusif. Pagination côté serveur (limit/offset + X-Total-Count). Filtres, recherche et
// moyenne sont calculés par le serveur sur TOUS les avis (audit du 19/10, admin-35 : ils ne portaient que sur la page
// chargée). Retirer un avis demande un motif, envoyé à son auteur avec ses recours (DSA, art. 17). Aucune note de livraison : le livreur n'est
// pas noté (contrat livreur, présomption de salariat), le serveur ne la renvoie plus.
const PAGE_SIZE = 50;
const MODES = (tr) => [{ key: 'cards', icon: '▤', label: tr('adminCommon.viewCards') }, { key: 'table', icon: '☰', label: tr('adminCommon.viewTable') }];
const estBas = (r) => r.foodRating <= 2;

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
  const q = useDebouncedValue(search, 350);
  const [statsServeur, setStatsServeur] = useState(null);
  const [filtre, setFiltre] = useEtatPage('filtre', searchParams.get('low') ? 'low' : 'all', { forcer: !!searchParams.get('low') }); // all | low | high | comments
  const [aSupprimer, setASupprimer] = useState(null);
  const [busy, setBusy] = useState(false);
  const [mode, setMode] = useViewMode('reviews', 'cards');
  const { sort, toggle } = useTableSort('createdAt');

  function load() {
    setReviews(null); setErreur(null);
    const p = new URLSearchParams({ limit: PAGE_SIZE, offset: page * PAGE_SIZE, stats: '1' });
    if (filtre === 'low') p.set('low', '1');
    if (filtre === 'high') p.set('high', '1');
    if (filtre === 'comments') p.set('comments', '1');
    if (q.trim()) p.set('q', q.trim());
    api(`/admin/reviews?${p.toString()}`, { token, withHeaders: true })
      .then(({ data, headers }) => { const l = Array.isArray(data) ? data : (data?.rows || []); setReviews(l); setTotal(data?.total ?? totalDepuisEntetes(headers, l)); setStatsServeur(data?.stats || null); })
      .catch((e) => setErreur(e.message));
  }
  useEffect(() => { load(); }, [token, page, filtre, q]); // eslint-disable-line react-hooks/exhaustive-deps
  useEffect(() => { setPage(0); }, [filtre, q]);

  const filtres = reviews || [];
  const stats = useMemo(() => ({
    food: statsServeur?.avgFood !== null && statsServeur?.avgFood !== undefined ? Number(statsServeur.avgFood).toFixed(1) : '-',
    low: statsServeur ? statsServeur.low : (reviews || []).filter(estBas).length
  }), [statsServeur, reviews]);

  async function supprimer(motif) {
    if (!aSupprimer) return;
    setBusy(true);
    try {
      await api(`/admin/reviews/${aSupprimer.id}`, { method: 'DELETE', token, body: { reason: motif } });
      setReviews((prev) => prev.filter((r) => r.id !== aSupprimer.id));
      setTotal((t) => Math.max(0, t - 1));
      toast(tr('adminSettings.toastReviewDeleted'));
    } catch (e) { toast(e.message, 'erreur'); } finally { setBusy(false); setASupprimer(null); }
  }

  function exportCsv() {
    if (!filtres.length) { toast(tr('adminCommon.nothingToExport')); return; }
    downloadCsv(`avis-${Date.now()}.csv`, filtres, [
      { label: tr('adminCommon.date'), get: (r) => fmtDateTime(r.createdAt) }, { label: tr('adminCommon.client'), get: (r) => r.clientName }, { label: tr('adminCommon.restaurant'), get: (r) => r.restaurantName },
      { label: tr('adminReviews.foodRating'), get: (r) => r.foodRating }, { label: tr('adminReviews.foodComment'), get: (r) => r.foodComment || '' }
    ]);
  }

  const colonnes = [
    { key: 'createdAt', label: tr('adminCommon.date'), get: (r) => fmtDateTime(r.createdAt), sortValue: (r) => r.createdAt },
    { key: 'clientName', label: tr('adminCommon.client'), get: (r) => <b>{r.clientName}</b>, sortValue: (r) => r.clientName },
    { key: 'restaurantName', label: tr('adminCommon.restaurant'), get: (r) => r.restaurantName },
    { key: 'foodRating', label: tr('adminReviews.foodRating'), get: (r) => <Etoiles n={r.foodRating} />, sortValue: (r) => r.foodRating, align: 'right' },
    { key: 'comments', label: tr('adminReviews.filterComments'), get: (r) => <span className="small" style={{ whiteSpace: 'normal' }}>{r.foodComment || '-'}</span>, sortValue: (r) => (r.foodComment ? 1 : 0) },
    { key: 'links', label: tr('adminCommon.actions'), get: (r) => <span className="row" style={{ gap: 6 }}><LiensAvis r={r} tr={tr} /><button className="btn-danger-ghost btn-sm" onClick={(e) => { e.stopPropagation(); setASupprimer(r); }}>{tr('adminCommon.delete')}</button></span>, sortValue: () => 0 }
  ];

  return (
    <div>
      <AdminPageHeader module="reviews" actions={<><ViewSwitcher mode={mode} onChange={setMode} labels={{ aria: tr('adminKanban.viewAria') }} modes={MODES(tr)} /><button className="btn-outline" onClick={exportCsv}>{tr('adminCommon.csv')}</button></>} />

      <div className="stat-grid">
        <div className="stat-card highlight"><div className="num">{stats.food}</div><div className="label">{tr('adminReviews.statFood')}</div></div>
        <div className="stat-card"><div className="num">{total}</div><div className="label">{tr('adminReviews.statTotal')}</div></div>
        <div className="stat-card"><div className="num" style={{ color: stats.low > 0 ? 'var(--red)' : undefined }}>{stats.low}</div><div className="label">{tr('adminReviews.statLow')}</div></div>
      </div>
      <p className="small" style={{ margin: '-8px 0 12px', opacity: 0.7 }}>{tr('adminReviews.statsAllHint')}</p>

      <div className="admin-control-panel">
        <input aria-label={tr('adminReviews.phSearch')} placeholder={tr('adminReviews.phSearch')} value={search} onChange={(e) => setSearch(e.target.value)} style={{ flex: 1, minWidth: 180 }} />
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
            <button className="btn-danger-ghost btn-sm" onClick={() => setASupprimer(r)}>{tr('adminCommon.delete')}</button>
          </div>
          <div className="admin-review-lines">
            <div><span className="small">{tr('adminReviews.foodRating')}</span> <Etoiles n={r.foodRating} /> {r.foodComment && <span className="admin-review-comment">“{r.foodComment}”</span>}</div>
          </div>
        </div>
      ))}
      <Pager page={page} pageSize={PAGE_SIZE} total={total} onPage={setPage} />

      <ReasonDialog
        open={!!aSupprimer}
        title={tr('adminReviews.confirmDelete')}
        message={aSupprimer ? `${tr('adminReviews.confirmDeleteBody', { client: aSupprimer.clientName, resto: aSupprimer.restaurantName })} ${tr('adminReviews.deleteNoticeHint')}` : ''}
        label={tr('adminReviews.deleteReasonLabel')}
        placeholder={tr('adminReviews.deleteReasonPh')}
        confirmLabel={tr('adminReviews.deleteConfirm')}
        multiline danger
        loading={busy}
        onConfirm={(motif) => { if (motif.length < 5) { toast(tr('adminReviews.deleteReasonShort'), 'erreur'); return; } supprimer(motif); }}
        onCancel={() => setASupprimer(null)}
      />
    </div>
  );
}
