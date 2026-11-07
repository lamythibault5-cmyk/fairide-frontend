import { api } from './api';
import { estNatif, plateforme } from './natif';
import { estOccupe, niveauMiseAJour, ecouterMiseAJour } from './miseAJour';
import { notificationToucheeRecemment } from './pushNatif';

/* LES MISES À JOUR DIRECTES (Owen, 2026-11-05 : « on trouve beaucoup de bugs », une correction doit arriver dans l'appli
 * aussi vite que sur le site, sans attendre un jour de revue chez Apple).
 *
 * L'appli embarque une copie des écrans (dist/). À chaque fusion dans main, le workflow « App mise à jour directe » en fait
 * un paquet (dist/ zippé, release GitHub « appli-directe ») et l'annonce au serveur (fairide-backend/paquetsAppli.js). Ici,
 * au démarrage et au retour au premier plan, l'appli demande GET /app/paquet ; s'il y a plus récent POUR SA COQUE (le
 * « socle », scripts/paquet-appli.mjs), le greffon @capgo/capacitor-updater le télécharge en silence et vérifie son
 * empreinte sha256. Rien ne passe par les serveurs de Capgo (adresses vides dans capacitor.config.json).
 *
 * QUAND IL S'APPLIQUE : jamais sous les doigts de quelqu'un. Au prochain démarrage de l'appli, ou à un retour après
 * 30 minutes d'absence, et jamais pendant qu'un écran tient quelque chose en cours (signalerOccupe de miseAJour.js :
 * commande suivie, course en main, commande à accepter). L'appli recharge alors ses écrans derrière l'écran de lancement.
 *
 * SI UN PAQUET NE DÉMARRE PAS : l'appli dit au greffon qu'elle tourne (notifyAppReady) seulement une fois montée, sans page
 * plantée, 3 secondes après ; sans ce signal dans les 15 secondes (appReadyTimeout), le greffon revient seul au paquet
 * d'avant, et ce paquet-là n'est plus jamais retenté sur ce téléphone (RATES). L'équipe peut aussi retirer un paquet côté
 * serveur : les applis reviennent au précédent, sinon à la version du store (« retour »).
 *
 * Ce qui ne passe PAS par ici : tout ce qui touche la coque native (greffons, permissions, icône, ios/, android/). Un tel
 * changement donne un nouveau socle : les applis installées gardent leur dernier paquet compatible et attendent le store.
 *
 * Builds sans socle (le site, l'appli de test, un build local) : rien ne se passe. */
const ID = import.meta.env.VITE_PAQUET_ID || '';
const ORDRE = Number(import.meta.env.VITE_PAQUET_ORDRE) || 0;
const SOCLES = { ios: import.meta.env.VITE_SOCLE_IOS || '', android: import.meta.env.VITE_SOCLE_ANDROID || '' };

// Le paquet téléchargé qui attend son moment : { id (celui du greffon), version (le nôtre) } ou { retour: true }.
const PRET = 'fairide_paquet_pret';
// Le paquet qu'on vient de mettre en place : s'il ne tourne pas au démarrage suivant, c'est qu'il n'a pas démarré.
const ESSAI = 'fairide_paquet_essai';
// Les paquets qui n'ont pas démarré sur ce téléphone : jamais retéléchargés.
const RATES = 'fairide_paquets_rates';
const ABSENCE = 30 * 60 * 1000;
const INTERVALLE = 10 * 60 * 1000;
// Au retour au premier plan, le toucher d'une notification arrive juste après le réveil : on l'attend avant de recharger (G128).
const ATTENTE_RETOUR_MS = 1000;

let greffon = null;
let demarre = false;
let derniereDemande = 0;
let partiLe = 0;
let enCours = false;

const lire = (cle, defaut = null) => { try { return JSON.parse(localStorage.getItem(cle) || 'null') ?? defaut; } catch { return defaut; } };
const ecrire = (cle, v) => { try { if (v == null) localStorage.removeItem(cle); else localStorage.setItem(cle, JSON.stringify(v)); } catch { /* stockage indisponible */ } };

async function charger() {
  if (!greffon) ({ CapacitorUpdater: greffon } = await import('@capgo/capacitor-updater'));
  return greffon;
}

// Le paquet mis en place au dernier démarrage n'est pas celui qui tourne : le greffon l'a écarté.
function noterEssai() {
  const essai = lire(ESSAI);
  if (!essai) return;
  if (essai !== ID) ecrire(RATES, [...lire(RATES, []), essai].slice(-20));
  ecrire(ESSAI, null);
}

