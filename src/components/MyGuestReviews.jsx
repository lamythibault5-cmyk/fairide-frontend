import { useEffect, useState } from 'react';
import { api } from '../api';
import { useAuth } from '../context/AuthContext';
import { useLanguage, getLocale } from '../context/LanguageContext';
import { Etoiles } from './reservations/GuestReliability';

// Mon compte (client) : ce que les restaurants ont écrit sur la fiabilité du client après ses réservations — exactement
// ce que voient les restaurants à qui il demande une table. Un avis contesté se signale au support.
export default function MyGuestReviews() {
  const { t } = useLanguage();
  const { token } = useAuth();
  const [d, setD] = useState(null);
  const [erreur, setErreur] = useState('');
  useEffect(() => { api('/orders/guest-reviews/mine', { token }).then(setD).catch((e) => setErreur(e.message)); }, [token]);
  if (erreur) return <p className="small">{erreur}</p>;
  if (!d) return <p className="small">{t('accountUi.loading')}</p>;
  const date = (ms) => new Date(ms).toLocaleDateString(getLocale(), { day: 'numeric', month: 'long', year: 'numeric' });
  return (
    <div>
      <p className="small" style={{ margin: '0 0 8px' }}>{t('accountUi.guestReviewsIntro')}</p>
      {d.count === 0 ? <p className="small" style={{ margin: 0 }}>{t('accountUi.guestReviewsNone')}</p> : (
        <>
          <p style={{ margin: '0 0 8px' }}><Etoiles note={d.average} taille={16} /> <b>{String(d.average).replace('.', ',')}/5</b> <span className="small">· {t('accountUi.guestReviewsCount', { n: d.count })}</span></p>
          <ul className="resa-avis-liste">
            {d.reviews.map((a, i) => (
              <li key={i}>
                <Etoiles note={a.rating} taille={12} /> <span className="small">{t('accountUi.guestReviewsFrom', { name: a.restaurantName, date: date(a.reservationAt) })}</span>
                {a.comment && <div className="small">« {a.comment} »</div>}
              </li>
            ))}
          </ul>
        </>
      )}
      <p className="small" style={{ margin: '8px 0 0', opacity: 0.8 }}>{t('accountUi.guestReviewsContest')}</p>
    </div>
  );
}
