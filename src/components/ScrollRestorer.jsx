import { useEffect, useRef } from 'react';
import { useLocation } from 'react-router-dom';

// Rendu une seule fois, en dehors de <Routes> (voir App.jsx), pour ne se remonter qu'à un vrai
// rechargement de page (F5) — pas à chaque navigation interne, qui remonte les pages elles-mêmes mais
// pas leurs ancêtres. Ça permet de distinguer les deux cas avec un simple ref : la toute première
// exécution de l'effet correspond au chargement de page en cours, les suivantes à des navigations.
//
// Le scroll natif du navigateur (history.scrollRestoration = 'auto') échoue régulièrement ici car le
// contenu de la page (fetch async, skeletons) n'a souvent pas encore sa hauteur finale au moment où le
// navigateur tente sa propre restauration — il ne réessaie pas après coup. On mémorise donc la position
// nous-mêmes par URL (sessionStorage, propre à l'onglet) et on la réapplique avec plusieurs tentatives
// échelonnées le temps que le contenu charge, comme déjà fait pour l'ancrage de catégorie dans
// RestaurantMenu.jsx.
export default function ScrollRestorer() {
  const location = useLocation();
  const isFirstRun = useRef(true);

  useEffect(() => {
    let ticking = false;
    function onScroll() {
      if (ticking) return;
      ticking = true;
      requestAnimationFrame(() => {
        sessionStorage.setItem(`fairide_scroll:${location.pathname}`, String(window.scrollY));
        ticking = false;
      });
    }
    window.addEventListener('scroll', onScroll, { passive: true });
    return () => window.removeEventListener('scroll', onScroll);
  }, [location.pathname]);

  useEffect(() => {
    if (isFirstRun.current) {
      isFirstRun.current = false;
      const saved = Number(sessionStorage.getItem(`fairide_scroll:${location.pathname}`) || 0);
      if (saved > 0) {
        [0, 100, 300, 600, 1000, 1500].forEach((delay) => setTimeout(() => window.scrollTo(0, saved), delay));
      }
    } else {
      window.scrollTo(0, 0);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [location.pathname]);

  return null;
}
