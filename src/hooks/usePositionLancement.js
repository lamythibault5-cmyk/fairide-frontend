import { useCallback, useEffect, useRef, useState } from 'react';
import { api } from '../api';
import { demanderPosition, etatPosition } from '../natif';
import { haversineDistanceKm } from '../menuCategories';
import { adresseEnCours } from '../nomAdresse';

/* LA POSITION À CHAQUE OUVERTURE (fondateur, 2026-11-08, maquette retours-08-11, section 3 : « oui ; si jamais demandée, on
 * demande une fois », site pareil que l'app).
 *
 * À l'ouverture de l'app (et au retour après 30 min en arrière-plan), la liste des commerces lit la position du téléphone :
 *   - déjà autorisée : lue sans rien demander ;
 *   - jamais demandée : la question du système, UNE fois (POSITION_DEMANDEE dans le stockage) ; un refus n'est plus reposé ;
 *   - refusée : rien.
 * Rien n'attend la position : la liste s'affiche avec l'adresse du compte, la suite arrive quand le téléphone répond.
 *
 * Ce qu'on en fait, sur le téléphone seulement (la position n'est envoyée nulle part) :
 *   1. À MOINS DE PRES_M D'UNE ADRESSE DU CARNET, elle devient l'adresse de livraison, sans rien demander (au bureau, « Livrer
 *      à · Travail »). Seulement si le téléphone donne une position assez fine (PRECISION_MAX_M) : l'approximative d'Android ou
 *      d'iPhone tombe à un ou deux kilomètres, elle « trouverait » la mauvaise adresse.
 *   2. À PLUS DE LOIN_KM DE L'ADRESSE CHOISIE (même seuil que le paiement, useLoinDeLAdresse.js), la bulle « Tu es à 4,2 km de
 *      … On livre bien là ? » (BulleAdresseLoin.jsx). La marge d'erreur du téléphone est retirée de la distance d'abord : on
 *      ne dit « tu es loin » que si c'est vrai même au pire. « Oui, garder » : voir GARDER plus bas.
 *   3. SANS COMPTE : la position range seulement la liste (le plus proche d'abord), pas de bulle (pas d'adresse à comparer).
 *
 * GARDER (fondateur, 2026-11-12 : « je dis Oui, garder, je quitte l'app, j'y reviens, et elle me redemande »). La réponse
 * vivait dans sessionStorage, que l'app perd à chaque fermeture : la bulle revenait à chaque ouverture, au même bureau. Elle
 * est gardée maintenant sur le téléphone (localStorage) pour CETTE adresse et CET ENDROIT : la bulle se tait tant qu'on est à
 * moins de GARDEE_RAYON_KM de l'endroit où l'on a répondu, pendant GARDEE_DUREE_MS. Plus loin (on est ailleurs, la question
 * redevient utile) ou plus tard, elle revient. Choisi contre un simple délai (24 h…), qui redemandait le lendemain au même
 * bureau. L'endroit est arrondi au centième de degré (environ un kilomètre) : de quoi comparer, rien de plus précis ; il ne
 * quitte pas le téléphone (politique des cookies, `cookiesPolicy.preferences`).
 *
 * HORS DE PORTÉE (même jour) : la bulle ne se montre que si la position est à moins de PORTEE_KM d'un commerce, le rayon de
 * livraison le plus grand permis (15 km, backend rayonLivraison.js, migration 080). À Londres, la question « on livre bien
 * là ? » n'avait pas de sens, et « Livrer à ma position » n'y trouvait rien (le serveur ne cherche qu'en Belgique). Le filtre
 * vit dans RestaurantList.jsx (aPorteeDUnCommerce), qui a la liste des commerces.
 *
 * Rend { position, loin, adresses, garder, relireCarnet }. `loin` : { km, adresse } ou null. */
const PRES_M = 150;
const LOIN_KM = 1;
const PRECISION_MAX_M = 150;
const RELIRE_APRES_MS = 30 * 60 * 1000;
const POSITION_DEMANDEE = 'fairide_position_demandee';
const BULLES_GARDEES = 'fairide_bulle_loin_gardee';
const GARDEE_RAYON_KM = 3;
const GARDEE_DUREE_MS = 7 * 24 * 60 * 60 * 1000;
export const PORTEE_KM = 15;

/* La position est-elle à portée d'au moins un commerce ? Liste pas encore là : non (la bulle attend la liste, elle ne
 * s'affiche pas pour rien). La marge d'erreur du téléphone joue ici en faveur de la bulle : au mieux, on est à portée. */
export function aPorteeDUnCommerce(position, commerces) {
  if (!position || !Array.isArray(commerces)) return false;
  const marge = Number(position.precision) > 0 ? Number(position.precision) / 1000 : 0;
  return commerces.some((r) => r?.lat != null && r?.lng != null
    && haversineDistanceKm(position.lat, position.lng, Number(r.lat), Number(r.lng)) - marge <= PORTEE_KM);
}

// Une lecture par ouverture de l'app, partagée par tous les montages de la liste (aller sur une fiche et revenir ne relit pas).
let lecture = null;
let lueA = 0;

