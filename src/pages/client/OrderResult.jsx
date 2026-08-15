import { Link, useSearchParams } from 'react-router-dom';
import { useLanguage } from '../../context/LanguageContext';

export default function OrderResult({ success }) {
  const [params] = useSearchParams();
  const orderId = params.get('order');
  const { t } = useLanguage();

  return (
    <div className="center-page">
      <div style={{ fontSize: 40 }}>{success ? '🎉' : '😕'}</div>
      <h2>{success ? t('orderResult.successTitle') : t('orderResult.cancelTitle')}</h2>
      <p className="small">
        {success ? t('orderResult.successText') : t('orderResult.cancelText')}
        {orderId && <><br />{t('orderResult.orderNumber', { id: orderId.slice(0, 8) })}</>}
      </p>
      <div className="row" style={{ gap: 10, justifyContent: 'center' }}>
        <Link to="/orders" className="btn-primary" style={{ textDecoration: 'none', display: 'inline-block' }}>
          {t('orderResult.viewOrders')}
        </Link>
        <Link to="/restaurants" className="btn-outline" style={{ textDecoration: 'none', display: 'inline-block' }}>
          {t('orderResult.backToRestaurants')}
        </Link>
      </div>
    </div>
  );
}
