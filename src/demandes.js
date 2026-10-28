/* « DEMANDE TON RESTAURANT » (fondateur, 2026-10-26 ; maquettes/demande-restaurant, version B « Moi aussi », carte « ticket »
 * 5 de maquettes/demande-restaurant/card-look-en.html). Ce qui est partagé par les écrans : appels au serveur (backend
 * routes/demandes.js), dessin de la cuisine d'un restaurant demandé, rang écrit dans chaque langue.
 *
 * Les raisons des règles (téléphone vérifié, une demande par personne, rien d'autre qu'un nombre montré au restaurant)
 * sont dans le backend, demandesRestaurants.js. */
import { api } from './api';
import { cuisineDepuisOsm } from './osmCuisine';
import { illustrationSpecialite } from './specialites';
import { illustrationCuisine, restaurantTypeLabel } from './menuCategories';

// La spécialité Fairride d'un restaurant demandé, d'après OpenStreetMap (tag « cuisine », sinon type : café, fast-food…).
export function specialiteDemande(d) {
  return cuisineDepuisOsm(d?.osmCuisine, d?.osmCategorie);
}

// Le petit dessin plat de sa cuisine (cuisines-2d), ou null : la carte montre alors l'icône des restaurants.
export function dessinDemande(d) {
  const nom = illustrationSpecialite(specialiteDemande(d));
  return nom ? illustrationCuisine(nom, { plat: true }) : null;
}

// « Belge · Bruxelles » : la cuisine si on la connaît, puis la commune.
export function sousTitreDemande(d, t) {
  const spec = specialiteDemande(d);
  return [spec ? restaurantTypeLabel(spec, t) : null, d?.commune].filter(Boolean).join(' · ');
}

// « 13e », « 13th », « 13e » : le rang de la confirmation (« Tu es la 13e personne… »).
export function rangEcrit(n, langue) {
  if (langue === 'en') {
    const s = n % 100 >= 11 && n % 100 <= 13 ? 'th' : ({ 1: 'st', 2: 'nd', 3: 'rd' }[n % 10] || 'th');
    return `${n}${s}`;
  }
  return `${n}e`;
}

// Le point autour duquel chercher : l'adresse du compte. Sans adresse connue, le serveur prend celle du compte lui-même,
// ou les plus demandés de Bruxelles.
const point = (user) => (user?.lat && user?.lng ? `lat=${user.lat}&lng=${user.lng}` : '');

export const chargerPres = (user, token) => api(`/demandes/pres?${point(user)}`, { token });
export const chercher = (q, user, token) => api(`/demandes/recherche?q=${encodeURIComponent(q)}&${point(user)}`, { token });
export const demander = (corps, token) => api('/demandes', { method: 'POST', token, body: corps });
export const retirer = (id, token) => api(`/demandes/${id}`, { method: 'DELETE', token });
export const miennes = (token) => api('/demandes/miennes', { token });

// Le serveur refuse une demande sans téléphone vérifié (REQUEST_PHONE_REQUIRED) : l'écran envoie vérifier le numéro.
export const CHEMIN_VERIFIER_TELEPHONE = '/account?ouvrir=connexion';
export const telephoneAVerifier = (e) => e?.code === 'REQUEST_PHONE_REQUIRED';
