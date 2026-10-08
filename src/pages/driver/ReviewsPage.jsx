import { useLanguage } from '../../context/LanguageContext';

// « Mes avis » (livreur). Depuis CODE-13 (8 oct. 2026, DEC-21), les clients ne notent plus la livraison : un livreur est
// un indépendant, et laisser la plateforme évaluer sa prestation est l'un des critères de la présomption de salariat
// (art. 337/3, 6°, loi-programme du 27/12/2006). La page reste à son adresse (liens et favoris existants) et le dit,
// sans plus appeler /reviews/driver/mine ni afficher d'étoiles.
export default function ReviewsPage() {
  const { t } = useLanguage();
  return (
    <div>
      <h2 className="section-title" style={{ marginTop: 0 }}>{t('reviewsDriver.title')}</h2>
      <div className="card"><p className="small" style={{ margin: 0 }}>{t('reviewsDriver.noRatings')}</p></div>
    </div>
  );
}
