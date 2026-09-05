import { useEffect, useRef, useState } from 'react';
import L from 'leaflet';
import 'leaflet/dist/leaflet.css';

const BRUSSELS_CENTER = [50.8503, 4.3517];

// Au-delà de ce délai sans nouvelle position, on prévient le client que la carte ne bouge plus. Deux
// minutes : assez long pour ne pas s'alarmer d'un feu rouge ou d'un immeuble qui coupe le GPS, assez
// court pour ne pas laisser quelqu'un attendre devant une carte morte.
const STALE_AFTER_MS = 120000;

// Le temps d'arrivée est recalculé quand le livreur a bougé d'au moins 25 m, ou toutes les 30 s : OSRM
// est un service public gratuit, on ne le sollicite pas à chaque rafraîchissement de position.
const ETA_DISTANCE_MIN_M = 25;
const ETA_INTERVALLE_MIN_MS = 30000;

function formatClock(date) {
  return date.toLocaleTimeString('fr-BE', { hour: '2-digit', minute: '2-digit' });
}

function distanceM(a, b) {
  const R = 6371000; const toRad = (d) => (d * Math.PI) / 180;
  const dLat = toRad(b[0] - a[0]); const dLng = toRad(b[1] - a[1]);
  const s = Math.sin(dLat / 2) ** 2 + Math.cos(toRad(a[0])) * Math.cos(toRad(b[0])) * Math.sin(dLng / 2) ** 2;
  return 2 * R * Math.asin(Math.sqrt(s));
}

function emojiIcon(emoji, bg) {
  return L.divIcon({
    className: '',
    html: `<div style="background:${bg};width:32px;height:32px;border-radius:50%;display:flex;align-items:center;justify-content:center;font-size:16px;box-shadow:0 2px 8px rgba(0,0,0,.3);border:2px solid #fff;">${emoji}</div>`,
    iconSize: [32, 32],
    iconAnchor: [16, 16]
  });
}

// Icône du livreur avec un anneau qui pulse autour, pour que "en mouvement, en direct" se lise d'un
// coup d'œil (même codage visuel que les apps de livraison grand public).
const DRIVER_ICON = L.divIcon({
  className: '',
  html: `
    <div style="position:relative;width:32px;height:32px;">
      <div class="tracking-driver-pulse"></div>
      <div style="position:relative;background:#14121F;width:32px;height:32px;border-radius:50%;display:flex;align-items:center;justify-content:center;font-size:16px;box-shadow:0 2px 8px rgba(0,0,0,.3);border:2px solid #fff;">🛵</div>
    </div>
  `,
  iconSize: [32, 32],
  iconAnchor: [16, 16]
});

const RESTAURANT_ICON = emojiIcon('🏪', '#3B2FB5');
const DELIVERY_ICON = emojiIcon('🏠', '#C8F03C');

// Itinéraire routier ET durée estimée, d'un seul appel. `duration` est en secondes, `distance` en mètres.
async function fetchStreetRoute(fromLat, fromLng, toLat, toLng) {
  const url = `https://router.project-osrm.org/route/v1/driving/${fromLng},${fromLat};${toLng},${toLat}?overview=full&geometries=geojson`;
  const res = await fetch(url);
  if (!res.ok) throw new Error('routing-failed');
  const data = await res.json();
  const route = data.routes?.[0];
  const coords = route?.geometry?.coordinates;
  if (!coords || !coords.length) throw new Error('no-route');
  return { latLngs: coords.map(([lng, lat]) => [lat, lng]), duration: route.duration, distance: route.distance };
}

