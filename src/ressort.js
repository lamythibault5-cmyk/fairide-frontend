// Le ressort des gestes de l'application iOS / Android (phase 2 du plan docs/plan-ux-design-apres-onboarding.md).
//
// POURQUOI UN RESSORT ET PAS UNE TRANSITION CSS. Une transition a une durée fixe et part toujours de zéro : quand on
// lâche une feuille qu'on tirait vite, elle repart lentement, comme si le doigt n'avait rien lancé. Un ressort part de
// la position affichée ET de la vitesse du doigt, et on peut le rattraper en plein vol (« Designing Fluid Interfaces »,
// Apple, WWDC 2018). Les deux réglages sont ceux d'Apple : l'amortissement (1 = sans rebond, < 1 = rebondit) et la
// réponse (en secondes : plus petit = plus vif).
//
// CE FICHIER N'EST JAMAIS CHARGÉ PAR LE SITE. Les composants l'importent avec `import('./ressort')` seulement quand
// estNatif() est vrai : le site web ne télécharge pas un octet de plus (contrainte du fondateur, 2026-10-13).

// Anime `de` → `vers` en appelant `surImage(x)` à chaque image. `vitesse` en px/s (celle du doigt au lâcher).
// Renvoie { arreter } ; `fin` est appelé une fois posé.
export function ressort({ de, vers, vitesse = 0, amortissement = 1, reponse = 0.35, surImage, fin }) {
  const raideur = (2 * Math.PI / reponse) ** 2;
  const frottement = (4 * Math.PI * amortissement) / reponse;
  let x = de; let v = vitesse; let precedent = null; let id = 0; let arrete = false;
  const pas = (t) => {
    if (arrete) return;
    const dt = precedent == null ? 1 / 60 : Math.min((t - precedent) / 1000, 1 / 30);
    precedent = t;
    // Euler semi-implicite : stable aux pas d'une image, et largement assez précis pour l'œil.
    v += (-raideur * (x - vers) - frottement * v) * dt;
    x += v * dt;
    if (Math.abs(x - vers) < 0.5 && Math.abs(v) < 8) { surImage(vers); fin?.(); return; }
    surImage(x);
    id = requestAnimationFrame(pas);
  };
  id = requestAnimationFrame(pas);
  return { arreter: () => { arrete = true; cancelAnimationFrame(id); } };
}

// Où l'élan porterait l'objet si on le laissait glisser (formule de la décélération du défilement d'iOS).
// Décider d'après ce point, et non d'après l'endroit où le doigt s'est levé, c'est ce qui fait qu'un petit coup sec suffit.
export function projeter(vitesse, deceleration = 0.998) {
  return ((vitesse / 1000) * deceleration) / (1 - deceleration);
}

// Résistance au-delà d'une limite : plus on tire, moins ça suit — un bord qui « répond », au lieu d'un arrêt sec.
export function elastique(depassement, dimension, constante = 0.55) {
  return (depassement * dimension * constante) / (dimension + constante * Math.abs(depassement));
}

// Vitesse du doigt en px/s, d'après les derniers points (100 ms) : un seul écart entre deux images est trop bruité.
export function suiviVitesse() {
  const points = [];
  return {
    ajouter(pos) { const t = performance.now(); points.push([t, pos]); while (points.length > 2 && t - points[0][0] > 100) points.shift(); },
    vitesse() {
      if (points.length < 2) return 0;
      const [t0, p0] = points[0]; const [t1, p1] = points[points.length - 1];
      return t1 > t0 ? ((p1 - p0) / (t1 - t0)) * 1000 : 0;
    }
  };
}
