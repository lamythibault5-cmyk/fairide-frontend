import { useEffect, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import L from 'leaflet';
import 'leaflet/dist/leaflet.css';
import markerIcon2x from 'leaflet/dist/images/marker-icon-2x.png';
import markerIcon from 'leaflet/dist/images/marker-icon.png';
import markerShadow from 'leaflet/dist/images/marker-shadow.png';

delete L.Icon.Default.prototype._getIconUrl;
L.Icon.Default.mergeOptions({ iconRetinaUrl: markerIcon2x, iconUrl: markerIcon, shadowUrl: markerShadow });

const BRUSSELS_CENTER = [50.8503, 4.3517];

export default function RestaurantsMap({ restaurants, height = 420, singleMarker = false }) {
  const containerRef = useRef(null);
  const mapRef = useRef(null);
  const markersRef = useRef([]);
  const navigate = useNavigate();

  useEffect(() => {
    if (!containerRef.current || mapRef.current) return;
    mapRef.current = L.map(containerRef.current).setView(BRUSSELS_CENTER, singleMarker ? 15 : 12);
    L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
      attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>',
      maxZoom: 19
    }).addTo(mapRef.current);
    return () => {
      mapRef.current?.remove();
      mapRef.current = null;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    if (!mapRef.current) return;
    markersRef.current.forEach((m) => m.remove());
    markersRef.current = [];

    const withCoords = (restaurants || []).filter((r) => r.lat && r.lng);
    withCoords.forEach((r) => {
      const marker = L.marker([r.lat, r.lng]).addTo(mapRef.current);
      marker.bindPopup(`
        <b>${r.name}</b><br/>
        ${r.commune}${r.neighborhood ? ' · ' + r.neighborhood : ''}<br/>
        ${!singleMarker ? '<a href="#" data-id="' + r.id + '" class="map-popup-link">Voir le menu →</a>' : ''}
      `);
      if (!singleMarker) {
        marker.on('popupopen', () => {
          const link = document.querySelector(`.map-popup-link[data-id="${r.id}"]`);
          if (link) link.onclick = (e) => { e.preventDefault(); navigate(`/restaurants/${r.id}`); };
        });
      }
      markersRef.current.push(marker);
    });

    if (withCoords.length === 1) {
      mapRef.current.setView([withCoords[0].lat, withCoords[0].lng], 15);
    } else if (withCoords.length > 1) {
      const bounds = L.latLngBounds(withCoords.map((r) => [r.lat, r.lng]));
      mapRef.current.fitBounds(bounds, { padding: [30, 30] });
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [restaurants]);

  return <div ref={containerRef} style={{ height, borderRadius: 'var(--radius)', overflow: 'hidden' }} />;
}
