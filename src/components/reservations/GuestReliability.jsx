import { useState } from 'react';
import { api } from '../../api';
import { useLanguage, getLocale } from '../../context/LanguageContext';

// Fiabilité du client dans une réservation : ce que les autres restaurants en disent (lu avant d'accepter), et, une
// fois la réservation terminée, la note que ce restaurant laisse à son tour. Les avis ne portent que sur des faits
// liés à la réservation ; le client les voit aussi (Mon compte). Données : GET …/reservations/:id/history.
export function Etoiles({ note, taille = 14 }) {
  const n = Math.round(Number(note) || 0);
  return (
    <span className="etoiles" style={{ fontSize: taille }} aria-label={`${note}/5`}>
      {[1, 2, 3, 4, 5].map((i) => <span key={i} className={i <= n ? 'pleine' : ''} aria-hidden="true">★</span>)}
    </span>
  );
}

export default function GuestReliability({ restoId, reservationId, token, toast, avis, onMaj }) {
  const { t } = useLanguage();
  const [note, setNote] = useState(avis?.myReview?.rating || 0);
  const [commentaire, setCommentaire] = useState(avis?.myReview?.comment || '');
  const [envoi, setEnvoi] = useState(false);
  const [edition, setEdition] = useState(!avis?.myReview);
  if (!avis || (!avis.reliability && !avis.reviewOpensAt)) return null;
  const f = avis.reliability;
  const date = (ms) => new Date(ms).toLocaleDateString(getLocale(), { day: 'numeric', month: 'short', year: 'numeric' });
  const heure = (ms) => new Date(ms).toLocaleString(getLocale(), { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' });

  async function enregistrer() {
    if (!note) { toast(t('resa.rateNeedStars')); return; }
    setEnvoi(true);
    try {
      const r = await api(`/restaurants/${restoId}/reservations/${reservationId}/guest-review`, { method: 'PUT', token, body: { rating: note, comment: commentaire } });
      onMaj(r); setEdition(false); toast(t('resa.rateSaved'));
    } catch (e) { toast(e.message); } finally { setEnvoi(false); }
  }

  return (
    <div className="resa-fiabilite">
      <h4>
        🛡️ {t('resa.relTitle')}
        {f && f.count > 0 && <span className="small" style={{ fontWeight: 400 }}><Etoiles note={f.average} /> {t('resa.relSummary', { avg: String(f.average).replace('.', ','), n: f.count })}</span>}
      </h4>
      {f && (
        <p className="small" style={{ margin: '0 0 6px' }}>
          {t('resa.relVisits', { n: f.visits })}{f.noShows > 0 && <b className="resa-fiabilite-alerte"> · {t('resa.relNoShows', { n: f.noShows })}</b>}
        </p>
      )}
      {f && f.count === 0 && <p className="small" style={{ margin: 0 }}>{t('resa.relNone')}</p>}
      {f && f.reviews.length > 0 && (
        <ul className="resa-avis-liste">
          {f.reviews.slice(0, 6).map((a, i) => (
            <li key={i}>
              <Etoiles note={a.rating} taille={12} /> <span className="small">{t('resa.relFrom', { name: a.restaurantName, date: date(a.at) })}{a.arrival === 'no_show' ? ` · ${t('resa.relWasNoShow')}` : ''}</span>
              {a.comment && <div className="small">« {a.comment} »</div>}
            </li>
          ))}
        </ul>
      )}

      {avis.reviewOpensAt && (
        <div className="resa-noter">
          <b className="small">{t('resa.rateTitle')}</b>
          {!avis.canReview && !avis.myReview && Date.now() < avis.reviewOpensAt && <p className="small" style={{ margin: '4px 0 0' }}>⏳ {t('resa.rateLocked', { when: heure(avis.reviewOpensAt) })}</p>}
          {!avis.canReview && !avis.myReview && Date.now() >= avis.reviewOpensAt && <p className="small" style={{ margin: '4px 0 0' }}>{t('resa.rateClosed')}</p>}
          {avis.myReview && !edition && (
            <p className="small" style={{ margin: '4px 0 0' }}>
              <Etoiles note={avis.myReview.rating} /> {avis.myReview.comment ? `« ${avis.myReview.comment} »` : ''}
              {avis.canReview && <button type="button" className="btn-link-plus" style={{ marginLeft: 6 }} onClick={() => setEdition(true)}>{t('resa.rateEdit')}</button>}
            </p>
          )}
          {avis.canReview && edition && (
            <>
              <div className="resa-noter-etoiles" role="radiogroup" aria-label={t('resa.rateTitle')}>
                {[1, 2, 3, 4, 5].map((i) => (
                  <button key={i} type="button" role="radio" aria-checked={note === i} className={i <= note ? 'pleine' : ''} onClick={() => setNote(i)} aria-label={`${i}/5`}>★</button>
                ))}
              </div>
              <textarea rows={2} maxLength={500} value={commentaire} placeholder={t('resa.ratePh')} onChange={(e) => setCommentaire(e.target.value)} />
              <p className="small" style={{ margin: '4px 0 6px', opacity: 0.8 }}>{t('resa.rateRules')}</p>
              <button type="button" className="btn-outline" style={{ padding: '6px 12px' }} disabled={envoi} onClick={enregistrer}>{envoi ? '…' : t('resa.rateSave')}</button>
            </>
          )}
        </div>
      )}
    </div>
  );
}
