import { useState } from 'react';
import { useOutletContext } from 'react-router-dom';
import { api } from '../../api';
import { useAuth } from '../../context/AuthContext';
import { useToast } from '../../context/ToastContext';
import { StarsDisplay } from '../../components/Stars';

// La réponse du restaurateur est publique (visible aux clients sur la fiche resto, voir
// RestaurantMenu.jsx) — pensée pour se justifier publiquement en cas d'avis contestable, pas comme
// un canal de discussion privé.
export default function ReviewsPage() {
  const { token } = useAuth();
  const toast = useToast();
  const { restaurant, reviews, loadDashboard, restoId } = useOutletContext();
  const [editingId, setEditingId] = useState(null);
  const [replyDrafts, setReplyDrafts] = useState({});
  const [saving, setSaving] = useState(false);

  function startReply(review) {
    setEditingId(review.id);
    setReplyDrafts((prev) => ({ ...prev, [review.id]: review.restaurantReply || '' }));
  }

  async function saveReply(reviewId) {
    setSaving(true);
    try {
      await api(`/reviews/${reviewId}/reply`, { method: 'PATCH', token, body: { reply: replyDrafts[reviewId] || '' } });
      toast('Réponse enregistrée.');
      setEditingId(null);
      await loadDashboard(restoId);
    } catch (e) {
      toast(e.message);
    } finally {
      setSaving(false);
    }
  }

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
          {reviews.reviews.map((r) => (
            <div key={r.id} style={{ padding: '10px 0', borderBottom: '1px solid var(--cream-dim)' }}>
              <div className="row" style={{ justifyContent: 'space-between' }}>
                <b style={{ fontSize: 13 }}>{r.clientName}</b>
                <StarsDisplay value={r.foodRating} />
              </div>
              {r.foodComment && <p className="small" style={{ margin: '4px 0 0' }}>{r.foodComment}</p>}

              {r.restaurantReply && editingId !== r.id && (
                <div style={{ marginTop: 8, paddingLeft: 10, borderLeft: '2px solid var(--teal)' }}>
                  <div className="small" style={{ fontWeight: 700 }}>Ta réponse</div>
                  <p className="small" style={{ margin: '2px 0 0' }}>{r.restaurantReply}</p>
                  <button type="button" className="btn-ghost" style={{ marginTop: 4, fontSize: 12, padding: '2px 8px' }} onClick={() => startReply(r)}>Modifier</button>
                </div>
              )}
              {!r.restaurantReply && editingId !== r.id && (
                <button type="button" className="btn-ghost" style={{ marginTop: 6, fontSize: 12, padding: '2px 8px' }} onClick={() => startReply(r)}>Répondre</button>
              )}
              {editingId === r.id && (
                <div style={{ marginTop: 8 }}>
                  <textarea
                    rows={3}
                    value={replyDrafts[r.id] || ''}
                    onChange={(e) => setReplyDrafts((prev) => ({ ...prev, [r.id]: e.target.value }))}
                    placeholder="Réponds publiquement pour apporter des précisions ou une justification..."
                    style={{ width: '100%' }}
                  />
                  <div className="row" style={{ gap: 8, marginTop: 6 }}>
                    <button type="button" className="btn-teal" disabled={saving} onClick={() => saveReply(r.id)}>{saving ? '...' : 'Enregistrer'}</button>
                    <button type="button" className="btn-ghost" onClick={() => setEditingId(null)}>Annuler</button>
                  </div>
                </div>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
