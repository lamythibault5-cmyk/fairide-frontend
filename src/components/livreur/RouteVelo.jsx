/* LE VÉLO SUR SA ROUTE, côté livreur (fondateur, 2026-10-16, mockups/tous-les-ecrans.html, partie Livreur).
 *
 * Le vélo « 5a » de la marque (BrandMark.jsx, sans tuile), à la couleur du texte : lime sur le bandeau iris. Il est posé
 * sur une route en pointillés, à `position` % de sa longueur. `roule` : la route défile sous ses roues et il pédale (le
 * livreur est disponible, ou en route vers le client). `saut` : un petit bond à l'arrivée (course livrée), après le
 * trajet. Le déplacement est une transition CSS sur `left` : tant que l'élément reste monté (même `key`), changer
 * `position` le fait rouler de l'ancien point au nouveau ; `depart` : à l'arrivée sur l'écran, il part de là (en route
 * vers le client : il quitte le commerce). Styles : ecran-livreur.css. Décoratif : aria-hidden. */
import { useEffect, useState } from 'react';

export function VeloMarque({ largeur = 42 }) {
  return (
    <svg viewBox="-3 5 82 42" width={largeur} height={Math.round((largeur * 42) / 82)} aria-hidden="true" focusable="false">
      <g fill="none" stroke="currentColor" strokeWidth="5" strokeLinecap="round"><circle cx="15" cy="29" r="12.5" /><circle cx="61" cy="29" r="12.5" /></g>
      <g fill="currentColor"><rect x="16" y="8" width="44" height="5" rx="2.5" /><g transform="rotate(42 27 22.5)"><rect x="13" y="20" width="28" height="5" rx="2.5" /></g></g>
    </svg>
  );
}

export default function RouteVelo({ position = 50, depart, roule = false, saut = false, pause = false }) {
  const [pos, setPos] = useState(depart ?? position);
  // Deux images d'attente : le navigateur doit avoir peint le point de départ pour que la transition joue.
  useEffect(() => {
    let id = requestAnimationFrame(() => { id = requestAnimationFrame(() => setPos(position)); });
    return () => cancelAnimationFrame(id);
  }, [position]);
  return (
    <div className={`ecl-route${roule ? ' roule' : ''}${saut ? ' saut' : ''}${pause ? ' pause' : ''}`} aria-hidden="true">
      <span className="ecl-voie" />
      <span className="ecl-velo" style={{ left: `${pos}%` }}><VeloMarque /></span>
    </div>
  );
}
