// Petits outils de dessin et de hasard partagés par les mini-jeux (jeux.js, rider.js). Pas de React, pas de DOM.
export const aleatoire = (a, b) => a + Math.random() * (b - a);
export const choix = (tab) => tab[Math.floor(Math.random() * tab.length)];
export const lerp = (a, b, k) => a + (b - a) * k;
// Rattrapage exponentiel indépendant de la cadence : k = vitesse (par seconde), dt en secondes.
export const suivre = (courant, cible, k, dt) => courant + (cible - courant) * Math.min(1, dt * k);

// LES EMOJIS NE SE DESSINENT PAS PARTOUT. Sur certains iPhone, fillText() d'un emoji couleur ne
// peint rien du tout : il ne reste que le halo blanc pose dessous, donc des bulles blanches vides a
// la place des obstacles. Le jeu devient litteralement injouable — on ne voit pas ce qu'on doit
// eviter. On ne peut pas corriger la police du systeme ; on peut arreter d'en dependre.
//
// Ce test dessine un emoji hors ecran et relit les pixels. S'il ne peint rien, tous les objets
// passent en formes vectorielles : un disque a la couleur du sujet, avec un detail simple. Moins
// joli que l'emoji, mais VISIBLE — et c'est tout ce qui compte pour jouer. Le resultat est mis en
// cache : ce n'est pas une mesure a refaire soixante fois par seconde.
let _emojiPeint = null;
export function emojiPeint() {
  if (_emojiPeint !== null) return _emojiPeint;
  try {
    const c = document.createElement('canvas');
    c.width = 16; c.height = 16;
    const g = c.getContext('2d', { willReadFrequently: true });
    g.font = '14px "Apple Color Emoji","Segoe UI Emoji","Noto Color Emoji",sans-serif';
    g.textAlign = 'center'; g.textBaseline = 'middle';
    g.fillText('\u{1F680}', 8, 8);
    const d = g.getImageData(0, 0, 16, 16).data;
    _emojiPeint = false;
    for (let i = 3; i < d.length; i += 4) if (d[i] > 12) { _emojiPeint = true; break; }
  } catch {
    // Lecture de pixels refusee : on suppose que oui, c'est le cas courant, plutot que de degrader
    // le rendu de tout le monde pour une mesure impossible.
    _emojiPeint = true;
  }
  return _emojiPeint;
}

// Force le repli, pour le verifier a l'ecran sans attendre d'avoir un iPhone sous la main.
export function forcerRepliEmoji(valeur) { _emojiPeint = !valeur; }

// Couleur de repli, par emoji reellement utilise dans les jeux. Ce qu'on doit eviter doit se
// distinguer de ce qu'on doit attraper : sans emoji, c'est la couleur qui porte cette information.
const REPLI = {
  '\u{1F6A7}': ['#F2A33C', 'barre'], '\u{1FAA8}': ['#8A8377', 'rond'], '\u{1F573}\u{FE0F}': ['#141220', 'trou'],
  '\u{1F525}': ['#F2653C', 'rond'], '\u{1F4A5}': ['#F2C53C', 'rond'],
  '\u{1F6F5}': ['#C8F03C', 'vehicule'], '\u{1F9FA}': ['#C8F03C', 'vehicule'], '\u{1F3AF}': ['#D92D3B', 'cible'],
  '\u{1F355}': ['#F2A33C', 'rond'], '\u{1F354}': ['#E08A3C', 'rond'], '\u{1F35F}': ['#F2C53C', 'barre'],
  '\u{1F369}': ['#E87FB0', 'rond'], '\u{1F363}': ['#F0EDE6', 'rond'], '\u{1F32E}': ['#E0B23C', 'rond'],
  '\u{1F950}': ['#D9A05B', 'rond'], '\u{1F366}': ['#F0D9C0', 'rond'],
  // Déchets de FairSort : teintes sales et sombres, jamais celles d'un plat.
  '\u{1F5D1}\u{FE0F}': ['#6E7480', 'barre'], '\u{1F9A0}': ['#6FAE3A', 'rond'], '\u{1F480}': ['#D8D3C6', 'rond'], '\u{1F9EA}': ['#8E4FC6', 'barre']
};

