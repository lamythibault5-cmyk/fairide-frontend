import { useEffect, useRef, useState } from 'react';
import { mouvementReduit } from '../gestes';
import L from 'leaflet';
import { coucheTuiles, itineraireRue } from '../carte';
import { useAuth } from '../context/AuthContext';
import 'leaflet/dist/leaflet.css';
import { useLanguage, getLocale } from '../context/LanguageContext';
import { escapeHtml } from '../escapeHtml';
import Icone from './Icone';
import { LIME, pastilleCommerce, pastilleLivreur, pastilleMaison, pastilleSelonCouleur, veloHtml, TRACE_BORD, TRACE_FAIT, TRACE_RESTE, TRACE_PREVU } from '../marqueursCarte';

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
  return date.toLocaleTimeString(getLocale(), { hour: '2-digit', minute: '2-digit' });
}

function distanceM(a, b) {
  const R = 6371000; const toRad = (d) => (d * Math.PI) / 180;
  const dLat = toRad(b[0] - a[0]); const dLng = toRad(b[1] - a[1]);
  const s = Math.sin(dLat / 2) ** 2 + Math.cos(toRad(a[0])) * Math.cos(toRad(b[0])) * Math.sin(dLng / 2) ** 2;
  return 2 * R * Math.asin(Math.sqrt(s));
}

// Pastilles et tracés en iris : marqueursCarte.js (audit « Look and feel », 2026-10-19).
const RESTAURANT_ICON = pastilleCommerce();
const DELIVERY_ICON = pastilleMaison();

// Itinéraire routier ET durée estimée, d'un seul appel. `duration` est en secondes, `distance` en mètres.

