import { useEffect, useState } from 'react';
import { createPortal } from 'react-dom';
import { api } from '../../api';
import { useAuth } from '../../context/AuthContext';
import { useToast } from '../../context/ToastContext';
import { usePreviewMode } from '../../context/PreviewModeContext';
import DeliveryTrackingMap from '../../components/DeliveryTrackingMap';
import GameSwitcher from '../../components/GameSwitcher';

// Suivi en direct des livraisons en cours du client (livreur à deux roues en route vers chez lui),
// accessible en permanence depuis la nav plutôt que caché dans le détail d'une commande. Sans livraison,
// la carte montre la maison du client — et les mini-jeux restent jouables, en petit à côté de la carte
// ou en plein écran (carte masquable).

// Où est « chez toi » quand rien n'est en cours ? D'abord l'adresse de la dernière commande livrée : elle
// a déjà été géocodée par le serveur, c'est la plus fiable. Sinon l'adresse du profil, géocodée ici via
// Nominatim (OpenStreetMap) et gardée en cache : une adresse ne bouge pas, on ne la redemande pas à
// chaque visite.
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
  const derniereLivree = orders?.find((o) => o.orderType === 'delivery' && o.deliveryLat && o.deliveryLng);
  const adresse = adresseProfil(user);
  useEffect(() => {
    if (derniereLivree) { setMaison({ lat: derniereLivree.deliveryLat, lng: derniereLivree.deliveryLng }); return undefined; }
    if (!adresse) return undefined;
    let annule = false;
    geocoder(adresse).then((pos) => { if (!annule) setMaison(pos); }).catch(() => { /* pas de maison plutôt qu une fausse */ });
    return () => { annule = true; };
  }, [derniereLivree?.deliveryLat, derniereLivree?.deliveryLng, adresse]); // eslint-disable-line react-hooks/exhaustive-deps
  return maison;
}

export default function MapPage() {
  const { token, role, user } = useAuth();
  const toast = useToast();
  const { previewMode } = usePreviewMode();
  const [orders, setOrders] = useState(null);
  // Identifiant du bloc actuellement agrandi en plein écran ('empty' pour le bloc "aucune livraison",
  // sinon l'id de la commande) — un seul à la fois, null si aucun.
  const [fullscreenId, setFullscreenId] = useState(null);
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

  if (!orders) return <div className="empty">Chargement...</div>;
  const inDelivery = orders.filter(
    (o) => o.status === 'livraison' && o.orderType === 'delivery' && o.restaurantLat && o.deliveryLat
  );
  const fullscreenOrder = fullscreenId && fullscreenId !== 'empty' ? inDelivery.find((o) => o.id === fullscreenId) : null;

  return (
    <div>
      <h2 className="section-title" style={{ marginTop: 0 }}>Carte</h2>
      <p className="small" style={{ marginBottom: 16 }}>
        Suis en direct ta livraison en cours : la position de ton livreur, le trajet qu'il lui reste et son heure d'arrivée estimée.
      </p>
      {inDelivery.length === 0 ? (
        <div className="card" style={{ marginBottom: 16 }}>
          <div className="empty" style={{ marginBottom: 10 }}>Aucune livraison en cours pour le moment — mais les jeux restent jouables !</div>
          <div className="tracking-with-game" style={{ margin: '10px 0' }}>
            <div className="tracking-map-col">
              <DeliveryTrackingMap height={300} homeLat={maison?.lat} homeLng={maison?.lng} />
              <div className="small" style={{ marginTop: 4, textAlign: 'center' }}>
                {maison ? 'Voici chez toi. ' : ''}Dès qu'une livraison démarre, ton livreur apparaît ici en direct.
              </div>
            </div>
            <GameSwitcher />
          </div>
          <button type="button" className="tracking-expand-btn" onClick={() => setFullscreenId('empty')}>⛶ Agrandir la carte et les jeux</button>
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
                  lastUpdatedAt={o.driverLocationUpdatedAt}
                  height={300}
                />
                <div className="small" style={{ marginTop: 4, textAlign: 'center' }}>
                  {o.driverLat ? 'Position du livreur en direct' : 'En attente de la position du livreur'}
                </div>
              </div>
              <GameSwitcher />
            </div>
            <button type="button" className="tracking-expand-btn" onClick={() => setFullscreenId(o.id)}>⛶ Agrandir la carte et les jeux</button>
          </div>
        ))
      )}

      {fullscreenId && (
        <TrackingFullscreen order={fullscreenOrder} maison={maison} onClose={() => setFullscreenId(null)} />
      )}
    </div>
  );
}

