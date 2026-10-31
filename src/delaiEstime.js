/* LE TEMPS D'ATTENTE AFFICHÉ AVANT DE COMMANDER (fondateur, 2026-10-29, maquettes/delai-estime : « faire comme les autres
 * applications »). Uber Eats, Deliveroo et Takeaway disent une fourchette (« 25–35 min ») sur chaque carte de la liste et en
 * haut de la fiche, puis une heure au paiement. Fairide ne disait rien avant le paiement, et seulement pour l'à emporter.
 *
 * LE CALCUL est celui du serveur (geocode.estimateDeliveryMinutes, calcul C1), refait ici parce que la liste et la fiche
 * ne connaissent la distance qu'une fois chez le client : à garder alignés.
 *   préparation (prepEstimeeMinutes : réglée par le commerce, sinon sa médiane mesurée, sinon la médiane de tous nos
 *   commerces dès 100 commandes, sinon 15 — backend delaiEstime.js et docs/delais.md, sources du 2026-10-30)
 *   + vol d'oiseau ×1,3 (les rues) au pas d'un scooter, 19 km/h (fondateur, 2026-10-31 : la flotte sera à 99 % en scooter ;
 *     16 km/h, à vélo, avant ; geocode.VITESSE_ANNONCE_KMH, backend docs/delais.md)
 *   + 5 minutes (le livreur rejoint le commerce).
 * La fourchette : l'estimation AU MILIEU, arrondie aux 5 minutes, ± 5 (41 → « 35–45 min », 28 → « 25–35 min »). Avant le
 * 2026-10-31, l'estimation était en bas (41 → « 40–50 ») : la fourchette paraissait plus longue que le trajet (fondateur :
 * « 40 à 50 minutes, ça ne donne pas envie »). Le haut garde 2,5 à 7,5 minutes de marge, en plus des 5 d'approche : un retard
 * déçoit bien plus qu'une avance ne réjouit, et une fourchette l'atténue mieux qu'une heure seule (sources dans
 * docs/delais.md du backend). Le serveur reste la seule vérité de l'heure (devis, commande, suivi) : ici ce n'est qu'une
 * annonce.
 *
 * D'OÙ : la position de l'adresse du compte, sinon le centre de sa commune (question 2 : « fourchette depuis le centre de la
 * commune »), sinon rien. Avant le GO ou sans livreur libre, il n'y a pas de livraison, donc pas de temps de livraison :
 * on dit le temps de l'à emporter (question 3). Rien ici ne lit quoi que ce soit des livreurs. */
import { haversineDistanceKm, communeDepuisCodePostal, COMMUNES } from './menuCategories';
import { lireBienvenue } from './bienvenue';

export const FACTEUR_RUES = 1.3;
export const VITESSE_KMH = 19;          // geocode.VITESSE_ANNONCE_KMH : un scooter (le serveur la remplace par sa médiane mesurée dès 100 livraisons ; pas encore ici)
export const APPROCHE_LIVREUR_MIN = 5;
export const PREP_DEFAUT_MIN = 15;      // geocode.PREP_MINUTES (médiane de 15 701 vraies commandes, backend docs/delais.md)

// Centre de chaque commune (sa maison communale, à quelques centaines de mètres près) : assez pour une fourchette de 10
// minutes, jamais pour une distance affichée ni pour le rayon de livraison (le serveur tranche avec l'adresse exacte).
const CENTRES_COMMUNES = {
  Anderlecht: [50.8365, 4.3087], Auderghem: [50.8156, 4.4264], 'Berchem-Sainte-Agathe': [50.8640, 4.2940],
  Bruxelles: [50.8467, 4.3525], Etterbeek: [50.8333, 4.3890], Evere: [50.8710, 4.4030], Forest: [50.8105, 4.3240],
  Ganshoren: [50.8710, 4.3080], Ixelles: [50.8330, 4.3670], Jette: [50.8780, 4.3260], Koekelberg: [50.8620, 4.3290],
  'Molenbeek-Saint-Jean': [50.8550, 4.3330], 'Saint-Gilles': [50.8280, 4.3460], 'Saint-Josse-ten-Noode': [50.8540, 4.3720],
  Schaerbeek: [50.8670, 4.3780], Uccle: [50.8020, 4.3370], 'Watermael-Boitsfort': [50.7990, 4.4150],
  'Woluwe-Saint-Lambert': [50.8430, 4.4330], 'Woluwe-Saint-Pierre': [50.8320, 4.4440]
};

const normaliser = (s) => String(s || '').normalize('NFD').replace(/[̀-ͯ]/g, '').trim().toLowerCase();
const communeConnue = (nom) => COMMUNES.find((c) => normaliser(c) === normaliser(nom)) || null;

// D'où compter : l'adresse du compte, sinon la commune donnée (celle de la liste), celle du compte, celle de l'accueil.
export function pointDuClient(user, commune = null) {
  if (user?.lat && user?.lng) return { lat: Number(user.lat), lng: Number(user.lng) };
  const nom = communeConnue(commune) || communeConnue(user?.addressCity) || communeDepuisCodePostal(user?.addressPostalCode)
    || communeConnue(lireBienvenue().commune);
  const c = nom && CENTRES_COMMUNES[nom];
  return c ? { lat: c[0], lng: c[1] } : null;
}

export const prepAnnoncee = (r) => Number(r?.prepEstimeeMinutes) || Number(r?.prepMinutes) || PREP_DEFAUT_MIN;

// Minutes jusqu'à la porte, ou null si on ne sait pas d'où.
export function minutesLivraison(r, point) {
  if (!point || !r?.lat || !r?.lng) return null;
  const km = haversineDistanceKm(point.lat, point.lng, Number(r.lat), Number(r.lng));
  return Math.round(prepAnnoncee(r) + (km * FACTEUR_RUES / VITESSE_KMH) * 60 + APPROCHE_LIVREUR_MIN);
}

export function fourchette(minutes) {
  const milieu = Math.round(minutes / 5) * 5;
  return { de: milieu - 5, a: milieu + 5 };
}

/* À DEUX PAS (fondateur, 2026-10-31) : à 1 km au plus de l'adresse EXACTE du compte (jamais le centre de la commune), la carte
 * dit aussi quand la commande serait prête à emporter. 1 km à vol d'oiseau, c'est 1,3 km de rues, un quart d'heure à pied
 * (5 km/h). Plus loin, l'à emporter n'est pas une vraie alternative à la livraison : on ne le propose pas. */
export const A_PIED_MAX_KM = 1;
export const aDeuxPas = (r, user) => !!(user?.lat && user?.lng && r?.lat && r?.lng)
  && haversineDistanceKm(Number(user.lat), Number(user.lng), Number(r.lat), Number(r.lng)) <= A_PIED_MAX_KM;
