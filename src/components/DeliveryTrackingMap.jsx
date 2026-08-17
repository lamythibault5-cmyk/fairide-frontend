import { useEffect, useRef } from 'react';
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

const RESTAURANT_ICON = emojiIcon('🏪', '#2F6F5E');
const DELIVERY_ICON = emojiIcon('🏠', '#D9A441');
const DRIVER_ICON = emojiIcon('🛵', '#16233A');

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

  useEffect(() => {
    if (!containerRef.current || mapRef.current) return;
    mapRef.current = L.map(containerRef.current, { zoomControl: false }).setView(BRUSSELS_CENTER, 13);
    L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
      attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>',
      maxZoom: 19
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
        lineRef.current = L.polyline(straightLine, { color: '#2F6F5E', weight: 3, dashArray: '6, 8', opacity: 0.6 }).addTo(mapRef.current);
      } else {
        lineRef.current.setLatLngs(straightLine);
      }
      mapRef.current.fitBounds(L.latLngBounds(straightLine), { padding: [40, 40] });

      let cancelled = false;
      fetchStreetRoute(restaurantLat, restaurantLng, deliveryLat, deliveryLng)
        .then((routeLatLngs) => {
          if (cancelled || !lineRef.current) return;
          lineRef.current.setLatLngs(routeLatLngs);
          lineRef.current.setStyle({ dashArray: null, opacity: 0.8 });
          mapRef.current.fitBounds(L.latLngBounds(routeLatLngs), { padding: [40, 40] });
        })
        .catch(() => {
          // OSRM indisponible : on garde la ligne droite en secours
        });
      return () => { cancelled = true; };
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [restaurantLat, restaurantLng, deliveryLat, deliveryLng]);

  useEffect(() => {
    if (!mapRef.current || !driverLat || !driverLng) return;
    if (!driverMarkerRef.current) {
      driverMarkerRef.current = L.marker([driverLat, driverLng], { icon: DRIVER_ICON })
        .addTo(mapRef.current).bindPopup('Ton livreur');
      return;
    }
    const marker = driverMarkerRef.current;
    const start = marker.getLatLng();
    const end = L.latLng(driverLat, driverLng);
    if (start.equals(end)) return;
    if (animRef.current) cancelAnimationFrame(animRef.current);
    const duration = 1200;
    const startTime = performance.now();
    function step(now) {
      const t = Math.min(1, (now - startTime) / duration);
      const lat = start.lat + (end.lat - start.lat) * t;
      const lng = start.lng + (end.lng - start.lng) * t;
      marker.setLatLng([lat, lng]);
      if (t < 1) animRef.current = requestAnimationFrame(step);
    }
    animRef.current = requestAnimationFrame(step);
    return () => {
      if (animRef.current) cancelAnimationFrame(animRef.current);
    };
  }, [driverLat, driverLng]);

  return <div ref={containerRef} style={{ height, borderRadius: 'var(--radius)', overflow: 'hidden' }} />;
}
