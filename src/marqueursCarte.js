import L from 'leaflet';
import { iconeHtml } from './iconeHtml';

/* LES PASTILLES ET LES TRACÉS DES CARTES DE SUIVI, EN IRIS (fondateur, 2026-10-19, audit « Look and feel », proposition A
 * de la carte : iris partout, couleurs des tuiles OpenStreetMap gardées). Partagés par la carte du client
 * (DeliveryTrackingMap), celle du livreur (DriverNavigationMap) et la carte d'une course (livreur/CarteCourse) :
 *   - le livreur : un rond iris, anneau blanc, le vélo de la marque en lime (la lime sur l'iris, règle n° 1), une onde lente ;
 *   - la maison : un rond lime, icône encre, anneau blanc ;
 *   - le commerce : un rond blanc cerclé d'iris, icône iris (deux ronds iris pleins se confondraient avec le livreur) ;
 *   - le trajet fait : iris plein, 6 px, bordé de blanc ; ce qui reste : des points iris.
 * Autrefois : le livreur en presque-noir (l'ancienne couleur de la marque) et le trajet fait en lime fine, invisible sur des
 * tuiles claires. Styles des ronds et de l'onde : « Pastilles des cartes » dans styles.css. */

export const IRIS = '#3B2FB5';
export const LIME = '#C8F03C';

// Le vélo « 5a » (BrandMark.jsx, sans tuile), en texte : les marqueurs Leaflet prennent du HTML.
export function veloHtml(largeur = 26) {
  const h = Math.round((largeur * 42) / 82);
  return `<svg viewBox="-3 5 82 42" width="${largeur}" height="${h}" aria-hidden="true"><g fill="none" stroke="currentColor" stroke-width="5" stroke-linecap="round"><circle cx="15" cy="29" r="12.5"/><circle cx="61" cy="29" r="12.5"/></g><g fill="currentColor"><rect x="16" y="8" width="44" height="5" rx="2.5"/><g transform="rotate(42 27 22.5)"><rect x="13" y="20" width="28" height="5" rx="2.5"/></g></g></svg>`;
}

const rond = (classe, contenu, taille) => L.divIcon({
  className: '',
  html: `<div class="carte-pastille ${classe}">${contenu}</div>`,
  iconSize: [taille, taille],
  iconAnchor: [taille / 2, taille / 2]
});

export const pastilleLivreur = () => rond('carte-pastille--livreur', `<span class="carte-pastille-onde"></span>${veloHtml(26)}`, 44);
export const pastilleMaison = (nom = 'maison') => rond('carte-pastille--maison', iconeHtml(nom, 16), 34);
export const pastilleCommerce = (nom = 'commerce') => rond('carte-pastille--commerce', iconeHtml(nom, 16), 32);

// Une destination dont la couleur vient de l'appelant (la lime pour un client, l'iris pour un commerce).
export function pastilleSelonCouleur(nom, couleur) {
  return couleur === LIME ? pastilleMaison(nom) : pastilleCommerce(nom);
}

// Le trajet fait : un bord blanc sous le trait iris, pour qu'il se détache des rues claires. Deux polylignes, à garder
// ensemble (même liste de points).
export const TRACE_BORD = { color: '#fff', weight: 10, opacity: 1, lineCap: 'round', lineJoin: 'round' };
export const TRACE_FAIT = { color: IRIS, weight: 6, opacity: 1, dashArray: null, lineCap: 'round', lineJoin: 'round' };
// Ce qui reste à parcourir : des points iris (un tiret presque nul, bouts ronds).
export const TRACE_RESTE = { color: IRIS, weight: 5, opacity: 1, dashArray: '0.1, 10', lineCap: 'round' };
// L'itinéraire prévu du commerce à la porte, sous le reste : une route iris pâle.
export const TRACE_PREVU = { color: IRIS, weight: 4, opacity: 0.25, dashArray: null, lineCap: 'round', lineJoin: 'round' };
