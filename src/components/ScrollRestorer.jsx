import { useEffect, useLayoutEffect, useRef } from 'react';
import { useLocation, useNavigationType } from 'react-router-dom';
import { repeterTantQueLibre, enHaut } from '../defilementAuto';

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
// REMONTER EN HAUT, PLUSIEURS FOIS. Un seul scrollTo(0, 0) au changement de page ne suffisait pas au téléphone : la
// nouvelle page arrive en squelettes, puis sa hauteur change (données, images, barre d'adresse de Safari qui se
// redéploie) et on se retrouvait quelques dizaines de pixels plus bas, le titre coupé. On remonte donc tout de
// suite (avant l'affichage), puis encore pendant ~0,8 s — sauf si la personne touche l'écran ou fait défiler
// entre-temps : on ne lui reprend jamais la main.
const REMONTEE_DELAIS = [0, 50, 150, 300, 500, 800];

// UNE SEULE MAIN SUR LE DÉFILEMENT : la restauration native du navigateur est coupée pour tout le site, dès le démarrage.
// Elle replaçait la page au retour arrière à SON moment — souvent quand la page n'était encore qu'un squelette, donc en
// haut — pendant que ce composant restaurait la vraie position : deux mains, et la page sautait (2026-10-17).
if (typeof window !== 'undefined' && 'scrollRestoration' in window.history) window.history.scrollRestoration = 'manual';

export default function ScrollRestorer() {
  const location = useLocation();
  const navigationType = useNavigationType();
  const isFirstRun = useRef(true);

  // La position est notée au fil du défilement et écrite au plus toutes les 150 ms, puis une dernière fois en quittant la
  // page (2026-10-23, app iPhone lente) : elle était écrite dans sessionStorage à CHAQUE image, une écriture synchrone sur le
  // fil qui fait défiler.
  useEffect(() => {
    const cleDefilement = `fairide_scroll:${location.pathname}`;
    let aEcrire = null;
    let minuteur = 0;
    const ecrire = () => {
      minuteur = 0;
      if (aEcrire === null) return;
      try { sessionStorage.setItem(cleDefilement, String(aEcrire)); } catch { /* stockage indisponible */ }
      aEcrire = null;
    };
    function onScroll() {
      aEcrire = window.scrollY;
      if (!minuteur) minuteur = setTimeout(ecrire, 150);
    }
    window.addEventListener('scroll', onScroll, { passive: true });
    return () => { window.removeEventListener('scroll', onScroll); clearTimeout(minuteur); ecrire(); };
  }, [location.pathname]);

  useLayoutEffect(() => {
    const premierChargement = isFirstRun.current;
    isFirstRun.current = false;
    // Une page qui s'ouvre en feuille (feuilles.js) défile dans sa feuille : la page de fond ne bouge pas.
    if (location.state?.fond) return undefined;
    const retour = navigationType === 'POP' || location.state?.restaurerDefilement === true;

    if (!premierChargement && !retour) {
      // Les ancres (#section) gardent leur cible.
      if (location.hash) return undefined;
      // ?ouvrir=… (Mon compte › Paiement depuis « Configurer mes paiements ») : la page défile elle-même jusqu'à la
      // section demandée, une fois ses données chargées. Les remontées ci-dessous la ramenaient en haut pendant ~0,8 s,
      // et le restaurateur atterrissait sur « Mes infos » (test au téléphone, 12 oct. 2026).
      if (new URLSearchParams(location.search).has('ouvrir')) return undefined;
      // En haut tout de suite (avant l'affichage), puis encore le temps que la page se construise — jusqu'au premier geste.
      return repeterTantQueLibre(enHaut, REMONTEE_DELAIS, { immediat: true });
    }
    const saved = Number(sessionStorage.getItem(`fairide_scroll:${location.pathname}`) || 0);
    if (saved <= 0) return undefined;
    // Retour arrière ou rechargement : la position quittée, réappliquée pendant le chargement — et plus rien dès que la
    // personne fait défiler (avant le 2026-10-17, ces reprises-ci n'avaient aucun arrêt : le saut « en revenant du panier »).
    return repeterTantQueLibre(() => window.scrollTo(0, saved), RESTAURATION_DELAIS);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [location.pathname]);

  return null;
}
