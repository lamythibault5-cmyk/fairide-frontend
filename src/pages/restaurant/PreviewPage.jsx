import { useOutletContext, useNavigate } from 'react-router-dom';
import { usePreviewMode } from '../../context/PreviewModeContext';
import RestaurantPreview from '../../components/RestaurantPreview';
import { useLanguage } from '../../context/LanguageContext';
import Icone from '../../components/Icone';
import CadreSite, { SITE } from '../../components/commerce/CadreSite';

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
    <CadreSite titre={t('previewPage.title')} sous={t('previewPage.intro')}>
      {!SITE && <h2 className="section-title" style={{ marginTop: 0 }}>{t('previewPage.title')}</h2>}
      {!SITE && <p className="small" style={{ margin: '0 0 14px' }}>{t('previewPage.intro')}</p>}
      {restaurant && !restaurant.publicListed && !restaurant.isDemo && (
        <div className="card preview-not-visible" role="status">
          <b><Icone nom="masque" taille={16} className="icone-texte" />{' '}{t('previewPage.notVisibleTitle')}</b>
          <p className="small" style={{ margin: '4px 0 0' }}>{t('previewPage.notVisibleText')}</p>
        </div>
      )}
      <div className="card" style={{ marginBottom: 14 }}>
        <h3 style={{ margin: '0 0 6px', fontSize: 15 }}>{t('previewPage.tryAppTitle')}</h3>
        <p className="small" style={{ margin: '0 0 12px' }}>
          {t('previewPage.tryAppHelp')}
        </p>
        <button type="button" className="btn-outline" onClick={tryAsClient}>{t('previewPage.tryAsCustomer')}</button>
      </div>
      <div className="card" style={{ border: '2px solid var(--ink)' }}>
        <RestaurantPreview restaurant={restaurant} />
      </div>
    </CadreSite>
  );
}
