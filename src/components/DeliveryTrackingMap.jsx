import { useEffect, useRef, useState } from 'react';
import L from 'leaflet';
import 'leaflet/dist/leaflet.css';

const BRUSSELS_CENTER = [50.8503, 4.3517];

function emojiIcon(emoji, bg) {
  return L.divIcon({
    className: '',
    html: `<div style="background:${bg};width:32px;height:32px;border-radius:50%;display:flex;align-items:center;justify-content:center;font-size:16px;box-shadow:0 2px 8px rgba(0,0,0,.3);border:2px solid #fff;">${emoji}</div>`,
    iconSize: [32, 32],
    iconAnchor: [16, 16]
  });
}

// Icône du livreur avec un anneau qui pulse autour, pour que "en mouvement, en direct" se lise d'un
// coup d'œil (même codage visuel que les apps de livraison grand public) — un simple <div> enfant animé
// en CSS (.tracking-driver-pulse), pas de dépendance ni de logique JS supplémentaire.
const DRIVER_ICON = L.divIcon({
  className: '',
  html: `
    <div style="position:relative;width:32px;height:32px;">
      <div class="tracking-driver-pulse"></div>
      <div style="position:relative;background:#16233A;width:32px;height:32px;border-radius:50%;display:flex;align-items:center;justify-content:center;font-size:16px;box-shadow:0 2px 8px rgba(0,0,0,.3);border:2px solid #fff;">🛵</div>
    </div>
  `,
  iconSize: [32, 32],
  iconAnchor: [16, 16]
});

const RESTAURANT_ICON = emojiIcon('🏪', '#3A4A63');
const DELIVERY_ICON = emojiIcon('🏠', '#D9A441');

async function fetchStreetRoute(fromLat, fromLng, toLat, toLng) {
  const url = `https://router.project-osrm.org/route/v1/driving/${fromLng},${fromLat};${toLng},${toLat}?overview=full&geometries=geojson`;
  const res = await fetch(url);
  if (!res.ok) throw new Error('routing-failed');
  const data = await res.json();
  const coords = data.routes?.[0]?.geometry?.coordinates;
  if (!coords || !coords.length) throw new Error('no-route');
  return coords.map(([lng, lat]) => [lat, lng]);
}

