import { useOutletContext } from 'react-router-dom';
import DeliveryTrackingMap from '../../components/DeliveryTrackingMap';
import { orderTypeLabel, orderTypeColor } from '../../orderStatus';

// Suivi en direct des livraisons en cours (livreur à deux roues en route vers le client),
// pour que le commerçant puisse voir où en est chaque livraison sans appeler le livreur.
export default function MapPage() {
  const { orders } = useOutletContext();

  const inDelivery = (orders || []).filter(
    (o) => o.status === 'livraison' && o.orderType === 'delivery' && o.restaurantLat && o.deliveryLat
  );

  return (
    <div>
      <h2 className="section-title" style={{ marginTop: 0 }}>Carte</h2>
      <p className="small" style={{ marginBottom: 16 }}>
        Suis en direct tes livraisons en cours : la position de ton livreur (vélo, scooter...) et le trajet jusqu'au client.
      </p>
      {inDelivery.length === 0 ? (
        <div className="empty">Aucune livraison en cours pour le moment.</div>
      ) : (
        inDelivery.map((o) => (
          <div className={`card order-type-${orderTypeColor(o)}`} key={o.id} style={{ marginBottom: 16 }}>
            <div className="row" style={{ justifyContent: 'space-between' }}>
              <b>Commande #{o.id.slice(0, 8)}</b>
              <span className="order-type-badge order-type-badge-delivery">{orderTypeLabel(o)}</span>
            </div>
            <div className="small" style={{ margin: '4px 0' }}>📍 {o.address}</div>
            {o.driverName && (
              <div className="small">🛵 {o.driverName}{o.driverPhone ? ` · ${o.driverPhone}` : ''}</div>
            )}
            <div style={{ margin: '10px 0' }}>
              <DeliveryTrackingMap
                restaurantLat={o.restaurantLat} restaurantLng={o.restaurantLng}
                deliveryLat={o.deliveryLat} deliveryLng={o.deliveryLng}
                driverLat={o.driverLat} driverLng={o.driverLng}
              />
              <div className="small" style={{ marginTop: 4, textAlign: 'center' }}>
                {o.driverLat ? 'Position du livreur en direct' : 'En attente de la position du livreur'}
              </div>
            </div>
          </div>
        ))
      )}
    </div>
  );
}
