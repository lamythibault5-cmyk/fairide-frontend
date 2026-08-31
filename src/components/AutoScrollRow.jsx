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
const RESUME_AFTER_TOUCH_MS = 900;

// Constante de temps du fondu de vitesse, en secondes. La rangée ne connaissait que deux états — pleine
// vitesse ou arrêt total : elle se figeait net sous le doigt puis repartait net. C'est ce basculement
// binaire qui donnait le côté mécanique, bien plus que la vitesse elle-même. Elle ralentit et réaccélère
// désormais progressivement. 0,45 s donne une décélération franchement perceptible sans donner
// l'impression que la rangée traîne à obéir.
const SPEED_RAMP_TAU = 0.45;

// Seuil du palier "compact". 900px et non 640 : la tablette héritait jusqu'ici de la vitesse desktop
// alors qu'elle a la même contrainte de fluidité que le téléphone. C'est aussi le seuil déjà retenu
// ailleurs dans l'app (la sidebar y devient une barre d'onglets), plutôt que d'en introduire un de plus.
const COMPACT_BREAKPOINT = 900;

// Vitesses en px/s, relevées par paliers successifs depuis 26/16 à l'origine.
//
// RECTIFICATIF : les versions précédentes de ce commentaire justifiaient ces hausses par une
// quantification de scrollLeft au pixel ENTIER. C'est faux, vérifié depuis dans le navigateur —
// scrollLeft accepte bien des valeurs fractionnaires, simplement alignées sur le pixel ÉCRAN : pas de
// 0,8 px à dpr 1,25, de 0,33 px à dpr 3. Sur un téléphone la position avance donc à chaque frame dès
// une vingtaine de px/s, et le rendu mécanique ne venait pas de là mais de l'absence de tout fondu à
// l'arrêt et à la reprise (voir SPEED_RAMP_TAU ci-dessus). Le palier compact reste juste sous le desktop :
// ses cartes plus étroites (flex-basis 168 contre 220) défilent déjà plus vite en proportion.
export default function AutoScrollRow({ items, renderItem, keyFor, speed = 56, mobileSpeed = 52, className = '' }) {
  const trackRef = useRef(null);
  const pausedRef = useRef(false);
  const resumeTimerRef = useRef(null);
  // Position de l'auto-défilement, tenue en pleine précision côté JS (voir l'explication dans l'effet
  // plus bas). Resynchronisée sur le DOM à chaque reprise, sinon la rangée ressauterait là où elle
  // était avant le geste de l'utilisateur.
  const positionRef = useRef(0);
  // Vitesse instantanée, distincte de la vitesse visée : c'est l'écart entre les deux qui est lissé.
  const currentSpeedRef = useRef(0);
  const canLoop = items.length > 1;
  const doubled = canLoop ? [...items, ...items] : items;

  // `immediate` coupe la vitesse d'un coup au lieu de la laisser redescendre en fondu. Indispensable au
  // toucher : tant que le doigt est posé, la moindre écriture de scrollLeft de notre part contrarierait
  // le geste. À la souris au contraire, rien ne conflicte — le survol peut donc ralentir en douceur.
  function pause({ immediate = false } = {}) {
    clearTimeout(resumeTimerRef.current);
    pausedRef.current = true;
    if (immediate) currentSpeedRef.current = 0;
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
      // Fondu exponentiel vers la vitesse visée (0 en pause) au lieu d'un basculement binaire : c'est ce
      // qui retire le côté robotique. Formule indépendante de la cadence d'affichage, donc ressenti
      // identique à 60 comme à 120 Hz.
      const target = pausedRef.current ? 0 : effectiveSpeed;
      currentSpeedRef.current += (target - currentSpeedRef.current) * (1 - Math.exp(-dt / SPEED_RAMP_TAU));

      // Sous ce seuil le mouvement n'est plus perceptible : on cesse d'écrire pour laisser le défilement
      // natif de l'utilisateur entièrement libre, plutôt que de le contrarier avec un résidu de vitesse.
      if (currentSpeedRef.current > 0.4) {
        // La position vit dans positionRef, en pleine précision, et non dans track.scrollLeft relu à
        // chaque frame : la relecture est alignée sur le pixel écran, ce qui rognerait l'incrément.
        let next = positionRef.current + currentSpeedRef.current * dt;
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
      onMouseEnter={() => pause()}
      onMouseLeave={() => resume(0)}
      onTouchStart={() => pause({ immediate: true })}
      onTouchEnd={() => resume(RESUME_AFTER_TOUCH_MS)}
      onTouchCancel={() => resume(RESUME_AFTER_TOUCH_MS)}
    >
      {doubled.map((item, i) => renderItem(item, i, keyFor ? `${keyFor(item)}-${i}` : i))}
    </div>
  );
}
