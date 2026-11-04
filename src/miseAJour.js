import { useSyncExternalStore } from 'react';
import { api } from './api';
import { estNatif, plateforme } from './natif';

/* LA MISE À JOUR DES APPLIS, UN SEUL ÉTAT POUR TOUTE L'APPLI (Owen, 2026-11-03, réponses à maquettes/mise-a-jour/mise-a-jour.html).
 *
 * L'application embarque une copie figée des écrans (Capacitor, webDir dist) : une vieille version continue d'appeler le
 * serveur d'aujourd'hui avec ses écrans d'hier. Au démarrage et à chaque retour au premier plan, l'app lit
 * GET /app/min-version (réglé dans Admin › Conformité › Paramètres) et compare son build (App.getInfo) :
 *   - sous le MINIMUM : « obligatoire », l'écran plein sans refus (D, MiseAJour.jsx) ;
 *   - sous la version CONSEILLÉE : « conseillée », la notification de verre qui descend du haut (A), refusable, plus une
 *     rangée en tête de Mon compte et un point sur l'onglet Compte (E) tant que l'app n'est pas à jour.
 * Le site n'est jamais concerné (il est toujours à jour).
 *
 * PERSONNE NE RÈGLE RIEN (Owen, 2026-11-04) : Claude décide dans la proposition de fusion (mises-a-jour/<id>.json :
 * conseillée ou obligatoire, trois lignes), le build l'envoie au serveur, et le serveur ne l'applique qu'une fois la version
 * en ligne dans le store (fairide-backend/versionsApplis.js). La conseillée n'arrive qu'aux applis qui ont 7 jours de
 * retard ; sans conseil ni minimum, une version plus récente en ligne (« disponible ») ne montre que la rangée de Mon compte.
 *
 * JAMAIS AU MILIEU DE QUELQUE CHOSE (réponse 7, « obligatoire compris ») : tant qu'une commande du client est en cours, qu'un
 * livreur a une course en main ou qu'une commande attend d'être acceptée au commerce, rien ne s'affiche ; l'écran vient
 * après. Les écrans concernés le disent eux-mêmes avec signalerOccupe(cle, oui).
 *
 * TOUJOURS DU CÔTÉ OUVERT : sans réponse du serveur, sans numéro de build lisible ou sur une plate-forme inconnue, rien ne
 * s'affiche — une panne ne doit jamais empêcher quelqu'un de commander ou de livrer. */
const STORE_PAR_DEFAUT = {
  android: 'https://play.google.com/store/apps/details?id=be.fairide.app',
  ios: 'https://apps.apple.com/be/app/id6826197340'
};

// « Plus tard » (réponse 4) : la notification revient une fois, 3 jours après ; au second « Plus tard », une semaine de
// calme, puis le cycle reprend. Compté par date et non par version (Owen, 2026-11-04 : des versions toutes les deux heures
// au début ne doivent pas la faire revenir à chaque fois). La rangée de Mon compte reste. Mémorisé sur l'appareil.
const PLUS_TARD = 'fairide_maj_plus_tard';
const JOUR = 24 * 3600 * 1000;

const VIDE = { niveau: null, store: null, os: null, cible: 0, nouveautes: {}, occupe: false, reportee: false };
let etat = VIDE;
const occupations = new Map();
const abonnes = new Set();
let demarre = false;

function publier(suite) {
  etat = { ...etat, ...suite };
  abonnes.forEach((f) => f());
}

function lirePlusTard() {
  try { return JSON.parse(localStorage.getItem(PLUS_TARD) || 'null'); } catch { return null; }
}
function estReportee() {
  const p = lirePlusTard();
  if (!p || !p.at) return false;
  return Date.now() - p.at < (p.fois >= 2 ? 7 : 3) * JOUR;
}

// « Plus tard » sur la notification conseillée.
export function reporterMiseAJour() {
  const p = lirePlusTard();
  const fois = p?.fois === 1 ? 2 : 1;
  try { localStorage.setItem(PLUS_TARD, JSON.stringify({ fois, at: Date.now() })); } catch { /* stockage indisponible : elle reviendra à la prochaine ouverture */ }
  publier({ reportee: true });
}

// Un écran dit qu'il tient quelque chose en cours (commande suivie, course en main, commande à accepter).
export function signalerOccupe(cle, oui) {
  if (oui) occupations.set(cle, true); else occupations.delete(cle);
  const occupe = occupations.size > 0;
  if (occupe !== etat.occupe) publier({ occupe });
}

async function buildInstalle() {
  try {
    const { App } = await import('@capacitor/app');
    const n = Number((await App.getInfo())?.build);
    return Number.isInteger(n) && n > 0 ? n : null;
  } catch { return null; }
}

async function verifier() {
  if (document.visibilityState === 'hidden') return;
  const os = etat.os;
  try {
    const build = await buildInstalle();
    if (!build) return;
    // Le build envoyé : « ce qui change » ne liste que ce que cette appli n'a pas encore.
    const reponse = await api(`/app/min-version?os=${os}&build=${build}`, { logoutOn401: false });
    const minimum = Number(reponse?.[os]) || 0;
    const conseille = Number(reponse?.conseille?.[os]) || 0;
    const dernier = Number(reponse?.dernier?.[os]) || 0;
    const store = reponse?.storeUrls?.[os] || STORE_PAR_DEFAUT[os];
    const nouveautes = reponse?.nouveautes || {};
    if (minimum && build < minimum) return publier({ niveau: 'obligatoire', store, cible: minimum, nouveautes, reportee: false });
    if (conseille && build < conseille) return publier({ niveau: 'conseillee', store, cible: conseille, nouveautes, reportee: estReportee() });
    if (dernier && build < dernier) return publier({ niveau: 'disponible', store, cible: dernier, nouveautes, reportee: false });
    publier({ niveau: null, store: null, cible: 0, nouveautes: {}, reportee: false });
  } catch { /* serveur muet : rien ne s'affiche */ }
}

// Lancée une fois par MiseAJour.jsx : natif Android / iPhone seulement.
export function demarrerVerification() {
  if (demarre || !estNatif()) return;
  const os = plateforme();
  if (os !== 'android' && os !== 'ios') return;
  demarre = true;
  etat = { ...etat, os };
  verifier();
  // natif.js relaie le retour au premier plan (appStateChange) en visibilitychange.
  document.addEventListener('visibilitychange', verifier);
}

function sAbonner(f) {
  abonnes.add(f);
  return () => abonnes.delete(f);
}
const lire = () => etat;

export default function useMiseAJour() {
  return useSyncExternalStore(sAbonner, lire, lire);
}

// Le point sur l'onglet Compte (DashboardSidebar) : seulement quand la mise à jour est conseillée ou obligatoire, pas pour
// une simple version plus récente (« disponible »), qui sinon s'allumerait après chaque sortie.
export function useMiseAJourDispo() {
  const { niveau } = useMiseAJour();
  return niveau === 'conseillee' || niveau === 'obligatoire';
}
