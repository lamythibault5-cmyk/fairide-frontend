import { useOutletContext } from 'react-router-dom';
import DeliveryTrackingMap from '../../components/DeliveryTrackingMap';
import TrackingWithGames from '../../components/TrackingWithGames';
import { orderTypeLabel, orderTypeColor } from '../../orderStatus';
import { useLanguage } from '../../context/LanguageContext';

// Suivi en direct des livraisons en cours (livreur à deux roues en route vers le client), pour que le
// commerçant puisse voir où en est chaque livraison sans appeler le livreur. Même bloc carte + jeux que
// chez le client (TrackingWithGames) : on peut laisser l'écran ouvert au comptoir et voir la livraison
// avancer sans rester planté devant. Sans livraison : le commerce, seul, sur la carte.
export default function MapPage() {
  const { t } = useLanguage();
  const { orders, restaurant } = useOutletContext();

  const inDelivery = (orders || []).filter(
    (o) => o.status === 'livraison' && o.orderType === 'delivery' && o.restaurantLat && o.deliveryLat
  );

  return (
    <div>
      <h2 className="section-title" style={{ marginTop: 0 }}>{t('mapResto.title')}</h2>
      <p className="small" style={{ marginBottom: 16 }}>
        {t('mapResto.intro')}
      </p>
      {inDelivery.length === 0 ? (
        <div className="card" style={{ marginBottom: 16 }}>
          <div className="empty" style={{ marginBottom: 10 }}>{t('mapResto.noneOngoing')}</div>
          <TrackingWithGames
            role="restaurant"
            legende={`${restaurant?.lat ? t('mapResto.hereIsBusiness') : ''}${t('mapResto.whenStarts')}`}
            etaSansEstimation={t('mapResto.nothingOngoing')}
            rendreCarte={({ height, onEta }) => (
              <DeliveryTrackingMap height={height} onEta={onEta} homeLat={restaurant?.lat} homeLng={restaurant?.lng} homeLabel={t('mapResto.yourBusiness')} homeEmoji="🏪" homeColor="#3B2FB5" />
            )}
          />
        </div>
      ) : (
        inDelivery.map((o) => (
          <div className={`card order-type-${orderTypeColor(o)}`} key={o.id} style={{ marginBottom: 16 }}>
            <div className="row" style={{ justifyContent: 'space-between' }}>
              <b>{t('mapResto.orderNumber', { id: o.id.slice(0, 8) })}</b>
              <span className="order-type-badge order-type-badge-delivery">{orderTypeLabel(o)}</span>
            </div>
            <div className="small" style={{ margin: '4px 0' }}>📍 {o.address}</div>
            {o.driverName && (
              <div className="small">🛵 {o.driverName}{o.driverPhone ? ` · ${o.driverPhone}` : ''}</div>
            )}
            <TrackingWithGames
              role="restaurant"
              legende={o.driverLat ? t('mapResto.livePosition', { name: o.driverName || t('mapResto.yourCourier') }) : t('mapResto.waitingPosition')}
              etaSansEstimation={o.driverLat ? t('mapResto.courierOnWay') : '⏳ Livreur attendu'}
              rendreCarte={({ height, onEta }) => (
                <DeliveryTrackingMap
                  restaurantLat={o.restaurantLat} restaurantLng={o.restaurantLng}
                  deliveryLat={o.deliveryLat} deliveryLng={o.deliveryLng}
                  driverLat={o.driverLat} driverLng={o.driverLng}
                  lastUpdatedAt={o.driverLocationUpdatedAt}
                  legendeDestination="Client"
                  height={height} onEta={onEta}
                />
              )}
            />
          </div>
        ))
      )}
    </div>
  );
}
