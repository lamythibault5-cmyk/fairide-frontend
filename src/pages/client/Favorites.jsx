import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { api } from '../../api';
import { useAuth } from '../../context/AuthContext';
import { useToast } from '../../context/ToastContext';
import { SkeletonCards } from '../../components/Skeleton';

export default function Favorites() {
  const { token } = useAuth();
  const [restaurants, setRestaurants] = useState([]);
  const [loading, setLoading] = useState(true);
  const toast = useToast();

  useEffect(() => {
    api('/restaurants/favorites/mine', { token }).then(setRestaurants).catch((e) => toast(e.message)).finally(() => setLoading(false));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return (
    <div>
      <h2 className="section-title" style={{ marginTop: 0 }}>Mes favoris</h2>
      {loading && <SkeletonCards count={4} />}
      {!loading && restaurants.length === 0 && (
        <div className="empty">Pas encore de favori. Ajoute un restaurant avec le cœur 🤍 sur sa page.</div>
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
            <p className="small">{r.desc || ''} {r.cuisine ? `· ${r.cuisine}` : ''}</p>
            <span className="small">{r.menu.length} plats</span>
          </Link>
        ))}
      </div>
    </div>
  );
}
