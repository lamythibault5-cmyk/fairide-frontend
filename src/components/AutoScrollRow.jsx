import { useEffect, useRef } from 'react';

// Rangée à défilement continu ("À découvrir" dans RestaurantList.jsx et RestaurantMenu.jsx, et les chips
// de types de commerce). Le mouvement est porté par `transform: translate3d` sur une piste interne, et
// le glissement au doigt est géré ici plutôt que délégué au défilement natif.
//
// POURQUOI CE CHANGEMENT. Les versions précédentes animaient le scrollLeft natif du conteneur. Mesuré
// dans le navigateur : scrollLeft s'aligne sur le pixel ÉCRAN (pas de 0,8 px à dpr 1,25) alors qu'un
// translate3d conserve la valeur fractionnaire exacte (10,37 px reste 10,37 px). S'y ajoute que chaque
// écriture de scrollLeft passe par le fil principal, quand une transformation est composée par le GPU
// sans calcul de mise en page ni repeinte. C'est la différence entre un mouvement approximé à la
// sous-division de pixel près et un mouvement réellement continu.
//
// POURQUOI GÉRER LE GLISSEMENT NOUS-MÊMES. Laisser le défilement natif actif en parallèle du transform
// ferait cohabiter deux systèmes de coordonnées : la piste translatée sort du domaine défilable, et
// arrivé en bout de course on découvrirait du vide à droite. Avec une seule coordonnée (offsetRef), la
// rangée boucle à l'infini dans les DEUX sens — on peut désormais revenir en arrière indéfiniment, ce
// que l'ancienne version interdisait en butant sur le début.
//
// SUR L'ANCIEN BUG D'AFFICHAGE. Une version encore antérieure animait déjà un transform et faisait
// parfois disparaître la rangée entière. Ce défaut tenait à la combinaison `mask-image` + transform
// animé + `overflow: hidden`. Il n'y a plus de mask-image ici, et le conteneur est en `overflow: clip`,
// qui masque le débordement SANS créer de conteneur de défilement — le même choix, et pour la même
// raison, que sur html/body dans styles.css.

const COMPACT_BREAKPOINT = 900;

// Constante de temps du fondu de vitesse, en secondes : la rangée ne bascule jamais brutalement entre
// arrêt et pleine vitesse, ce qui était la principale cause du rendu mécanique.
const SPEED_RAMP_TAU = 0.5;

// Décroissance de l'inertie après un lâcher de doigt. Plus la valeur est basse, plus le glissement
// s'arrête court ; 2.2 donne une glissade franche sans partir à l'autre bout de la rangée.
const INERTIA_DECAY = 2.2;

// Au-delà de ce déplacement, le geste est un glissement et non un appui : le clic sur la carte est alors
// annulé. En dessous, on laisse passer — sans quoi il deviendrait impossible d'ouvrir une fiche.
const DRAG_SLOP_PX = 8;

const RESUME_AFTER_GESTURE_MS = 700;