export default function DeliveryTrackingMap({ restaurantLat, restaurantLng, deliveryLat, deliveryLng, driverLat, driverLng, height = 260 }) {
  const containerRef = useRef(null);
  const mapRef = useRef(null);
  const restaurantMarkerRef = useRef(null);
  const deliveryMarkerRef = useRef(null);
  const driverMarkerRef = useRef(null);
  const lineRef = useRef(null);
  const animRef = useRef(null);
  // Trace des positions déjà vues du livreur (pas juste le trajet prévu restaurant→adresse) : une ligne
  // qui s'allonge en direct à chaque nouvelle position reçue, visible d'un coup d'œil même si le client
  // ne regarde la carte que de temps en temps (typiquement en jouant à un des mini-jeux à côté).
  const driverTrailRef = useRef([]);
  const driverTrailLineRef = useRef(null);
  // Dernier périmètre ajusté (droite puis, une fois reçu, le vrai trajet routier) — permet au bouton
  // "Recentrer" de revenir dessus si l'utilisateur a zoomé/déplacé la carte pour explorer.
  const boundsRef = useRef(null);
  // Périmètre livreur + adresse de livraison — le segment qui compte une fois la course commencée (le
  // livreur peut s'écarter du trajet restaurant→adresse initialement tracé). Alimente le bouton "Voir
  // le livreur", qui recadre sur ce segment plutôt que sur tout l'itinéraire depuis le restaurant.
  const driverBoundsRef = useRef(null);
  const [showRecenter, setShowRecenter] = useState(false);
  const [showFollowDriver, setShowFollowDriver] = useState(false);
  const [hasTrail, setHasTrail] = useState(false);

  useEffect(() => {
    if (!containerRef.current || mapRef.current) return;
    mapRef.current = L.map(containerRef.current, { zoomControl: false }).setView(BRUSSELS_CENTER, 13);
    // Fond de carte CARTO Voyager plutôt que les tuiles OSM brutes par défaut : rendu bien plus épuré
    // (moins de bruit visuel, palette plus douce), tout en gardant les rues/quartiers lisibles — mêmes
    // données OpenStreetMap en dessous, gratuit sans clé API pour un usage raisonnable comme ici.
    L.tileLayer('https://{s}.basemaps.cartocdn.com/rastertiles/voyager/{z}/{x}/{y}{r}.png', {
      attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> &copy; <a href="https://carto.com/attributions">CARTO</a>',
      maxZoom: 19,
      subdomains: 'abcd'
    }).addTo(mapRef.current);
    L.control.zoom({ position: 'bottomright' }).addTo(mapRef.current);
    // Voir RestaurantsMap.jsx : corrige la bande grise Leaflet quand le conteneur change de taille
    // après l'initialisation (police, image, mise en page).
    const resizeObserver = new ResizeObserver(() => mapRef.current?.invalidateSize());
    resizeObserver.observe(containerRef.current);
    return () => {
      resizeObserver.disconnect();
      mapRef.current?.remove();
      mapRef.current = null;
      // Les marqueurs/tracé appartenaient à cette instance de carte, maintenant détruite — sans ce
      // reset, un remontage (StrictMode en dev, ou un vrai remontage du composant) verrait ces refs
      // encore "remplies" et se contenterait de déplacer les anciens objets au lieu d'en recréer sur
      // la nouvelle carte, qui resterait alors vide.
      restaurantMarkerRef.current = null;
      deliveryMarkerRef.current = null;
      driverMarkerRef.current = null;
      lineRef.current = null;
      boundsRef.current = null;
      driverBoundsRef.current = null;
      driverTrailLineRef.current = null;
      driverTrailRef.current = [];
    };
  }, []);

  useEffect(() => {
    if (!mapRef.current) return;
    const hasResto = restaurantLat && restaurantLng;
    const hasDelivery = deliveryLat && deliveryLng;

    if (hasResto) {
      if (!restaurantMarkerRef.current) {
        restaurantMarkerRef.current = L.marker([restaurantLat, restaurantLng], { icon: RESTAURANT_ICON })
          .addTo(mapRef.current).bindPopup('Restaurant');
      } else {
        restaurantMarkerRef.current.setLatLng([restaurantLat, restaurantLng]);
      }
    }
    if (hasDelivery) {
      if (!deliveryMarkerRef.current) {
        deliveryMarkerRef.current = L.marker([deliveryLat, deliveryLng], { icon: DELIVERY_ICON })
          .addTo(mapRef.current).bindPopup('Adresse de livraison');
      } else {
        deliveryMarkerRef.current.setLatLng([deliveryLat, deliveryLng]);
      }
    }
    if (hasResto && hasDelivery) {
      const straightLine = [[restaurantLat, restaurantLng], [deliveryLat, deliveryLng]];
      if (!lineRef.current) {
        lineRef.current = L.polyline(straightLine, { color: '#3A4A63', weight: 4, dashArray: '2, 10', lineCap: 'round', opacity: 0.65 }).addTo(mapRef.current);
      } else {
        lineRef.current.setLatLngs(straightLine);
      }
      const straightBounds = L.latLngBounds(straightLine);
      boundsRef.current = straightBounds;
      mapRef.current.fitBounds(straightBounds, { padding: [40, 40] });
      setShowRecenter(true);

      let cancelled = false;
      fetchStreetRoute(restaurantLat, restaurantLng, deliveryLat, deliveryLng)
        .then((routeLatLngs) => {
          if (cancelled || !lineRef.current) return;
          lineRef.current.setLatLngs(routeLatLngs);
          lineRef.current.setStyle({ dashArray: null, opacity: 0.8 });
          const routeBounds = L.latLngBounds(routeLatLngs);
          boundsRef.current = routeBounds;
          mapRef.current.fitBounds(routeBounds, { padding: [40, 40] });
        })
        .catch(() => {
          // OSRM indisponible : on garde la ligne droite en secours
        });
      return () => { cancelled = true; };
    } else {
      setShowRecenter(false);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [restaurantLat, restaurantLng, deliveryLat, deliveryLng]);

  useEffect(() => {
    if (!mapRef.current || !driverLat || !driverLng) return;
    // Allonge la trace en direct — n'empile pas un point identique au précédent (aucun mouvement réel
    // entre deux rafraîchissements) et garde une fenêtre glissante raisonnable plutôt qu'illimitée,
    // une livraison pouvant rester ouverte longtemps.
    const trail = driverTrailRef.current;
    const lastPoint = trail[trail.length - 1];
    if (!lastPoint || lastPoint[0] !== driverLat || lastPoint[1] !== driverLng) {
      trail.push([driverLat, driverLng]);
      if (trail.length > 200) trail.shift();
    }
    if (trail.length > 1) {
      if (!driverTrailLineRef.current) {
        driverTrailLineRef.current = L.polyline(trail, { color: '#B5822B', weight: 3, opacity: 0.8, lineCap: 'round' }).addTo(mapRef.current);
      } else {
        driverTrailLineRef.current.setLatLngs(trail);
      }
      setHasTrail(true);
    }
    if (!driverMarkerRef.current) {
      driverMarkerRef.current = L.marker([driverLat, driverLng], { icon: DRIVER_ICON })
        .addTo(mapRef.current).bindPopup('Ton livreur');
    } else {
      const marker = driverMarkerRef.current;
      const start = marker.getLatLng();
      const end = L.latLng(driverLat, driverLng);
      if (!start.equals(end)) {
        if (animRef.current) cancelAnimationFrame(animRef.current);
        const duration = 1200;
        const startTime = performance.now();
        const step = (now) => {
          const t = Math.min(1, (now - startTime) / duration);
          const lat = start.lat + (end.lat - start.lat) * t;
          const lng = start.lng + (end.lng - start.lng) * t;
          marker.setLatLng([lat, lng]);
          if (t < 1) animRef.current = requestAnimationFrame(step);
        };
        animRef.current = requestAnimationFrame(step);
      }
    }
    if (deliveryLat && deliveryLng) {
      driverBoundsRef.current = L.latLngBounds([[driverLat, driverLng], [deliveryLat, deliveryLng]]);
      setShowFollowDriver(true);
    }
    return () => {
      if (animRef.current) cancelAnimationFrame(animRef.current);
    };
  }, [driverLat, driverLng, deliveryLat, deliveryLng]);

  function recenter() {
    if (mapRef.current && boundsRef.current) {
      mapRef.current.fitBounds(boundsRef.current, { padding: [40, 40] });
    }
  }

  // Recadre sur le segment qui compte une fois la course en cours : la position actuelle du livreur et
  // l'adresse de livraison, donc le chemin qu'il reste à parcourir — plutôt que tout l'itinéraire depuis
  // le restaurant, qui peut sortir du cadre une fois que le livreur a bien avancé.
  function followDriver() {
    if (mapRef.current && driverBoundsRef.current) {
      mapRef.current.fitBounds(driverBoundsRef.current, { padding: [50, 50] });
    }
  }

  return (
    <div className="tracking-map-wrap">
      <div ref={containerRef} style={{ height, borderRadius: 'var(--radius)', overflow: 'hidden' }} />
      {(showRecenter || showFollowDriver) && (
        <div className="tracking-map-controls">
          {showFollowDriver && (
            <button type="button" className="tracking-map-follow-driver" onClick={followDriver}>🛵 Voir le livreur</button>
          )}
          {showRecenter && (
            <button type="button" className="tracking-map-recenter" onClick={recenter}>🎯 Vue d'ensemble</button>
          )}
        </div>
      )}
      <div className="tracking-map-legend">
        <span><span className="tracking-map-legend-icon" style={{ background: '#3A4A63' }}>🏪</span> Restaurant</span>
        <span><span className="tracking-map-legend-icon" style={{ background: '#16233A' }}>🛵</span> Livreur</span>
        <span><span className="tracking-map-legend-icon" style={{ background: '#D9A441' }}>🏠</span> Toi</span>
        {hasTrail && (
          <span><span className="tracking-map-legend-line" style={{ background: '#B5822B' }} /> Trajet parcouru</span>
        )}
      </div>
    </div>
  );
}
