import { useEffect, useLayoutEffect, useRef, useState } from 'react';

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
// 1,1 s (au lieu de 0,5) : la rangée prend son élan et le perd lentement, comme un objet qui a du poids
// (fondateur, 2026-10-05 : « toujours un peu trop mécanique »).
const SPEED_RAMP_TAU = 1.1;

// Décroissance de l'inertie après un lâcher de doigt. Plus la valeur est basse, plus le glissement
// s'arrête court ; 2.2 donne une glissade franche sans partir à l'autre bout de la rangée.
// 1.7 (au lieu de 2.2) : la glissade se prolonge un peu plus avant de s'éteindre.
const INERTIA_DECAY = 1.7;

// Au-delà de ce déplacement, le geste est un glissement et non un appui : le clic sur la carte est alors
// annulé. En dessous, on laisse passer — sans quoi il deviendrait impossible d'ouvrir une fiche.
const DRAG_SLOP_PX = 8;

// Après un geste, la rangée attend avant de repartir : 0,7 s la faisait redémarrer sous le doigt à peine levé.
const RESUME_AFTER_GESTURE_MS = 1800;

/* UNE TRAÎNE, PAS DES COPIES ENTIÈRES (2026-10-27, appli lente). Pour boucler sans trou, la piste était la rangée recopiée
 * deux fois ou plus (au moins 8 cartes) : sur l'accueil, 680 éléments et 23 photos sur 2 042 ne servaient qu'à ça. Or au
 * moment du repli, l'écran ne montre que la fin de la rangée et le début de sa suite : il suffit de faire suivre la rangée de
 * ses premières cartes, autant qu'il en faut pour couvrir la largeur de l'écran (la « traîne », mesurée : 2 sur un
 * téléphone de 390 px, 6 sur un écran de 1 600). La période du repli est la largeur d'UNE rangée, mesurée jusqu'à la première
 * carte de la traîne. La dernière traîne mesurée sert de départ à la rangée suivante : la largeur de l'écran ne change presque
 * jamais, et une traîne juste du premier coup évite de recalculer la mise en page de toute la page pour une carte de plus. */
let traineConnue = 4;

