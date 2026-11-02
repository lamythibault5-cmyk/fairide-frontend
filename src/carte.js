// Fonds de carte et itinéraires, en un seul endroit (backlog de conformité E1, 23/09/2026).
//
// TUILES. Les cinq cartes Leaflet chargeaient les tuiles publiques d'OpenStreetMap, dont la politique
// d'usage exclut un usage commercial lourd et qui peuvent être coupées sans préavis. Depuis le 2026-11-02 (fondateur,
// maquettes/fond-de-carte, version A), le fond est le style vectoriel « Liberty » d'OpenFreeMap (carteVecteur.js) : gratuit,
// sans clé, sans limite, usage commercial autorisé — MapTiler gratuit, lui, ne l'autorise pas. Le fond raster ci-dessous
// (VITE_MAP_TILE_URL, sinon OSM) ne sert plus qu'en secours : style injoignable, WebGL absent, ou réglage serveur.
//
// ITINÉRAIRES. Les cartes du client et du livreur appelaient le serveur de démonstration OSRM directement
// depuis le navigateur. Elles passent par l'API (GET /geo/route), qui choisit le fournisseur et met en cache.
import { api } from './api';
import { estNatif } from './natif';

export const TUILES = {
  url: import.meta.env.VITE_MAP_TILE_URL || 'https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png',
  attribution: import.meta.env.VITE_MAP_TILE_ATTRIBUTION || '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>'
};

// Mention exigée par OpenFreeMap sous chaque carte.
const STYLE_PAR_DEFAUT = {
  style: 'https://tiles.openfreemap.org/styles/liberty',
  attribution: '<a href="https://openfreemap.org" target="_blank" rel="noopener">OpenFreeMap</a> © <a href="https://www.openmaptiles.org/" target="_blank" rel="noopener">OpenMapTiles</a> Data from <a href="https://www.openstreetmap.org/copyright" target="_blank" rel="noopener">OpenStreetMap</a>'
};

// FOURNISSEUR DONNÉ PAR LE SERVEUR (décision DEC-11, 7 oct. 2026). Le code de l'application iOS/Android est figé une fois
// publiée ; GET /api/geo/tiles, lui, se change sur Railway et toutes les cartes le suivent au prochain chargement :
//   - `style` : un autre style vectoriel (MAP_STYLE_URL), ou `false` pour forcer le raster (MAP_STYLE_URL=off) ;
//   - `url` : le fond raster de secours (MAP_TILE_URL), à la place du réglage de construction.
// Lu une fois par chargement. Si le serveur ne répond pas en 3 s, on garde les réglages du code.
// En attendant la réponse, la carte ne demande AUCUNE tuile : partir sur un fond puis basculer envoyait l'adresse IP du
// visiteur à un serveur qu'on n'utilise pas (vu au test du 7 oct. 2026).
const reglagePret = Promise.race([
  api('/geo/tiles').catch(() => null),
  new Promise((ok) => setTimeout(() => ok(null), 3000))
]).then((r) => ({
  raster: r?.url ? { url: r.url, attribution: r.attribution || TUILES.attribution } : TUILES,
  vecteur: r?.style === false ? null : {
    style: (typeof r?.style === 'string' && r.style) || STYLE_PAR_DEFAUT.style,
    attribution: r?.styleAttribution || STYLE_PAR_DEFAUT.attribution
  }
}));

// TUILES EN MODE CORS DANS L'APPLICATION (2026-10-23, carte vide sur iPhone). La clé MapTiler n'accepte que les origines de
// Fairide (tableau de bord MapTiler) et la lit dans le Referer OU l'en-tête Origin. Dans l'app iPhone, la page est
// capacitor://localhost : WebKit n'envoie de Referer que depuis une page http(s), chaque tuile arrivait sans, et MapTiler
// répondait 403. Une image chargée en CORS (crossorigin="anonymous") porte toujours l'en-tête Origin, que MapTiler accepte
// (Access-Control-Allow-Origin: *). Le site garde le chargement normal : son Referer suffit. Ne concerne que le raster de
// secours : MapLibre lit déjà le vectoriel en CORS (fetch), qu'OpenFreeMap accepte de toute origine.
const CORS_APPLI = estNatif() ? { crossOrigin: 'anonymous' } : {};

// Sans WebGL (vieux téléphone, accélération coupée), MapLibre ne peut rien dessiner : raster d'emblée.
function webglDisponible() {
  try {
    const c = document.createElement('canvas');
    return !!(c.getContext('webgl2') || c.getContext('webgl'));
  } catch {
    return false;
  }
}

// Le style doit avoir fini de se dessiner dans ce délai, sinon on passe au raster (serveur lent, réseau qui bloque).
const DELAI_STYLE_MS = 10000;

// Rend une couche que les cartes ajoutent tout de suite (coucheTuiles(L).addTo(carte)) : un groupe, rempli dès que le fond
// est choisi — vectoriel, ou raster en secours. Marqueurs et tracés restent au-dessus (volet des tuiles, comme avant).
export function coucheTuiles(L, options = {}) {
  const groupe = L.layerGroup();
  let fini = false;
  const raster = (r) => {
    if (fini) return;
    fini = true;
    groupe.clearLayers();
    groupe.addLayer(L.tileLayer(r.url, { attribution: r.attribution, maxZoom: 19, ...CORS_APPLI, ...options }));
  };
  reglagePret.then(async (r) => {
    if (!r.vecteur || !webglDisponible()) return raster(r.raster);
    try {
      const { chargerStyle, coucheVecteur } = await import('./carteVecteur');
      const style = await chargerStyle(r.vecteur.style);
      if (fini) return;
      const couche = coucheVecteur(style, r.vecteur.attribution);
      groupe.addLayer(couche);
      // Le calque MapLibre n'existe qu'une fois la couche sur une carte : si la carte n'est pas encore là (ou déjà fermée),
      // il n'y a rien à surveiller.
      const gl = couche.getMaplibreMap?.();
      if (!gl) { fini = true; return; }
      const minuterie = setTimeout(() => raster(r.raster), DELAI_STYLE_MS);
      gl.once('load', () => { clearTimeout(minuterie); fini = true; });
    } catch (e) {
      console.warn('Fond vectoriel indisponible, fond raster de secours :', e?.message || e);
      raster(r.raster);
    }
  });
  return groupe;
}

// Itinéraire routier et durée estimée : { latLngs: [[lat, lng], …], duration (s), distance (m) }.
// Lève si le service ne répond pas : l'appelant garde alors sa ligne droite.
// `voiture` : l'itinéraire d'une voiture (rocades, tunnels), pas celui d'un scooter (fondateur, 2026-10-23).
export async function itineraireRue(token, fromLat, fromLng, toLat, toLng, { velo = false, voiture = false } = {}) {
  const r = await api(`/geo/route?from=${fromLat},${fromLng}&to=${toLat},${toLng}&mode=${velo ? 'velo' : voiture ? 'voiture' : 'moteur'}`, { token });
  if (!r || !r.geometry?.length) throw new Error('no-route');
  return { latLngs: r.geometry, duration: r.durationS, distance: r.distanceM };
}
