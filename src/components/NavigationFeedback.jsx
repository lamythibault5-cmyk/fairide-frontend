import { useEffect, useRef, useState } from 'react';
import { useLocation } from 'react-router-dom';
import { prechargerPage } from '../routePrefetch';

// Retour visuel pendant un changement de page. Les pages sont chargées à la demande (lazy, voir App.jsx)
// et React garde l'ancienne page affichée tant que la nouvelle n'est pas prête : sans ce composant, un
// clic sur un onglet ne produisait rien pendant quelques centaines de millisecondes puis la page
// changeait d'un coup — l'impression d'un « mini-bug ». Ici :
//   - une barre fine en haut de l'écran apparaît dès le clic sur un lien interne et disparaît quand
//     l'adresse a changé (ou après 8 s si la navigation n'a pas lieu) ;
//   - le module de la page visée est préchargé dès le survol, le toucher ou le focus d'un lien, pour
//     que le clic qui suit n'ait plus rien à télécharger.
const DELAI_ABANDON = 8000;
// Veille de version : toutes les 5 minutes (et au retour sur l'onglet), on relit index.html et on compare le
// nom du fichier principal à celui qui tourne. S'il a changé, une nouvelle version est en ligne : le prochain
// clic sur un lien interne quitte le routeur pour un vrai chargement de la page cible — la personne arrive
// où elle voulait aller, dans la nouvelle version, sans jamais voir un rechargement en plein travail.
const VEILLE_MS = 5 * 60 * 1000;
let nouvelleVersion = false;
function fichierPrincipalCourant() {
  const el = document.querySelector('script[type="module"][src*="/assets/index-"]');
  return el ? (el.getAttribute('src') || '').replace(/^.*\/assets\//, '') : null;
}
async function verifierVersion() {
  const courant = fichierPrincipalCourant();
  if (!courant || nouvelleVersion) return;
  try {
    const r = await fetch(`/index.html?v=${Date.now()}`, { cache: 'no-store' });
    if (!r.ok) return;
    const html = await r.text();
    const m = html.match(/\/assets\/(index-[A-Za-z0-9_-]+\.js)/);
    if (m && m[1] !== courant) nouvelleVersion = true;
  } catch { /* hors ligne : on réessaiera */ }
}

function lienInterne(e) {
  const a = e.target?.closest?.('a[href]');
  if (!a) return null;
  if (a.target && a.target !== '_self') return null;
  if (a.hasAttribute('download') || a.getAttribute('href').startsWith('#')) return null;
  let url;
  try { url = new URL(a.href, window.location.href); } catch { return null; }
  if (url.origin !== window.location.origin) return null;
  return url;
}

export default function NavigationFeedback() {
  const location = useLocation();
  const [etat, setEtat] = useState('repos'); // repos | encours | fin
  const abandon = useRef(null);
  const finTimer = useRef(null);

  useEffect(() => {
    function onClick(e) {
      if (e.defaultPrevented || e.button !== 0 || e.metaKey || e.ctrlKey || e.shiftKey || e.altKey) return;
      const url = lienInterne(e);
      if (!url) return;
      if (url.pathname === window.location.pathname && url.search === window.location.search) return;
      if (nouvelleVersion) {
        // Nouvelle version en ligne : chargement complet de la page cible, hors routeur.
        e.preventDefault(); e.stopPropagation();
        window.location.assign(url.href);
        return;
      }
      clearTimeout(abandon.current); clearTimeout(finTimer.current);
      setEtat('encours');
      abandon.current = setTimeout(() => setEtat('repos'), DELAI_ABANDON);
    }
    function onIntention(e) {
      const url = lienInterne(e);
      if (url) prechargerPage(url.pathname);
    }
    document.addEventListener('click', onClick, true);
    const veille = setInterval(verifierVersion, VEILLE_MS);
    const onVisible = () => { if (document.visibilityState === 'visible') verifierVersion(); };
    document.addEventListener('visibilitychange', onVisible);
    document.addEventListener('pointerover', onIntention, { passive: true });
    document.addEventListener('touchstart', onIntention, { passive: true });
    document.addEventListener('focusin', onIntention);
    return () => {
      clearInterval(veille);
      document.removeEventListener('visibilitychange', onVisible);
      document.removeEventListener('click', onClick, true);
      document.removeEventListener('pointerover', onIntention);
      document.removeEventListener('touchstart', onIntention);
      document.removeEventListener('focusin', onIntention);
    };
  }, []);

  // L'adresse a changé : la nouvelle page est affichée, la barre file jusqu'au bout puis s'efface.
  useEffect(() => {
    clearTimeout(abandon.current);
    setEtat((s) => (s === 'encours' ? 'fin' : s));
    finTimer.current = setTimeout(() => setEtat('repos'), 320);
    return () => clearTimeout(finTimer.current);
  }, [location.pathname, location.search]);

  if (etat === 'repos') return null;
  return <div className={`nav-progress ${etat}`} aria-hidden="true" />;
}
