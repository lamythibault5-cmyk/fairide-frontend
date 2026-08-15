import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { api } from '../../api';
import { useAuth } from '../../context/AuthContext';
import { useToast } from '../../context/ToastContext';
import { SkeletonCards } from '../../components/Skeleton';
import { useLanguage } from '../../context/LanguageContext';
import { restaurantTypeLabel } from '../../menuCategories';

export default function Favorites() {
  const { token } = useAuth();
  const [restaurants, setRestaurants] = useState([]);
  const [loading, setLoading] = useState(true);
  const toast = useToast();
  const { t } = useLanguage();

  useEffect(() => {
    api('/restaurants/favorites/mine', { token }).then(setRestaurants).catch((e) => toast(e.message)).finally(() => setLoading(false));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return (
    <div>
      <h2 className="section-title" style={{ marginTop: 0 }}>{t('favorites.title')}</h2>
      {loading && <SkeletonCards count={4} />}
      {!loading && restaurants.length === 0 && (
        <div className="empty">{t('favorites.empty')}</div>
      )}
      <div className="rest-grid">
        {!loading && restaurants.map((r) => (
          <Link key={r.id} to={`/restaurants/${r.id}`} className="card rest-card">
            {r.coverImageUrl && <img src={r.coverImageUrl} alt={r.name} className="cover-banner-sm" />}
            <div className="pill-row">
              <span className="pill teal">{r.commune}</span>
              {r.neighborhood && <span className="pill gold">{r.neighborhood}</span>}
            </div>
            <h3 style={{ margin: '8px 0 4px' }}>{r.name}</h3>
            <p className="small">{r.desc || ''} {r.cuisine ? `· ${restaurantTypeLabel(r.cuisine, t)}` : ''}</p>
            <span className="small">{t('restaurantList.dishesCount', { count: r.menu.length })}</span>
          </Link>
        ))}
      </div>
    </div>
  );
}