export default function AutoScrollRow({ items, renderItem, keyFor, speed = 70, mobileSpeed = 64, className = '' }) {
  const viewportRef = useRef(null);
  const trackRef = useRef(null);
  // Unique coordonnée du système : de combien la piste est décalée vers la gauche, en pixels, en pleine
  // précision. Tout le reste (auto-défilement, glissement, inertie) ne fait qu'agir dessus.
  const offsetRef = useRef(0);
  const halfWidthRef = useRef(0);
  const autoSpeedRef = useRef(0);
  const inertiaRef = useRef(0);
  const pausedRef = useRef(false);
  const resumeTimerRef = useRef(null);
  const dragRef = useRef(null);
  const movedRef = useRef(false);

  const canLoop = items.length > 1;
  const doubled = canLoop ? [...items, ...items] : items;

  useEffect(() => {
    const viewport = viewportRef.current;
    const track = trackRef.current;
    if (!viewport || !track) return undefined;

    const measure = () => { halfWidthRef.current = track.scrollWidth / 2; };
    measure();
    // La largeur ne bouge qu'au redimensionnement (le seuil 640px change la largeur des cartes) et à
    // l'arrivée de la police (les chips n'ont pas de largeur fixe). Mesurer dans la boucle forcerait un
    // calcul de mise en page à chaque frame, exactement ce que ce changement cherche à supprimer.
    const observer = new ResizeObserver(measure);
    observer.observe(track);
    observer.observe(viewport);
    if (document.fonts && document.fonts.ready) document.fonts.ready.then(measure).catch(() => {});

    const compact = window.matchMedia(`(max-width: ${COMPACT_BREAKPOINT}px)`);
    let targetSpeed = compact.matches ? mobileSpeed : speed;
    const onTierChange = () => { targetSpeed = compact.matches ? mobileSpeed : speed; };
    compact.addEventListener('change', onTierChange);

    const reduceMotion = window.matchMedia('(prefers-reduced-motion: reduce)');

    // Ramène l'offset dans [0, halfWidth) : les deux copies du contenu étant identiques, ce repli est
    // invisible, et il fonctionne aussi bien vers l'arrière que vers l'avant.
    function wrap(v) {
      const half = halfWidthRef.current;
      if (half <= 0) return v;
      return ((v % half) + half) % half;
    }

    function paint() {
      track.style.transform = `translate3d(${-offsetRef.current}px, 0, 0)`;
    }

    let raf;
    let last = null;
    function step(now) {
      if (last === null) last = now;
      const dt = Math.min(0.1, (now - last) / 1000);
      last = now;

      if (!dragRef.current) {
        const wanted = (pausedRef.current || (canLoop && reduceMotion.matches)) ? 0 : (canLoop ? targetSpeed : 0);
        autoSpeedRef.current += (wanted - autoSpeedRef.current) * (1 - Math.exp(-dt / SPEED_RAMP_TAU));
        // Inertie du lâcher, en px/s, qui s'éteint exponentiellement et s'ajoute à la vitesse de fond.
        inertiaRef.current *= Math.exp(-dt * INERTIA_DECAY);
        if (Math.abs(inertiaRef.current) < 1) inertiaRef.current = 0;
        const v = autoSpeedRef.current + inertiaRef.current;
        if (v !== 0) {
          offsetRef.current = wrap(offsetRef.current + v * dt);
          paint();
        }
      }
      raf = requestAnimationFrame(step);
    }
    raf = requestAnimationFrame(step);

    function clearResume() { clearTimeout(resumeTimerRef.current); }
    function scheduleResume() {
      clearResume();
      resumeTimerRef.current = setTimeout(() => { pausedRef.current = false; }, RESUME_AFTER_GESTURE_MS);
    }

    function onPointerDown(e) {
      if (e.pointerType === 'mouse' && e.button !== 0) return;
      clearResume();
      pausedRef.current = true;
      // Coupe net vitesse de fond et inertie : sous le doigt, la rangée doit obéir au geste seul.
      autoSpeedRef.current = 0;
      inertiaRef.current = 0;
      movedRef.current = false;
      dragRef.current = { x: e.clientX, y: e.clientY, startX: e.clientX, t: performance.now(), v: 0, captured: false };
    }

    function onPointerMove(e) {
      const d = dragRef.current;
      if (!d) return;
      const dx = e.clientX - d.x;
      const dy = e.clientY - d.y;
      if (!d.captured) {
        // Tant que le geste n'est pas clairement horizontal, on ne le capture pas : un balayage vertical
        // doit continuer de faire défiler la page, pas d'être avalé par la rangée.
        if (Math.abs(e.clientX - d.startX) < DRAG_SLOP_PX) return;
        if (Math.abs(dy) > Math.abs(dx)) { dragRef.current = null; scheduleResume(); return; }
        d.captured = true;
        movedRef.current = true;
        try { viewport.setPointerCapture(e.pointerId); } catch { /* capture non supportée : le glissement fonctionne quand même */ }
      }
      const now = performance.now();
      const dt = Math.max(0.001, (now - d.t) / 1000);
      // Vitesse lissée pour l'inertie : une seule frame isolée donnerait une valeur erratique.
      d.v = 0.7 * d.v + 0.3 * (-dx / dt);
      d.x = e.clientX;
      d.y = e.clientY;
      d.t = now;
      offsetRef.current = wrap(offsetRef.current - dx);
      paint();
    }

    function endDrag(e) {
      const d = dragRef.current;
      if (!d) return;
      dragRef.current = null;
      if (d.captured) {
        inertiaRef.current = Math.max(-2600, Math.min(2600, d.v));
        try { viewport.releasePointerCapture(e.pointerId); } catch { /* rien à libérer */ }
      }
      scheduleResume();
    }

    // Un glissement ne doit pas ouvrir la fiche du commerce survolé au relâchement.
    function onClickCapture(e) {
      if (!movedRef.current) return;
      movedRef.current = false;
      e.preventDefault();
      e.stopPropagation();
    }

    function onEnter() { if (!dragRef.current) { clearResume(); pausedRef.current = true; } }
    function onLeave() { if (!dragRef.current) scheduleResume(); }

    viewport.addEventListener('pointerdown', onPointerDown);
    viewport.addEventListener('pointermove', onPointerMove);
    viewport.addEventListener('pointerup', endDrag);
    viewport.addEventListener('pointercancel', endDrag);
    viewport.addEventListener('click', onClickCapture, true);
    viewport.addEventListener('mouseenter', onEnter);
    viewport.addEventListener('mouseleave', onLeave);

    return () => {
      cancelAnimationFrame(raf);
      clearResume();
      observer.disconnect();
      compact.removeEventListener('change', onTierChange);
      viewport.removeEventListener('pointerdown', onPointerDown);
      viewport.removeEventListener('pointermove', onPointerMove);
      viewport.removeEventListener('pointerup', endDrag);
      viewport.removeEventListener('pointercancel', endDrag);
      viewport.removeEventListener('click', onClickCapture, true);
      viewport.removeEventListener('mouseenter', onEnter);
      viewport.removeEventListener('mouseleave', onLeave);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [items.length, canLoop, speed, mobileSpeed]);

  return (
    <div ref={viewportRef} className={`auto-scroll-row ${className}`}>
      <div ref={trackRef} className="auto-scroll-track">
        {doubled.map((item, i) => renderItem(item, i, keyFor ? `${keyFor(item)}-${i}` : i))}
      </div>
    </div>
  );
}
