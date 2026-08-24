import { useEffect, useRef, useState } from 'react';

// Toutes les instances de Reveal partagent UNE seule boucle de scroll/rAF (plutôt qu'un listener par
// élément) — évite le layout thrashing avec ~17 sections sur la page d'accueil et garde tout parfaitement
// synchronisé au même frame.
const updaters = new Set();
let rafId = null;
function scheduleTick() {
  if (rafId != null) return;
  rafId = requestAnimationFrame(() => {
    rafId = null;
    updaters.forEach((fn) => fn());
  });
}

// Smootherstep (Ken Perlin) : dérivée nulle aux deux bornes, une transition bien plus douce qu'un
// cubic-bezier appliqué à une durée fixe — ici appliquée à la progression du SCROLL lui-même, pas au
// temps. C'est ce qui change tout : une transition CSS à durée fixe tourne sur sa propre horloge, donc
// si on scrolle vite elle "rattrape" en retard et ça donne cette impression saccadée/robotique. En
// recalculant opacité/position à chaque frame en fonction de la position réelle de l'élément, l'animation
// reste collée au geste de scroll — aucun décalage possible, quelle que soit la vitesse.
function smootherstep(p) {
  return p * p * p * (p * (p * 6 - 15) + 10);
}

export default function Reveal({ children, className = '', delay = 0, as: Tag = 'div', style, ...rest }) {
  const ref = useRef(null);
  const [reduced] = useState(() => typeof window !== 'undefined' && window.matchMedia('(prefers-reduced-motion: reduce)').matches);

  useEffect(() => {
    if (reduced) return;
    const el = ref.current;
    if (!el) return;

    function update() {
      const rect = el.getBoundingClientRect();
      const vh = window.innerHeight || document.documentElement.clientHeight;
      // Fenêtre de révélation : commence quand le haut de l'élément atteint 92% de la hauteur de
      // l'écran (encore bien en dessous, pour ne rien couper), termine à 55% (un peu avant le centre) —
      // `delay` (px) décale cette fenêtre plus bas pour étaler les cartes d'une même grille dans le temps.
      const start = vh * 0.92 + delay;
      const end = vh * 0.55 + delay;
      const raw = (start - rect.top) / (start - end || 1);
      const p = raw < 0 ? 0 : raw > 1 ? 1 : raw;
      const eased = smootherstep(p);
      el.style.opacity = eased;
      el.style.transform = `translateY(${(1 - eased) * 30}px) scale(${0.965 + eased * 0.035})`;
    }

    updaters.add(update);
    scheduleTick();
    window.addEventListener('scroll', scheduleTick, { passive: true });
    window.addEventListener('resize', scheduleTick);
    return () => {
      updaters.delete(update);
      window.removeEventListener('scroll', scheduleTick);
      window.removeEventListener('resize', scheduleTick);
    };
  }, [reduced, delay]);

  return (
    <Tag
      ref={ref}
      className={`reveal${className ? ` ${className}` : ''}`}
      style={reduced ? style : { ...style, opacity: 0, willChange: 'opacity, transform' }}
      {...rest}
    >
      {children}
    </Tag>
  );
}
