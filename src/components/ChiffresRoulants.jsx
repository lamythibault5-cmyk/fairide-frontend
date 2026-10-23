import { useState } from 'react';

/* Un montant dont les chiffres ROULENT quand il change (fondateur, 2026-10-16, maquettes/autres-idees/autres-idees.html 2C et 3C) : seul le
   chiffre qui a changé remonte, les autres restent. Sa clé porte le caractère : un chiffre différent est un nouvel élément,
   donc l'animation (.chiffre-roulant.roule, styles.css) rejoue. Sert à la barre du panier et au bouton de la fiche d'un plat.
   LES CHIFFRES QUI ROULENT SONT RETENUS JUSQU'AU CHANGEMENT SUIVANT (2026-10-23). L'ancienne valeur était notée dans un effet,
   juste après le rendu : le moindre second rendu (le rebond de la barre du panier, qui suit chaque ajout) comparait la valeur
   à elle-même et retirait `roule` aussitôt — le total ne roulait jamais. C'est le schéma de React « garder une information du
   rendu précédent » : la comparaison se fait une fois, quand la valeur change, et son résultat reste. */
export default function ChiffresRoulants({ valeur }) {
  const [precedente, setPrecedente] = useState(valeur);
  const [roulent, setRoulent] = useState(() => new Set());
  if (precedente !== valeur) {
    const decalage = valeur.length - precedente.length;
    setRoulent(new Set([...valeur].flatMap((c, i) => (precedente[i - decalage] !== c ? [i] : []))));
    setPrecedente(valeur);
  }
  return [...valeur].map((c, i) => (
    <span key={`${i}-${c}`} className={`chiffre-roulant${roulent.has(i) ? ' roule' : ''}`}>{c === ' ' ? ' ' : c}</span>
  ));
}
