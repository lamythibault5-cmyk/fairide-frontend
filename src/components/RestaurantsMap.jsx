import { useEffect, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import L from 'leaflet';
import 'leaflet/dist/leaflet.css';
import { RESTAURANT_TYPES } from '../menuCategories';
import { StarsDisplay } from './Stars';

const BRUSSELS_CENTER = [50.8503, 4.3517];

function cuisineEmoji(cuisine) {
  return RESTAURANT_TYPES.find((t) => t.value === cuisine)?.emoji || '🍽️';
}

function pinIcon(cuisine, active) {
  return L.divIcon({
    className: 'map-pin-wrap',
    html: `<div class="map-pin${active ? ' active' : ''}"><span class="map-pin-emoji">${cuisineEmoji(cuisine)}</span></div>`,
    iconSize: [34, 34],
    iconAnchor: [17, 32],
    popupAnchor: [0, -30]
  });
}

function homeIcon() {
  return L.divIcon({
    className: 'map-pin-wrap',
    html: '<div class="map-pin map-pin-home"><span class="map-pin-emoji">🏠</span></div>',
    iconSize: [34, 34],
    iconAnchor: [17, 32],
    popupAnchor: [0, -30]
  });
}

export default function RestaurantsMap({ restaurants, height = 420, singleMarker = false, userLocation = null }) {
  const containerRef = useRef(null);
  const mapRef = useRef(null);
  const markersRef = useRef([]);
  const homeMarkerRef = useRef(null);
  const navigate = useNavigate();
  const [selected, setSelected] = useState(null);

  useEffect(() => {
    if (!containerRef.current || mapRef.current) return;
    mapRef.current = L.map(containerRef.current).setView(BRUSSELS_CENTER, singleMarker ? 15 : 12);
    L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
      attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>',
      maxZoom: 19
    }).addTo(mapRef.current);
    if (!singleMarker) {
      mapRef.current.on('click', () => setSelected(null));
    }
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
    homeMarkerRef.current?.remove();
    homeMarkerRef.current = null;

    const withCoords = (restaurants || []).filter((r) => r.lat && r.lng);
    withCoords.forEach((r) => {
      const marker = L.marker([r.lat, r.lng], { icon: pinIcon(r.cuisine, selected?.id === r.id) }).addTo(mapRef.current);
      if (!singleMarker) {
        marker.on('click', () => setSelected(r));
      }
      markersRef.current.push(marker);
    });

    const points = withCoords.map((r) => [r.lat, r.lng]);
    if (userLocation?.lat && userLocation?.lng) {
      homeMarkerRef.current = L.marker([userLocation.lat, userLocation.lng], { icon: homeIcon(), zIndexOffset: 1000 })
        .addTo(mapRef.current)
        .bindPopup(`<b>🏠 Chez toi</b>${userLocation.address ? '<br/>' + userLocation.address : ''}`);
      points.push([userLocation.lat, userLocation.lng]);
    }

    if (points.length === 1) {
      mapRef.current.setView(points[0], 15);
    } else if (points.length > 1) {
      mapRef.current.fitBounds(L.latLngBounds(points), { padding: [30, 30] });
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [restaurants, selected, userLocation]);

  useEffect(() => {
    if (selected && !(restaurants || []).some((r) => r.id === selected.id)) setSelected(null);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [restaurants]);

  return (
    <div style={{ position: 'relative' }}>
      <div ref={containerRef} style={{ height, borderRadius: 'var(--radius)', overflow: 'hidden' }} />
      {selected && (
        <div className="map-detail-card">
          <button className="map-detail-close" onClick={() => setSelected(null)} aria-label="Retour à la carte">✕</button>
          {selected.coverImageUrl && <img src={selected.coverImageUrl} alt={selected.name} className="map-detail-cover" />}
          <div className="map-detail-body">
            {selected.hasPromo && <span className="promo-badge" style={{ position: 'static', display: 'inline-block', marginBottom: 6 }}>🏷️ Promo</span>}
            <div className="pill-row">
              <span className="pill teal">{cuisineEmoji(selected.cuisine)} {selected.cuisine}</span>
              <span className="pill gold">{selected.commune}{selected.neighborhood ? ' · ' + selected.neighborhood : ''}</span>
            </div>
            <h3 style={{ margin: '4px 0' }}>{selected.name}</h3>
            <div className="row" style={{ gap: 6, margin: '2px 0' }}>
              <StarsDisplay value={selected.rating} />
              <span className="small">{selected.reviewCount > 0 ? `(${selected.reviewCount} avis)` : 'Nouveau'}</span>
            </div>
            {selected.desc && <p className="small" style={{ margin: '6px 0' }}>{selected.desc}</p>}
            <p className="small" style={{ margin: '6px 0', color: 'var(--ink-soft)' }}>📍 {selected.address}</p>
            <div className="row" style={{ gap: 8, marginTop: 10 }}>
              <button className="btn-teal" style={{ flex: 1 }} onClick={() => navigate(`/restaurants/${selected.id}`)}>
                Voir le restaurant →
              </button>
              <button className="btn-outline" onClick={() => setSelected(null)}>
                ← Retour à la carte
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