// `homeLat`/`homeLng` (optionnels) : la maison du client, affichée seule quand aucune livraison n'est en
// cours — une carte vide centrée sur Bruxelles ne dit rien à personne, une carte centrée chez soi dit
// « c'est ici qu'on te livrera ».
// `onEta` (optionnel) : reçoit { minutes, km } à chaque nouvelle estimation, ou null — pour que le
// parent puisse l'afficher même quand la carte est masquée.
// `homeLabel`/`homeEmoji`/`homeColor` : le « chez soi » n'est pas le même pour tout le monde — la maison du
// client, le commerce du restaurateur. `legendeDestination` : ce que la légende appelle l'adresse de
// livraison (« Toi » pour le client, « Client » pour le restaurateur).
export default function DeliveryTrackingMap({ restaurantLat, restaurantLng, deliveryLat, deliveryLng, driverLat, driverLng, lastUpdatedAt, homeLat, homeLng, homeLabel, homeEmoji = 'maison', homeColor = '#C8F03C', legendeDestination, onEta, height = 260 }) {
  const { t } = useLanguage();
  const { token } = useAuth();
  // Libellés par défaut résolus ici (pas dans la signature) : t n'existe qu'à l'intérieur du composant.
  homeLabel = homeLabel ?? t('trackingMap.home');
  legendeDestination = legendeDestination ?? t('trackingMap.you');
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
  const driverTrailBordRef = useRef(null);
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
    coucheTuiles(L).addTo(mapRef.current);
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
      driverTrailLineRef.current = null; driverTrailBordRef.current = null; driverTrailRef.current = [];
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
      // `homeLabel` est aujourd'hui alimenté par une clé de traduction, donc sans danger — mais c'est
      // une propriété publique du composant, et rien n'empêcherait un prochain appelant d'y passer le
      // nom d'un commerce. On échappe maintenant, tant que la question est encore théorique.
      homeMarkerRef.current = L.marker([homeLat, homeLng], { icon: pastilleSelonCouleur(homeEmoji, homeColor) }).addTo(mapRef.current).bindPopup(escapeHtml(homeLabel));
    } else {
      homeMarkerRef.current.setLatLng([homeLat, homeLng]);
    }
    mapRef.current.setView([homeLat, homeLng], 15);
    // L'étiquette et la pastille suivent l'effet ci-dessous : les lister ici recentrerait la carte à chaque changement de langue.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [homeLat, homeLng, restaurantLat, restaurantLng, deliveryLat, deliveryLng]);

  // La pastille posée garde l'étiquette et l'icône de sa création : sans cet effet, la bulle restait dans la langue d'avant
  // un changement de langue fait carte ouverte (audit du 27/10).
  useEffect(() => {
    if (!homeMarkerRef.current) return;
    homeMarkerRef.current.setIcon(pastilleSelonCouleur(homeEmoji, homeColor)).setPopupContent(escapeHtml(homeLabel));
  }, [homeLabel, homeEmoji, homeColor]);

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
        deliveryMarkerRef.current = L.marker([deliveryLat, deliveryLng], { icon: DELIVERY_ICON }).addTo(mapRef.current).bindPopup(t('trackingMap.deliveryAddress'));
      } else deliveryMarkerRef.current.setLatLng([deliveryLat, deliveryLng]);
    }
    if (hasResto && hasDelivery) {
      const straightLine = [[restaurantLat, restaurantLng], [deliveryLat, deliveryLng]];
      if (!lineRef.current) {
        lineRef.current = L.polyline(straightLine, TRACE_RESTE).addTo(mapRef.current);
      } else lineRef.current.setLatLngs(straightLine);
      const straightBounds = L.latLngBounds(straightLine);
      boundsRef.current = straightBounds;
      mapRef.current.fitBounds(straightBounds, { padding: [40, 40] });
      setShowRecenter(true);

      let cancelled = false;
      itineraireRue(token, restaurantLat, restaurantLng, deliveryLat, deliveryLng)
        .then(({ latLngs }) => {
          if (cancelled || !lineRef.current) return;
          lineRef.current.setLatLngs(latLngs);
          lineRef.current.setStyle(TRACE_PREVU);
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
      // Le trajet fait : iris plein bordé de blanc (deux traits, le bord dessous), sous la pastille du livreur.
      if (!driverTrailLineRef.current) {
        driverTrailBordRef.current = L.polyline(trail, TRACE_BORD).addTo(mapRef.current);
        driverTrailLineRef.current = L.polyline(trail, TRACE_FAIT).addTo(mapRef.current);
      } else { driverTrailBordRef.current.setLatLngs(trail); driverTrailLineRef.current.setLatLngs(trail); }
      setHasTrail(true);
    }
    if (!driverMarkerRef.current) {
      driverMarkerRef.current = L.marker([driverLat, driverLng], { icon: pastilleLivreur() }).addTo(mapRef.current).bindPopup(t('trackingMap.yourCourier'));
    } else {
      const marker = driverMarkerRef.current;
      const start = marker.getLatLng();
      const end = L.latLng(driverLat, driverLng);
      if (!start.equals(end)) {
        if (animRef.current) cancelAnimationFrame(animRef.current);
        // Mouvements réduits demandés : le livreur saute à sa nouvelle place au lieu de glisser (audit du 19/10, CROSS-107).
        const duration = mouvementReduit() ? 1 : 1200; const startTime = performance.now();
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
        itineraireRue(token, driverLat, driverLng, deliveryLat, deliveryLng)
          .then(({ latLngs, duration, distance }) => {
            if (cancelled || !mapRef.current) return;
            if (!remainingLineRef.current) {
              remainingLineRef.current = L.polyline(latLngs, TRACE_RESTE).addTo(mapRef.current);
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
    for (const ref of [driverMarkerRef, driverTrailLineRef, driverTrailBordRef, remainingLineRef]) {
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
      {/* Position figée depuis plus de 2 min : « Arrive dans ~3 min » se lisait sous l'avertissement « position ancienne »
          (audit du 19/10, AO-17). L'estimation part de cette vieille position : on ne l'affiche plus jusqu'à la suivante. */}
      {eta && !isStale && (
        <div className="tracking-eta-pill" aria-live="polite">
          {t('trackingMap.arrivesIn')} <b>~{eta.minutes} min</b> <span className="tracking-eta-km">· {eta.km.toLocaleString(getLocale())} km</span>
        </div>
      )}
      {(showRecenter || showFollowDriver) && (
        <div className="tracking-map-controls">
          {/* Ronds iris pleins, anneau blanc (règle des boutons posés sur une image) : le vélo suit le livreur, la cible
              revient au trajet entier. Le nom en aria-label et en infobulle. */}
          {showFollowDriver && <button type="button" className="tracking-map-rond" onClick={followDriver} aria-label={t('trackingMap.followCourier')} title={t('trackingMap.followCourier')}><span className="tracking-map-rond-velo" dangerouslySetInnerHTML={{ __html: veloHtml(24) }} /></button>}
          {showRecenter && <button type="button" className="tracking-map-rond" onClick={recenter} aria-label={t('trackingMap.overview')} title={t('trackingMap.overview')}><Icone nom="cible" taille={20} /></button>}
        </div>
      )}
      </div>
      {driverLat != null && driverLng != null && shownAt && (
        <div className={`tracking-map-freshness${isStale ? ' stale' : ''}`}>
          {isStale ? t('trackingMap.stale', { time: formatClock(shownAt) }) : authoritativeAt ? t('trackingMap.updatedAt', { time: formatClock(shownAt) }) : t('trackingMap.lastMoveAt', { time: formatClock(shownAt) })}
        </div>
      )}
      <div className="tracking-map-legend">
        {/* Les mêmes ronds que sur la carte (marqueursCarte.js) : le commerce cerclé d'iris, le livreur iris au vélo lime,
            la maison lime ; le trajet fait en trait iris. */}
        {enLivraison && <span><span className="tracking-map-legend-icon tracking-map-legend-icon--commerce"><Icone nom="commerce" taille={12} /></span> {t('trackingMap.restaurant')}</span>}
        {enLivraison && <span><span className="tracking-map-legend-icon tracking-map-legend-icon--livreur" dangerouslySetInnerHTML={{ __html: veloHtml(14) }} /> {t('trackingMap.courier')}</span>}
        {enLivraison
          ? <span><span className="tracking-map-legend-icon tracking-map-legend-icon--maison"><Icone nom="maison" taille={12} /></span> {legendeDestination}</span>
          : <span><span className={`tracking-map-legend-icon tracking-map-legend-icon--${homeColor === LIME ? 'maison' : 'commerce'}`}><Icone nom={homeEmoji} taille={12} /></span> {homeLabel}</span>}
        {hasTrail && <span><span className="tracking-map-legend-line" /> {t('trackingMap.routeDone')}</span>}
      </div>
    </div>
  );
}