async function lirePosition() {
  const etat = await etatPosition();
  if (etat === 'denied') return null;
  if (etat !== 'granted') {
    let deja = false;
    try { deja = !!localStorage.getItem(POSITION_DEMANDEE); } catch { /* stockage fermé : on demande, une fois par ouverture */ }
    if (deja) return null;
    try { localStorage.setItem(POSITION_DEMANDEE, new Date().toISOString()); } catch { /* idem */ }
  }
  return demanderPosition({ delai: 8000 });
}

function positionDeCetteOuverture() {
  if (!lecture || Date.now() - lueA > RELIRE_APRES_MS) {
    lueA = Date.now();
    lecture = lirePosition().catch(() => null);
  }
  return lecture;
}

const cleAdresse = (user) => `${user?.addressStreet || ''}|${user?.addressNumber || ''}`.toLowerCase();
const arrondi = (v) => Math.round(Number(v) * 100) / 100;
// Les réponses encore valables : { cle, lat, lng, a } (a = date de la réponse, en ms). Les périmées tombent à la lecture.
function gardees() {
  try {
    const l = JSON.parse(localStorage.getItem(BULLES_GARDEES) || '[]');
    return Array.isArray(l) ? l.filter((g) => g && typeof g.cle === 'string' && Date.now() - Number(g.a) < GARDEE_DUREE_MS) : [];
  } catch { return []; }
}
const gardeeIci = (cle, position) => gardees().some((g) => g.cle === cle
  && haversineDistanceKm(position.lat, position.lng, Number(g.lat), Number(g.lng)) <= GARDEE_RAYON_KM);

export default function usePositionLancement({ user, token, refreshUser }) {
  const [position, setPosition] = useState(null);
  const [adresses, setAdresses] = useState(null);
  const [loin, setLoin] = useState(null);
  const [tour, setTour] = useState(0);
  const choixFait = useRef(false);
  // refreshUser change à chaque rendu (AuthContext) : gardé à part, pour que l'effet plus bas ne tourne pas en boucle.
  const rafraichir = useRef(refreshUser);
  useEffect(() => { rafraichir.current = refreshUser; }, [refreshUser]);

  const relireCarnet = useCallback(() => {
    if (!token) { setAdresses(null); return Promise.resolve(null); }
    return api('/auth/me/addresses', { token }).then((l) => { const a = Array.isArray(l) ? l : []; setAdresses(a); return a; }).catch(() => null);
  }, [token]);

  // Le carnet : pour le nom de l'adresse choisie (« Livrer à · Maison ») et pour le choix automatique.
  useEffect(() => { relireCarnet(); }, [relireCarnet, user?.id]);

  // La position de cette ouverture.
  useEffect(() => {
    let vivant = true;
    positionDeCetteOuverture().then((p) => { if (vivant && p) setPosition(p); });
    return () => { vivant = false; };
  }, [tour]);

  // Retour au premier plan après 30 min : une nouvelle « ouverture ».
  useEffect(() => {
    let cachee = 0;
    const surVisibilite = () => {
      if (document.visibilityState === 'hidden') { cachee = Date.now(); return; }
      if (cachee && Date.now() - cachee > RELIRE_APRES_MS) { choixFait.current = false; setTour((n) => n + 1); }
    };
    document.addEventListener('visibilitychange', surVisibilite);
    return () => document.removeEventListener('visibilitychange', surVisibilite);
  }, []);

  // 1. Près d'une adresse du carnet : on la choisit. 2. Sinon, loin de l'adresse choisie : la bulle.
  useEffect(() => {
    setLoin(null);
    if (!user || !position || !Array.isArray(adresses)) return;
    const marge = Number(position.precision) > 0 ? Number(position.precision) / 1000 : 0;
    const distance = (lat, lng) => (lat != null && lng != null ? haversineDistanceKm(position.lat, position.lng, Number(lat), Number(lng)) : null);
    const enCours = adresseEnCours(adresses, user);
    if (!choixFait.current && marge * 1000 <= PRECISION_MAX_M) {
      const proche = adresses
        .map((a) => ({ a, d: distance(a.lat, a.lng) }))
        .filter((x) => x.d != null && x.d * 1000 <= PRES_M)
        .sort((x, y) => x.d - y.d)[0];
      if (proche && proche.a.id !== enCours?.id) {
        choixFait.current = true;
        api(`/auth/me/addresses/${proche.a.id}/select`, { method: 'POST', body: {}, token })
          .then(() => rafraichir.current?.())
          .catch(() => {});
        return;
      }
    }
    choixFait.current = true;
    const d = distance(user.lat, user.lng);
    if (d == null || d - marge <= LOIN_KM) return;
    if (gardeeIci(cleAdresse(user), position)) return;
    setLoin({ km: d, adresse: enCours });
  }, [user, position, adresses, token]);

  const garder = useCallback(() => {
    if (position) {
      const cle = cleAdresse(user);
      // Une réponse par adresse : la nouvelle remplace l'ancienne (un seul endroit retenu par adresse, la liste reste courte).
      const autres = gardees().filter((g) => g.cle !== cle);
      try {
        localStorage.setItem(BULLES_GARDEES, JSON.stringify([...autres, { cle, lat: arrondi(position.lat), lng: arrondi(position.lng), a: Date.now() }]));
      } catch { /* stockage fermé : elle reviendra à la prochaine ouverture */ }
    }
    setLoin(null);
  }, [user, position]);

  return { position, loin, adresses, garder, relireCarnet };
}
