import { useEffect, useState } from 'react';
import { api } from '../../api';
import { useAuth } from '../../context/AuthContext';
import { SkeletonCards } from '../../components/Skeleton';
import { StarsDisplay } from '../../components/Stars';
import { useLanguage } from '../../context/LanguageContext';

export default function ReviewsPage() {
  const { t } = useLanguage();
  const { token } = useAuth();
  const [data, setData] = useState(null);

  useEffect(() => {
    api('/reviews/driver/mine', { token }).then(setData).catch(() => {});
  }, [token]);

  if (!data) return <SkeletonCards count={3} />;

  return (
    <div>
      <h2 className="section-title" style={{ marginTop: 0 }}>{t('reviewsDriver.title')}</h2>
      <div className="card" style={{ marginBottom: 16 }}>
        <div className="row" style={{ gap: 10, alignItems: 'center' }}>
          <StarsDisplay value={data.avg} size={20} />
          <b style={{ fontSize: 18 }}>{data.avg.toFixed(1)}</b>
          <span className="small">{t('reviewsDriver.countReviews', { n: data.count })}</span>
        </div>
      </div>
      {data.reviews.length === 0 ? (
        <div className="empty">{t('reviewsDriver.none')}</div>
      ) : (
        data.reviews.map((r) => (
          <div className="card" key={r.orderId}>
            <div className="row" style={{ justifyContent: 'space-between' }}>
              <b style={{ fontSize: 13 }}>{r.clientName}</b>
              <StarsDisplay value={r.deliveryRating} />
            </div>
            <div className="small" style={{ margin: '4px 0' }}>{t('reviewsDriver.orderAt', { name: r.restaurantName })}</div>
            {r.deliveryComment && <p className="small" style={{ margin: '4px 0 0' }}>{r.deliveryComment}</p>}
          </div>
        ))
      )}
    </div>
  );
}
