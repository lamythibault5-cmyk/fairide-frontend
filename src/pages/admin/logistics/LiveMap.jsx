import { useEffect, useRef } from 'react';
import L from 'leaflet';
import 'leaflet/dist/leaflet.css';

// Carte Leaflet des livraisons en cours : livreurs (violet, rouge si en retard), restaurants (or) et
// points de livraison (encre). RestaurantsMap.jsx est trop lié à la fiche restaurant (popup, navigation
// client) pour être réutilisé ; on garde juste la même recette (divIcon, ResizeObserver, fitBounds).
// `points` : [{ id, kind: 'driver' | 'restaurant' | 'client', lat, lng, label, sub, late }]
const BRUSSELS_CENTER = [50.8503, 4.3517];
const EMOJI = { driver: '🚴', restaurant: '🍽️', client: '🏠' };

function escapeHtml(s) {
  return String(s || '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
}

function icone(p) {
  return L.divIcon({
    className: 'lg-marker-wrap',
    html: `<div class="lg-marker ${p.kind}${p.late ? ' late' : ''}"><span>${EMOJI[p.kind] || '📍'}</span></div>`,
    iconSize: [28, 28],
    iconAnchor: [14, 28],
    popupAnchor: [0, -26]
  });
}

export default function LiveMap({ points, height = 420 }) {
  const containerRef = useRef(null);
  const mapRef = useRef(null);
  const layerRef = useRef(null);
  const derniereCleRef = useRef('');

  useEffect(() => {
    if (!containerRef.current || mapRef.current) return;
    mapRef.current = L.map(containerRef.current).setView(BRUSSELS_CENTER, 12);
    L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
      attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>',
      maxZoom: 19
    }).addTo(mapRef.current);
    layerRef.current = L.layerGroup().addTo(mapRef.current);
    const resizeObserver = new ResizeObserver(() => mapRef.current?.invalidateSize());
    resizeObserver.observe(containerRef.current);
    return () => {
      resizeObserver.disconnect();
      mapRef.current?.remove();
      mapRef.current = null;
      layerRef.current = null;
    };
  }, []);

  useEffect(() => {
    if (!mapRef.current || !layerRef.current) return;
    layerRef.current.clearLayers();
    const valides = (points || []).filter((p) => Number.isFinite(p.lat) && Number.isFinite(p.lng));
    for (const p of valides) {
      const marker = L.marker([p.lat, p.lng], { icon: icone(p), zIndexOffset: p.kind === 'driver' ? 1000 : 0 });
      marker.bindPopup(`<b>${escapeHtml(p.label)}</b>${p.sub ? '<br/>' + escapeHtml(p.sub) : ''}`);
      layerRef.current.addLayer(marker);
    }
    // On ne recadre que quand l'ensemble des points change (pas à chaque rafraîchissement de position),
    // pour ne pas arracher la carte des mains de l'admin toutes les 20 s.
    const cle = valides.map((p) => p.id).sort().join('|');
    if (cle !== derniereCleRef.current) {
      derniereCleRef.current = cle;
      if (valides.length === 1) mapRef.current.setView([valides[0].lat, valides[0].lng], 14);
      else if (valides.length > 1) mapRef.current.fitBounds(L.latLngBounds(valides.map((p) => [p.lat, p.lng])), { padding: [30, 30], maxZoom: 15 });
    }
  }, [points]);

  return <div ref={containerRef} className="lg-map" style={{ height }} />;
}
