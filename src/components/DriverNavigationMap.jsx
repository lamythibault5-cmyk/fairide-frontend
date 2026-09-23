import { useEffect, useRef, useState } from 'react';
import L from 'leaflet';
import { coucheTuiles, itineraireRue } from '../carte';
import { useAuth } from '../context/AuthContext';
import 'leaflet/dist/leaflet.css';
import { useLanguage, getLocale } from '../context/LanguageContext';
import { escapeHtml } from '../escapeHtml';

// Variante de DeliveryTrackingMap orientée navigation pour le livreur lui-même : au lieu de montrer le
// trajet fixe restaurant → client avec un livreur observé de l'extérieur, celle-ci trace le trajet depuis
// la position actuelle du livreur (origin) jusqu'à son prochain arrêt (target — le restaurant tant que la
// commande n'est pas retirée, l'adresse du client une fois retirée), pour remplacer une appli de guidage
// externe pendant une course. Sans arrêt à atteindre (aucune course), elle montre juste le livreur.
//
// Le temps d'arrivée vient du même appel OSRM que l'itinéraire (`duration`, en secondes), majoré de 15 %
// — un scooter en ville ne roule pas comme la voiture d'OSRM. `onEta` (optionnel) le remonte au parent,
// qui l'affiche même quand la carte est masquée.
const BRUSSELS_CENTER = [50.8503, 4.3517];

function emojiIcon(emoji, bg) {
  return L.divIcon({
    className: '',
    html: `<div style="background:${bg};width:32px;height:32px;border-radius:50%;display:flex;align-items:center;justify-content:center;font-size:16px;box-shadow:0 2px 8px rgba(0,0,0,.3);border:2px solid #fff;">${emoji}</div>`,
    iconSize: [32, 32],
    iconAnchor: [16, 16]
  });
}

const ORIGIN_ICON = emojiIcon('🛵', '#14121F');


