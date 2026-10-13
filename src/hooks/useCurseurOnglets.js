import { useLayoutEffect } from 'react';

// La pastille iris qui GLISSE d'un onglet à l'autre dans la barre du bas (sous 900px).
//
// POURQUOI UN CURSEUR ET PAS UN FOND SUR L'ONGLET ACTIF. Un fond posé sur `.active` change de place d'un
// coup : l'ancien s'éteint, le nouveau s'allume, rien ne relie les deux. Une seule pastille qui se déplace
// dit d'où l'on vient et où l'on va — c'est la barre de Revolut que le fondateur a montrée (2026-10-13), et
// la « cohérence spatiale » des interfaces d'Apple.
//
// CE QUE ÇA COÛTE : rien de plus que du CSS. On ne fait que mesurer l'onglet actif (offsetLeft / offsetWidth,
// une lecture par changement de page, jamais pendant le défilement) et poser un `transform`. Le glissement
// lui-même est une transition CSS sur `transform`, donc tenue par le compositeur — pas de JavaScript image
// par image, pas de bibliothèque, et `prefers-reduced-motion` le coupe par la règle globale de styles.css.
//
// Le ResizeObserver replace la pastille quand la barre change de taille : rotation de l'écran, et surtout
// passage en barre compacte au défilement (useEnteteDefilement), où les onglets perdent leur libellé.
//
// `cle` : ce qui doit déclencher une nouvelle mesure (l'adresse de la page).
export function useCurseurOnglets(navRef, cle) {
  useLayoutEffect(() => {
    const nav = navRef.current;
    const curseur = nav?.querySelector(':scope > .nav-curseur');
    if (!nav || !curseur) return undefined;

    // `changement` : vrai quand on vient de changer d'onglet (pas quand la barre change seulement de taille).
    const placer = (changement = false) => {
      const actif = nav.querySelector(':scope > .dashboard-nav-link.active');
      // Page hors de la barre (une sous-page sans onglet) : la pastille s'efface au lieu de rester sur l'ancien.
      if (!actif || !actif.offsetWidth) { curseur.style.opacity = '0'; return; }
      // Première pose : pas de glissement depuis le bord gauche à l'ouverture de l'app.
      const premiere = !curseur.dataset.pose;
      /* LA BARRE ACCOMPAGNE LE GESTE (fondateur, 2026-10-13 : « qu'elle bouge un peu »). Elle part de 3px dans
       * le sens où va la pastille, puis revient : la barre entière « suit » l'onglet touché, comme un objet
       * qu'on pousse. Une animation de `transform` sur un seul élément, relancée en retirant puis remettant la
       * classe — le `void offsetWidth` entre les deux est ce qui fait repartir l'animation de zéro. */
      const avant = Number(curseur.dataset.x);
      if (changement && !premiere && actif.offsetLeft !== avant) {
        nav.style.setProperty('--pousse', actif.offsetLeft > avant ? '3px' : '-3px');
        nav.classList.remove('dashboard-nav--pousse');
        void nav.offsetWidth;
        nav.classList.add('dashboard-nav--pousse');
      }
      curseur.dataset.x = String(actif.offsetLeft);
      if (premiere) curseur.style.transition = 'none';
      curseur.style.opacity = '1';
      curseur.style.width = `${actif.offsetWidth}px`;
      curseur.style.height = `${actif.offsetHeight}px`;
      curseur.style.transform = `translate(${actif.offsetLeft}px, ${actif.offsetTop}px)`;
      if (premiere) {
        void curseur.offsetWidth; // applique la position sans transition avant de rendre la transition
        curseur.style.transition = '';
        curseur.dataset.pose = '1';
      }
    };

    placer(true);
    if (typeof ResizeObserver === 'undefined') return undefined;
    const observateur = new ResizeObserver(() => placer(false));
    observateur.observe(nav);
    return () => observateur.disconnect();
  }, [navRef, cle]);
}
