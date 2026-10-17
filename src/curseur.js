// La partie remplie d'un curseur (input type="range"), de la gauche jusqu'au bouton. Safari et Chrome ne savent pas la
// colorier seuls une fois le curseur redessiné (styles.css, « Contrôles natifs ») : on leur passe le pourcentage dans
// --pct. Firefox a son propre ::-moz-range-progress et n'en a pas besoin.
export function remplissage(valeur, min, max, style = {}) {
  const v = Number(valeur); const a = Number(min); const b = Number(max);
  const pct = b > a ? Math.min(100, Math.max(0, ((v - a) / (b - a)) * 100)) : 0;
  return { ...style, '--pct': `${pct}%` };
}
