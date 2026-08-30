import { useEffect, useRef, useState } from 'react';
import { api } from '../../api';
import { useAuth } from '../../context/AuthContext';
import { useToast } from '../../context/ToastContext';
import DriverNavigationMap from '../../components/DriverNavigationMap';

// Carte de navigation pour le livreur : le trajet depuis sa position actuelle jusqu'à son prochain
// arrêt (le restaurant tant que la commande n'est pas retirée, sinon l'adresse du client) — à utiliser
// à la place d'une appli de guidage externe pendant une course. Reprend le même partage de position que
// le tableau de bord principal (voir Dashboard.jsx) puisque cette page peut être la seule montée pendant
// que le livreur roule.
export default function MapPage() {
  const { token, user } = useAuth();
  const toast = useToast();
  const [orders, setOrders] = useState(null);
  const [position, setPosition] = useState(null);
  const [sharingLocation, setSharingLocation] = useState(false);

  useEffect(() => {
    function load() {
      api('/orders/mine/deliveries', { token }).then(setOrders).catch((e) => toast(e.message));
    }
    load();
    const interval = setInterval(load, 15000);
    return () => clearInterval(interval);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const active = (orders || []).filter((o) => o.orderType === 'delivery' && ['preparation', 'pret', 'livraison'].includes(o.status));
  const activeIdsRef = useRef([]);
  useEffect(() => {
    activeIdsRef.current = active.filter((o) => o.status === 'livraison').map((o) => o.id);
  }, [active]);

  useEffect(() => {
    if (!('geolocation' in navigator) || user?.locationSharingEnabled === false) {
      setSharingLocation(false);
      return;
    }
    let deniedNotified = false;
    function tick() {
      navigator.geolocation.getCurrentPosition(
        (pos) => {
          setSharingLocation(true);
          const { latitude, longitude } = pos.coords;
          setPosition({ lat: latitude, lng: longitude });
          activeIdsRef.current.forEach((id) => {
            api(`/orders/${id}/location`, { method: 'PATCH', token, body: { lat: latitude, lng: longitude } }).catch(() => {});
          });
        },
        () => {
          setSharingLocation(false);
          if (!deniedNotified) {
            deniedNotified = true;
            toast('Autorise la géolocalisation dans ton navigateur pour utiliser la navigation.');
          }
        },
        { enableHighAccuracy: true, timeout: 8000 }
      );
    }
    tick();
    const interval = setInterval(tick, 8000);
    return () => clearInterval(interval);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [token, user?.locationSharingEnabled]);

  if (!orders) return <div className="empty">Chargement...</div>;

  return (
    <div>
      <h2 className="section-title" style={{ marginTop: 0 }}>Carte</h2>
      <p className="small" style={{ marginBottom: 16 }}>
        Navigation vers ton prochain arrêt pour chaque course en cours — utilise-la à la place d'une appli de guidage externe.
      </p>
      {!sharingLocation && (
        <div className="empty" style={{ marginBottom: 16 }}>Active la géolocalisation pour voir le trajet depuis ta position.</div>
      )}
      {active.length === 0 ? (
        <div className="empty">Aucune course en cours pour le moment.</div>
      ) : (
        active.map((o) => {
          const pickedUp = o.status === 'livraison';
          const target = pickedUp
            ? { lat: o.deliveryLat, lng: o.deliveryLng, label: o.address, emoji: '🏠', color: '#D9A441' }
            : { lat: o.restaurantLat, lng: o.restaurantLng, label: o.restaurantName, emoji: '🏪', color: '#3A4A63' };
          return (
            <div className="card" key={o.id} style={{ marginBottom: 16 }}>
              <div className="row" style={{ justifyContent: 'space-between' }}>
                <b>{pickedUp ? 'Vers le client' : 'Vers le restaurant'}</b>
                <span className="small">{pickedUp ? `📍 ${o.address}` : `🏪 ${o.restaurantName}`}</span>
              </div>
              <div style={{ margin: '10px 0' }}>
                {target.lat && target.lng ? (
                  <DriverNavigationMap
                    originLat={position?.lat} originLng={position?.lng}
                    targetLat={target.lat} targetLng={target.lng}
                    targetLabel={target.label} targetEmoji={target.emoji} targetColor={target.color}
                  />
                ) : (
                  <div className="empty">Adresse non localisée pour cette course.</div>
                )}
              </div>
            </div>
          );
        })
      )}
    </div>
  );
}
