import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { api } from '../../api';
import { useAuth } from '../../context/AuthContext';
import { useToast } from '../../context/ToastContext';
import { SkeletonCards } from '../../components/Skeleton';
import { StarsDisplay } from '../../components/Stars';
import RestaurantsMap from '../../components/RestaurantsMap';
import { COMMUNES, RESTAURANT_TYPES, communeRingDistance, restaurantTypeLabel } from '../../menuCategories';
import { useLanguage } from '../../context/LanguageContext';

// Normalise pour comparer "Ixelles", "ixelles", "Ixelles " ou une variante accentuée saisie librement
// à l'inscription contre la liste officielle des 19 communes (comparaison insensible à la casse/aux accents).
function normalizeCommune(s) {
  return (s || '').normalize('NFD').replace(/[̀-ͯ]/g, '').trim().toLowerCase();
}

function matchCommune(addressCity) {
  const target = normalizeCommune(addressCity);
  if (!target) return null;
  return COMMUNES.find((c) => normalizeCommune(c) === target) || null;
}

export default function RestaurantList() {
  const { token, user } = useAuth();
  const { t } = useLanguage();
  const homeCommune = matchCommune(user?.addressCity);
  const [restaurants, setRestaurants] = useState([]);
  const [favoriteIds, setFavoriteIds] = useState(new Set());
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [commune, setCommune] = useState('');
  const [cuisine, setCuisine] = useState('');
  const [view, setView] = useState('list');
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

  const cuisineOptions = [{ value: '', emoji: '🍽️', label: t('restaurantList.allCuisines') }, ...RESTAURANT_TYPES.map((rt) => ({ value: rt.value, emoji: rt.emoji, label: restaurantTypeLabel(rt.value, t) }))];

  const list = restaurants
    .filter((r) => {
      if (commune && r.commune !== commune) return false;
      if (cuisine && r.cuisine !== cuisine) return false;
      if (search && !`${r.name} ${r.desc} ${r.cuisine}`.toLowerCase().includes(search.toLowerCase())) return false;
      return true;
    })
    // Sans filtre de commune explicite : d'abord les commerces de la commune du client, puis ceux
    // des communes limitrophes, de proche en proche. Sort étant stable, l'ordre existant (plus
    // récent d'abord, envoyé par le serveur) reste la règle de départage au sein d'un même anneau.
    .sort((a, b) => {
      if (!homeCommune || commune) return 0;
      return communeRingDistance(homeCommune, a.commune) - communeRingDistance(homeCommune, b.commune);
    });

  return (
    <div>
      <div className="cuisine-scroll">
        <div className="cuisine-track">
          {cuisineOptions.map((opt) => (
            <div
              key={`a-${opt.value}`}
              className={`cuisine-chip${cuisine === opt.value ? ' active' : ''}`}
              onClick={() => setCuisine(cuisine === opt.value ? '' : opt.value)}
            >
              <span className="emoji">{opt.emoji}</span>
              <span>{opt.label}</span>
            </div>
          ))}
          {cuisineOptions.map((opt) => (
            <div
              key={`b-${opt.value}`}
              aria-hidden="true"
              tabIndex={-1}
              className={`cuisine-chip${cuisine === opt.value ? ' active' : ''}`}
              onClick={() => setCuisine(cuisine === opt.value ? '' : opt.value)}
            >
              <span className="emoji">{opt.emoji}</span>
              <span>{opt.label}</span>
            </div>
          ))}
        </div>
      </div>
      <div className="row" style={{ marginBottom: 14 }}>
        <input placeholder={t('restaurantList.searchPlaceholder')} style={{ flex: 2, minWidth: 160 }} value={search} onChange={(e) => setSearch(e.target.value)} />
        <select style={{ flex: 1, minWidth: 130 }} value={commune} onChange={(e) => setCommune(e.target.value)}>
          <option value="">{t('restaurantList.allCommunes')}</option>
          {COMMUNES.map((c) => <option key={c}>{c}</option>)}
        </select>
      </div>
      <div className="role-pick" style={{ marginBottom: 14 }}>
        <div className={`chip${view === 'list' ? ' active' : ''}`} onClick={() => setView('list')}>{t('restaurantList.viewList')}</div>
        <div className={`chip${view === 'map' ? ' active' : ''}`} onClick={() => setView('map')}>{t('restaurantList.viewMap')}</div>
      </div>
      {!loading && <div className="small" style={{ marginBottom: 14 }}>{t('restaurantList.count', { count: list.length })}</div>}
      {loading && <SkeletonCards count={4} />}
      {!loading && view === 'map' && (
        <div className="card">
          <RestaurantsMap
            restaurants={list}
            userLocation={user?.lat && user?.lng ? { lat: user.lat, lng: user.lng, address: user.address } : null}
          />
        </div>
      )}
      {!loading && view === 'list' && (
      <div className="rest-grid">
        {list.map((r) => (
          <Link key={r.id} to={`/restaurants/${r.id}`} className="card rest-card" style={{ position: 'relative' }}>
            <button
              onClick={(e) => toggleFavorite(e, r.id)}
              className="rest-card-fav"
              title={t('restaurantList.addFavorite')}
            >
              {favoriteIds.has(r.id) ? '❤️' : '🤍'}
            </button>
            {r.hasPromo && <span className="promo-badge">🏷️ Promo</span>}
            {r.coverImageUrl && <img src={r.coverImageUrl} alt={r.name} className="cover-banner-sm" />}
            <div className="pill-row">
              <span className="pill teal">{r.commune}</span>
              {r.neighborhood && <span className="pill gold">{r.neighborhood}</span>}
            </div>
            <h3 className="rest-card-name" style={{ margin: '8px 0 4px' }}>{r.name}</h3>
            <div className="row rest-card-rating" style={{ gap: 6, margin: '2px 0' }}>
              <StarsDisplay value={r.rating} />
              <span className="small rest-card-reviews">{r.reviewCount > 0 ? `(${r.reviewCount})` : t('restaurantList.newBadge')}</span>
            </div>
            <p className="small rest-card-desc">{r.desc || ''} {r.cuisine ? `· ${restaurantTypeLabel(r.cuisine, t)}` : ''}</p>
            <span className="small rest-card-dishes">{t('restaurantList.dishesCount', { count: r.menu.length })}</span>
          </Link>
        ))}
      </div>
      )}
      {!loading && list.length === 0 && (
        <div className="empty">{t('restaurantList.empty')}</div>
      )}
    </div>
  );
}
