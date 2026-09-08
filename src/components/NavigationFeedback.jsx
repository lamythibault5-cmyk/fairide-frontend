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
      clearTimeout(abandon.current); clearTimeout(finTimer.current);
      setEtat('encours');
      abandon.current = setTimeout(() => setEtat('repos'), DELAI_ABANDON);
    }
    function onIntention(e) {
      const url = lienInterne(e);
      if (url) prechargerPage(url.pathname);
    }
    document.addEventListener('click', onClick, true);
    document.addEventListener('pointerover', onIntention, { passive: true });
    document.addEventListener('touchstart', onIntention, { passive: true });
    document.addEventListener('focusin', onIntention);
    return () => {
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