// autoplay=false : la rangée ne bouge pas d'elle-même, mais reste une boucle infinie au doigt, à la
// souris (glisser) et à la molette horizontale — c'est le mode des rangées thématiques ; seule
// « À découvrir » défile en continu.
// Vitesses par défaut : une allure de promenade (une carte toutes les 5 à 6 secondes). À 70 / 64 px par seconde, une
// carte entière passait toutes les 2,5 s — un tapis roulant, pas une vitrine.
export default function AutoScrollRow({ items, renderItem, keyFor, speed = 34, mobileSpeed = 28, className = '', autoplay = true }) {
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
  const n = items.length;
  const [traine, setTraine] = useState(traineConnue);
  const piste = canLoop ? [...items, ...Array.from({ length: traine }, (_, i) => items[i % n])] : items;

  // La période (une rangée) et la traîne qu'il faut pour couvrir l'écran. Avant l'image (useLayoutEffect) : une traîne
  // trop courte au premier rendu ne se voit jamais. Refaite quand le nombre de cartes change, au redimensionnement (l'observateur
  // plus bas) et à l'arrivée des polices.
  const mesurerRef = useRef(() => {});
  useLayoutEffect(() => {
    const viewport = viewportRef.current;
    const track = trackRef.current;
    if (!viewport || !track) return;
    mesurerRef.current = () => {
      const cartes = track.children;
      if (!canLoop || cartes.length <= n) { halfWidthRef.current = track.scrollWidth; return; }
      const debut = cartes[0].offsetLeft;
      const periode = cartes[n].offsetLeft - debut;
      halfWidthRef.current = periode;
      if (periode <= 0) return; // rangée cachée : rien à mesurer
      // Largeur de la carte i, écart compris (la suivante commence là où elle s'arrête).
      const largeur = (i) => (i + 1 < n ? cartes[i + 1].offsetLeft : debut + periode) - cartes[i].offsetLeft;
      let couvert = 0; let k = 0;
      while (couvert < viewport.clientWidth && k < 64) { couvert += largeur(k % n); k += 1; }
      // Une carte de plus : la marge des fractions de pixel.
      const voulue = k + 1;
      traineConnue = voulue;
      setTraine((t) => (t === voulue ? t : voulue));
    };
    mesurerRef.current();
  }, [n, traine, canLoop]);

  useEffect(() => {
    const viewport = viewportRef.current;
    const track = trackRef.current;
    if (!viewport || !track) return undefined;

    const measure = () => mesurerRef.current();
    // La largeur ne bouge qu'au redimensionnement (le seuil 640px change la largeur des cartes) et à
    // l'arrivée de la police (les chips n'ont pas de largeur fixe). Mesurer dans la boucle forcerait un
    // calcul de mise en page à chaque frame, exactement ce que ce changement cherche à supprimer.
    const observer = new ResizeObserver(measure);
    observer.observe(track);
    observer.observe(viewport);
    if (document.fonts && document.fonts.ready) document.fonts.ready.then(measure).catch(() => {});

    const compact = window.matchMedia(`(max-width: ${COMPACT_BREAKPOINT}px)`);
    const vitesseCible = () => (autoplay ? (compact.matches ? mobileSpeed : speed) : 0);
    let targetSpeed = vitesseCible();
    const onTierChange = () => { targetSpeed = vitesseCible(); relancer(); };
    compact.addEventListener('change', onTierChange);

    const reduceMotion = window.matchMedia('(prefers-reduced-motion: reduce)');

    // HORS DE L'ÉCRAN, LA RANGÉE S'ARRÊTE. Elle tournait en continu même invisible (batterie), et surtout elle était
    // déjà lancée à pleine vitesse quand on arrivait dessus. Elle démarre maintenant en douceur au moment où elle
    // entre dans l'écran (fondu de vitesse ci-dessous), et se pose quand elle en sort.
    let visible = true;
    let vue = null;
    // « visible » reste vrai tant que le navigateur n'a rien dit : si l'observateur ne répond jamais, la rangée défile
    // comme avant plutôt que de rester figée.
    if (typeof IntersectionObserver !== 'undefined') {
      vue = new IntersectionObserver((entrees) => { visible = entrees.some((e) => e.isIntersecting); relancer(); }, { threshold: 0.15 });
      vue.observe(viewport);
    }

    // Ramène l'offset dans [0, halfWidth) — une rangée : la traîne reprenant ses premières cartes, ce repli est
    // invisible, et il fonctionne aussi bien vers l'arrière que vers l'avant.
    function wrap(v) {
      const half = halfWidthRef.current;
      if (half <= 0) return v;
      return ((v % half) + half) % half;
    }

    function paint() {
      track.style.transform = `translate3d(${-offsetRef.current}px, 0, 0)`;
    }

    /* LA BOUCLE S'ARRÊTE QUAND RIEN NE BOUGE (2026-10-23, app iPhone lente). Elle tournait à chaque image pour toute la vie
     * de la page — rangées immobiles (autoplay=false) et rangées sorties de l'écran comprises — et la vitesse de fond, qui
     * décroît en exponentielle, n'atteignait jamais exactement 0 : la piste recevait une nouvelle transformation à chaque
     * image, d'un millionième de pixel (mesuré : 164 écritures en 4 s de défilement d'une fiche), et le navigateur
     * recomposait la page pour rien. Maintenant la vitesse tombe à 0 sous 0,5 px/s, la boucle s'endort quand il n'y a ni
     * vitesse, ni inertie, ni rien à rattraper, et tout ce qui peut la remettre en route la relance (entrée dans l'écran,
     * reprise après un geste, lâcher avec élan, changement de taille d'écran). Pendant un glissement, pointermove peint lui-même. */
    let raf = 0;
    let last = null;
    function step(now) {
      raf = 0;
      if (last === null) last = now;
      const dt = Math.min(0.1, (now - last) / 1000);
      last = now;
      if (dragRef.current) return;

      const wanted = (pausedRef.current || !visible || (canLoop && reduceMotion.matches)) ? 0 : (canLoop ? targetSpeed : 0);
      // Sortie de l'écran, la rangée s'arrête net : personne ne voit son ralenti, qui faisait encore 4 s de peinture.
      if (!visible) { autoSpeedRef.current = 0; inertiaRef.current = 0; }
      autoSpeedRef.current += (wanted - autoSpeedRef.current) * (1 - Math.exp(-dt / SPEED_RAMP_TAU));
      if (wanted === 0 && Math.abs(autoSpeedRef.current) < 0.5) autoSpeedRef.current = 0;
      // Inertie du lâcher, en px/s, qui s'éteint exponentiellement et s'ajoute à la vitesse de fond.
      inertiaRef.current *= Math.exp(-dt * INERTIA_DECAY);
      if (Math.abs(inertiaRef.current) < 1) inertiaRef.current = 0;
      const v = autoSpeedRef.current + inertiaRef.current;
      if (v !== 0) {
        offsetRef.current = wrap(offsetRef.current + v * dt);
        paint();
      }
      if (v !== 0 || wanted !== 0) raf = requestAnimationFrame(step);
    }
    function relancer() {
      if (raf || dragRef.current) return;
      last = null;
      raf = requestAnimationFrame(step);
    }
    relancer();

    function clearResume() { clearTimeout(resumeTimerRef.current); }
    function scheduleResume() {
      clearResume();
      resumeTimerRef.current = setTimeout(() => { pausedRef.current = false; relancer(); }, RESUME_AFTER_GESTURE_MS);
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
      relancer();
      scheduleResume();
    }

    // Un glissement ne doit pas ouvrir la fiche du commerce survolé au relâchement.
    function onClickCapture(e) {
      if (!movedRef.current) return;
      movedRef.current = false;
      e.preventDefault();
      e.stopPropagation();
    }

    // Molette ou pavé tactile horizontal : on décale la piste directement. Le vertical n'est pas touché,
    // la page continue de défiler normalement.
    function onWheel(e) {
      if (Math.abs(e.deltaX) <= Math.abs(e.deltaY) || !canLoop) return;
      e.preventDefault();
      offsetRef.current = wrap(offsetRef.current + e.deltaX);
      paint();
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
    // Clavier (WCAG 2.2.2, audit du 15/10/2026) : une carte atteinte avec Tab arrête la rangée, comme le survol ; elle
    // repart quand le focus en sort. Sans ça, la carte focalisée filait hors de l'écran sous les yeux.
    viewport.addEventListener('focusin', onEnter);
    viewport.addEventListener('focusout', onLeave);
    viewport.addEventListener('wheel', onWheel, { passive: false });

    return () => {
      cancelAnimationFrame(raf);
      clearResume();
      observer.disconnect();
      vue?.disconnect();
      compact.removeEventListener('change', onTierChange);
      viewport.removeEventListener('pointerdown', onPointerDown);
      viewport.removeEventListener('pointermove', onPointerMove);
      viewport.removeEventListener('pointerup', endDrag);
      viewport.removeEventListener('pointercancel', endDrag);
      viewport.removeEventListener('click', onClickCapture, true);
      viewport.removeEventListener('mouseenter', onEnter);
      viewport.removeEventListener('mouseleave', onLeave);
      viewport.removeEventListener('focusin', onEnter);
      viewport.removeEventListener('focusout', onLeave);
      viewport.removeEventListener('wheel', onWheel);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [items.length, canLoop, speed, mobileSpeed, autoplay]);

  return (
    <div ref={viewportRef} className={`auto-scroll-row ${className}${autoplay ? '' : ' auto-scroll-static'}`}>
      <div ref={trackRef} className="auto-scroll-track">
        {piste.map((item, i) => renderItem(item, i, keyFor ? `${keyFor(item)}-${i}` : i))}
      </div>
    </div>
  );
}
