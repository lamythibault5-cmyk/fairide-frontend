import { useOutletContext } from 'react-router-dom';
import { StarsDisplay } from '../../components/Stars';

export default function ReviewsPage() {
  const { restaurant, reviews } = useOutletContext();

  return (
    <div>
      <h2 className="section-title" style={{ marginTop: 0 }}>Avis clients</h2>
      <div className="row" style={{ gap: 6, marginBottom: 14 }}>
        <StarsDisplay value={restaurant.rating} />
        <span className="small">{restaurant.reviewCount > 0 ? `${restaurant.rating.toFixed(1)} (${restaurant.reviewCount} avis)` : "Pas encore d'avis"}</span>
      </div>
      {(!reviews || reviews.reviews.length === 0) && <div className="empty">Pas encore d'avis client.</div>}
      {reviews && reviews.reviews.length > 0 && (
        <div className="card">
          {reviews.reviews.map((r, i) => (
            <div key={i} style={{ padding: '8px 0', borderBottom: '1px solid var(--cream-dim)' }}>
              <div className="row" style={{ justifyContent: 'space-between' }}>
                <b style={{ fontSize: 13 }}>{r.clientName}</b>
                <StarsDisplay value={r.foodRating} />
              </div>
              {r.foodComment && <p className="small" style={{ margin: '4px 0 0' }}>{r.foodComment}</p>}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
