import { useEffect, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { api } from '../../api';
import { useAuth } from '../../context/AuthContext';
import { useLanguage } from '../../context/LanguageContext';
import { SkeletonCards } from '../../components/Skeleton';
import ReservationSteps from '../../components/ReservationSteps';
import usePageMeta from '../../hooks/usePageMeta';

// Page publique /restaurants/:id/reserver : le parcours de réservation côté client (voir
// components/ReservationSteps.jsx, partagé avec la saisie manuelle du restaurateur).
export default function ReservationWizard() {
  const { id } = useParams();
  const { t } = useLanguage();
  const { user, token } = useAuth();
  const navigate = useNavigate();
  const [restaurant, setRestaurant] = useState(null);
  const [introuvable, setIntrouvable] = useState(false);

  usePageMeta({ title: restaurant ? t('resaWizard.pageTitle', { name: restaurant.name }) : t('resaWizard.title') });

  useEffect(() => {
    api(`/restaurants/${id}`).then(setRestaurant).catch(() => setIntrouvable(true));
  }, [id]);

  if (introuvable) return <div className="empty">{t('resaWizard.notFound')}</div>;
  if (!restaurant) return <SkeletonCards count={2} />;
  if (!restaurant.offersDineIn) {
    return (
      <div className="card">
        <p style={{ margin: 0 }}>{t('resaWizard.noReservations', { name: restaurant.name })}</p>
        <button type="button" className="btn-outline" style={{ marginTop: 12 }} onClick={() => navigate(`/restaurants/${id}`)}>{t('resaWizard.backToRestaurant')}</button>
      </div>
    );
  }
  return <ReservationSteps restaurantId={id} restaurant={restaurant} mode="client" token={token} user={user} />;
}
