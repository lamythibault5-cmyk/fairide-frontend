import { useEffect, useState } from 'react';
import { api } from '../../api';
import { useAuth } from '../../context/AuthContext';
import { useToast } from '../../context/ToastContext';
import { usePreviewMode } from '../../context/PreviewModeContext';
import DeliveryTrackingMap from '../../components/DeliveryTrackingMap';
import TrackingWithGames from '../../components/TrackingWithGames';
import { useLanguage } from '../../context/LanguageContext';

// Suivi en direct des livraisons en cours du client (livreur à deux roues en route vers chez lui),
// accessible en permanence depuis la nav plutôt que caché dans le détail d'une commande. Sans livraison,
// la carte montre la maison du client — et les mini-jeux restent jouables, en petit à côté de la carte
// ou en plein écran (carte masquable). Voir TrackingWithGames pour le bloc commun aux trois rôles.

// Où est « chez toi » quand rien n'est en cours ? D'abord les coordonnées du profil (géocodées par le
// serveur à l'inscription), sinon l'adresse de la dernière commande livrée, sinon l'adresse du profil
// géocodée ici via Nominatim (OpenStreetMap) et gardée en cache : une adresse ne bouge pas, on ne la
// redemande pas à chaque visite.
const CLE_CACHE_MAISON = 'fairide_home_geo_v1';

function adresseProfil(user) {
  if (!user?.addressStreet || !user?.addressCity) return null;
  return [`${user.addressStreet} ${user.addressNumber || ''}`.trim(), `${user.addressPostalCode || ''} ${user.addressCity}`.trim(), 'Belgique'].join(', ');
}

async function geocoder(adresse) {
  let cache = {};
  try { cache = JSON.parse(localStorage.getItem(CLE_CACHE_MAISON) || '{}'); } catch { cache = {}; }
  if (cache[adresse]) return cache[adresse];
  const url = `https://nominatim.openstreetmap.org/search?format=json&limit=1&countrycodes=be&q=${encodeURIComponent(adresse)}`;
  const res = await fetch(url, { headers: { Accept: 'application/json' } });
  if (!res.ok) throw new Error('geocode-failed');
  const [hit] = await res.json();
  if (!hit) throw new Error('geocode-empty');
  const pos = { lat: Number(hit.lat), lng: Number(hit.lon) };
  try { localStorage.setItem(CLE_CACHE_MAISON, JSON.stringify({ ...cache, [adresse]: pos })); } catch { /* sans stockage, on regéocodera la prochaine fois */ }
  return pos;
}

function useMaison(user, orders) {
  const [maison, setMaison] = useState(null);
  const profil = user?.lat && user?.lng ? { lat: user.lat, lng: user.lng } : null;
  const derniereLivree = orders?.find((o) => o.orderType === 'delivery' && o.deliveryLat && o.deliveryLng);
  const adresse = adresseProfil(user);
  useEffect(() => {
    if (profil) { setMaison(profil); return undefined; }
    if (derniereLivree) { setMaison({ lat: derniereLivree.deliveryLat, lng: derniereLivree.deliveryLng }); return undefined; }
    if (!adresse) return undefined;
    let annule = false;
    geocoder(adresse).then((pos) => { if (!annule) setMaison(pos); }).catch(() => { /* pas de maison plutôt qu une fausse */ });
    return () => { annule = true; };
  }, [profil?.lat, profil?.lng, derniereLivree?.deliveryLat, derniereLivree?.deliveryLng, adresse]); // eslint-disable-line react-hooks/exhaustive-deps
  return maison;
}

export default function MapPage() {
  const { t } = useLanguage();
  const { token, role, user } = useAuth();
  const toast = useToast();
  const { previewMode } = usePreviewMode();
  const [orders, setOrders] = useState(null);
  const maison = useMaison(user, orders);

  useEffect(() => {
    // Un restaurateur en mode aperçu n'a pas de vraies commandes client (l'API les refuse, 403) — page
    // vide plutôt qu'un message d'erreur trompeur, et surtout pas bloquée indéfiniment sur "Chargement..."
    // (voir plus bas : sans ce filet, orders resterait null pour toujours si l'appel échoue).
    const isPreviewingRestaurant = previewMode && role === 'restaurant';
    function load() {
      api('/orders/mine', { token }).then(setOrders).catch((e) => {
        if (!isPreviewingRestaurant) toast(e.message);
        setOrders([]);
      });
    }
    load();
    const interval = setInterval(load, 15000);
    return () => clearInterval(interval);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  if (!orders) return <div className="empty">{t('mapClient.loading')}</div>;
  const inDelivery = orders.filter(
    (o) => o.status === 'livraison' && o.orderType === 'delivery' && o.restaurantLat && o.deliveryLat
  );

  return (
    <div>
      <h2 className="section-title" style={{ marginTop: 0 }}>{t('mapClient.title')}</h2>
      <p className="small" style={{ marginBottom: 16 }}>
        {t('mapClient.intro')}
      </p>
      {inDelivery.length === 0 ? (
        <div className="card" style={{ marginBottom: 16 }}>
          <div className="empty" style={{ marginBottom: 10 }}>{t('mapClient.noneOngoing')}</div>
          <TrackingWithGames
            role="client"
            legende={`${maison ? t('mapClient.hereIsHome') : ''}${t('mapClient.whenStarts')}`}
            etaSansEstimation={t('mapClient.nothingOngoing')}
            rendreCarte={({ height, onEta }) => <DeliveryTrackingMap height={height} onEta={onEta} homeLat={maison?.lat} homeLng={maison?.lng} />}
          />
        </div>
      ) : (
        inDelivery.map((o) => (
          <div className="card" key={o.id} style={{ marginBottom: 16 }}>
            <div className="row" style={{ justifyContent: 'space-between' }}>
              <b>{o.restaurantName}</b>
              {o.driverName && <span className="small">🛵 {o.driverName}{o.driverPhone ? ` · ${o.driverPhone}` : ''}</span>}
            </div>
            <div className="small" style={{ margin: '4px 0' }}>📍 {o.address}</div>
            <TrackingWithGames
              role="client"
              legende={o.driverLat ? t('mapClient.livePosition', { name: o.driverName || t('mapClient.yourCourier') }) : t('mapClient.waitingPosition')}
              etaSansEstimation={o.driverLat ? t('mapClient.courierOnWay') : '⏳ Livreur attendu'}
              rendreCarte={({ height, onEta }) => (
                <DeliveryTrackingMap
                  restaurantLat={o.restaurantLat} restaurantLng={o.restaurantLng}
                  deliveryLat={o.deliveryLat} deliveryLng={o.deliveryLng}
                  driverLat={o.driverLat} driverLng={o.driverLng}
                  lastUpdatedAt={o.driverLocationUpdatedAt}
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