// `homeLat`/`homeLng` (optionnels) : la maison du client, affichée seule quand aucune livraison n'est en
// cours — une carte vide centrée sur Bruxelles ne dit rien à personne, une carte centrée chez soi dit
// « c'est ici qu'on te livrera ».
// `onEta` (optionnel) : reçoit { minutes, km } à chaque nouvelle estimation, ou null — pour que le
// parent puisse l'afficher même quand la carte est masquée.
// `homeLabel`/`homeEmoji`/`homeColor` : le « chez soi » n'est pas le même pour tout le monde — la maison du
// client, le commerce du restaurateur. `legendeDestination` : ce que la légende appelle l'adresse de
// livraison (« Toi » pour le client, « Client » pour le restaurateur).
export default function DeliveryTrackingMap({ restaurantLat, restaurantLng, deliveryLat, deliveryLng, driverLat, driverLng, lastUpdatedAt, homeLat, homeLng, homeLabel = 'Chez toi', homeEmoji = '🏠', homeColor = '#C8F03C', legendeDestination = 'Toi', onEta, height = 260 }) {
  const containerRef = useRef(null);
  const mapRef = useRef(null);
  const restaurantMarkerRef = useRef(null);
  const deliveryMarkerRef = useRef(null);
  const homeMarkerRef = useRef(null);
  const driverMarkerRef = useRef(null);
  const lineRef = useRef(null);
  const remainingLineRef = useRef(null);
  const animRef = useRef(null);
  const driverTrailRef = useRef([]);
  const driverTrailLineRef = useRef(null);
  const boundsRef = useRef(null);
  const driverBoundsRef = useRef(null);
  // Suivi automatique : la carte se recadre sur le livreur à chaque position. Un glissement de
  // l'utilisateur le coupe (il veut regarder ailleurs) ; « Voir le livreur » le réactive.
  const autoSuiviRef = useRef(true);
  const etaDernierRef = useRef({ pos: null, at: 0 });
  const [showRecenter, setShowRecenter] = useState(false);
  const [showFollowDriver, setShowFollowDriver] = useState(false);
  const [hasTrail, setHasTrail] = useState(false);
  const [eta, setEta] = useState(null);

  // Fraîcheur de la position : voir le commentaire long de la version précédente — `lastUpdatedAt`
  // (heure serveur du dernier envoi) est la seule source qui permette d'affirmer quelque chose ; le
  // repli ne fait que dater le dernier déplacement observé par cette page.
  const [firstSeenMoveAt, setFirstSeenMoveAt] = useState(null);
  const [now, setNow] = useState(() => Date.now());
  const lastDriverPosRef = useRef(null);

  useEffect(() => {
    if (driverLat == null || driverLng == null) return;
    const key = `${driverLat},${driverLng}`;
    if (lastDriverPosRef.current === null) { lastDriverPosRef.current = key; return; }
    if (lastDriverPosRef.current === key) return;
    lastDriverPosRef.current = key;
    setFirstSeenMoveAt(new Date());
  }, [driverLat, driverLng]);

  useEffect(() => {
    const clock = setInterval(() => setNow(Date.now()), 30000);
    return () => clearInterval(clock);
  }, []);

  const authoritativeAt = lastUpdatedAt ? new Date(lastUpdatedAt) : null;
  const isStale = authoritativeAt != null && now - authoritativeAt.getTime() > STALE_AFTER_MS;
  const shownAt = authoritativeAt || firstSeenMoveAt;

  useEffect(() => {
    if (!containerRef.current || mapRef.current) return;
    mapRef.current = L.map(containerRef.current, { zoomControl: false }).setView(BRUSSELS_CENTER, 13);
    // Tuiles OpenStreetMap. La version précédente utilisait le fond CARTO « Voyager », devenu payant :
    // chaque tuile affichait « API KEY REQUIRED » en travers. OSM est ce que les autres cartes de
    // l'application utilisent déjà, gratuit et sans clé.
    L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
      attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>',
      maxZoom: 19
    }).addTo(mapRef.current);
    L.control.zoom({ position: 'bottomright' }).addTo(mapRef.current);
    mapRef.current.on('dragstart', () => { autoSuiviRef.current = false; });
    const resizeObserver = new ResizeObserver(() => mapRef.current?.invalidateSize());
    resizeObserver.observe(containerRef.current);
    return () => {
      resizeObserver.disconnect();
      mapRef.current?.remove();
      mapRef.current = null;
      restaurantMarkerRef.current = null; deliveryMarkerRef.current = null; homeMarkerRef.current = null;
      driverMarkerRef.current = null; lineRef.current = null; remainingLineRef.current = null;
      boundsRef.current = null; driverBoundsRef.current = null;
      driverTrailLineRef.current = null; driverTrailRef.current = [];
    };
  }, []);

  // Sans livraison : la maison, seule, à une échelle de quartier.
  useEffect(() => {
    if (!mapRef.current) return;
    const enLivraison = restaurantLat && restaurantLng && deliveryLat && deliveryLng;
    if (enLivraison || !homeLat || !homeLng) {
      if (homeMarkerRef.current) { homeMarkerRef.current.remove(); homeMarkerRef.current = null; }
      return;
    }
    if (!homeMarkerRef.current) {
      homeMarkerRef.current = L.marker([homeLat, homeLng], { icon: emojiIcon(homeEmoji, homeColor) }).addTo(mapRef.current).bindPopup(homeLabel);
    } else {
      homeMarkerRef.current.setLatLng([homeLat, homeLng]);
    }
    mapRef.current.setView([homeLat, homeLng], 15);
  }, [homeLat, homeLng, restaurantLat, restaurantLng, deliveryLat, deliveryLng]);

  useEffect(() => {
    if (!mapRef.current) return;
    const hasResto = restaurantLat && restaurantLng;
    const hasDelivery = deliveryLat && deliveryLng;

    if (hasResto) {
      if (!restaurantMarkerRef.current) {
        restaurantMarkerRef.current = L.marker([restaurantLat, restaurantLng], { icon: RESTAURANT_ICON }).addTo(mapRef.current).bindPopup('Restaurant');
      } else restaurantMarkerRef.current.setLatLng([restaurantLat, restaurantLng]);
    }
    if (hasDelivery) {
      if (!deliveryMarkerRef.current) {
        deliveryMarkerRef.current = L.marker([deliveryLat, deliveryLng], { icon: DELIVERY_ICON }).addTo(mapRef.current).bindPopup('Adresse de livraison');
      } else deliveryMarkerRef.current.setLatLng([deliveryLat, deliveryLng]);
    }
    if (hasResto && hasDelivery) {
      const straightLine = [[restaurantLat, restaurantLng], [deliveryLat, deliveryLng]];
      if (!lineRef.current) {
        lineRef.current = L.polyline(straightLine, { color: '#3B2FB5', weight: 4, dashArray: '2, 10', lineCap: 'round', opacity: 0.55 }).addTo(mapRef.current);
      } else lineRef.current.setLatLngs(straightLine);
      const straightBounds = L.latLngBounds(straightLine);
      boundsRef.current = straightBounds;
      mapRef.current.fitBounds(straightBounds, { padding: [40, 40] });
      setShowRecenter(true);

      let cancelled = false;
      fetchStreetRoute(restaurantLat, restaurantLng, deliveryLat, deliveryLng)
        .then(({ latLngs }) => {
          if (cancelled || !lineRef.current) return;
          lineRef.current.setLatLngs(latLngs);
          lineRef.current.setStyle({ dashArray: null, opacity: 0.45 });
          const routeBounds = L.latLngBounds(latLngs);
          boundsRef.current = routeBounds;
          if (autoSuiviRef.current && !driverMarkerRef.current) mapRef.current.fitBounds(routeBounds, { padding: [40, 40] });
        })
        .catch(() => { /* OSRM indisponible : on garde la ligne droite */ });
      return () => { cancelled = true; };
    }
    // Plus de livraison (terminée pendant qu'on regardait) : on retire tout ce qui la concernait, sinon la
    // carte « chez toi » garderait un restaurant et un trajet fantômes.
    for (const ref of [restaurantMarkerRef, deliveryMarkerRef, lineRef, remainingLineRef]) {
      if (ref.current) { ref.current.remove(); ref.current = null; }
    }
    boundsRef.current = null;
    setShowRecenter(false);
    return undefined;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [restaurantLat, restaurantLng, deliveryLat, deliveryLng]);

  useEffect(() => {
    if (!mapRef.current || !driverLat || !driverLng) return undefined;
    const trail = driverTrailRef.current;
    const lastPoint = trail[trail.length - 1];
    if (!lastPoint || lastPoint[0] !== driverLat || lastPoint[1] !== driverLng) {
      trail.push([driverLat, driverLng]);
      if (trail.length > 200) trail.shift();
    }
    if (trail.length > 1) {
      if (!driverTrailLineRef.current) {
        driverTrailLineRef.current = L.polyline(trail, { color: '#C8F03C', weight: 3, opacity: 0.8, lineCap: 'round' }).addTo(mapRef.current);
      } else driverTrailLineRef.current.setLatLngs(trail);
      setHasTrail(true);
    }
    if (!driverMarkerRef.current) {
      driverMarkerRef.current = L.marker([driverLat, driverLng], { icon: DRIVER_ICON }).addTo(mapRef.current).bindPopup('Ton livreur');
    } else {
      const marker = driverMarkerRef.current;
      const start = marker.getLatLng();
      const end = L.latLng(driverLat, driverLng);
      if (!start.equals(end)) {
        if (animRef.current) cancelAnimationFrame(animRef.current);
        const duration = 1200; const startTime = performance.now();
        const step = (t0) => {
          const t = Math.min(1, (t0 - startTime) / duration);
          marker.setLatLng([start.lat + (end.lat - start.lat) * t, start.lng + (end.lng - start.lng) * t]);
          if (t < 1) animRef.current = requestAnimationFrame(step);
        };
        animRef.current = requestAnimationFrame(step);
      }
    }
    let cancelled = false;
    if (deliveryLat && deliveryLng) {
      driverBoundsRef.current = L.latLngBounds([[driverLat, driverLng], [deliveryLat, deliveryLng]]);
      setShowFollowDriver(true);
      // La carte suit : recadrée sur ce qu'il reste à parcourir, tant que l'utilisateur n'a pas pris la main.
      if (autoSuiviRef.current) mapRef.current.fitBounds(driverBoundsRef.current, { padding: [50, 50], maxZoom: 16 });

      // Temps d'arrivée : le trajet RESTANT, du livreur à la porte, et sa durée. Tracé en plein par-dessus
      // l'itinéraire complet en pointillé : ce qui est fait s'estompe, ce qui reste ressort.
      const pos = [driverLat, driverLng]; const dernier = etaDernierRef.current;
      const aBouge = !dernier.pos || distanceM(dernier.pos, pos) >= ETA_DISTANCE_MIN_M;
      const assezVieux = Date.now() - dernier.at >= ETA_INTERVALLE_MIN_MS;
      if (aBouge || assezVieux) {
        etaDernierRef.current = { pos, at: Date.now() };
        fetchStreetRoute(driverLat, driverLng, deliveryLat, deliveryLng)
          .then(({ latLngs, duration, distance }) => {
            if (cancelled || !mapRef.current) return;
            if (!remainingLineRef.current) {
              remainingLineRef.current = L.polyline(latLngs, { color: '#3B2FB5', weight: 5, opacity: 0.9, lineCap: 'round' }).addTo(mapRef.current);
            } else remainingLineRef.current.setLatLngs(latLngs);
            // Un scooter en ville ne roule pas comme la voiture d'OSRM : on majore de 15 %, et jamais
            // moins d'une minute — « arrive dans 0 min » alors qu'il n'est pas là est un mensonge.
            const minutes = Math.max(1, Math.round((duration * 1.15) / 60));
            const info = { minutes, km: Math.round(distance / 100) / 10 };
            setEta(info); onEta?.(info);
          })
          .catch(() => { /* pas d estimation plutôt qu une fausse */ });
      }
    }
    return () => { cancelled = true; if (animRef.current) cancelAnimationFrame(animRef.current); };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [driverLat, driverLng, deliveryLat, deliveryLng]);

  // Plus de livreur (livraison terminée, autre commande) : l'estimation ne veut plus rien dire, et son
  // marqueur, sa trace et le trajet restant non plus.
  useEffect(() => {
    if (driverLat != null && driverLng != null) return;
    setEta(null); onEta?.(null);
    if (animRef.current) cancelAnimationFrame(animRef.current);
    for (const ref of [driverMarkerRef, driverTrailLineRef, remainingLineRef]) {
      if (ref.current) { ref.current.remove(); ref.current = null; }
    }
    driverTrailRef.current = []; driverBoundsRef.current = null; etaDernierRef.current = { pos: null, at: 0 };
    autoSuiviRef.current = true;
    setHasTrail(false); setShowFollowDriver(false);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [driverLat, driverLng]);

  function recenter() {
    autoSuiviRef.current = false;
    if (mapRef.current && boundsRef.current) mapRef.current.fitBounds(boundsRef.current, { padding: [40, 40] });
  }
  function followDriver() {
    autoSuiviRef.current = true;
    if (mapRef.current && driverBoundsRef.current) mapRef.current.fitBounds(driverBoundsRef.current, { padding: [50, 50], maxZoom: 16 });
  }

  const enLivraison = !!(restaurantLat && deliveryLat);
  return (
    <div className="tracking-map-wrap">
      {/* .tracking-map-cadre : la pastille et les boutons se positionnent par rapport à la carte seule,
          pas au bloc entier (légende, fraîcheur) — sinon la pastille « en bas » tombait sous la carte. */}
      <div className="tracking-map-cadre">
      <div ref={containerRef} style={{ height, borderRadius: 'var(--radius)', overflow: 'hidden' }} />
      {eta && (
        <div className="tracking-eta-pill" aria-live="polite">
          🛵 Arrive dans <b>~{eta.minutes} min</b> <span className="tracking-eta-km">· {eta.km.toLocaleString('fr-BE')} km</span>
        </div>
      )}
      {(showRecenter || showFollowDriver) && (
        <div className="tracking-map-controls">
          {showFollowDriver && <button type="button" className="tracking-map-follow-driver" onClick={followDriver}>🛵 Suivre le livreur</button>}
          {showRecenter && <button type="button" className="tracking-map-recenter" onClick={recenter}>🎯 Vue d'ensemble</button>}
        </div>
      )}
      </div>
      {driverLat != null && driverLng != null && shownAt && (
        <div className={`tracking-map-freshness${isStale ? ' stale' : ''}`}>
          {isStale
            ? `⚠️ Aucune nouvelle position depuis ${formatClock(shownAt)}. Le suivi peut s'interrompre si le téléphone du livreur se met en veille.`
            : authoritativeAt ? `Position mise à jour à ${formatClock(shownAt)}` : `Dernier déplacement observé à ${formatClock(shownAt)}`}
        </div>
      )}
      <div className="tracking-map-legend">
        {enLivraison && <span><span className="tracking-map-legend-icon" style={{ background: '#3B2FB5' }}>🏪</span> Restaurant</span>}
        {enLivraison && <span><span className="tracking-map-legend-icon" style={{ background: '#14121F' }}>🛵</span> Livreur</span>}
        {enLivraison
          ? <span><span className="tracking-map-legend-icon" style={{ background: '#C8F03C' }}>🏠</span> {legendeDestination}</span>
          : <span><span className="tracking-map-legend-icon" style={{ background: homeColor }}>{homeEmoji}</span> {homeLabel}</span>}
        {hasTrail && <span><span className="tracking-map-legend-line" style={{ background: '#C8F03C' }} /> Trajet parcouru</span>}
      </div>
    </div>
  );
}
