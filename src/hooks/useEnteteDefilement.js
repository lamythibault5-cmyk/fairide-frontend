import { useEffect, useState } from 'react';

// En-tête escamotable : il s'efface quand on descend dans la page et revient dès qu'on remonte.
//
// L'en-tête est collant (`position: sticky` sur .hero) : il reste donc à l'écran en permanence, et
// mange une bande de hauteur sur toutes les pages — celles où l'on veut justement toute la place
// (la carte de suivi et ses mini-jeux, une longue liste de commerces, une carte de restaurant).
// Plutôt que de le supprimer, on le fait glisser hors-champ dans le sens de la lecture : on descend,
// il s'écarte ; on remonte — le geste de quelqu'un qui cherche à naviguer — il est déjà là.
//
// Trois précautions apprises des en-têtes qui clignotent :
//   - au-dessus de `seuil`, il reste toujours visible : en haut de page, il n'y a rien à gagner à le
//     cacher, et le moindre soubresaut le ferait sauter ;
//   - il faut dépasser `marge` pixels dans un sens pour changer d'état, sinon le tremblement d'un
//     doigt sur l'écran suffit à le faire osciller ;
//   - la lecture de scrollY est repoussée dans un requestAnimationFrame : l'évènement `scroll` part
//     bien plus souvent qu'une image, et lire la position force un recalcul de mise en page.
export function useEnteteDefilement({ seuil = 90, marge = 8 } = {}) {
  const [cache, setCache] = useState(false);

  useEffect(() => {
    if (typeof window === 'undefined') return undefined;
    let dernier = window.scrollY;
    let enAttente = false;

    const evaluer = () => {
      const y = Math.max(0, window.scrollY); // le rebond élastique d'iOS donne des valeurs négatives
      const ecart = y - dernier;
      if (y <= seuil) setCache(false);
      else if (ecart > marge) setCache(true);
      else if (ecart < -marge) setCache(false);
      if (Math.abs(ecart) > marge || y <= seuil) dernier = y;
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
