// Fond de carte VECTORIEL (OpenFreeMap, fondateur 2026-11-02 : version A « Liberty » de maquettes/fond-de-carte, arrêts de bus
// et de tram cachés, site pareil que l'appli). Chargé à la demande par carte.js (import dynamique) : MapLibre pèse lourd et
// seules les pages qui montrent une carte le paient.
//
// POURQUOI PLUS MAPTILER. Son offre gratuite est réservée à un usage non commercial (conditions MapTiler Cloud) et coupe la
// carte au-delà du quota du mois. OpenFreeMap : gratuit, sans clé ni compte, sans limite de vues, usage commercial autorisé
// (openfreemap.org, FAQ et conditions du 14/10/2026). Sans garantie de service : en cas d'échec, carte.js repasse sur le fond
// raster de secours.
import 'maplibre-gl/dist/maplibre-gl.css';
import { setWorkerUrl } from 'maplibre-gl';
import { maplibreGL } from '@maplibre/maplibre-gl-leaflet';
// LE TRAVAILLEUR QUI DÉCODE LES TUILES. MapLibre le cherche à côté de son propre fichier, qui n'existe plus une fois le code
// regroupé par Vite ; dans l'application (capacitor://), il ne le cherche même pas (adresse vide). Sans lui, la carte ne montre
// que son fond beige, sans une rue. On lui donne donc l'adresse du fichier livré à part (vite.config.js : extension .js).
import urlTravailleur from 'maplibre-gl/dist/maplibre-gl-worker.mjs?url';

setWorkerUrl(urlTravailleur);

// ARRÊTS DE BUS ET DE TRAM CACHÉS (question 2 du questionnaire). Dans le schéma OpenMapTiles, ce sont les points d'intérêt de
// classe « bus » (arrêts, gares routières) et la sous-classe « tram_stop ». Les gares et le métro restent : ce sont des
// repères que tout le monde connaît.
const ARRET = ['any',
  ['match', ['get', 'class'], ['bus'], true, false],
  ['match', ['get', 'subclass'], ['bus_stop', 'bus_station', 'tram_stop', 'platform'], true, false]
];

function sansArrets(style) {
  for (const couche of style.layers || []) {
    if (couche['source-layer'] !== 'poi') continue;
    couche.filter = couche.filter ? ['all', couche.filter, ['!', ARRET]] : ['!', ARRET];
  }
  return style;
}

// Le style est lu ici plutôt que confié à MapLibre : les arrêts sont retirés avant le premier dessin (pas d'icônes qui
// clignotent puis disparaissent), et un style injoignable se voit tout de suite — carte.js passe alors au raster.
export async function chargerStyle(url) {
  const controle = new AbortController();
  const minuterie = setTimeout(() => controle.abort(), 8000);
  try {
    const r = await fetch(url, { signal: controle.signal });
    if (!r.ok) throw new Error(`style ${r.status}`);
    return sansArrets(await r.json());
  } finally {
    clearTimeout(minuterie);
  }
}

// Calque Leaflet qui dessine le style avec MapLibre, sous les marqueurs et les tracés (même volet que les tuiles).
export function coucheVecteur(style, attribution) {
  return maplibreGL({ style, interactive: false, attributionControl: { customAttribution: attribution } });
}
