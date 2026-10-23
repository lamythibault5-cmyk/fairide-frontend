// Fonds de carte et itinéraires, en un seul endroit (backlog de conformité E1, 23/09/2026).
//
// TUILES. Les cinq cartes Leaflet chargeaient les tuiles publiques d'OpenStreetMap, dont la politique
// d'usage exclut un usage commercial lourd et qui peuvent être coupées sans préavis. Le fournisseur se
// règle désormais par variables : VITE_MAP_TILE_URL (gabarit Leaflet {z}/{x}/{y}, avec la clé du
// fournisseur si besoin, restreinte au domaine) et VITE_MAP_TILE_ATTRIBUTION. Sans elles, repli sur OSM —
// à ne pas garder pour le lancement (voir fairide-backend/docs/geo/README.md).
//
// ITINÉRAIRES. Les cartes du client et du livreur appelaient le serveur de démonstration OSRM directement
// depuis le navigateur. Elles passent par l'API (GET /geo/route), qui choisit le fournisseur et met en cache.
import { api } from './api';
import { estNatif } from './natif';

export const TUILES = {
  url: import.meta.env.VITE_MAP_TILE_URL || 'https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png',
  attribution: import.meta.env.VITE_MAP_TILE_ATTRIBUTION || '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>'
};

// FOURNISSEUR DONNÉ PAR LE SERVEUR (décision DEC-11, 7 oct. 2026 : MapTiler). Le réglage de construction ci-dessus est
// figé dans l'application iOS/Android une fois publiée ; GET /api/geo/tiles, lui, se change sur Railway. Lu une fois par
// chargement : chaque carte part avec le réglage connu, puis bascule dès que la réponse arrive (sans recréer la carte).
// Si le serveur ne règle rien, ne répond pas ou tarde plus de 3 s, on garde le réglage de construction.
// En attendant la réponse, la couche ne demande AUCUNE tuile (image vide en mémoire) : partir sur OpenStreetMap puis
// basculer envoyait l'adresse IP du visiteur à un serveur qu'on n'utilise pas (vu au test du 7 oct. 2026).
let reglageServeur = null;
const reglagePret = Promise.race([
  api('/geo/tiles').then((r) => (r?.url ? { url: r.url, attribution: r.attribution || TUILES.attribution } : null)).catch(() => null),
  new Promise((ok) => setTimeout(() => ok(null), 3000))
]).then((r) => { reglageServeur = r; return r || TUILES; });
let reglageConnu = false;
reglagePret.then(() => { reglageConnu = true; });
const TUILE_VIDE = 'data:image/gif;base64,R0lGODlhAQABAIAAAAAAAP///yH5BAEAAAAALAAAAAABAAEAAAIBRAA7';

// TUILES EN MODE CORS DANS L'APPLICATION (2026-10-23, carte vide sur iPhone). La clé MapTiler n'accepte que les origines de
// Fairide (tableau de bord MapTiler) et la lit dans le Referer OU l'en-tête Origin. Dans l'app iPhone, la page est
// capacitor://localhost : WebKit n'envoie de Referer que depuis une page http(s), chaque tuile arrivait sans, et MapTiler
// répondait 403. Une image chargée en CORS (crossorigin="anonymous") porte toujours l'en-tête Origin, que MapTiler accepte
// (Access-Control-Allow-Origin: *). Le site garde le chargement normal : son Referer suffit.
const CORS_APPLI = estNatif() ? { crossOrigin: 'anonymous' } : {};

export function coucheTuiles(L, options = {}) {
  if (reglageConnu) {
    const r = reglageServeur || TUILES;
    return L.tileLayer(r.url, { attribution: r.attribution, maxZoom: 19, ...CORS_APPLI, ...options });
  }
  const couche = L.tileLayer(TUILE_VIDE, { maxZoom: 19, ...CORS_APPLI, ...options });
  reglagePret.then((r) => {
    // L'attribution (mention obligatoire du fournisseur) arrive avec le fond.
    couche.options.attribution = r.attribution;
    couche._map?.attributionControl?.addAttribution(r.attribution);
    couche.setUrl(r.url);
  });
  return couche;
}

// Itinéraire routier et durée estimée : { latLngs: [[lat, lng], …], duration (s), distance (m) }.
// Lève si le service ne répond pas : l'appelant garde alors sa ligne droite.
// `voiture` : l'itinéraire d'une voiture (rocades, tunnels), pas celui d'un scooter (fondateur, 2026-10-23).
export async function itineraireRue(token, fromLat, fromLng, toLat, toLng, { velo = false, voiture = false } = {}) {
  const r = await api(`/geo/route?from=${fromLat},${fromLng}&to=${toLat},${toLng}&mode=${velo ? 'velo' : voiture ? 'voiture' : 'moteur'}`, { token });
  if (!r || !r.geometry?.length) throw new Error('no-route');
  return { latLngs: r.geometry, duration: r.durationS, distance: r.distanceM };
}
