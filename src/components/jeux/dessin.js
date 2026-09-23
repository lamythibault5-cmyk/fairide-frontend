// Petits outils de dessin et de hasard partagés par les mini-jeux (jeux.js, rider.js). Pas de React, pas de DOM.
export const aleatoire = (a, b) => a + Math.random() * (b - a);
export const choix = (tab) => tab[Math.floor(Math.random() * tab.length)];
export const lerp = (a, b, k) => a + (b - a) * k;
// Rattrapage exponentiel indépendant de la cadence : k = vitesse (par seconde), dt en secondes.
export const suivre = (courant, cible, k, dt) => courant + (cible - courant) * Math.min(1, dt * k);

// LES EMOJIS NE SE DESSINENT PAS PARTOUT — ET PAS TOUJOURS LÀ OÙ UN TEST LE DIT.
//
// Sur certains iPhone, fillText() d'un emoji couleur ne peint rien. Sur Chrome Android, les jeux restaient vides
// (retour du fondateur, 23/09/2026) alors que l'ancien test passait : il dessinait l'emoji sur un PETIT canvas
// ordinaire, pendant que les jeux le dessinaient sur leur grand canvas OPAQUE (getContext('2d', { alpha: false })),
// un chemin de rendu différent. Le test vérifiait autre chose que ce qu'on affichait.
//
// Désormais chaque emoji est dessiné UNE fois, à sa taille, sur un petit canvas à lui (un « sprite ») ; on relit
// SES pixels ; puis on le recopie dans le jeu avec drawImage(), qui marche partout. Le test porte donc sur l'image
// même qu'on affiche. Un sprite vide → cet objet passe en forme vectorielle (un disque à sa couleur, voir forme()).
// Bonus : un emoji n'est plus remis en forme par la police soixante fois par seconde, seulement recopié.
const SPRITES = new Map(); // clé « emoji|taille arrondie » → canvas, ou null si l'emoji ne se peint pas
const PAS_TAILLE = 4;       // tailles arrondies au multiple de 4 px : quelques sprites par emoji, pas un par image
const DENSITE = 2;          // sprites dessinés en 2× : nets sur écran Retina, sans être lourds

function sprite(e, taille) {
  const t = Math.max(PAS_TAILLE, Math.round(taille / PAS_TAILLE) * PAS_TAILLE);
  const cle = `${e}|${t}`;
  if (SPRITES.has(cle)) return SPRITES.get(cle);
  let rendu = null;
  try {
    const cote = Math.ceil(t * 1.35 * DENSITE);
    const c = document.createElement('canvas');
    c.width = cote; c.height = cote;
    const g = c.getContext('2d', { willReadFrequently: true });
    g.font = `${t * DENSITE}px "Apple Color Emoji","Segoe UI Emoji","Noto Color Emoji",sans-serif`;
    g.textAlign = 'center'; g.textBaseline = 'middle';
    g.fillText(e, cote / 2, cote / 2);
    const d = g.getImageData(0, 0, cote, cote).data;
    for (let k = 3; k < d.length; k += 16) if (d[k] > 12) { rendu = c; break; }
  } catch {
    rendu = null;
  }
  SPRITES.set(cle, rendu);
  return rendu;
}

// Gardé pour les sondes : vrai si l'emoji de référence (🍕) se peint sur ce navigateur.
export function emojiPeint() { return !!sprite('\u{1F355}', 24); }
// Force le repli, pour le vérifier à l'écran sans attendre d'avoir le téléphone en cause sous la main.
let _repliForce = false;
export function forcerRepliEmoji(valeur) { _repliForce = !!valeur; }

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
  const img = _repliForce ? null : sprite(e, taille);
  if (!img) {
    forme(ctx, e, taille);
    ctx.restore();
    return;
  }
  const cote = taille * 1.35;
  ctx.drawImage(img, -cote / 2, -cote / 2, cote, cote);
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

// Difficulté en crescendo : part de `debut` au niveau 0 et tend vers `fin` sans jamais la dépasser (`k` niveaux
// pour parcourir 63 % du chemin). Les premiers niveaux changent doucement, les derniers serrent la vis — et il
// existe une vraie limite : un score infini n'est plus possible, sans que le jeu devienne injuste d'un coup.
export const courbe = (n, debut, fin, k = 6) => fin + (debut - fin) * Math.exp(-Math.max(0, n) / k);

export const IRIS = '#3B2FB5';
export const LIME = '#C8F03C';
export const INK = '#14121F';
