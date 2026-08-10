import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { api } from '../../api';
import { useAuth } from '../../context/AuthContext';
import { useToast } from '../../context/ToastContext';
import { SkeletonCards } from '../../components/Skeleton';
import { StarsDisplay } from '../../components/Stars';
import { COMMUNES, RESTAURANT_TYPES } from '../../menuCategories';

export default function RestaurantList() {
  const { token } = useAuth();
  const [restaurants, setRestaurants] = useState([]);
  const [favoriteIds, setFavoriteIds] = useState(new Set());
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [commune, setCommune] = useState('');
  const [cuisine, setCuisine] = useState('');
  const toast = useToast();

  useEffect(() => {
    api('/restaurants').then(setRestaurants).catch((e) => toast(e.message)).finally(() => setLoading(false));
    api('/restaurants/favorites/ids', { token }).then((ids) => setFavoriteIds(new Set(ids))).catch(() => {});
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  async function toggleFavorite(e, id) {
    e.preventDefault();
    e.stopPropagation();
    const isFav = favoriteIds.has(id);
    try {
      if (isFav) {
        await api(`/restaurants/${id}/favorite`, { method: 'DELETE', token });
        setFavoriteIds((prev) => { const next = new Set(prev); next.delete(id); return next; });
      } else {
        await api(`/restaurants/${id}/favorite`, { method: 'POST', token });
        setFavoriteIds((prev) => new Set(prev).add(id));
      }
    } catch (err) {
      toast(err.message);
    }
  }

  const list = restaurants.filter((r) => {
    if (commune && r.commune !== commune) return false;
    if (cuisine && r.cuisine !== cuisine) return false;
    if (search && !`${r.name} ${r.desc} ${r.cuisine}`.toLowerCase().includes(search.toLowerCase())) return false;
    return true;
  });

  return (
    <div>
      <div className="row" style={{ marginBottom: 14 }}>
        <input placeholder="Chercher un restaurant ou un plat" style={{ flex: 2, minWidth: 160 }} value={search} onChange={(e) => setSearch(e.target.value)} />
        <select style={{ flex: 1, minWidth: 130 }} value={commune} onChange={(e) => setCommune(e.target.value)}>
          <option value="">Toutes les communes</option>
          {COMMUNES.map((c) => <option key={c}>{c}</option>)}
        </select>
        <select style={{ flex: 1, minWidth: 130 }} value={cuisine} onChange={(e) => setCuisine(e.target.value)}>
          <option value="">Tous les types</option>
          {RESTAURANT_TYPES.map((t) => <option key={t.value} value={t.value}>{t.emoji} {t.value}</option>)}
        </select>
      </div>
      {!loading && <div className="small" style={{ marginBottom: 14 }}>{list.length} restaurant(s)</div>}
      {loading && <SkeletonCards count={4} />}
      <div className="rest-grid">
        {!loading && list.map((r) => (
          <Link key={r.id} to={`/restaurants/${r.id}`} className="card rest-card" style={{ position: 'relative' }}>
            <button
              onClick={(e) => toggleFavorite(e, r.id)}
              style={{ position: 'absolute', top: 10, right: 10, background: 'rgba(255,255,255,0.9)', border: 'none', borderRadius: '50%', width: 32, height: 32, fontSize: 16, cursor: 'pointer' }}
              title="Ajouter aux favoris"
            >
              {favoriteIds.has(r.id) ? '❤️' : '🤍'}
            </button>
            {r.hasPromo && <span className="promo-badge">🏷️ Promo</span>}
            {r.coverImageUrl && <img src={r.coverImageUrl} alt={r.name} className="cover-banner-sm" />}
            <div className="pill-row">
              <span className="pill teal">{r.commune}</span>
              {r.neighborhood && <span className="pill gold">{r.neighborhood}</span>}
            </div>
            <h3 style={{ margin: '8px 0 4px' }}>{r.name}</h3>
            <div className="row" style={{ gap: 6, margin: '2px 0' }}>
              <StarsDisplay value={r.rating} />
              <span className="small">{r.reviewCount > 0 ? `(${r.reviewCount})` : 'Nouveau'}</span>
            </div>
            <p className="small">{r.desc || ''} {r.cuisine ? `· ${r.cuisine}` : ''}</p>
            <span className="small">{r.menu.length} plats</span>
          </Link>
        ))}
      </div>
      {!loading && list.length === 0 && (
        <div className="empty">Aucun restaurant pour le moment.</div>
      )}
    </div>
  );
}
