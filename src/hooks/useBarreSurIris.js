import { useEffect } from 'react';

/* LA BARRE D'APP SUIT CE QU'ELLE SURMONTE (fondateur, 2026-10-19 : « blanche quand dessous c'est blanc, mais quand dessous
 * c'est bleu, toujours bleue »). La barre sans compte de l'app (.appli-barre, Layout.jsx) était blanche partout : au-dessus
 * d'un bandeau iris (Nouveau mot de passe, Valider ma carte…) elle faisait une bande blanche entre la barre d'état et le
 * bandeau. Elle prend maintenant l'iris tant qu'un fond iris passe juste sous elle, et redevient blanche quand le bandeau
 * est remonté en défilant — comme la barre d'état (barreEtat.js), même façon de regarder.
 *
 * On lit ce qui est peint 2 px sous la barre (elementFromPoint au milieu de l'écran) et on remonte jusqu'au premier fond
 * opaque. Toutes les 120 ms au plus pendant un défilement (regardSousBarre.js, 2026-10-20 : c'était à chaque image), et la
 * classe ne change que si la couleur change. */
import { IRIS, fondSous, surveillerSousBarre } from '../regardSousBarre';

export default function useBarreSurIris(barre, actif = true) {
  useEffect(() => {
    const el = barre.current;
    if (!actif || !el) return undefined;
    return surveillerSousBarre(() => {
      const fond = fondSous(el.getBoundingClientRect().bottom + 2);
      el.classList.toggle('sur-iris', fond !== null && IRIS.has(fond));
    });
  }, [barre, actif]);
}
