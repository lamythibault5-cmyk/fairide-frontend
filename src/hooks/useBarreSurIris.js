import { useEffect } from 'react';

/* LA BARRE D'APP SUIT CE QU'ELLE SURMONTE (fondateur, 2026-10-19 : « blanche quand dessous c'est blanc, mais quand dessous
 * c'est bleu, toujours bleue »). La barre sans compte de l'app (.appli-barre, Layout.jsx) était blanche partout : au-dessus
 * d'un bandeau iris (Nouveau mot de passe, Valider ma carte…) elle faisait une bande blanche entre la barre d'état et le
 * bandeau. Elle prend maintenant l'iris tant qu'un fond iris passe juste sous elle, et redevient blanche quand le bandeau
 * est remonté en défilant — comme la barre d'état (barreEtat.js), même façon de regarder.
 *
 * On lit ce qui est peint 2 px sous la barre (elementFromPoint au milieu de l'écran) et on remonte jusqu'au premier fond
 * opaque. Une fois par image au plus, et la classe ne change que si la couleur change. */
const IRIS = new Set(['59,47,181', '42,33,133']);

function fondSous(y) {
  let el = document.elementFromPoint(window.innerWidth / 2, y);
  while (el && el !== document.documentElement) {
    const m = getComputedStyle(el).backgroundColor.match(/rgba?\(([^)]+)\)/);
    if (m) {
      const [r, v, b, a = 1] = m[1].split(',').map((x) => Number(x.trim()));
      if (a >= 0.9) return `${r},${v},${b}`;
    }
    el = el.parentElement;
  }
  return null;
}

export default function useBarreSurIris(barre, actif = true) {
  useEffect(() => {
    const el = barre.current;
    if (!actif || !el) return undefined;
    let image = 0;
    let retard = 0;
    const appliquer = () => {
      image = 0;
      const fond = fondSous(el.getBoundingClientRect().bottom + 2);
      el.classList.toggle('sur-iris', fond !== null && IRIS.has(fond));
    };
    const demander = () => { if (!image) image = requestAnimationFrame(appliquer); };
    // Changement d'écran, données arrivées : la page change sans défilement ; un second regard après les animations.
    const demanderApres = () => { demander(); clearTimeout(retard); retard = setTimeout(demander, 450); };
    window.addEventListener('scroll', demander, { capture: true, passive: true });
    window.addEventListener('resize', demanderApres);
    const obs = new MutationObserver(demanderApres);
    obs.observe(document.body, { childList: true, subtree: true });
    demanderApres();
    return () => {
      cancelAnimationFrame(image); clearTimeout(retard);
      window.removeEventListener('scroll', demander, { capture: true });
      window.removeEventListener('resize', demanderApres);
      obs.disconnect();
    };
  }, [barre, actif]);
}
