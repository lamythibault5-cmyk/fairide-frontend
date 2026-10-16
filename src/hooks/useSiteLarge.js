import { useEffect, useState } from 'react';
import { experienceApp } from '../natif';

/* LE SITE SUR UN ORDINATEUR (fondateur, 2026-10-16, lot « liste » de mockups/site-ordinateur.html). Vrai seulement sur le
 * SITE, dans une fenêtre d'au moins `min` px : l'app ne change pas, quelle que soit la largeur de l'écran (une tablette en
 * mode app garde ses rangées et ses pastilles). Suit le redimensionnement de la fenêtre. Utilisé par la liste des
 * commerces (RestaurantList.jsx) et la carte (MapPage.jsx) ; src/site-liste.css porte la mise en page, sous html:not(.appli). */
export function useSiteLarge(min) {
  const requete = `(min-width: ${min}px)`;
  const [large, setLarge] = useState(() => {
    try { return !experienceApp() && window.matchMedia(requete).matches; } catch { return false; }
  });
  useEffect(() => {
    if (experienceApp() || typeof window.matchMedia !== 'function') return undefined;
    const mq = window.matchMedia(requete);
    const suivre = () => setLarge(mq.matches);
    suivre();
    mq.addEventListener?.('change', suivre);
    return () => mq.removeEventListener?.('change', suivre);
  }, [requete]);
  return large;
}
