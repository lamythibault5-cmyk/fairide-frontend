import { useEffect, useState } from 'react';
import { createPortal } from 'react-dom';
import { api } from '../../api';
import { useAuth } from '../../context/AuthContext';
import { useToast } from '../../context/ToastContext';
import { usePreviewMode } from '../../context/PreviewModeContext';
import DeliveryTrackingMap from '../../components/DeliveryTrackingMap';
import GameSwitcher from '../../components/GameSwitcher';

// Suivi en direct des livraisons en cours du client (livreur à deux roues en route vers chez lui),
// accessible en permanence depuis la nav plutôt que caché dans le détail d'une commande.
export default function MapPage() {
  const { token, role } = useAuth();
  const toast = useToast();
  const { previewMode } = usePreviewMode();
  const [orders, setOrders] = useState(null);
  // Identifiant du bloc actuellement agrandi en plein écran ('empty' pour le bloc "aucune livraison",
  // sinon l'id de la commande) — un seul à la fois, null si aucun.
  const [fullscreenId, setFullscreenId] = useState(null);

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
                  height={260}
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
        <TrackingFullscreen order={fullscreenOrder} onClose={() => setFullscreenId(null)} />
      )}
    </div>
  );
}

// Vue plein écran : la carte (avec le livreur en direct) occupe une moitié de l'écran, le sélecteur de
// jeu et le jeu en cours l'autre moitié — empilés au lieu de côte à côte sous 800px (voir styles.css,
// .tracking-fullscreen-split). `order` est null pour le bloc "aucune livraison en cours" (carte vide,
// jeux jouables quand même).
// Sous 800px de large, .tracking-fullscreen-split empile la carte au-dessus du jeu (voir styles.css) —
// avec des tailles pensées pour le desktop (carte jusqu'à 640px de haut, jeu 280×420), les deux empilés
// dépassent largement un écran de téléphone et forcent à faire défiler pour voir l'un ou l'autre, ce qui
// va à l'encontre du but (jouer ET voir le livreur en même temps). Ici on calcule donc des tailles bien
// plus modestes, proportionnelles à la fenêtre réelle, quand on est en mise en page empilée — recalculées
// au redimensionnement/à la rotation de l'écran.
const NARROW_BREAKPOINT = 800;

function useFullscreenSizes() {
  const [size, setSize] = useState(() => ({ width: window.innerWidth, height: window.innerHeight }));
  useEffect(() => {
    function onResize() { setSize({ width: window.innerWidth, height: window.innerHeight }); }
    window.addEventListener('resize', onResize);
    return () => window.removeEventListener('resize', onResize);
  }, []);
  const narrow = size.width <= NARROW_BREAKPOINT;
  return narrow
    ? {
        narrow,
        mapHeight: Math.round(Math.max(180, Math.min(280, size.height * 0.3))),
        gameWidth: Math.round(Math.min(230, size.width - 100)),
        gameHeight: Math.round(Math.max(180, Math.min(230, size.height * 0.25)))
      }
    : {
        narrow,
        mapHeight: Math.round(Math.max(320, Math.min(640, size.height - 220))),
        gameWidth: 280,
        gameHeight: 420
      };
}

function TrackingFullscreen({ order, onClose }) {
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

  const { mapHeight, gameWidth, gameHeight } = useFullscreenSizes();

  return createPortal(
    <div className="tracking-fullscreen-overlay">
      <button type="button" className="tracking-fullscreen-close" onClick={onClose} aria-label="Fermer">✕</button>
      <div className="tracking-fullscreen-split">
        <div className="tracking-fullscreen-map">
          <DeliveryTrackingMap
            restaurantLat={order?.restaurantLat} restaurantLng={order?.restaurantLng}
            deliveryLat={order?.deliveryLat} deliveryLng={order?.deliveryLng}
            driverLat={order?.driverLat} driverLng={order?.driverLng}
            height={mapHeight}
          />
          <div className="small tracking-fullscreen-map-caption">
            {order ? (order.driverLat ? `🛵 Position de ${order.driverName || 'ton livreur'} en direct` : 'En attente de la position du livreur') : "Dès qu'une livraison démarre, ton livreur apparaît ici en direct."}
          </div>
        </div>
        <div className="tracking-fullscreen-game">
          <GameSwitcher width={gameWidth} height={gameHeight} large />
        </div>
      </div>
    </div>,
    document.body
  );
}
