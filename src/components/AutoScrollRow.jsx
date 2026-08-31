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
export default function AutoScrollRow({ items, renderItem, keyFor, speed = 26, mobileSpeed = 16, className = '' }) {
  const trackRef = useRef(null);
  const pausedRef = useRef(false);
  const canLoop = items.length > 1;
  const doubled = canLoop ? [...items, ...items] : items;

  useEffect(() => {
    const track = trackRef.current;
    if (!track || !canLoop) return undefined;
    const effectiveSpeed = window.innerWidth <= 640 ? mobileSpeed : speed;
    let raf;
    let last = null;
    function step(now) {
      if (last === null) last = now;
      const dt = Math.min(0.1, (now - last) / 1000);
      last = now;
      if (!pausedRef.current) {
        const halfWidth = track.scrollWidth / 2;
        let next = track.scrollLeft + effectiveSpeed * dt;
        if (halfWidth > 0 && next >= halfWidth) next -= halfWidth;
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
      onMouseEnter={() => { pausedRef.current = true; }}
      onMouseLeave={() => { pausedRef.current = false; }}
      onTouchStart={() => { pausedRef.current = true; }}
      onTouchEnd={() => { pausedRef.current = false; }}
    >
      {doubled.map((item, i) => renderItem(item, i, keyFor ? `${keyFor(item)}-${i}` : i))}
    </div>
  );
}
