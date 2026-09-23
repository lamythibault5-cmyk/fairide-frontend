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

export const TUILES = {
  url: import.meta.env.VITE_MAP_TILE_URL || 'https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png',
  attribution: import.meta.env.VITE_MAP_TILE_ATTRIBUTION || '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>'
};

export function coucheTuiles(L, options = {}) {
  return L.tileLayer(TUILES.url, { attribution: TUILES.attribution, maxZoom: 19, ...options });
}

// Itinéraire routier et durée estimée : { latLngs: [[lat, lng], …], duration (s), distance (m) }.
// Lève si le service ne répond pas : l'appelant garde alors sa ligne droite.
export async function itineraireRue(token, fromLat, fromLng, toLat, toLng, { velo = false } = {}) {
  const r = await api(`/geo/route?from=${fromLat},${fromLng}&to=${toLat},${toLng}&mode=${velo ? 'velo' : 'moteur'}`, { token });
  if (!r || !r.geometry?.length) throw new Error('no-route');
  return { latLngs: r.geometry, duration: r.durationS, distance: r.distanceM };
}
