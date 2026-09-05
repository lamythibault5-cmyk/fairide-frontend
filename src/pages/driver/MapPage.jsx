import { useEffect, useRef, useState } from 'react';
import { api } from '../../api';
import { useAuth } from '../../context/AuthContext';
import { useToast } from '../../context/ToastContext';
import DriverNavigationMap from '../../components/DriverNavigationMap';
import TrackingWithGames from '../../components/TrackingWithGames';

// Cadence maximale d'envoi de la position au serveur — même valeur que Dashboard.jsx, un seul rythme
// pour les deux pages qui partagent la position.
const MIN_LOCATION_SEND_INTERVAL_MS = 12000;

// Cadence de rafraîchissement de la carte de guidage. 8 s : la valeur du sondage d'origine, assez
// réactive pour suivre un scooter, assez lente pour ne pas relancer un calcul d'itinéraire par seconde.
const MIN_MAP_REFRESH_INTERVAL_MS = 8000;

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
    let lastSentAt = 0;
    let lastShownAt = 0;

    // Même bascule que dans Dashboard.jsx : watchPosition au lieu d'un getCurrentPosition relancé par
    // setInterval, que le verrouillage de l'écran suspendait en silence en pleine course. Ici l'enjeu
    // est double, puisque cette page sert aussi de guidage : la carte doit suivre le livreur en continu,
    // pas se rafraîchir toutes les 8 secondes.
    const watchId = navigator.geolocation.watchPosition(
      (pos) => {
        setSharingLocation(true);
        const { latitude, longitude } = pos.coords;
        const now = Date.now();

        // Rafraîchissement de la carte volontairement bridé, contrairement à ce que je pensais en
        // écrivant "c'est gratuit" : chaque nouvelle position relance un calcul d'itinéraire chez
        // OSRM et un recadrage de la carte dans DriverNavigationMap. watchPosition émettant jusqu'à
        // plusieurs fois par seconde en roulant, la carte devenait impossible à déplacer (elle se
        // recentrait sans cesse) et on martelait le serveur de démonstration public d'OSRM.
        if (now - lastShownAt >= MIN_MAP_REFRESH_INTERVAL_MS) {
          lastShownAt = now;
          setPosition({ lat: latitude, lng: longitude });
        }

        // Les envois au serveur ont leur propre cadence, plus lente encore.
        if (now - lastSentAt < MIN_LOCATION_SEND_INTERVAL_MS) return;
        lastSentAt = now;
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
      { enableHighAccuracy: true, timeout: 8000, maximumAge: 5000 }
    );

    return () => navigator.geolocation.clearWatch(watchId);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [token, user?.locationSharingEnabled]);

  if (!orders) return <div className="empty">Chargement...</div>;

  return (
    <div>
      <h2 className="section-title" style={{ marginTop: 0 }}>Carte</h2>
      <p className="small" style={{ marginBottom: 16 }}>
        Navigation vers ton prochain arrêt pour chaque course en cours, avec le temps qu'il te reste — utilise-la à la place d'une appli de guidage externe.
      </p>
      {!sharingLocation && (
        <div className="empty" style={{ marginBottom: 16 }}>Active la géolocalisation pour voir le trajet depuis ta position.</div>
      )}
      {active.length === 0 ? (
        <div className="card" style={{ marginBottom: 16 }}>
          <div className="empty" style={{ marginBottom: 10 }}>Aucune course en cours pour le moment — mais les jeux restent jouables !</div>
          <TrackingWithGames
            role="driver"
            legende={position ? 'Te voilà. Dès qu\'une course démarre, le trajet vers ton prochain arrêt apparaît ici.' : 'Dès qu\'une course démarre, le trajet vers ton prochain arrêt apparaît ici.'}
            etaSansEstimation="⏳ Pas de course"
            rendreCarte={({ height, onEta }) => <DriverNavigationMap originLat={position?.lat} originLng={position?.lng} height={height} onEta={onEta} />}
          />
        </div>
      ) : (
        active.map((o) => {
          const pickedUp = o.status === 'livraison';
          const target = pickedUp
            ? { lat: o.deliveryLat, lng: o.deliveryLng, label: o.address, emoji: '🏠', color: '#C8F03C' }
            : { lat: o.restaurantLat, lng: o.restaurantLng, label: o.restaurantName, emoji: '🏪', color: '#3B2FB5' };
          const carte = ({ height, onEta }) => (
            <DriverNavigationMap
              originLat={position?.lat} originLng={position?.lng}
              targetLat={target.lat} targetLng={target.lng}
              targetLabel={target.label} targetEmoji={target.emoji} targetColor={target.color}
              height={height} onEta={onEta}
            />
          );
          return (
            <div className="card" key={o.id} style={{ marginBottom: 16 }}>
              <div className="row" style={{ justifyContent: 'space-between' }}>
                <b>{pickedUp ? 'Vers le client' : 'Vers le restaurant'}</b>
                <span className="small">{pickedUp ? `📍 ${o.address}` : `🏪 ${o.restaurantName}`}</span>
              </div>
              {!target.lat || !target.lng ? (
                <div className="empty" style={{ margin: '10px 0' }}>Adresse non localisée pour cette course.</div>
              ) : pickedUp ? (
                // En course, pas de jeux : le livreur roule, la carte seule, en grand.
                <div style={{ margin: '10px 0' }}>{carte({ height: 320 })}</div>
              ) : (
                // Commande pas encore retirée : le livreur attend au restaurant (ou y va). Les jeux servent
                // à patienter sans quitter la carte — pas à jouer en roulant, la phrase 💡 le rappelle.
                <TrackingWithGames
                  role="driver"
                  legende={o.status === 'pret' ? '✅ Commande prête, à retirer au restaurant' : '⏳ Commande en préparation'}
                  etaSansEstimation="🏪 Vers le restaurant"
                  rendreCarte={carte}
                />
              )}
            </div>
          );
        })
      )}
    </div>
  );
}
