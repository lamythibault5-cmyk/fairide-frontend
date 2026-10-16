import { useEffect, useRef } from 'react';

/* Un montant dont les chiffres ROULENT quand il change (fondateur, 2026-10-16, mockups/autres-idees.html 2C et 3C) : seul le
   chiffre qui a changé remonte, les autres restent. Sa clé porte le caractère : un chiffre différent est un nouvel élément,
   donc l'animation (.chiffre-roulant.roule, styles.css) rejoue. Sert à la barre du panier et au bouton de la fiche d'un plat. */
export default function ChiffresRoulants({ valeur }) {
  const avant = useRef(valeur);
  const ancien = avant.current;
  useEffect(() => { avant.current = valeur; }, [valeur]);
  const decalage = valeur.length - ancien.length;
  return [...valeur].map((c, i) => (
    <span key={`${i}-${c}`} className={`chiffre-roulant${ancien[i - decalage] !== c ? ' roule' : ''}`}>{c === ' ' ? ' ' : c}</span>
  ));
}
