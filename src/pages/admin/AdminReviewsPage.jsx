import { useEffect, useMemo, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import { api } from '../../api';
import { useAuth } from '../../context/AuthContext';
import { useToast } from '../../context/ToastContext';
import { SkeletonCards } from '../../components/Skeleton';
import ConfirmDialog from '../../components/ConfirmDialog';
import AdminPageHeader from '../../components/admin/AdminPageHeader';
import { fmtDateTime, filterBySearch, downloadCsv } from './adminUtils';
import { useLanguage } from '../../context/LanguageContext';

// Application Avis : modération des avis clients (plats et livraison), avec recherche, filtre par note,
// notes moyennes, et suppression d'un avis abusif. Extraite des Paramètres.
function Etoiles({ n }) {
  if (!n) return <span className="small">—</span>;
  return <span className="admin-stars" aria-label={`${n}/5`}>{'★'.repeat(n)}<span>{'★'.repeat(5 - n)}</span></span>;
}

export default function AdminReviewsPage() {
  const { t: tr } = useLanguage();
  const { token } = useAuth();
  const toast = useToast();
  const [searchParams] = useSearchParams();
  const [reviews, setReviews] = useState(null);
  const [search, setSearch] = useState('');
  const [filtre, setFiltre] = useState(searchParams.get('low') ? 'low' : 'all'); // all | low | high | comments
  const [aSupprimer, setASupprimer] = useState(null);
  const [busy, setBusy] = useState(false);

  useEffect(() => { api('/admin/reviews', { token }).then(setReviews).catch((e) => toast(e.message)); }, [token]); // eslint-disable-line react-hooks/exhaustive-deps

  const filtres = useMemo(() => {
    let l = filterBySearch(reviews || [], search, (r) => [r.clientName, r.restaurantName, r.foodComment, r.deliveryComment]);
    if (filtre === 'low') l = l.filter((r) => r.foodRating <= 2 || (r.deliveryRating && r.deliveryRating <= 2));
    if (filtre === 'high') l = l.filter((r) => r.foodRating >= 4);
    if (filtre === 'comments') l = l.filter((r) => (r.foodComment && r.foodComment.trim()) || (r.deliveryComment && r.deliveryComment.trim()));
    return l;
  }, [reviews, search, filtre]);

  const stats = useMemo(() => {
    const l = reviews || [];
    const moy = (arr) => (arr.length ? (arr.reduce((s, v) => s + v, 0) / arr.length).toFixed(1) : '—');
    return {
      total: l.length,
      food: moy(l.map((r) => r.foodRating).filter(Boolean)),
      delivery: moy(l.map((r) => r.deliveryRating).filter(Boolean)),
      low: l.filter((r) => r.foodRating <= 2 || (r.deliveryRating && r.deliveryRating <= 2)).length
    };
  }, [reviews]);

  async function supprimer() {
    if (!aSupprimer) return;
    setBusy(true);
    try {
      await api(`/admin/reviews/${aSupprimer.id}`, { method: 'DELETE', token });
      setReviews((prev) => prev.filter((r) => r.id !== aSupprimer.id));
      toast(tr('adminSettings.toastReviewDeleted'));
    } catch (e) { toast(e.message); } finally { setBusy(false); setASupprimer(null); }
  }

  function exportCsv() {
    if (!filtres.length) { toast(tr('adminCommon.nothingToExport')); return; }
    downloadCsv(`avis-${Date.now()}.csv`, filtres, [
      { label: 'Date', get: (r) => fmtDateTime(r.createdAt) }, { label: 'Client', get: (r) => r.clientName }, { label: 'Restaurant', get: (r) => r.restaurantName },
      { label: tr('adminReviews.foodRating'), get: (r) => r.foodRating }, { label: tr('adminReviews.foodComment'), get: (r) => r.foodComment || '' },
      { label: tr('adminReviews.deliveryRating'), get: (r) => r.deliveryRating || '' }, { label: tr('adminReviews.deliveryComment'), get: (r) => r.deliveryComment || '' }
    ]);
  }

  return (
    <div>
      <AdminPageHeader module="reviews" actions={<button className="btn-outline" onClick={exportCsv}>{tr('adminCommon.csv')}</button>} />

      <div className="stat-grid">
        <div className="stat-card highlight"><div className="num">{stats.food}</div><div className="label">{tr('adminReviews.statFood')}</div></div>
        <div className="stat-card"><div className="num">{stats.delivery}</div><div className="label">{tr('adminReviews.statDelivery')}</div></div>
        <div className="stat-card"><div className="num">{stats.total}</div><div className="label">{tr('adminReviews.statTotal')}</div></div>
        <div className="stat-card"><div className="num" style={{ color: stats.low > 0 ? 'var(--red)' : undefined }}>{stats.low}</div><div className="label">{tr('adminReviews.statLow')}</div></div>
      </div>

      <div className="admin-control-panel">
        <input placeholder={tr('adminReviews.phSearch')} value={search} onChange={(e) => setSearch(e.target.value)} style={{ flex: 1, minWidth: 180 }} />
        <div className="role-pick" style={{ margin: 0 }}>
          {[['all', tr('adminCommon.allF')], ['low', tr('adminReviews.filterLow')], ['high', tr('adminReviews.filterHigh')], ['comments', tr('adminReviews.filterComments')]].map(([k, l]) => (
            <div key={k} className={`chip${filtre === k ? ' active' : ''}`} onClick={() => setFiltre(k)}>{l}</div>
          ))}
        </div>
      </div>

      {!reviews && <SkeletonCards count={3} />}
      {reviews && filtres.length === 0 && <div className="empty">{tr('adminSettings.noReviews')}</div>}
      {reviews && filtres.map((r) => {
        const bas = r.foodRating <= 2 || (r.deliveryRating && r.deliveryRating <= 2);
        return (
          <div className={`card admin-review${bas ? ' low' : ''}`} key={r.id}>
            <div className="row" style={{ justifyContent: 'space-between', alignItems: 'flex-start' }}>
              <div>
                <b>{r.clientName}</b> <span className="small">→ {r.restaurantName}</span>
                <div className="small" style={{ opacity: 0.6 }}>{fmtDateTime(r.createdAt)}</div>
              </div>
              <button className="btn-danger-ghost" style={{ padding: '4px 10px', fontSize: 12 }} onClick={() => setASupprimer(r)}>{tr('adminCommon.delete')}</button>
            </div>
            <div className="admin-review-lines">
              <div><span className="small">{tr('adminReviews.foodRating')}</span> <Etoiles n={r.foodRating} /> {r.foodComment && <span className="admin-review-comment">“{r.foodComment}”</span>}</div>
              {r.deliveryRating && <div><span className="small">{tr('adminReviews.deliveryRating')}</span> <Etoiles n={r.deliveryRating} /> {r.deliveryComment && <span className="admin-review-comment">“{r.deliveryComment}”</span>}</div>}
            </div>
          </div>
        );
      })}

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
