import { useEffect, useRef } from 'react';
import { useLocation, useNavigationType } from 'react-router-dom';

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
//
// QUAND RESTAURE-T-ON, ET QUAND REMONTE-T-ON EN HAUT ? Trois cas :
//   - rechargement de page : on restaure (c'est l'usage d'origine) ;
//   - retour arrière du navigateur (POP) ou lien qui le demande (state.restaurerDefilement, posé par
//     les liens « ← Mon compte ») : on restaure. Revenir sur une page, c'est revenir à l'endroit où
//     on l'a quittée — quelqu'un qui a ouvert la dernière rubrique de Mon compte et clique « retour »
//     veut retrouver cette rubrique sous le doigt, pas le haut de la page et tout à refaire défiler ;
//   - toute autre navigation (clic sur un onglet, sur une carte) : on part du haut, c'est une
//     nouvelle page qu'on commence.
const RESTAURATION_DELAIS = [0, 100, 300, 600, 1000, 1500];

export default function ScrollRestorer() {
  const location = useLocation();
  const navigationType = useNavigationType();
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
    const premierChargement = isFirstRun.current;
    isFirstRun.current = false;
    const retour = navigationType === 'POP' || location.state?.restaurerDefilement === true;

    if (!premierChargement && !retour) {
      window.scrollTo(0, 0);
      return undefined;
    }
    const saved = Number(sessionStorage.getItem(`fairide_scroll:${location.pathname}`) || 0);
    if (saved <= 0) return undefined;
    const minuteurs = RESTAURATION_DELAIS.map((delay) => setTimeout(() => window.scrollTo(0, saved), delay));
    return () => minuteurs.forEach(clearTimeout);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [location.pathname]);

  return null;
}
