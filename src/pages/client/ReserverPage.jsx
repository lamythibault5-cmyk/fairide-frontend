import { useEffect, useState } from 'react';
import { useNavigate, useParams, useSearchParams } from 'react-router-dom';
import { api } from '../../api';
import { useAuth } from '../../context/AuthContext';
import { useLanguage, getLocale } from '../../context/LanguageContext';
import { SkeletonCards } from '../../components/Skeleton';
import { StarsDisplay } from '../../components/Stars';
import ReservationSteps from '../../components/ReservationSteps';
import usePageMeta from '../../hooks/usePageMeta';
import { reservationsOuvertes, dateOuvertureReservations } from '../../launch';
import { formatFullSchedule } from '../../openingHours';

// Page publique /reserver/:id — le lien que le restaurateur colle sur sa fiche Google, Instagram,
// Facebook ou son site (onglet Intégration). Elle présente le commerce (photo, adresse, horaires,
// avis) puis le parcours de réservation (components/ReservationSteps.jsx) ; la connexion n'est
// demandée qu'à l'étape des coordonnées, et l'on revient ici après. `?embed=1` (iframe) masque la
// présentation pour ne garder que le formulaire.

export default function ReserverPage() {
  const { id } = useParams();
  const [params] = useSearchParams();
  const embed = params.get('embed') === '1';
  const { t } = useLanguage();
  const { user, token } = useAuth();
  const navigate = useNavigate();
  const [restaurant, setRestaurant] = useState(null);
  const [erreur, setErreur] = useState('');

  usePageMeta({ title: restaurant ? t('reserver.pageTitle', { name: restaurant.name }) : t('reserver.title'), path: `/reserver/${id}` });

  useEffect(() => {
    let annule = false;
    setErreur('');
    api(`/restaurants/${id}`).then((r) => { if (!annule) setRestaurant(r); }).catch((e) => { if (!annule) setErreur(e.status === 404 ? t('reserver.notFound') : e.message); });
    return () => { annule = true; };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [id]);

  if (erreur) {
    return (
      <div className="card" style={{ maxWidth: 560, margin: '20px auto' }}>
        <p style={{ margin: 0 }}>{erreur}</p>
        <button type="button" className="btn-outline" style={{ marginTop: 12 }} onClick={() => navigate('/restaurants')}>{t('reserver.browse')}</button>
      </div>
    );
  }
  if (!restaurant) return <SkeletonCards count={2} />;

  const horaires = restaurant.hours ? formatFullSchedule(restaurant.hours, t) : null;
  const ouvert = reservationsOuvertes(user);

  return (
    <div className="resa-wizard" style={{ maxWidth: 640, margin: '0 auto' }}>
      {!embed && (
        <div className="card" style={{ padding: 0, overflow: 'hidden', marginBottom: 12 }}>
          {restaurant.coverImageUrl && <img src={restaurant.coverImageUrl} alt="" style={{ width: '100%', height: 160, objectFit: 'cover', display: 'block' }} />}
          <div style={{ padding: '14px 16px' }}>
            <div className="row" style={{ gap: 10, alignItems: 'center' }}>
              {restaurant.logoImageUrl && <img src={restaurant.logoImageUrl} alt="" style={{ width: 48, height: 48, borderRadius: 12, objectFit: 'cover' }} />}
              <div style={{ minWidth: 0 }}>
                <h1 style={{ margin: 0, fontSize: 20 }}>{restaurant.name}</h1>
                <span className="small">{restaurant.cuisine}{restaurant.commune ? ` · ${restaurant.commune}` : ''}</span>
              </div>
            </div>
            {restaurant.reviewCount > 0 && (
              <div className="row" style={{ gap: 6, marginTop: 8, alignItems: 'center' }}>
                <StarsDisplay value={restaurant.rating} />
                <span className="small">{t('reserver.reviews', { rating: Number(restaurant.rating).toFixed(1), count: restaurant.reviewCount })}</span>
              </div>
            )}
            {restaurant.address && <p className="small" style={{ margin: '8px 0 0' }}>📍 {restaurant.address}</p>}
            {restaurant.phone && <p className="small" style={{ margin: '4px 0 0' }}>📞 <a href={`tel:${restaurant.phone}`}>{restaurant.phone}</a></p>}
            {Array.isArray(horaires) && horaires.length > 0 && (
              <details style={{ marginTop: 8 }}>
                <summary className="small" style={{ cursor: 'pointer' }}>{t('reserver.hours')}</summary>
                <ul className="small" style={{ margin: '6px 0 0', paddingLeft: 18 }}>
                  {horaires.map((l, i) => <li key={i}>{typeof l === 'string' ? l : `${l.day} : ${l.schedule}`}</li>)}
                </ul>
              </details>
            )}
            {!user && (
              <p className="small" style={{ margin: '10px 0 0', padding: '8px 10px', background: 'var(--cream-dim)', borderRadius: 9 }}>{t('reserver.loginNote')}</p>
            )}
            <p className="small" style={{ margin: '8px 0 0' }}>
              <button type="button" className="btn-ghost" style={{ padding: '2px 6px' }} onClick={() => navigate(`/restaurants/${id}`)}>{t('reserver.seeMenu')}</button>
            </p>
          </div>
        </div>
      )}

      {!restaurant.offersDineIn && (
        <div className="card">
          <p style={{ margin: 0 }}>{t('reserver.noReservations', { name: restaurant.name })}</p>
          <button type="button" className="btn-outline" style={{ marginTop: 12 }} onClick={() => navigate(`/restaurants/${id}`)}>{t('reserver.seeMenu')}</button>
        </div>
      )}
      {restaurant.offersDineIn && !ouvert && (
        <div className="card">
          <p style={{ margin: 0 }}>🗓️ {t('reserver.opensOn', { date: dateOuvertureReservations(getLocale()), name: restaurant.name })}</p>
          <p className="small" style={{ margin: '8px 0 0' }}>{t('reserver.opensHelp')}{restaurant.phone ? ` ${t('reserver.callMeanwhile', { phone: restaurant.phone })}` : ''}</p>
        </div>
      )}
      {restaurant.offersDineIn && ouvert && (
        <ReservationSteps restaurantId={id} restaurant={restaurant} mode="client" token={token} user={user} />
      )}
      <p className="small" style={{ textAlign: 'center', margin: '12px 0 0', color: 'var(--ink-soft)' }}>{t('reserver.poweredBy')}</p>
    </div>
  );
}