// Vue plein écran : la carte (avec le livreur en direct) occupe une moitié de l'écran, le sélecteur de
// jeu et le jeu en cours l'autre moitié — empilés au lieu de côte à côte sous 800px (voir styles.css,
// .tracking-fullscreen-split). « Masquer la carte » donne tout l'écran au jeu ; la carte reste montée
// (juste cachée) pour continuer à recevoir les positions et recalculer le temps d'arrivée, qui s'affiche
// alors dans la barre du haut — on joue sans perdre de vue quand ça sonne.
// `order` est null pour le bloc "aucune livraison en cours" (la maison, jeux jouables quand même).
const NARROW_BREAKPOINT = 800;

function useFullscreenSizes() {
  const [size, setSize] = useState(() => ({ width: window.innerWidth, height: window.innerHeight }));
  useEffect(() => {
    function onResize() { setSize({ width: window.innerWidth, height: window.innerHeight }); }
    window.addEventListener('resize', onResize);
    return () => window.removeEventListener('resize', onResize);
  }, []);
  const narrow = size.width <= NARROW_BREAKPOINT;
  // Empilé (téléphone) : la carte prend ~30 % de la hauteur, le jeu tout le reste (il remplit son bloc,
  // voir GameFrame `fill`). Côte à côte : la carte prend la hauteur disponible sous la barre d'outils,
  // moins la légende et la fraîcheur en dessous.
  return {
    narrow,
    mapHeight: narrow
      ? Math.round(Math.max(170, Math.min(280, size.height * 0.3)))
      : Math.round(Math.max(320, Math.min(760, size.height - 210)))
  };
}

function TrackingFullscreen({ order, maison, onClose }) {
  const [carteMasquee, setCarteMasquee] = useState(false);
  const [eta, setEta] = useState(null);

  useEffect(() => {
    const prevOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    function onKeyDown(e) { if (e.key === 'Escape') onClose(); }
    window.addEventListener('keydown', onKeyDown);
    return () => {
      document.body.style.overflow = prevOverflow;
      window.removeEventListener('keydown', onKeyDown);
    };
  }, [onClose]);

  const { mapHeight } = useFullscreenSizes();

  return createPortal(
    <div className="tracking-fullscreen-overlay">
      <div className="tracking-fullscreen-bar">
        <button type="button" className="tracking-fullscreen-toggle" onClick={() => setCarteMasquee((m) => !m)} aria-pressed={carteMasquee}>
          {carteMasquee ? '🗺️ Afficher la carte' : '🙈 Masquer la carte'}
        </button>
        {carteMasquee && order && (
          <span className="tracking-fullscreen-eta" aria-live="polite">
            {eta ? <>🛵 Arrive dans ~{eta.minutes} min</> : (order.driverLat ? '🛵 Livreur en route' : '⏳ En attente du livreur')}
          </span>
        )}
        <button type="button" className="tracking-fullscreen-close" onClick={onClose} aria-label="Fermer">✕</button>
      </div>
      <div className={`tracking-fullscreen-split${carteMasquee ? ' carte-masquee' : ''}`}>
        <div className="tracking-fullscreen-map" hidden={carteMasquee}>
          <DeliveryTrackingMap
            restaurantLat={order?.restaurantLat} restaurantLng={order?.restaurantLng}
            deliveryLat={order?.deliveryLat} deliveryLng={order?.deliveryLng}
            driverLat={order?.driverLat} driverLng={order?.driverLng}
            lastUpdatedAt={order?.driverLocationUpdatedAt}
            homeLat={maison?.lat} homeLng={maison?.lng}
            onEta={setEta}
            height={mapHeight}
          />
          <div className="small tracking-fullscreen-map-caption">
            {order ? (order.driverLat ? `🛵 Position de ${order.driverName || 'ton livreur'} en direct` : 'En attente de la position du livreur') : "Dès qu'une livraison démarre, ton livreur apparaît ici en direct."}
          </div>
        </div>
        <div className="tracking-fullscreen-game">
          <GameSwitcher fill large />
        </div>
      </div>
    </div>,
    document.body
  );
}
