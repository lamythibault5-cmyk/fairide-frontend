import { useEffect, useLayoutEffect } from 'react';
import { experienceApp } from '../natif';

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
// LE LIBELLÉ TIENT DANS LA PASTILLE (Owen, 2026-10-26 : « Commandes » coupé par la pastille sur un Android, jamais sur
// l'iPhone). La pastille a les bouts ronds (rayon = moitié de sa hauteur) et le libellé est sous l'icône, là où l'arrondi la
// resserre déjà. Mesuré : sur un iPhone de 393 px, « Commandes » (54 px) y a 61 px ; sur un Android de 360 px, 55 — bord à
// bord — et moins encore quand Android grossit le texte (taille de police du système) ou rétrécit l'écran (taille
// d'affichage). On mesure donc le vrai texte et la place que l'arrondi lui laisse à sa hauteur, et TOUS les libellés
// réduisent d'un même facteur (--libelle-ajuste, styles.css), juste assez pour que le plus long tienne à 2 px du bord.
// Sur un écran assez large, le facteur reste 1 : rien ne change. La console (.admin) défile de côté : elle n'est pas concernée.
const MARGE_LIBELLE = 2;
function ajusterLibelles(nav) {
  if (nav.classList.contains('admin') || !window.matchMedia('(max-width: 900px)').matches) {
    nav.style.removeProperty('--libelle-ajuste');
    return;
  }
  const avant = Number(nav.style.getPropertyValue('--libelle-ajuste')) || 1;
  let facteur = 1;
  for (const onglet of nav.querySelectorAll(':scope > .dashboard-nav-link')) {
    const libelle = onglet.querySelector('.dashboard-nav-label');
    // Libellé replié ou en train de se déplier (barre compacte) : la mesure attend qu'il soit posé.
    if (!libelle || !libelle.scrollWidth || libelle.offsetHeight < libelle.scrollHeight) return;
    const rayon = onglet.offsetHeight / 2;
    const corps = parseFloat(getComputedStyle(libelle).fontSize);
    const ecart = Math.min(rayon, Math.abs(libelle.offsetTop + libelle.offsetHeight / 2 - rayon) + corps / 2);
    const place = onglet.offsetWidth - 2 * rayon + 2 * Math.sqrt(rayon * rayon - ecart * ecart) - 2 * MARGE_LIBELLE;
    facteur = Math.min(facteur, (avant * place) / libelle.scrollWidth);
  }
  facteur = Math.max(0.6, Math.floor(facteur * 100) / 100);
  if (Math.abs(facteur - avant) >= 0.01) nav.style.setProperty('--libelle-ajuste', String(facteur));
}

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
      curseur.dataset.y = String(actif.offsetTop);
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
    ajusterLibelles(nav);
    if (typeof ResizeObserver === 'undefined') return undefined;
    const observateur = new ResizeObserver(() => { ajusterLibelles(nav); placer(false); });
    observateur.observe(nav);
    // Un libellé change de largeur sans que la barre bouge : police chargée, autre langue.
    nav.querySelectorAll(':scope > .dashboard-nav-link .dashboard-nav-label').forEach((l) => observateur.observe(l));
    return () => observateur.disconnect();
  }, [navRef, cle]);

  // Dans l'app : la barre en verre, sa lentille qu'on promène du doigt et la réfraction (barreVerre.js, chargé à part :
  // le site n'en télécharge rien). Branchée une fois par barre, pas à chaque page.
  useEffect(() => {
    const nav = navRef.current;
    const curseur = nav?.querySelector(':scope > .nav-curseur');
    if (!nav || !curseur || !experienceApp()) return undefined;
    let debrancher = null;
    let fini = false;
    import('../barreVerre').then(({ brancherBarreVerre }) => { if (!fini) debrancher = brancherBarreVerre(nav, curseur); }).catch(() => {});
    return () => { fini = true; debrancher?.(); };
  }, [navRef]);
}