// Met en place ce qui attend, si le moment est bon. Recharge les écrans : rien n'est exécuté après.
async function appliquer() {
  const pret = lire(PRET);
  // Pas juste après le toucher d'une notification (G128) : le commerce ou le livreur ouvre l'appli pour agir, la page que la
  // notification ouvre ne doit pas disparaître dans un rechargement. Ce sera au prochain démarrage ou au prochain retour.
  // Sauf sous l'écran « Mets à jour » obligatoire, qui bloque déjà tout.
  if (!pret || estOccupe() || (notificationToucheeRecemment() && niveauMiseAJour() !== 'obligatoire')) return;
  // Déjà celui qui tourne (téléchargé une seconde fois pendant qu'il se mettait en place) : rien à recharger.
  if (pret.version === ID) { ecrire(PRET, null); return; }
  const u = await charger();
  ecrire(PRET, null);
  if (pret.retour) { await u.reset(); return; }
  ecrire(ESSAI, pret.version);
  await u.set({ id: pret.id });
}

// L'écran « Mets à jour Fairride » (obligatoire, miseAJour.js) bloque déjà tout : si des écrans plus récents sont
// téléchargés, ils se mettent en place sans attendre le prochain démarrage. Le serveur ne demande l'obligatoire qu'aux
// écrans qui n'ont pas la correction (versionsApplis.couverture) ; s'ils l'apportent, l'écran se lève au rechargement.
function lever() {
  if (niveauMiseAJour() === 'obligatoire' && lire(PRET)) appliquer().catch(() => {});
}

async function verifier() {
  const os = plateforme();
  const socle = SOCLES[os];
  if (!socle || enCours || Date.now() - derniereDemande < INTERVALLE) return;
  enCours = true;
  derniereDemande = Date.now();
  try {
    const r = await api(`/app/paquet?os=${os}&socle=${socle}&id=${encodeURIComponent(ID)}&ordre=${ORDRE}`, { logoutOn401: false });
    const u = await charger();
    if (r?.retour) {
      // Seulement si l'appli tourne sur un paquet : la version du store, elle, reste.
      if ((await u.current())?.bundle?.id !== 'builtin') ecrire(PRET, { retour: true });
      return;
    }
    const p = r?.paquet;
    if (!p || p.id === ID || lire(RATES, []).includes(p.id) || lire(PRET)?.version === p.id) return;
    const ancien = lire(PRET);
    const b = await u.download({ url: p.url, version: p.id, checksum: p.checksum });
    ecrire(PRET, { id: b.id, version: p.id });
    if (ancien?.id) u.delete({ id: ancien.id }).catch(() => {});
    lever();
  } catch { /* serveur muet, téléchargement raté : on réessaie au prochain retour */ } finally {
    enCours = false;
  }
}

// main.jsx, au tout début : natif seulement. Un paquet qui attend est mis en place tout de suite, derrière l'écran de
// lancement (sauf si l'appli s'ouvre sur un lien : retour de paiement, lien universel).
export async function demarrerMiseAJourDirecte() {
  if (demarre || !estNatif()) return;
  demarre = true;
  noterEssai();
  try {
    if (lire(PRET)) {
      const { App } = await import('@capacitor/app');
      // Pas attendu : set() recharge les écrans et ne rend jamais la main ; s'il échoue, la suite tourne quand même.
      if (!(await App.getLaunchUrl())?.url) appliquer().catch(() => {});
    }
  } catch { /* greffon absent de cette coque (build d'avant le 05/11) : rien */ }
  attendreDemarrage();
  ecouterMiseAJour(lever);
  document.addEventListener('visibilitychange', () => {
    if (document.visibilityState === 'hidden') { partiLe = Date.now(); return; }
    // Une seconde plus tard (G128) : le toucher d'une notification qui a réveillé l'appli a eu le temps d'arriver.
    if (partiLe && Date.now() - partiLe > ABSENCE) setTimeout(() => { if (document.visibilityState === 'visible') appliquer().catch(() => {}); }, ATTENTE_RETOUR_MS);
    verifier();
  });
}

// Une fois React monté (le texte pré-rendu pour les moteurs remplacé), 3 secondes plus tard et si aucune page n'a planté,
// l'appli dit au greffon qu'elle tourne (sinon il revient au paquet d'avant), puis cherche une mise à jour. Sondé à part de
// l'écran de lancement de main.jsx, qui abandonne à 7,5 s : un téléphone lent ne doit pas faire écarter un bon paquet.
function attendreDemarrage() {
  const root = document.getElementById('root');
  if (!root?.children.length || root.querySelector('[data-prerendu]')) { setTimeout(attendreDemarrage, 100); return; }
  setTimeout(async () => {
    if (document.querySelector('[data-page-plantee]')) return;
    try { await (await charger()).notifyAppReady(); } catch { /* greffon absent de cette coque */ }
    verifier();
  }, 3000);
}