function forme(ctx, e, taille) {
  const [couleur, genre] = REPLI[e] || ['#B9B3A8', 'rond'];
  const r = taille * 0.42;
  ctx.fillStyle = couleur;
  if (genre === 'barre') {
    ctx.fillRect(-r, -r * 0.55, r * 2, r * 1.1);
    ctx.fillStyle = 'rgba(20,18,31,0.55)';
    for (let i = -1; i <= 1; i++) ctx.fillRect(i * r * 0.6 - r * 0.12, -r * 0.55, r * 0.24, r * 1.1);
    return;
  }
  ctx.beginPath(); ctx.arc(0, 0, r, 0, Math.PI * 2); ctx.fill();
  if (genre === 'trou') {
    // Un trou noir sur un ciel sombre ne se voit pas — c'est precisement le defaut qu'on corrige.
    // Un cerne clair le detache sans le transformer en autre chose qu'un trou.
    ctx.strokeStyle = 'rgba(255,255,255,0.75)'; ctx.lineWidth = Math.max(2, r * 0.18);
    ctx.beginPath(); ctx.arc(0, 0, r * 0.92, 0, Math.PI * 2); ctx.stroke();
    return;
  }
  if (genre === 'vehicule') {
    ctx.fillStyle = 'rgba(20,18,31,0.65)';
    ctx.beginPath(); ctx.arc(0, r * 0.12, r * 0.42, 0, Math.PI * 2); ctx.fill();
    return;
  }
  if (genre === 'cible') {
    ctx.fillStyle = '#FFFFFF';
    ctx.beginPath(); ctx.arc(0, 0, r * 0.58, 0, Math.PI * 2); ctx.fill();
    ctx.fillStyle = couleur;
    ctx.beginPath(); ctx.arc(0, 0, r * 0.26, 0, Math.PI * 2); ctx.fill();
    return;
  }
  ctx.fillStyle = 'rgba(255,255,255,0.28)';
  ctx.beginPath(); ctx.arc(-r * 0.3, -r * 0.32, r * 0.3, 0, Math.PI * 2); ctx.fill();
}

export function emoji(ctx, e, x, y, taille, angle = 0, miroir = false) {
  ctx.save();
  ctx.translate(x, y);
  if (angle) ctx.rotate(angle);
  // Les emojis « véhicule » regardent à gauche dans la plupart des polices : miroir pour aller vers la droite.
  if (miroir) ctx.scale(-1, 1);
  if (!emojiPeint()) {
    forme(ctx, e, taille);
    ctx.restore();
    return;
  }
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

// Le sac isotherme Fairide (iris, « f » lime, anses) : l'avatar des jeux « ça tombe » à la place du panier emoji —
// c'est l'objet qui dit « Fairide » dans la rue. `taille` = hauteur du sac ; le repère est le centre du sac.
export function sacFairide(ctx, x, y, taille, angle = 0) {
  const l = taille * 1.1; const ht = taille; const r = taille * 0.16;
  ctx.save(); ctx.translate(x, y); ctx.rotate(angle);
  // Anses
  ctx.strokeStyle = '#2A2185'; ctx.lineWidth = Math.max(3, taille * 0.09); ctx.lineCap = 'round';
  ctx.beginPath(); ctx.arc(0, -ht * 0.5, l * 0.28, Math.PI, 0); ctx.stroke();
  // Corps
  const g = ctx.createLinearGradient(-l / 2, 0, l / 2, 0);
  g.addColorStop(0, '#4A3ED0'); g.addColorStop(1, '#3B2FB5');
  ctx.fillStyle = g;
  ctx.beginPath();
  if (ctx.roundRect) ctx.roundRect(-l / 2, -ht / 2, l, ht, r);
  else { ctx.moveTo(-l / 2 + r, -ht / 2); ctx.arcTo(l / 2, -ht / 2, l / 2, ht / 2, r); ctx.arcTo(l / 2, ht / 2, -l / 2, ht / 2, r); ctx.arcTo(-l / 2, ht / 2, -l / 2, -ht / 2, r); ctx.arcTo(-l / 2, -ht / 2, l / 2, -ht / 2, r); ctx.closePath(); }
  ctx.fill();
  ctx.strokeStyle = '#14121F'; ctx.lineWidth = Math.max(2, taille * 0.06); ctx.stroke();
  // Rabat
  ctx.fillStyle = 'rgba(0,0,0,.18)'; ctx.fillRect(-l / 2, -ht / 2, l, ht * 0.22);
  // « f » lime
  ctx.fillStyle = LIME; ctx.font = `900 ${Math.round(taille * 0.62)}px system-ui, sans-serif`; ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
  ctx.fillText('f', 0, ht * 0.1);
  // Reflet
  ctx.fillStyle = 'rgba(255,255,255,.14)';
  ctx.beginPath(); ctx.ellipse(-l * 0.28, -ht * 0.1, l * 0.1, ht * 0.28, 0, 0, Math.PI * 2); ctx.fill();
  ctx.restore();
}

export const IRIS = '#3B2FB5';
export const LIME = '#C8F03C';
export const INK = '#14121F';
