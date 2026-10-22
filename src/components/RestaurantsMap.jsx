import { useEffect, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import L from 'leaflet';
import { coucheTuiles } from '../carte';
import 'leaflet/dist/leaflet.css';
import { restaurantTypeLabel } from '../menuCategories';
import { FAMILLES, iconeSpecialite } from '../specialites';
import { escapeHtml } from '../escapeHtml';
import { cheminFiche } from '../adresseFiche';
import CertifiedBadge from './CertifiedBadge';
import { useLanguage } from '../context/LanguageContext';
import Icone from './Icone';
import { iconeHtml } from '../iconeHtml';

const BRUSSELS_CENTER = [50.8503, 4.3517];

// Les icônes des épingles, préparées au chargement du module (mises en cache). Depuis le 2026-10-17, iconeHtml écrit le SVG
// en texte sans React : l'appeler depuis un effet ne pose plus de problème ; ce préchargement reste, sans danger.
for (const nom of new Set(['restaurants', ...FAMILLES.map((f) => f.icone)])) iconeHtml(nom, 16);
iconeHtml('maison', 15);

function cuisineEmoji(cuisine) {
  return iconeSpecialite(cuisine); // un nom d'icône (Icone.jsx) : celle de sa famille
}

function pinIcon(cuisine, active) {
  return L.divIcon({
    className: 'map-pin-wrap',
    html: `<div class="map-pin${active ? ' active' : ''}"><span class="map-pin-emoji">${iconeHtml(cuisineEmoji(cuisine), 16)}</span></div>`,
    iconSize: [34, 34],
    iconAnchor: [17, 32],
    popupAnchor: [0, -30]
  });
}

function homeIcon() {
  return L.divIcon({
    className: 'map-pin-wrap',
    html: `<div class="map-pin map-pin-home"><span class="map-pin-emoji">${iconeHtml('maison', 15)}</span></div>`,
    iconSize: [34, 34],
    iconAnchor: [17, 32],
    popupAnchor: [0, -30]
  });
}

// `renderFiche(commerce, fermer)` : la page dessine elle-même la fiche du commerce touché (la carte plein écran, MapPage.jsx :
// une fiche compacte qui monte au-dessus des onglets). Sans elle, la fiche détaillée ci-dessous.
export default function RestaurantsMap({ restaurants, height = 420, singleMarker = false, userLocation = null, cadrerSurCommerces = false, renderFiche = null }) {
  const containerRef = useRef(null);
  const mapRef = useRef(null);
  const markersRef = useRef([]);
  const homeMarkerRef = useRef(null);
  // Le dernier cadrage calculé, rejouable par le ResizeObserver ci-dessous.
  const recadrerRef = useRef(null);
  const navigate = useNavigate();
  const { t } = useLanguage();
  const [selected, setSelected] = useState(null);

  useEffect(() => {
    if (!containerRef.current || mapRef.current) return;
    mapRef.current = L.map(containerRef.current).setView(BRUSSELS_CENTER, singleMarker ? 15 : 12);
    coucheTuiles(L).addTo(mapRef.current);
    if (!singleMarker) {
      mapRef.current.on('click', () => setSelected(null));
    }
    // Leaflet mesure la taille de son conteneur au moment de l'init — si celle-ci change ensuite
    // (police qui finit de charger, image de couverture qui pousse la mise en page, carte affichée
    // dans un onglet/section pas encore visible...), les tuiles restent calées sur l'ancienne largeur
    // et une bande grise apparaît. Un ResizeObserver + invalidateSize() corrige ça à chaque changement
    // réel de taille, plutôt qu'un seul recalcul au montage qui rate les cas ci-dessus.
    // …et il faut REFAIRE le cadrage après, pas seulement recalculer la taille. En pleine hauteur
    // (height: 100%), le conteneur naît à zéro pixel : fitBounds s'exécute sur une boîte minuscule
    // et choisit un zoom de rue. invalidateSize corrigeait bien la taille ensuite, mais le cadrage,
    // lui, restait celui de la boîte d'avant — on arrivait sur deux marqueurs au lieu de vingt-neuf.
    const resizeObserver = new ResizeObserver(() => {
      mapRef.current?.invalidateSize();
      recadrerRef.current?.();
    });
    resizeObserver.observe(containerRef.current);
    return () => {
      resizeObserver.disconnect();
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
      // `title` : le nom du commerce, lu par les lecteurs d'écran sur l'épingle (qui se touche comme un bouton) et affiché au survol.
      const marker = L.marker([r.lat, r.lng], { icon: pinIcon(r.cuisine, selected?.id === r.id), title: r.name }).addTo(mapRef.current);
      if (!singleMarker) {
        marker.on('click', () => setSelected(r));
      }
      markersRef.current.push(marker);
    });

    const pointsCommerces = withCoords.map((r) => [r.lat, r.lng]);
    const points = pointsCommerces.slice();
    if (userLocation?.lat && userLocation?.lng) {
      homeMarkerRef.current = L.marker([userLocation.lat, userLocation.lng], { icon: homeIcon(), zIndexOffset: 1000 })
        .addTo(mapRef.current)
        // L'adresse est celle du visiteur lui-même : il ne peut s'attaquer que lui-même. On l'échappe
        // quand même, parce qu'une adresse contenant « & » ou « < » s'affichait déjà de travers.
        .bindPopup(`<b>${escapeHtml(t('map.home'))}</b>${userLocation.address ? '<br/>' + escapeHtml(userLocation.address) : ''}`);
      points.push([userLocation.lat, userLocation.lng]);
    }

    // Le cadrage est gardé sous forme de fonction : le ResizeObserver le rejoue quand le conteneur
    // atteint enfin sa taille définitive, sans quoi on resterait sur le zoom d'une boîte vide.
    recadrerRef.current = () => {
      if (!mapRef.current) return;
      // CADRER SUR LES RESULTATS, PAS SUR LE DOMICILE. Le cadrage englobe la position du client,
      // ce qui est juste quand on decouvre son quartier : on veut se voir au milieu de ses commerces.
      // Mais des qu'on CHERCHE un nom, le seul resultat peut etre a trois kilometres — l'englober avec
      // le domicile donne une vue d'ensemble ou le commerce trouve n'est qu'un point parmi les rues.
      // On cadre alors sur les commerces seuls, et sur un seul on s'approche pour de bon.
      const cibles = cadrerSurCommerces && pointsCommerces.length ? pointsCommerces : points;
      if (!cibles.length) return;
      if (cibles.length === 1) mapRef.current.setView(cibles[0], 16);
      else mapRef.current.fitBounds(L.latLngBounds(cibles), { padding: [40, 40] });
    };
    recadrerRef.current();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [restaurants, selected, userLocation, t, cadrerSurCommerces]);

  useEffect(() => {
    if (selected && !(restaurants || []).some((r) => r.id === selected.id)) setSelected(null);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [restaurants]);

  // height: 100% pour la carte plein écran (pages/client/MapPage.jsx) — le conteneur suit alors son
  // parent au lieu d'imposer une hauteur fixe, et perd son arrondi, qui n'a pas de sens bord à bord.
  const pleineHauteur = height === '100%';
  return (
    <div style={{ position: 'relative', height: pleineHauteur ? '100%' : undefined }}>
      <div ref={containerRef} style={{ height, borderRadius: pleineHauteur ? 0 : 'var(--radius)', overflow: 'hidden' }} />
      {selected && renderFiche && renderFiche(selected, () => setSelected(null))}
      {selected && !renderFiche && (
        <div className="map-detail-card">
          <button className="map-detail-close" onClick={() => setSelected(null)} aria-label={t('map.backToMapAria')}>✕</button>
          {selected.coverImageUrl && <img loading="lazy" src={selected.coverImageUrl} alt={selected.name} className="map-detail-cover" />}
          <div className="map-detail-body">
            {selected.hasPromo && <span className="promo-badge" style={{ position: 'static', display: 'inline-block', marginBottom: 6 }}>{t('restoMap.promo')}</span>}
            <div className="pill-row">
              <span className="pill teal"><Icone nom={cuisineEmoji(selected.cuisine)} taille={14} className="icone-texte" /> {restaurantTypeLabel(selected.cuisine, t)}</span>
              <span className="pill gold">{selected.commune}{selected.neighborhood ? ' · ' + selected.neighborhood : ''}</span>
            </div>
            <h3 className="restaurant-header-name-row" style={{ margin: '4px 0' }}>
              <span>{selected.name}</span>
              {selected.certified && <CertifiedBadge size={16} />}
            </h3>
            {selected.desc && <p className="small" style={{ margin: '6px 0' }}>{selected.desc}</p>}
            <p className="small" style={{ margin: '6px 0', color: 'var(--ink-soft)' }}><Icone nom="position" taille={16} className="icone-texte" />{' '}{selected.address}</p>
            <div className="row" style={{ gap: 8, marginTop: 10 }}>
              <button className="btn-teal" style={{ flex: 1 }} onClick={() => navigate(cheminFiche(selected))}>
                {t('map.viewRestaurant')}
              </button>
              <button className="btn-outline" onClick={() => setSelected(null)}>
                {t('map.backToMap')}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
