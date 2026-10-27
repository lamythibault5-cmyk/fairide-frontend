import { useOutletContext, useNavigate } from 'react-router-dom';
import { usePreviewMode } from '../../context/PreviewModeContext';
import RestaurantPreview from '../../components/RestaurantPreview';
import { useLanguage } from '../../context/LanguageContext';
import Icone from '../../components/Icone';
import CadreSite from '../../components/commerce/CadreSite';

export default function PreviewPage() {
  const { t } = useLanguage();
  const { restaurant } = useOutletContext();
  const { enterPreview } = usePreviewMode();
  const navigate = useNavigate();

  function tryAsClient() {
    enterPreview();
    navigate('/restaurants');
  }

  return (
    // Le bandeau iris dans l'app aussi (fondateur, 2026-10-25, maquettes/une-action/panier-et-site, réponse 9).
    <CadreSite titre={t('previewPage.title')} sous={t('previewPage.intro')} appli>
      {restaurant && !restaurant.publicListed && !restaurant.isDemo && (
        <div className="card preview-not-visible" role="status">
          <b><Icone nom="masque" taille={16} className="icone-texte" />{' '}{t('previewPage.notVisibleTitle')}</b>
          <p className="small" style={{ margin: '4px 0 0' }}>{t('previewPage.notVisibleText')}</p>
        </div>
      )}
      {/* UNE PHRASE, UN BOUTON (fondateur, 2026-10-27, S8 de maquettes/audit-ecrans) : une carte expliquait l'aperçu, puis un
          encadré noir le réexpliquait. La phrase est dans le bandeau, le bouton iris reste, l'encadré noir est parti
          (RestaurantPreview). Le texte long (tryAppHelp) est en infobulle pour qui veut savoir. */}
      <button type="button" className="btn-outline" style={{ marginBottom: 14 }} onClick={tryAsClient} title={t('previewPage.tryAppHelp')}>{t('previewPage.tryAsCustomer')}</button>
      <div className="card">
        <RestaurantPreview restaurant={restaurant} />
      </div>
    </CadreSite>
  );
}
