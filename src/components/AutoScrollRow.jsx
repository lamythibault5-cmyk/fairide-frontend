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

export default function AutoScrollRow({ items, renderItem, keyFor, speed = 26, mobileSpeed = 16, className = '' }) {
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
    const effectiveSpeed = window.innerWidth <= 640 ? mobileSpeed : speed;
    let raf;
    let last = null;
    positionRef.current = track.scrollLeft;
    function step(now) {
      if (last === null) last = now;
      const dt = Math.min(0.1, (now - last) / 1000);
      last = now;
      if (!pausedRef.current) {
        const halfWidth = track.scrollWidth / 2;
        // La position vit dans positionRef, en pleine précision, et NON dans track.scrollLeft relu à
        // chaque frame. À 60 fps l'incrément vaut 0,27 px sur mobile et 0,43 px sur PC : sous le pixel.
        // Le navigateur quantifiant scrollLeft à la relecture, réinjecter la valeur lue écrasait
        // l'incrément à chaque frame et la rangée ne bougeait tout simplement jamais. En accumulant
        // côté JS, la position progresse toujours ; seul l'affichage est quantifié, ce qui est sans
        // conséquence visible.
        let next = positionRef.current + effectiveSpeed * dt;
        if (halfWidth > 0 && next >= halfWidth) next -= halfWidth;
        positionRef.current = next;
        track.scrollLeft = next;
      }
      raf = requestAnimationFrame(step);
    }
    raf = requestAnimationFrame(step);
    return () => cancelAnimationFrame(raf);
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