export default function DriverNavigationMap({ originLat, originLng, targetLat, targetLng, targetLabel, targetEmoji, targetColor = '#3B2FB5', onEta, height = 280 }) {
  const { t } = useLanguage();
  const { token } = useAuth();
  const containerRef = useRef(null);
  const mapRef = useRef(null);
  const originMarkerRef = useRef(null);
  const targetMarkerRef = useRef(null);
  const lineRef = useRef(null);
  const animRef = useRef(null);
  const boundsRef = useRef(null);
  // Suivi automatique : la carte se recadre à chaque position. Un glissement du livreur le coupe (il
  // regarde plus loin sur le trajet) ; « Recentrer » le relance.
  const autoSuiviRef = useRef(true);
  const targetIconRef = useRef(emojiIcon(targetEmoji, targetColor));
  const [eta, setEta] = useState(null);
  const [recentrable, setRecentrable] = useState(false);

  useEffect(() => {
    if (!containerRef.current || mapRef.current) return;
    mapRef.current = L.map(containerRef.current, { zoomControl: false }).setView(BRUSSELS_CENTER, 13);
    coucheTuiles(L).addTo(mapRef.current);
    L.control.zoom({ position: 'bottomright' }).addTo(mapRef.current);
    mapRef.current.on('dragstart', () => { autoSuiviRef.current = false; setRecentrable(true); });
    // Voir RestaurantsMap.jsx : corrige la bande grise Leaflet quand le conteneur change de taille
    // après l'initialisation (police, image, mise en page).
    const resizeObserver = new ResizeObserver(() => mapRef.current?.invalidateSize());
    resizeObserver.observe(containerRef.current);
    return () => {
      resizeObserver.disconnect();
      mapRef.current?.remove();
      mapRef.current = null;
      originMarkerRef.current = null; targetMarkerRef.current = null; lineRef.current = null; boundsRef.current = null;
    };
  }, []);

  useEffect(() => {
    if (!mapRef.current) return;
    if (targetLat && targetLng) {
      if (!targetMarkerRef.current) {
        // escapeHtml : bindPopup insère du HTML brut, et `targetLabel` est le nom du commerce ou
        // l'adresse du client — deux chaînes saisies par quelqu'un d'autre, et jamais échappées côté
        // serveur. Sans ça, un nom de commerce contenant du balisage s'exécutait ici, dans le
        // navigateur du livreur, qui y garde son jeton de session.
        targetMarkerRef.current = L.marker([targetLat, targetLng], { icon: targetIconRef.current }).addTo(mapRef.current).bindPopup(escapeHtml(targetLabel));
      } else {
        targetMarkerRef.current.setLatLng([targetLat, targetLng]);
      }
    } else {
      // Plus d'arrêt à atteindre : on retire la cible, le trajet et l'estimation.
      if (targetMarkerRef.current) { targetMarkerRef.current.remove(); targetMarkerRef.current = null; }
      if (lineRef.current) { lineRef.current.remove(); lineRef.current = null; }
      boundsRef.current = null;
      setEta(null); onEta?.(null);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [targetLat, targetLng, targetLabel]);

  useEffect(() => {
    if (!mapRef.current || !originLat || !originLng) return undefined;
    if (!originMarkerRef.current) {
      originMarkerRef.current = L.marker([originLat, originLng], { icon: ORIGIN_ICON }).addTo(mapRef.current).bindPopup(t('navMap.you'));
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

    if (!targetLat || !targetLng) {
      // Aucune course : juste le livreur, à l'échelle du quartier.
      if (autoSuiviRef.current) mapRef.current.setView([originLat, originLng], 15);
      return undefined;
    }
    const straightLine = [[originLat, originLng], [targetLat, targetLng]];
    if (!lineRef.current) {
      lineRef.current = L.polyline(straightLine, { color: targetColor, weight: 4, dashArray: '6, 8', opacity: 0.7 }).addTo(mapRef.current);
    } else {
      lineRef.current.setLatLngs(straightLine);
    }
    boundsRef.current = L.latLngBounds(straightLine);
    if (autoSuiviRef.current) mapRef.current.fitBounds(boundsRef.current, { padding: [40, 40] });

    let cancelled = false;
    itineraireRue(token, originLat, originLng, targetLat, targetLng)
      .then(({ latLngs, duration, distance }) => {
        if (cancelled || !lineRef.current) return;
        lineRef.current.setLatLngs(latLngs);
        lineRef.current.setStyle({ dashArray: null, opacity: 0.85 });
        boundsRef.current = L.latLngBounds(latLngs);
        if (autoSuiviRef.current) mapRef.current.fitBounds(boundsRef.current, { padding: [40, 40] });
        // Jamais moins d'une minute : « 0 min » alors qu'on n'est pas arrivé est un mensonge.
        const info = { minutes: Math.max(1, Math.round((duration * 1.15) / 60)), km: Math.round(distance / 100) / 10 };
        setEta(info); onEta?.(info);
      })
      .catch(() => {
        // OSRM indisponible : on garde la ligne droite en secours, sans estimation plutôt qu'une fausse
      });
    return () => { cancelled = true; };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [originLat, originLng, targetLat, targetLng]);

  function recentrer() {
    autoSuiviRef.current = true; setRecentrable(false);
    if (!mapRef.current) return;
    if (boundsRef.current) mapRef.current.fitBounds(boundsRef.current, { padding: [40, 40] });
    else if (originLat && originLng) mapRef.current.setView([originLat, originLng], 15);
  }

  return (
    <div className="tracking-map-wrap">
      <div className="tracking-map-cadre">
      <div ref={containerRef} style={{ height, borderRadius: 'var(--radius)', overflow: 'hidden' }} />
      {eta && (
        <div className="tracking-eta-pill" aria-live="polite">
          {t('navMap.arrivalIn')} <b>~{eta.minutes} min</b> <span className="tracking-eta-km">· {eta.km.toLocaleString(getLocale())} km</span>
        </div>
      )}
      {recentrable && (
        <div className="tracking-map-controls">
          <button type="button" className="tracking-map-follow-driver" onClick={recentrer}>{t('navMap.recenter')}</button>
        </div>
      )}
      </div>
      <div className="tracking-map-legend">
        <span><span className="tracking-map-legend-icon" style={{ background: '#14121F' }}>🛵</span> {t('navMap.you')}</span>
        {targetLat && targetLng && <span><span className="tracking-map-legend-icon" style={{ background: targetColor }}>{targetEmoji}</span> {targetLabel || t('navMap.nextStop')}</span>}
      </div>
    </div>
  );
}
