import { useLayoutEffect, useRef, useState } from 'react';
import '../../ecran-commerce.css';

/* LE BANDEAU IRIS ET LA FEUILLE BLANCHE DES ÉCRANS DU COMMERCE (fondateur, 2026-10-16, « Proposition » de la partie
   Commerce de maquettes/tous-les-ecrans/tous-les-ecrans.html ; styles dans ecran-commerce.css). Mon commerce, Commandes, Ma carte et
   Statistiques commencent par <BandeauCommerce> (nom, titre, ce qui se règle d'un geste) puis mettent le reste dans
   <FeuilleCommerce>. DashboardLayout ne pose alors plus le nom du commerce au-dessus de la page (`avecBandeau`). */
export function BandeauCommerce({ children, retour = false }) {
  return <header className={`ec-bandeau${retour ? ' ec-bandeau--retour' : ''}`}>{children}</header>;
}

export function FeuilleCommerce({ children }) {
  return <div className="ec-feuille">{children}</div>;
}

// Le vélo de la marque (BrandMark), en `currentColor` : lime sur le bandeau.
export function VeloMarque({ largeur = 38 }) {
  return (
    <svg viewBox="-3 5 82 42" width={largeur} height={Math.round((largeur * 42) / 82)} aria-hidden="true">
      <g fill="none" stroke="currentColor" strokeWidth="5" strokeLinecap="round"><circle cx="15" cy="29" r="12.5" /><circle cx="61" cy="29" r="12.5" /></g>
      <g fill="currentColor"><rect x="16" y="8" width="44" height="5" rx="2.5" /><g transform="rotate(42 27 22.5)"><rect x="13" y="20" width="28" height="5" rx="2.5" /></g></g>
    </svg>
  );
}

export function CocheTrait({ taille = 12 }) {
  return (
    <svg viewBox="0 0 24 24" width={taille} height={taille} fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <path d="m5 12.5 4.5 4.5L19 7.5" />
    </svg>
  );
}

/* Un choix parmi quelques valeurs, dont le POUCE glisse d'une option à l'autre avec un ressort (temps de préparation,
   période des statistiques). Le pouce est mesuré sur le bouton choisi ; il ne s'anime qu'une fois posé la première fois
   (sinon il partirait du bord gauche à chaque affichage). `lime` : pouce lime sur le bandeau iris. */
export function SegmentGlisse({ options, valeur, onChange, libelle, lime = false, disabled = false }) {
  const boite = useRef(null);
  const [pouce, setPouce] = useState(null);
  useLayoutEffect(() => {
    const el = boite.current;
    if (!el) return undefined;
    const poser = () => {
      const on = el.querySelector('button.on');
      if (on) setPouce((p) => ({ x: on.offsetLeft, l: on.offsetWidth, pret: p !== null }));
    };
    poser();
    const ro = new ResizeObserver(poser);
    ro.observe(el);
    return () => ro.disconnect();
  }, [valeur, options.length]);
  return (
    <div ref={boite} className={`ec-segment${lime ? ' ec-segment--lime' : ''}`} role="group" aria-label={libelle}>
      <span className={`ec-segment-pouce${pouce?.pret ? ' pret' : ''}`} aria-hidden="true"
        style={pouce ? { width: pouce.l, transform: `translateX(${pouce.x}px)` } : undefined} />
      {options.map((o) => (
        <button key={o.value} type="button" className={o.value === valeur ? 'on' : ''} aria-pressed={o.value === valeur}
          disabled={disabled} onClick={() => o.value !== valeur && onChange(o.value)}>{o.label}</button>
      ))}
    </div>
  );
}
