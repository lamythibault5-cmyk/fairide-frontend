/* LES DONNÉES DÉJÀ LUES RESTENT EN MÉMOIRE LE TEMPS DE LA VISITE (fondateur, 2026-10-20, test de l'app Android avec Maestro
 * Pizza : « ça met du temps à s'ouvrir », « fermer avec la croix est très lent »). Chaque passage par la liste relisait
 * /restaurants en montrant des squelettes, et chaque fiche refaisait ses cinq requêtes avant de s'afficher : sur un
 * téléphone moyen en 4G, une à deux secondes à chaque aller-retour, et la carte vers laquelle la photo devait revenir
 * (transitionPhoto.js) n'existait pas encore quand la transition la cherchait.
 *
 * Le principe, « périmé pendant qu'on revalide » : ce qui a déjà été lu s'affiche tout de suite, la lecture repart en
 * arrière-plan, et l'écran ne change que si la réponse est DIFFÉRENTE — la même réponse rend le même objet (comparaison du
 * JSON), donc un setState(même objet) que React ignore : pas de rendu, pas de rangée « À découvrir » rebattue sous les yeux.
 *
 * Ce que ce n'est PAS : un stockage. Une simple Map en mémoire, perdue à la fermeture de l'app ou de l'onglet ; rien dans
 * localStorage ni sessionStorage, donc rien à déclarer dans la politique des cookies, et rien qui survive à la personne
 * suivante sur un appareil partagé — la déconnexion volontaire vide tout (même événement que le panier, CartContext.jsx).
 * La clé contient le jeton : une fiche lue connecté (un commerce encore caché, visible de son propriétaire) n'est jamais
 * resservie à une autre session. Le service worker, lui, ne met toujours rien en cache (public/sw.js). */
import { api } from './api';

// Au-delà, une donnée gardée ne s'affiche plus d'avance (squelette, comme avant) : un menu ou des horaires d'il y a une
// demi-heure, même corrigés une seconde après, seraient une fausse information le temps de la relecture.
const AGE_MAX_MS = 30 * 60 * 1000;
// Une lecture faite il y a moins de FRAIS_MS n'est pas refaite : le préchargement au toucher de la carte (prechargerFiche)
// sert alors tel quel à la fiche qui s'ouvre, sans seconde requête identique.
const FRAIS_MS = 3000;
// Une fiche avec sa carte complète pèse quelques dizaines de Ko : on en garde une quarantaine, les plus anciennes partent.
const ENTREES_MAX = 40;

const memoire = new Map(); // clé → { donnees, signature, at, enCours }

const cle = (chemin, token) => `${token || ''}|${chemin}`;

function ranger(k, entree) {
  memoire.delete(k);
  memoire.set(k, entree);
  while (memoire.size > ENTREES_MAX) memoire.delete(memoire.keys().next().value);
}

// La donnée gardée pour ce chemin et cette session, ou undefined (jamais lue, ou trop vieille pour être montrée).
export function lireCache(chemin, token) {
  const e = memoire.get(cle(chemin, token));
  if (!e || e.at === 0 || Date.now() - e.at > AGE_MAX_MS) return undefined;
  return e.donnees;
}

/* Lit `chemin` (GET) et garde la réponse. Une lecture déjà en cours pour la même clé est partagée. Promet la donnée : le
 * MÊME objet que celui déjà gardé si rien n'a changé. `forcer` : relire même si la dernière lecture est toute fraîche
 * (tirer pour actualiser). Les erreurs remontent à l'appelant, la donnée gardée reste. */
export function chargerAvecCache(chemin, { token, forcer = false } = {}) {
  const k = cle(chemin, token);
  const e = memoire.get(k);
  if (e?.enCours) return e.enCours;
  if (!forcer && e && e.at && Date.now() - e.at < FRAIS_MS) return Promise.resolve(e.donnees);
  const enCours = api(chemin, token ? { token } : undefined).then((donnees) => {
    const actuelle = memoire.get(k);
    let signature = null;
    try { signature = JSON.stringify(donnees); } catch { /* réponse non sérialisable : jamais considérée inchangée */ }
    const memes = actuelle && signature !== null && actuelle.signature === signature;
    const gardee = memes ? actuelle.donnees : donnees;
    ranger(k, { donnees: gardee, signature, at: Date.now(), enCours: null });
    return gardee;
  }, (erreur) => {
    const actuelle = memoire.get(k);
    if (actuelle) actuelle.enCours = null;
    throw erreur;
  });
  ranger(k, { donnees: e?.donnees, signature: e?.signature ?? null, at: e?.at ?? 0, enCours });
  return enCours;
}

/* Une action a changé la donnée côté serveur (cœur des favoris) : on corrige la copie gardée tout de suite, sinon l'écran
 * suivant la montrerait d'abord dans son ancien état, puis basculerait à la relecture. Rien si rien n'est gardé. */
export function modifierCache(chemin, token, modifier) {
  const e = memoire.get(cle(chemin, token));
  if (!e || e.donnees === undefined) return;
  e.donnees = modifier(e.donnees);
  try { e.signature = JSON.stringify(e.donnees); } catch { e.signature = null; }
}

/* PRÉCHARGEMENT AU TOUCHER (fondateur, 2026-10-20). Entre le doigt posé sur la carte d'un commerce et le clic, il se passe
 * 80 à 150 ms, plus la transition de la photo : la fiche et ses avis partent dès le contact. Appelé seulement quand le lien
 * mène vraiment à la fiche (connecté, voir murCompte.js) : sans compte, il mène à la connexion. */
export function prechargerFiche(id, token) {
  if (!id) return;
  chargerAvecCache(`/restaurants/${id}`, { token }).catch(() => {});
  chargerAvecCache(`/restaurants/${id}/reviews`).catch(() => {});
}

export function viderCacheDonnees() {
  memoire.clear();
}

// Déconnexion volontaire (AuthContext.logout) : la personne suivante ne doit rien trouver de la session d'avant.
if (typeof window !== 'undefined') window.addEventListener('fairide:deconnexion', viderCacheDonnees);
