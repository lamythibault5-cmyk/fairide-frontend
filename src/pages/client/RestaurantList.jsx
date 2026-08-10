import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { api } from '../../api';
import { useToast } from '../../context/ToastContext';
import { SkeletonCards } from '../../components/Skeleton';

const COMMUNES = ['Ixelles', 'Saint-Gilles', 'Etterbeek', 'Schaerbeek', 'Uccle', 'Woluwe-Saint-Lambert', 'Woluwe-Saint-Pierre'];

export default function RestaurantList() {
  const [restaurants, setRestaurants] = useState([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [commune, setCommune] = useState('');
  const toast = useToast();

  useEffect(() => {
    api('/restaurants').then(setRestaurants).catch((e) => toast(e.message)).finally(() => setLoading(false));
  }, []);

  const list = restaurants.filter((r) => {
    if (commune && r.commune !== commune) return false;
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
      </div>
      {!loading && <div className="small" style={{ marginBottom: 14 }}>{list.length} restaurant(s)</div>}
      {loading && <SkeletonCards count={4} />}
      <div className="rest-grid">
        {!loading && list.map((r) => (
          <Link key={r.id} to={`/restaurants/${r.id}`} className="card rest-card">
            {r.coverImageUrl && <img src={r.coverImageUrl} alt={r.name} className="cover-banner-sm" />}
            <span className="pill teal">{r.commune}</span>
            <h3 style={{ margin: '8px 0 4px' }}>{r.name}</h3>
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
