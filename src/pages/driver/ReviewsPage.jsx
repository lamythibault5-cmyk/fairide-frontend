import { useLanguage } from '../../context/LanguageContext';
import PageLivreur from '../../components/livreur/PageLivreur';

// « Mes avis » (livreur). Depuis CODE-13 (8 oct. 2026, DEC-21), les clients ne notent plus la livraison : un livreur est
// un indépendant, et laisser la plateforme évaluer sa prestation est l'un des critères de la présomption de salariat
// (art. 337/3, 6°, loi-programme du 27/12/2006). La page reste à son adresse (liens et favoris existants) et le dit,
// sans plus appeler /reviews/driver/mine ni afficher d'étoiles.
export default function ReviewsPage() {
  const { t } = useLanguage();
  return (
    <PageLivreur titre={t('reviewsDriver.title')}>
      <div className="card"><p className="small" style={{ margin: 0 }}>{t('reviewsDriver.noRatings')}</p></div>
    </PageLivreur>
  );
}
