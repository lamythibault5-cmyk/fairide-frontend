import { useOutletContext, useNavigate } from 'react-router-dom';
import { usePreviewMode } from '../../context/PreviewModeContext';
import RestaurantPreview from '../../components/RestaurantPreview';
import { useLanguage } from '../../context/LanguageContext';

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
    <div>
      <h2 className="section-title" style={{ marginTop: 0 }}>{t('previewPage.title')}</h2>
      <p className="small" style={{ margin: '0 0 14px' }}>{t('previewPage.intro')}</p>
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
    </div>
  );
}
