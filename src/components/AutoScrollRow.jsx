import { useEffect, useRef } from 'react';

// Défilement continu d'une rangée de cartes (utilisé par "À découvrir" — RestaurantList.jsx et
// RestaurantMenu.jsx). Piloté par requestAnimationFrame sur le scrollLeft NATIF du conteneur, pas par
// une animation CSS `transform` + `mask-image` : cette dernière combinaison (déjà en place ici avant)
// provoquait un vrai bug d'affichage — après avoir fait défiler la page, la rangée entière restait
// parfois invisible (fond uni, aucune carte), alors que le DOM et les positions calculées étaient
// pourtant corrects. C'est un défaut classique de repaint du navigateur avec mask-image + transform
// animé + overflow:hidden dans une page qui scrolle, reproductible sur desktop comme mobile — pas
// une simple coïncidence d'une capture d'écran. Le scroll natif (scrollLeft), lui, est toujours peint
// correctement par le navigateur : c'est le seul mécanisme fiable ici.
//
// Le contenu est dupliqué une fois (comme avant) pour boucler sans coupure visible : une fois que le
// scroll dépasse la largeur d'une copie, on retranche cette largeur — la seconde copie étant identique
// à la première, le saut est invisible.
// Délai avant que l'auto-défilement ne reprenne la main après un geste de l'utilisateur. La rangée est
// défilable au doigt (voir .auto-scroll-row en CSS) : sans ce délai, relâcher le doigt relancerait
// l'animation en plein élan d'inertie, qui pousse vers la droite pendant que le geste porte vers la
// gauche — la rangée se bat contre l'utilisateur juste après son balayage. La souris n'a pas d'inertie,
// d'où une reprise immédiate quand le curseur quitte la rangée.
const RESUME_AFTER_TOUCH_MS = 1600;

// Seuil du palier "compact". 900px et non 640 : la tablette héritait jusqu'ici de la vitesse desktop
// alors qu'elle a la même contrainte de fluidité que le téléphone. C'est aussi le seuil déjà retenu
// ailleurs dans l'app (la sidebar y devient une barre d'onglets), plutôt que d'en introduire un de plus.
const COMPACT_BREAKPOINT = 900;

