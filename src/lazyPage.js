import { lazy } from 'react';
import { chargerSuite } from './i18n/translations';

// Chargement des pages à la demande, tolérant aux mises en ligne. Chaque déploiement renomme les fichiers de
// code (empreinte dans le nom) : un onglet resté ouvert sur l'ancienne version demande, au changement de
// section, un fichier qui n'existe plus — la page reste vide et la personne doit recharger elle-même.
// Ici, cet échec précis déclenche un rechargement silencieux vers la nouvelle version, une seule fois par
// minute au plus (pas de boucle si le réseau est réellement coupé). Voir aussi main.jsx (vite:preloadError)
// et AppErrorBoundary.jsx.
const CLE = 'fairide_reload_chunk_at';
const MOTIFS = /dynamically imported module|Importing a module script failed|Loading chunk|Loading CSS chunk|Unexpected token '<'|error loading dynamically imported|Failed to fetch/i;

export function erreurDeChargementDeCode(err) {
  const message = String(err?.message || err || '');
  return MOTIFS.test(message);
}

/* HORS LIGNE, ON NE RECHARGE PAS (audit du 24/10). Sur le site, sans réseau, ouvrir une section dont le code n'est pas encore
   chargé fait échouer l'import (« Failed to fetch ») : recharger menait tout droit à la page « Vous êtes hors ligne » de
   Chrome (le dinosaure), et la page où l'on était disparaissait. Le fichier n'a pas changé de nom, c'est le réseau qui manque :
   l'erreur suit son chemin jusqu'à AppErrorBoundary, qui le dit et recharge de lui-même au retour du réseau. Dans l'app, le
   code est sur le téléphone : ce cas n'y arrive pas. `navigator.onLine === false` est fiable dans ce sens-là (pas de réseau
   du tout) ; un réseau présent mais mauvais garde le comportement d'avant. */
export function horsLigne() {
  return typeof navigator !== 'undefined' && navigator.onLine === false;
}

export function rechargerSiNouveauCode(err) {
  if (!erreurDeChargementDeCode(err)) return false;
  if (horsLigne()) return false;
  let dernier = 0;
  try { dernier = Number(sessionStorage.getItem(CLE) || 0); } catch { /* sans stockage */ }
  if (Date.now() - dernier < 60000) return false;
  try { sessionStorage.setItem(CLE, String(Date.now())); } catch { /* sans stockage */ }
  window.location.reload();
  return true;
}

/* LA PAGE ATTEND AUSSI LA SUITE DU FRANÇAIS (audit du 27/10/2026). Le premier chargement n'emporte que les textes des pages
   publiques (src/i18n/translations.js) ; une page chargée à la demande peut lire n'importe quel espace, elle ne s'affiche
   donc qu'avec la table complète. Les deux téléchargements partent ensemble, et la suite n'est téléchargée qu'une fois. */
export function lazyPage(importer) {
  return lazy(() => Promise.all([importer(), chargerSuite()]).then(([module]) => module).catch((err) => {
    // Rechargement en cours : on laisse le squelette affiché jusqu'au redémarrage plutôt que de propager.
    if (rechargerSiNouveauCode(err)) return new Promise(() => {});
    throw err;
  }));
}
