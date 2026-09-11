// Petits outils de dessin et de hasard partagés par les mini-jeux (jeux.js, rider.js). Pas de React, pas de DOM.
export const aleatoire = (a, b) => a + Math.random() * (b - a);
export const choix = (tab) => tab[Math.floor(Math.random() * tab.length)];
export const lerp = (a, b, k) => a + (b - a) * k;
// Rattrapage exponentiel indépendant de la cadence : k = vitesse (par seconde), dt en secondes.
export const suivre = (courant, cible, k, dt) => courant + (cible - courant) * Math.min(1, dt * k);

export function emoji(ctx, e, x, y, taille, angle = 0, miroir = false) {
  ctx.save();
  ctx.translate(x, y);
  if (angle) ctx.rotate(angle);
  // Les emojis « véhicule » regardent à gauche dans la plupart des polices : miroir pour aller vers la droite.
  if (miroir) ctx.scale(-1, 1);
  ctx.font = `${taille}px "Apple Color Emoji","Segoe UI Emoji","Noto Color Emoji",sans-serif`;
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.fillText(e, 0, 0);
  ctx.restore();
}

// Pastille lumineuse posée DERRIÈRE un objet. Sur les ciels sombres des jeux, un emoji sombre
// (🍩, 🪨, 🛵, le panier violet) se confondait avec le décor : on ne voyait littéralement pas ce qui
// tombait. Un dégradé radial très doux le détache du fond sans le cerner d'un trait, qui aurait durci
// le dessin. rgb = composantes seules (« 255,255,255 »), force = opacité au centre.
export function halo(ctx, x, y, r, rgb = '255,255,255', force = 0.5) {
  const g = ctx.createRadialGradient(x, y, r * 0.08, x, y, r);
  g.addColorStop(0, `rgba(${rgb},${force})`);
  g.addColorStop(0.55, `rgba(${rgb},${(force * 0.4).toFixed(3)})`);
  g.addColorStop(1, `rgba(${rgb},0)`);
  ctx.fillStyle = g;
  ctx.beginPath(); ctx.arc(x, y, r, 0, Math.PI * 2); ctx.fill();
}

export function fondDegrade(ctx, w, h, haut, bas) {
  const g = ctx.createLinearGradient(0, 0, 0, h);
  g.addColorStop(0, haut);
  g.addColorStop(1, bas);
  ctx.fillStyle = g;
  ctx.fillRect(0, 0, w, h);
}

export const IRIS = '#3B2FB5';
export const LIME = '#C8F03C';
export const INK = '#14121F';
