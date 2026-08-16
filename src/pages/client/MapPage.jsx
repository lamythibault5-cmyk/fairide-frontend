import { useEffect, useState } from 'react';
import { api } from '../../api';
import { useAuth } from '../../context/AuthContext';
import { useToast } from '../../context/ToastContext';
import DeliveryTrackingMap from '../../components/DeliveryTrackingMap';
import FoodCatchGame from '../../components/FoodCatchGame';

// Suivi en direct des livraisons en cours du client (livreur à deux roues en route vers chez lui),
// accessible en permanence depuis la nav plutôt que caché dans le détail d'une commande.
export default function MapPage() {
  const { token } = useAuth();
  const toast = useToast();
  const [orders, setOrders] = useState(null);

  useEffect(() => {
    function load() {
      api('/orders/mine', { token }).then(setOrders).catch((e) => toast(e.message));
    }
    load();
    const interval = setInterval(load, 15000);
    return () => clearInterval(interval);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  if (!orders) return <div className="empty">Chargement...</div>;
  const inDelivery = orders.filter(
    (o) => o.status === 'livraison' && o.orderType === 'delivery' && o.restaurantLat && o.deliveryLat
  );

  return (
    <div>
      <h2 className="section-title" style={{ marginTop: 0 }}>Carte</h2>
      <p className="small" style={{ marginBottom: 16 }}>
        Suis en direct ta livraison en cours : la position de ton livreur (vélo, scooter...) et le trajet jusque chez toi.
      </p>
      {inDelivery.length === 0 ? (
        <div className="card" style={{ marginBottom: 16 }}>
          <div className="empty" style={{ marginBottom: 10 }}>Aucune livraison en cours pour le moment — mais le jeu reste jouable !</div>
          <div className="tracking-with-game" style={{ margin: '10px 0' }}>
            <div className="tracking-map-col">
              <DeliveryTrackingMap height={260} />
              <div className="small" style={{ marginTop: 4, textAlign: 'center' }}>
                Dès qu'une livraison démarre, ton livreur apparaît ici en direct.
              </div>
            </div>
            <FoodCatchGame />
          </div>
        </div>
      ) : (
        inDelivery.map((o) => (
          <div className="card" key={o.id} style={{ marginBottom: 16 }}>
            <div className="row" style={{ justifyContent: 'space-between' }}>
              <b>{o.restaurantName}</b>
              {o.driverName && <span className="small">🛵 {o.driverName}{o.driverPhone ? ` · ${o.driverPhone}` : ''}</span>}
            </div>
            <div className="small" style={{ margin: '4px 0' }}>📍 {o.address}</div>
            <div className="tracking-with-game" style={{ margin: '10px 0' }}>
              <div className="tracking-map-col">
                <DeliveryTrackingMap
                  restaurantLat={o.restaurantLat} restaurantLng={o.restaurantLng}
                  deliveryLat={o.deliveryLat} deliveryLng={o.deliveryLng}
                  driverLat={o.driverLat} driverLng={o.driverLng}
                  height={260}
                />
                <div className="small" style={{ marginTop: 4, textAlign: 'center' }}>
                  {o.driverLat ? 'Position du livreur en direct' : 'En attente de la position du livreur'}
                </div>
              </div>
              <FoodCatchGame />
            </div>
          </div>
        ))
      )}
    </div>
  );
}