// Vitesses en px/s. Parti de 26 (desktop) et 16 (mobile), relevé une première fois à 34/30, puis à
// 46/42 — le mouvement restait trop lent et trop saccadé sur téléphone. La vitesse joue directement sur
// la fluidité perçue : scrollLeft étant quantifié, la position n'avance que par pas d'un pixel entier,
// et plus la vitesse est basse plus ces pas sont espacés dans le temps. À 16 px/s il fallait 3,75 frames
// par pixel, à 42 px/s il en faut 1,43 — le mouvement se lit alors comme continu. Le palier compact reste
// juste en dessous du desktop parce que ses cartes plus étroites (flex-basis 168 contre 220) défilent
// déjà plus vite en proportion, à vitesse égale.
export default function AutoScrollRow({ items, renderItem, keyFor, speed = 46, mobileSpeed = 42, className = '' }) {
  const trackRef = useRef(null);
  const pausedRef = useRef(false);
  const resumeTimerRef = useRef(null);
  // Position de l'auto-défilement, tenue en pleine précision côté JS (voir l'explication dans l'effet
  // plus bas). Resynchronisée sur le DOM à chaque reprise, sinon la rangée ressauterait là où elle
  // était avant le geste de l'utilisateur.
  const positionRef = useRef(0);
  const canLoop = items.length > 1;
  const doubled = canLoop ? [...items, ...items] : items;

  function pause() {
    clearTimeout(resumeTimerRef.current);
    pausedRef.current = true;
  }

  function resume(delay) {
    clearTimeout(resumeTimerRef.current);
    const go = () => {
      // Reprendre depuis là où l'utilisateur a laissé la rangée, pas depuis la dernière position
      // calculée avant son geste.
      if (trackRef.current) positionRef.current = trackRef.current.scrollLeft;
      pausedRef.current = false;
    };
    if (!delay) { go(); return; }
    resumeTimerRef.current = setTimeout(go, delay);
  }

  // Le minuteur survivrait au démontage et écrirait dans une ref d'un composant disparu (sans planter,
  // mais autant ne pas le laisser courir) — typiquement en changeant de page pendant l'inertie.
  useEffect(() => () => clearTimeout(resumeTimerRef.current), []);

  useEffect(() => {
    const track = trackRef.current;
    if (!track || !canLoop) return undefined;
    // Respecte le réglage système "réduire les animations" : la rangée reste alors immobile, mais
    // toujours défilable au doigt — on ne retire pas l'accès au contenu, seulement le mouvement subi.
    if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) return undefined;

    // Palier de vitesse suivi en continu (et non lu une seule fois au montage) : sans écouteur, faire
    // pivoter un téléphone ou passer une fenêtre d'un côté à l'autre du seuil gardait l'ancienne vitesse
    // jusqu'au prochain remontage du composant.
    const compact = window.matchMedia(`(max-width: ${COMPACT_BREAKPOINT}px)`);
    let effectiveSpeed = compact.matches ? mobileSpeed : speed;
    const onTierChange = () => { effectiveSpeed = compact.matches ? mobileSpeed : speed; };
    compact.addEventListener('change', onTierChange);

    // halfWidth mesuré HORS de la boucle. Lire scrollWidth juste après avoir écrit scrollLeft force un
    // recalcul synchrone de la mise en page, 60 fois par seconde. Mesuré sur cette page : ~1,21 ms par
    // itération avec la lecture contre ~1,11 ms sans, soit environ 8 % du coût par frame — un gain réel
    // mais modeste, l'écriture de scrollLeft dominant le reste. C'est surtout du travail gratuit, la
    // largeur ne changeant qu'à trois occasions, toutes couvertes ci-dessous : redimensionnement du
    // conteneur, arrivée de la police, changement du nombre d'éléments (items.length relance l'effet).
    let halfWidth = track.scrollWidth / 2;
    const measure = () => { halfWidth = track.scrollWidth / 2; };
    // Le seuil des 640px change la largeur des cartes (flex-basis 220 -> 168), donc la largeur totale :
    // observer le conteneur suffit à rattraper tout redimensionnement, y compris ce changement-là.
    const observer = new ResizeObserver(measure);
    observer.observe(track);
    // Les chips de type de commerce n'ont pas de largeur fixe : leur largeur dépend du texte, donc de la
    // police. Tant que la police web n'est pas arrivée, la mesure initiale porte sur la police de repli.
    if (document.fonts && document.fonts.ready) document.fonts.ready.then(measure).catch(() => {});

    let raf;
    let last = null;
    positionRef.current = track.scrollLeft;
    function step(now) {
      if (last === null) last = now;
      const dt = Math.min(0.1, (now - last) / 1000);
      last = now;
      if (!pausedRef.current) {
        // La position vit dans positionRef, en pleine précision, et NON dans track.scrollLeft relu à
        // chaque frame : le navigateur quantifie scrollLeft, donc réinjecter la valeur lue écrasait
        // l'incrément quand celui-ci restait sous le pixel, et la rangée ne bougeait jamais.
        let next = positionRef.current + effectiveSpeed * dt;
        if (halfWidth > 0 && next >= halfWidth) next -= halfWidth;
        positionRef.current = next;
        track.scrollLeft = next;
      }
      raf = requestAnimationFrame(step);
    }
    raf = requestAnimationFrame(step);
    return () => {
      cancelAnimationFrame(raf);
      observer.disconnect();
      compact.removeEventListener('change', onTierChange);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [items.length, canLoop, speed, mobileSpeed]);

  return (
    <div
      ref={trackRef}
      className={`auto-scroll-row ${className}`}
      onMouseEnter={pause}
      onMouseLeave={() => resume(0)}
      onTouchStart={pause}
      onTouchEnd={() => resume(RESUME_AFTER_TOUCH_MS)}
      onTouchCancel={() => resume(RESUME_AFTER_TOUCH_MS)}
    >
      {doubled.map((item, i) => renderItem(item, i, keyFor ? `${keyFor(item)}-${i}` : i))}
    </div>
  );
}
