import { lazy } from 'react';

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

export function rechargerSiNouveauCode(err) {
  if (!erreurDeChargementDeCode(err)) return false;
  let dernier = 0;
  try { dernier = Number(sessionStorage.getItem(CLE) || 0); } catch { /* sans stockage */ }
  if (Date.now() - dernier < 60000) return false;
  try { sessionStorage.setItem(CLE, String(Date.now())); } catch { /* sans stockage */ }
  window.location.reload();
  return true;
}

export function lazyPage(importer) {
  return lazy(() => importer().catch((err) => {
    // Rechargement en cours : on laisse le squelette affiché jusqu'au redémarrage plutôt que de propager.
    if (rechargerSiNouveauCode(err)) return new Promise(() => {});
    throw err;
  }));
}
