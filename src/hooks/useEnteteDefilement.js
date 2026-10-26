import { useEffect, useLayoutEffect, useRef, useState } from 'react';

// En-tête escamotable : il s'efface quand on descend dans la page et revient dès qu'on remonte.
//
// L'en-tête est collant (`position: sticky` sur .hero) : il reste donc à l'écran en permanence, et
// mange une bande de hauteur sur toutes les pages — celles où l'on veut justement toute la place
// (la carte de suivi et ses mini-jeux, une longue liste de commerces, une carte de restaurant).
// Plutôt que de le supprimer, on le fait glisser hors-champ dans le sens de la lecture : on descend,
// il s'écarte ; on remonte — le geste de quelqu'un qui cherche à naviguer — il est déjà là.
//
// Trois précautions apprises des en-têtes qui clignotent :
//   - au-dessus de `seuil` (et de sa propre hauteur), il reste toujours visible : en haut de page, il n'y a rien à gagner à le
//     cacher, et le moindre soubresaut le ferait sauter ;
//   - il faut dépasser `marge` pixels dans un sens pour changer d'état, sinon le tremblement d'un
//     doigt sur l'écran suffit à le faire osciller ;
//   - la lecture de scrollY est repoussée dans un requestAnimationFrame : l'évènement `scroll` part
//     bien plus souvent qu'une image, et lire la position force un recalcul de mise en page.
//
// `cle` (l'adresse de la page, barre d'onglets de l'app) : RIEN NE SE RÉDUIT SANS LE DOIGT (fondateur, 2026-10-26 : un onglet,
// puis Restaurants, et la barre du bas se retrouvait réduite sans qu'il ait fait défiler — environ une fois sur dix). Revenir
// sur un onglet remet la page où on l'avait laissée (ScrollRestorer.jsx, plusieurs reprises pendant le chargement) : ce saut
// vers le bas passait pour un défilement. Au changement de `cle`, la barre reprend sa taille, et les mouvements de la page
// ne la changent plus tant que la personne n'a ni touché l'écran, ni fait défiler à la molette, ni tapé une touche.
const GESTES = ['touchstart', 'wheel', 'keydown', 'pointerdown'];

export function useEnteteDefilement({ seuil = 90, marge = 8, cle } = {}) {
  const [cache, setCache] = useState(false);
  const libre = useRef(true);

  useLayoutEffect(() => {
    if (cle === undefined) return undefined;
    libre.current = false;
    setCache(false);
    const lacher = () => { libre.current = true; };
    GESTES.forEach((g) => window.addEventListener(g, lacher, { passive: true, capture: true }));
    return () => GESTES.forEach((g) => window.removeEventListener(g, lacher, { capture: true }));
  }, [cle]);

  useEffect(() => {
    if (typeof window === 'undefined') return undefined;
    let dernier = window.scrollY;
    let enAttente = false;

    const evaluer = () => {
      const y = Math.max(0, window.scrollY); // le rebond élastique d'iOS donne des valeurs négatives
      const ecart = y - dernier;
      // Jamais caché tant que sa place dans la page est encore visible : sinon il laisse un trou à sa place.
      const plancher = Math.max(seuil, document.querySelector('.hero')?.offsetHeight || 0);
      if (y <= plancher) setCache(false);
      else if (!libre.current) { dernier = y; enAttente = false; return; }
      else if (ecart > marge) setCache(true);
      else if (ecart < -marge) setCache(false);
      if (Math.abs(ecart) > marge || y <= plancher) dernier = y;
      enAttente = false;
    };

    const surDefilement = () => {
      if (enAttente) return;
      enAttente = true;
      window.requestAnimationFrame(evaluer);
    };

    window.addEventListener('scroll', surDefilement, { passive: true });
    return () => window.removeEventListener('scroll', surDefilement);
  }, [seuil, marge]);

  return cache;
}
