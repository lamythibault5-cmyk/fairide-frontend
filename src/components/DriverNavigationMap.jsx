import { useEffect, useRef } from 'react';
import L from 'leaflet';
import 'leaflet/dist/leaflet.css';

// Variante de DeliveryTrackingMap orientée navigation pour le livreur lui-même : au lieu de montrer le
// trajet fixe restaurant → client avec un livreur observé de l'extérieur, celle-ci trace le trajet depuis
// la position actuelle du livreur (origin) jusqu'à son prochain arrêt (target — le restaurant tant que la
// commande n'est pas retirée, l'adresse du client une fois retirée), pour remplacer une appli de guidage
// externe pendant une course.
const BRUSSELS_CENTER = [50.8503, 4.3517];

function emojiIcon(emoji, bg) {
  return L.divIcon({
    className: '',
    html: `<div style="background:${bg};width:32px;height:32px;border-radius:50%;display:flex;align-items:center;justify-content:center;font-size:16px;box-shadow:0 2px 8px rgba(0,0,0,.3);border:2px solid #fff;">${emoji}</div>`,
    iconSize: [32, 32],
    iconAnchor: [16, 16]
  });
}

const ORIGIN_ICON = emojiIcon('🛵', '#16233A');

async function fetchStreetRoute(fromLat, fromLng, toLat, toLng) {
  const url = `https://router.project-osrm.org/route/v1/driving/${fromLng},${fromLat};${toLng},${toLat}?overview=full&geometries=geojson`;
  const res = await fetch(url);
  if (!res.ok) throw new Error('routing-failed');
  const data = await res.json();
  const coords = data.routes?.[0]?.geometry?.coordinates;
  if (!coords || !coords.length) throw new Error('no-route');
  return coords.map(([lng, lat]) => [lat, lng]);
}

export default function DriverNavigationMap({ originLat, originLng, targetLat, targetLng, targetLabel, targetEmoji, targetColor = '#3A4A63', height = 280 }) {
  const containerRef = useRef(null);
  const mapRef = useRef(null);
  const originMarkerRef = useRef(null);
  const targetMarkerRef = useRef(null);
  const lineRef = useRef(null);
  const animRef = useRef(null);
  const targetIconRef = useRef(emojiIcon(targetEmoji, targetColor));

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
    if (targetLat && targetLng) {
      if (!targetMarkerRef.current) {
        targetMarkerRef.current = L.marker([targetLat, targetLng], { icon: targetIconRef.current }).addTo(mapRef.current).bindPopup(targetLabel || '');
      } else {
        targetMarkerRef.current.setLatLng([targetLat, targetLng]);
      }
    }
  }, [targetLat, targetLng, targetLabel]);

  useEffect(() => {
    if (!mapRef.current || !originLat || !originLng) return;
    if (!originMarkerRef.current) {
      originMarkerRef.current = L.marker([originLat, originLng], { icon: ORIGIN_ICON }).addTo(mapRef.current).bindPopup('Toi');
    } else {
      const marker = originMarkerRef.current;
      const start = marker.getLatLng();
      const end = L.latLng(originLat, originLng);
      if (!start.equals(end)) {
        if (animRef.current) cancelAnimationFrame(animRef.current);
        const duration = 1200;
        const startTime = performance.now();
        function step(now) {
          const t = Math.min(1, (now - startTime) / duration);
          marker.setLatLng([start.lat + (end.lat - start.lat) * t, start.lng + (end.lng - start.lng) * t]);
          if (t < 1) animRef.current = requestAnimationFrame(step);
        }
        animRef.current = requestAnimationFrame(step);
      }
    }

    if (!targetLat || !targetLng) return undefined;
    const straightLine = [[originLat, originLng], [targetLat, targetLng]];
    if (!lineRef.current) {
      lineRef.current = L.polyline(straightLine, { color: targetColor, weight: 4, dashArray: '6, 8', opacity: 0.7 }).addTo(mapRef.current);
    } else {
      lineRef.current.setLatLngs(straightLine);
    }
    mapRef.current.fitBounds(L.latLngBounds(straightLine), { padding: [40, 40] });

    let cancelled = false;
    fetchStreetRoute(originLat, originLng, targetLat, targetLng)
      .then((routeLatLngs) => {
        if (cancelled || !lineRef.current) return;
        lineRef.current.setLatLngs(routeLatLngs);
        lineRef.current.setStyle({ dashArray: null, opacity: 0.85 });
        mapRef.current.fitBounds(L.latLngBounds(routeLatLngs), { padding: [40, 40] });
      })
      .catch(() => {
        // OSRM indisponible : on garde la ligne droite en secours
      });
    return () => { cancelled = true; };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [originLat, originLng, targetLat, targetLng]);

  return <div ref={containerRef} style={{ height, borderRadius: 'var(--radius)', overflow: 'hidden' }} />;
}
