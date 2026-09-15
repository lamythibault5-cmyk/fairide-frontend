import { aleatoire, choix, suivre, emoji, fondDegrade, halo, IRIS, LIME, INK } from './dessin';

// FairRider — le vélo sur la piste, façon « Rider » : UNE seule commande.
//
// Maintenir (doigt, souris, Espace) = gaz au sol (on accélère jusqu'au plafond du niveau) ET, en l'air,
// rotation arrière continue (backflip) avec inertie. Relâcher = on roule sur l'erre au sol / on arrête de
// tourner en l'air (la rotation s'amortit et le vélo se stabilise doucement). Un tap vaut un appui court.
// Pas de bouton de saut : ce sont les tremplins, les crêtes prises vite, les trous et les falaises qui font
// décoller. Le risque, c'est l'atterrissage : retomber à peu près dans l'axe de la pente = propre ; trop de
// travers = chute. Chaque backflip complet en l'air = +1 (double = +2, triple = +3…), sans plafond.
//
// Unités : U = min(largeur, 1,1 × hauteur). Toutes les grandeurs ci-dessous sont en fraction de U (par
// seconde ou par seconde²), sauf les angles (radians) et les durées (secondes). Positions monde en px,
// y vers le bas comme le canvas ; un angle négatif = nez qui se lève.

// ---------- Réglages (à ajuster ici, nulle part ailleurs) ----------
// Tranche d'intégration de la physique : 1/120 s. Deux fois la cadence d'un écran ordinaire, assez
// fin pour que les contacts au sol et les réceptions ne dépendent plus du moment où l'image tombe,
// assez large pour rester à deux pas par image (mesuré au banc d'essai, coût négligeable).
const PAS_PHYSIQUE = 1 / 120;
// Retard maximal rattrapé d'un coup : au-delà (onglet en arrière-plan, longue pause), on laisse filer
// plutôt que de rejouer trente tranches d'affilée — la moto ferait un bond.
const ACCUM_MAX = 0.25;
const GRAVITE = 1.15; // g, en U/s² : assez lourd pour qu'on sente le poids du vélo
const CROISIERE = 0.55; // vitesse « moteur au ralenti » (doigt levé), niveau 0
const CROISIERE_NIVEAU = 0.03; // + par niveau
const VITESSE_MAX = 0.95; // plafond gaz à fond, niveau 0
const VITESSE_MAX_NIVEAU = 0.05; // + par niveau (le plafond monte lentement)
const POUSSEE = 0.45; // accélération du gaz au sol, U/s² (croisière → plafond en ≈ 1 s)
const FREIN_MOTEUR = 1.0; // rappel vers la croisière quand on relâche (1/s)
const PENTE_EFFET = 0.55; // part de g qui joue le long de la pente : descente = ça file, montée = ça freine
const VITESSE_PLANCHER = 0.6; // fraction de la croisière sous laquelle on ne descend jamais (le vélo ne cale pas)
// Saltos (2026-09-15, « plus réalistes ») : un vrai backflip de BMX prend ~0,8 s par tour. La rotation monte donc
// progressivement et garde un peu d'élan quand on relâche, au lieu de s'arrêter net ; en contrepartie le vélo
// s'aligne de lui-même sur la pente d'arrivée à l'approche du sol, comme un pilote qui prépare sa réception.
const ROT_ACCEL = 12; // accélération angulaire en l'air quand on maintient, rad/s²
const ROT_MAX = 8.2; // vitesse angulaire maxi, rad/s (≈ 0,77 s par tour)
const ROT_AMORT = 11; // amortissement de la rotation quand on relâche (1/s) : un reste d'élan, pas un arrêt sec
const ROT_GRACE = 0.08; // s d'envol avant que l'appui fasse tourner : les petits sauts de bosse sont immunisés
const REDRESSE = 3; // rappel vers l'assiette visée une fois relâché, 1/s (trajectoire en l'air, pente d'arrivée près du sol)
const REDRESSE_SOL = 3; // hauteur (en tailles de vélo) sous laquelle on vise la pente d'arrivée plutôt que la trajectoire
// Écart angle/pente admis à l'atterrissage. À 39° on chutait sur des réceptions qui « passaient » à l'œil,
// et le jeu punissait le joueur qui osait un double. À 65°, c'est le geste raté qui coûte, pas l'à-peu-près.
const TOLERANCE = 1.13;
const BOUCLE_R = 0.155; // rayon d'un looping, en fraction de U
const BOUCLE_ELAN = 3.2; // il faut v² ≥ BOUCLE_ELAN × g × r pour entrer dans l'anneau, sinon on passe dessous
const BOUCLE_MINI = 1.8; // vitesse garantie dans l'anneau (v² = BOUCLE_MINI × g × r) : un looping engagé se termine
const BOUCLE_POINTS = 3; // ce que rapporte un anneau bouclé
const RELANCE_PARFAITE = 1.12; // coup de fouet quand la réception tombe pile dans l'axe
const PARFAIT = 0.14; // écart en dessous duquel l'atterrissage est « parfait » (≈ 8°)
const SUIVI_PENTE = 12; // vitesse à laquelle l'inclinaison suit la pente au sol (1/s)
const DUREE_TAP = 0.1; // un simple tap vaut un appui de cette durée
const CAM_SUIVI = 5; // rattrapage vertical de la caméra (1/s)
const CAM_SUIVI_X = 16; // rattrapage horizontal (1/s) : absorbe les à-coups de vitesse sans laisser dériver
const CAM_AVANCE = 0.08; // recul du vélo sur l'écran (fraction de la largeur) quand on est à fond
const CAM_HAUTEUR = 0.35; // sur les gros sauts, la caméra ne suit qu'une partie de la hauteur : le sol reste en vue plus longtemps
const SECOUSSE = 0.02; // amplitude de la secousse d'écran par U/s de vitesse verticale à l'atterrissage
const PAS = 6; // pas d'échantillonnage du relief, px monde
const JALON = 3; // +1 tous les JALON × U parcourus

// Saut (double tap, double clic, double Espace, ou ↑ / W au clavier). Hauteur en fraction de U : assez pour
// franchir un obstacle posé sur la route et cueillir une lettre en l'air, pas assez pour remplacer un tremplin.
// Obstacles plus faciles à esquiver (2026-09-15) : saut plus haut, double tap plus tolérant, saut mémorisé plus
// longtemps, et un obstacle ne fait tomber que si les roues passent vraiment dedans.
const SAUT_HAUTEUR = 0.32;
const DOUBLE_TAP = 0.4; // deux appuis à moins de 0,4 s = un saut
const SAUT_TAMPON = 0.24; // un saut demandé juste avant de toucher le sol part à l'atterrissage, pas perdu
const COYOTE = 0.16; // on peut encore sauter un instant après avoir quitté une crête
const SAUT_POP = 1.6; // le nez se lève au départ du saut (rad/s), comme un bunny hop
const OBSTACLE_HAUT = 0.26; // hauteur de contact d'un obstacle, en tailles de vélo (on le franchit dès que les roues sont au-dessus)
const ALERTE_OBSTACLE = 1.8; // distance (en U) à partir de laquelle un obstacle devant soi est signalé
// Lettres : chaque niveau cache un mot lié à Fairide (7 lettres au plus). Toutes attrapées = les points
// gagnés pendant ce mot sont doublés. La liste vient des traductions (jeux.rider_mots), sinon celle-ci.
const MOTS_DEFAUT = 'VÉLO,MENU,RESTO,REPAS,LOCAL,PANIER,CUISINE,LIVREUR,FAIRIDE';
const LETTRES_EN_JEU = 2; // lettres posées devant soi au plus en même temps : le mot se gagne, il ne se ramasse pas
const FETE_MOT = 1.8; // s pendant lesquelles le mot complet reste affiché avant le suivant

const OBSTACLES = ['🪨', '🚧', '🛢️', '📦', '🛴'];
const BONUS = ['🍕', '🍔', '🌮', '🍩'];
const DEUX_PI = Math.PI * 2;
const normaliser = (a) => { let r = a % DEUX_PI; if (r > Math.PI) r -= DEUX_PI; if (r < -Math.PI) r += DEUX_PI; return r; };
const lisse = (t) => t * t * (3 - 2 * t);
const borner = (v, a, b) => Math.max(a, Math.min(b, v));

// Rectangle à coins arrondis, avec repli pour les navigateurs qui n'ont pas roundRect.
function arrondi(ctx, x, y, l, ht, r) {
  ctx.beginPath();
  if (ctx.roundRect) { ctx.roundRect(x, y, l, ht, r); return; }
  ctx.moveTo(x + r, y); ctx.lineTo(x + l - r, y); ctx.quadraticCurveTo(x + l, y, x + l, y + r);
  ctx.lineTo(x + l, y + ht - r); ctx.quadraticCurveTo(x + l, y + ht, x + l - r, y + ht);
  ctx.lineTo(x + r, y + ht); ctx.quadraticCurveTo(x, y + ht, x, y + ht - r);
  ctx.lineTo(x, y + r); ctx.quadraticCurveTo(x, y, x + r, y); ctx.closePath();
}

// Le sac isotherme Fairide, avec le plat qu'il transporte. Remplace l'emoji nu des bonus : sur la piste,
// c'est une livraison qu'on va chercher, pas une pizza qui flotte.
function dessinerSacRepas(ctx, x, y, s, e, angle) {
  const l = s * 0.94; const ht = s * 0.88; const r = Math.max(2, s * 0.16);
  ctx.save();
  ctx.translate(x, y); if (angle) ctx.rotate(angle);
  ctx.strokeStyle = IRIS; ctx.lineWidth = Math.max(1.6, s * 0.09); ctx.lineCap = 'round';
  ctx.beginPath(); ctx.arc(0, -ht * 0.42, l * 0.3, Math.PI, 0); ctx.stroke(); // l'anse
  arrondi(ctx, -l / 2, -ht * 0.42, l, ht, r);
  ctx.fillStyle = IRIS; ctx.fill();
  ctx.strokeStyle = INK; ctx.lineWidth = Math.max(1, s * 0.06); ctx.stroke();
  ctx.fillStyle = 'rgba(255,255,255,.16)'; ctx.fillRect(-l / 2 + r * 0.4, ht * 0.1, l - r * 0.8, ht * 0.14);
  emoji(ctx, e, 0, -ht * 0.05, s * 0.46);
  ctx.restore();
}

// Bruxelles en ombres chinoises, trois couches de parallaxe. Chaque tuile est tirée d'un hasard
// déterministe (fonction de son index) : le décor défile à l'infini sans jamais changer d'aspect
// quand on repasse au même endroit, et rien n'est stocké.
const hasard = (n) => { const v = Math.sin(n * 127.1 + 311.7) * 43758.5453; return v - Math.floor(v); };

// Ajoute au tracé en cours les formes d'une tuile de ville. Ne peint rien : c'est l'appelant qui fait un
// seul fill() (ou stroke()) pour toute la couche. « phase » choisit ce qu'on ajoute, parce que les corps,
// les tubes de l'Atomium et les fenêtres allumées n'ont ni la même couleur ni la même façon d'être peints.
function cercle(ctx, x, y, r) { ctx.moveTo(x + r, y); ctx.arc(x, y, r, 0, Math.PI * 2); }

function tuileVille(ctx, index, couche, gauche, yBase, L, s, phase) {
  const graine = index * 17.13 + couche * 101.7;
  const genre = Math.floor(hasard(graine) * 12);
  if (genre === 0) {
    // L'Atomium : neuf sphères et leurs tubes.
    const cx = gauche + L * 0.5; const e = s * 0.85; const r = s * 0.27;
    const noeuds = [[-e, -e], [e, -e], [0, -e], [-e, 0], [e, 0], [0, 0], [-e * 0.5, -e * 1.5], [e * 0.5, -e * 0.5]];
    if (phase === 'tubes') { for (const nd of noeuds) { ctx.moveTo(cx, yBase - 2 * e); ctx.lineTo(cx + nd[0], yBase + nd[1]); } return; }
    if (phase !== 'corps') return;
    cercle(ctx, cx, yBase - 2 * e, r);
    for (const nd of noeuds) cercle(ctx, cx + nd[0], yBase + nd[1], r);
    return;
  }
  if (phase === 'tubes') return;
  if (genre === 1) {
    // La flèche de l'hôtel de ville, sur la Grand-Place.
    if (phase !== 'corps') return;
    const cx = gauche + L * 0.34; const l = s * 0.9; const ht = s * 2.5;
    ctx.rect(cx - l / 2, yBase - ht, l, ht);
    ctx.moveTo(cx - l / 2, yBase - ht); ctx.lineTo(cx, yBase - ht - s * 1.6); ctx.lineTo(cx + l / 2, yBase - ht); ctx.closePath();
    for (let i = 0; i < 3; i++) ctx.rect(cx + l * 0.9 + i * s * 0.75, yBase - s * (0.9 + hasard(graine + i) * 0.8), s * 0.58, s * 3);
    return;
  }
  if (genre === 2) {
    // Les deux tours carrées de la cathédrale et la nef entre elles.
    if (phase !== 'corps') return;
    const cx = gauche + L * 0.5; const l = s * 0.62; const ht = s * 2.1; const ec = s * 0.8;
    ctx.rect(cx - ec - l / 2, yBase - ht, l, ht);
    ctx.rect(cx + ec - l / 2, yBase - ht, l, ht);
    ctx.rect(cx - ec, yBase - ht * 0.72, ec * 2, ht * 0.72);
    return;
  }
  // Le tissu ordinaire : immeubles, toits plats, quelques antennes, quelques fenêtres allumées.
  let px = gauche; let i = 0;
  while (px < gauche + L) {
    const l = s * (0.55 + hasard(graine + i * 3.7) * 1.1);
    const ht = s * (0.7 + hasard(graine + i * 5.1) * 2.3);
    if (phase === 'corps') {
      ctx.rect(px, yBase - ht, l - s * 0.08, ht);
      if (hasard(graine + i * 7.3) > 0.75) ctx.rect(px + l * 0.44, yBase - ht - s * 0.45, Math.max(1, s * 0.07), s * 0.45);
    } else {
      const rangs = Math.floor(ht / (s * 0.42));
      for (let r = 1; r < rangs; r++) {
        for (let c = 0; c < 3; c++) {
          if (hasard(graine + i * 11.3 + r * 3.1 + c) < 0.72) continue;
          ctx.rect(px + s * 0.12 + c * (l - s * 0.24) / 3, yBase - ht + r * s * 0.42, s * 0.13, s * 0.17);
        }
      }
    }
    px += l; i++;
  }
}

export function creerRider(api) {
  let w = api.w; let h = api.h;
  // Vélo : position monde (x, y = point de contact au sol), vitesse, orientation
  let x = 0; let y = 0; let vx = 0; let vy = 0; let auSol = true; let tempsVol = 0;
  let angle = 0; let omega = 0; let angleDepart = 0; let flips = 0; let serie = 0; let serieObstacles = 0; let obstaclesVol = 0;
  // Saisie
  let pulse = 0;
  // Saut : horloge de la partie (pour mesurer l'écart entre deux appuis), dernier appui, demande en attente.
  let horloge = 0; let dernierAppui = -9; let enfoncePrec = false; let sautDemande = 0; let sautEnCours = false;
  let sautsFaits = 0; let astuces = 0;
  // Lettres : le mot du moment, ce qui est déjà attrapé, les indices déjà posés sur la piste, les points
  // marqués depuis le début du mot (c'est eux qu'on double), la fête du mot complet.
  let mot = []; let attrapees = []; let enJeu = new Set(); let lettres = [];
  let pointsMot = 0; let motFini = 0; let motsFinis = 0;
  // Relief : échantillons tous les PAS px à partir de x0 ; T = 1 dans un trou (y retomber = chute)
  let H = []; let T = []; let x0 = 0; let xGen = 0; let yFin = 0; let yBase = 0; let sections = 0;
  // Objets du monde
  let obstacles = []; let bonus = []; let prochainJalon = 0;
  // Loopings : un anneau ne peut pas vivre dans un relief en hauteurs (deux altitudes pour un même x).
  // C'est donc un rail circulaire posé sur la piste, que le vélo emprunte le temps d'un tour.
  let boucles = []; let boucle = null; let phi = 0; let vBoucle = 0;
  // Rendu
  let accumule = 0; // reliquat de temps non encore intégré (voir PAS_PHYSIQUE)
  let camX = 0; let camY = 0; let decal = 0; let ecrasement = 0; let vEcrasement = 0;
  let roue = 0; let vRoue = 0; let pedale = 0; let penche = 0; let air = 0; let secousse = 0;
  let poussiere = []; let traits = []; let flash = null; let derniereChute = null;

  const U = () => Math.min(w, h * 1.1);
  // Textes du terrain dans la langue du joueur ; hors application (bancs d'essai), le français par défaut.
  const tr = (cle, defaut, vars) => {
    const v = api.t?.(cle, vars);
    return typeof v === 'string' && v !== cle ? v : defaut;
  };
  const listeMots = () => {
    const brut = tr('jeux.rider_mots', MOTS_DEFAUT);
    const l = brut.split(',').map((m) => m.trim().toUpperCase()).filter((m) => m.length >= 3 && m.length <= 7);
    return l.length ? l : MOTS_DEFAUT.split(',');
  };
  // Un mot par palier, du plus court au plus long : chaque mot complété révèle le suivant. Suivre le niveau
  // du moteur ne marchait pas — il plafonne à 8 dès 64 points, et on passait de VÉLO à FAIRIDE sans transition.
  // Au-delà de la liste, un mot au hasard, jamais le même deux fois de suite.
  const nouveauMot = () => {
    const l = listeMots(); const avant = mot.join('');
    const i = Math.min(l.length - 1, motsFinis);
    if (motsFinis >= l.length || l[i] === avant) {
      const autres = l.filter((m) => m !== avant);
      mot = [...(autres.length ? choix(autres) : l[0])];
    } else mot = [...l[i]];
    attrapees = mot.map(() => false); enJeu = new Set(); motFini = 0;
  };
  // Tous les points du jeu passent par ici : ce qu'on marque pendant un mot est ce que le mot complet doublera.
  const marquer = (k) => { pointsMot += k; api.marquer(k); };
  const taille = () => Math.max(26, Math.min(48, U() * 0.12));
  const croisiere = (n) => U() * (CROISIERE + n * CROISIERE_NIVEAU);
  const maxi = (n) => U() * (VITESSE_MAX + n * VITESSE_MAX_NIVEAU);

  // ---------- Relief ----------
  const idx = (px) => (px - x0) / PAS;
  const sol = (px) => {
    const i = idx(px); const k = Math.floor(i);
    if (k < 0) return H[0]; if (k >= H.length - 1) return H[H.length - 1];
    return H[k] + (H[k + 1] - H[k]) * (i - k);
  };
  const trou = (px) => T[borner(Math.floor(idx(px)), 0, T.length - 1)] === 1;
  // Pente locale. Un mur (falaise, bord de trou) ne compte pas : on garde la pente du côté du vélo, sinon le
  // vélo « plongerait » dans le trou au lieu de décoller avec l'élan de la lèvre.
  const MUR = PAS * 3;
  const pente = (px) => {
    const k = borner(Math.floor(idx(px)), 1, H.length - 2);
    const avant = H[k + 1] - H[k]; const arriere = H[k] - H[k - 1];
    if (Math.abs(avant) <= MUR) return avant / PAS;
    if (Math.abs(arriere) <= MUR) return arriere / PAS;
    return 0;
  };
  const ajouter = (yy, t = 0) => { H.push(yy); T.push(t); xGen += PAS; yFin = yy; };
  const courbe = (longueur, fn, t = 0) => { const n = Math.max(1, Math.round(longueur / PAS)); const y0 = yFin; for (let i = 1; i <= n; i++) ajouter(fn(i / n, y0), t); };
  // Retour en douceur vers l'altitude de référence (la piste descend un peu à chaque tremplin ou falaise).
  const recentrer = (longueur) => { const dy = (yBase - yFin) * 0.5; courbe(longueur, (t, y0) => y0 + dy * lisse(t)); };
  const poserObstacle = (px, route = false) => obstacles.push({ x: px, emoji: choix(OBSTACLES), passe: false, route });
  const poserBonus = (px, py) => bonus.push({ x: px, y: py, emoji: choix(BONUS), pris: false, phase: Math.random() * 6 });

  // Les sections de piste. Chacune part de (xGen, yFin) et allonge le relief.
  const sectionPlat = (u) => recentrer(u * aleatoire(0.3, 0.6));
  const sectionVallons = (u, n) => {
    const k = 2 + Math.floor(Math.random() * 3);
    for (let i = 0; i < k; i++) {
      if (Math.random() < 0.45) {
        // Une bosse : la crête, prise vite, fait décoller.
        const amp = u * aleatoire(0.05, 0.1 + n * 0.006); const l = u * aleatoire(0.5, 0.75);
        const xCrete = xGen + l / 2; const yCrete = yFin - amp;
        courbe(l, (t, y0) => y0 - amp * (1 - Math.cos(t * DEUX_PI)) / 2);
        if (Math.random() < 0.4) poserBonus(xCrete + u * 0.12, yCrete - u * 0.16);
      } else {
        const dy = (yBase - yFin) * 0.35 + u * aleatoire(-0.12, 0.12);
        courbe(u * aleatoire(0.4, 0.7), (t, y0) => y0 + dy * lisse(t));
      }
    }
  };
  const sectionTremplin = (u, n) => {
    // Approche en légère descente (on prend de l'élan), puis rampe de plus en plus raide (quart de tube),
    // lèvre, fosse, zone d'atterrissage un peu plus basse et en pente descendante pour garder la vitesse.
    courbe(u * 0.3, (t, y0) => y0 + u * 0.06 * lisse(t));
    const L = u * (0.36 + n * 0.015); const Hr = u * (0.22 + n * 0.02);
    courbe(L, (t, y0) => y0 - Hr * Math.pow(t, 1.9));
    const xLevre = xGen; const yLevre = yFin;
    const G = u * (0.2 + n * 0.035); const yAtt = yLevre + Hr + u * 0.06;
    courbe(G, () => yAtt + u * 0.6, 1);
    ajouter(yAtt);
    if (n >= 1 && Math.random() < 0.6) poserObstacle(xGen + u * 0.1);
    courbe(u * 0.5, (t, y0) => y0 + u * 0.1 * lisse(t));
    poserBonus(xLevre + u * 0.2, yLevre - u * 0.12);
    if (Math.random() < 0.6) poserBonus(xLevre + u * 0.55, yLevre - u * 0.42);
    recentrer(u * 0.3);
  };
  const sectionTrou = (u, n) => {
    // Petit trou dans le plat : une mini-lèvre, le vide, un rebord plus bas.
    courbe(u * 0.12, (t, y0) => y0 - u * 0.05 * t * t);
    const yLevre = yFin; const G = u * (0.14 + n * 0.025);
    courbe(G, () => yLevre + u * 0.6, 1);
    ajouter(yLevre + u * 0.14);
    courbe(u * 0.3, (t, y0) => y0 + u * 0.05 * lisse(t));
    recentrer(u * 0.2);
  };
  const sectionChute = (u, n) => {
    // Falaise : on part en l'air à plat, on retombe plus bas sur une pente qui relance.
    courbe(u * 0.15, (t, y0) => y0);
    const D = u * (0.3 + n * 0.03); const xBord = xGen;
    ajouter(yFin + D);
    if (Math.random() < 0.7) poserObstacle(xBord + u * 0.1);
    courbe(u * 0.5, (t, y0) => y0 + u * 0.12 * lisse(t));
    if (Math.random() < 0.5) poserBonus(xBord + u * 0.3, yFin - D - u * 0.2);
    recentrer(u * 0.25);
  };
  const sectionLooping = (u, n) => {
    // Descente d'élan, puis un plat sur lequel l'anneau est posé : il faut arriver vite, sinon on passe dessous.
    courbe(u * 0.55, (t, y0) => y0 + u * 0.14 * lisse(t));
    const r = u * (BOUCLE_R + n * 0.004 + Math.random() * 0.02); // l’anneau grandit avec le niveau : il faut plus d’élan
    courbe(u * 0.25, (t, y0) => y0);
    const xE = xGen; const yE = yFin;
    boucles.push({ x: xE, y: yE, r, fait: false });
    courbe(r + u * 0.5, () => yE);
    poserBonus(xE + r, yE - r * 2 - u * 0.09); // le plat au sommet de l'anneau : la récompense du geste
    recentrer(u * 0.45);
  };
  const sectionObstacles = (u, n) => {
    // Une ligne droite encombrée : colis, trottinette, cône… posés sur la route. On ne passe qu'en sautant.
    // À partir du niveau 3, parfois deux obstacles rapprochés, qu'un seul saut bien placé franchit ensemble.
    recentrer(u * 0.35);
    const xD = xGen; const yP = yFin;
    courbe(u * 1.75, (t, y0) => y0);
    poserObstacle(xD + u * 0.8, true);
    if (n >= 2 && Math.random() < 0.5) poserObstacle(xD + u * 1.07, true);
    if (Math.random() < 0.45) poserBonus(xD + u * 0.95, yP - u * 0.3); // la récompense au sommet du saut
    recentrer(u * 0.3);
  };
  // Pose sur la section qu'on vient de générer la prochaine lettre qui manque, sur la route ou en l'air
  // (il faut alors sauter ou passer par un tremplin). Dans l'ordre du mot : on l'épelle en roulant.
  const semerLettre = (u, xDeb) => {
    if (!mot.length || motFini > 0 || enJeu.size >= LETTRES_EN_JEU || Math.random() > 0.7) return;
    const i = attrapees.findIndex((ok, k) => !ok && !enJeu.has(k));
    if (i < 0) return;
    for (let essai = 0; essai < 8; essai++) {
      const px = xDeb + (xGen - xDeb) * aleatoire(0.15, 0.9);
      if (trou(px) || trou(px - PAS * 4) || trou(px + PAS * 4)) continue;
      if (boucles.some((b) => Math.abs(px - b.x) < b.r + u * 0.15)) continue;
      if (obstacles.some((o) => Math.abs(px - o.x) < u * 0.12)) continue;
      const aerienne = Math.random() < 0.45;
      const py = sol(px) - (aerienne ? u * aleatoire(0.2, 0.3) : taille() * 0.6);
      lettres.push({ x: px, y: py, i, pris: false, phase: Math.random() * 6 });
      enJeu.add(i);
      return;
    }
  };
  const genererSection = (n) => {
    const u = U();
    sections += 1;
    const xDeb = xGen;
    if (sections <= 2) { sectionVallons(u, 0); semerLettre(u, xDeb); return; }
    // Le mélange se corse avec le niveau : plus de trous, de falaises et d'obstacles, moins de plat. Les loopings
    // et la route encombrée n'arrivent jamais d'entrée de jeu : on laisse le temps de comprendre les commandes.
    const poids = [
      [() => sectionTremplin(u, n), 0.3],
      [() => sectionTrou(u, n), 0.08 + n * 0.025],
      [() => sectionChute(u, n), 0.06 + n * 0.02],
      [() => sectionLooping(u, n), sections > 4 ? 0.11 : 0],
      [() => sectionObstacles(u, n), sections > 3 ? 0.15 + n * 0.015 : 0],
      [() => sectionVallons(u, n), 0.3],
      [() => sectionPlat(u), 0.08]
    ];
    let r = Math.random() * poids.reduce((a, [, q]) => a + q, 0);
    for (const [faire, q] of poids) { if (r < q) { faire(); break; } r -= q; }
    semerLettre(u, xDeb);
  };
  const assurer = (jusqua, n) => { while (xGen < jusqua) genererSection(n); };
  const elaguer = () => {
    const u = U();
    if (x - x0 < u * 6) return;
    const k = Math.floor((x - x0 - u * 2) / PAS);
    H.splice(0, k); T.splice(0, k); x0 += k * PAS;
    obstacles = obstacles.filter((o) => o.x > x - u);
    bonus = bonus.filter((b) => b.x > x - u);
    // Une lettre ratée repart dans le semis : elle reviendra plus loin.
    for (const l of lettres) if (!l.pris && l.x <= x - u) enJeu.delete(l.i);
    lettres = lettres.filter((l) => l.x > x - u);
    boucles = boucles.filter((b) => b.x + b.r > x - u);
  };

  const poussierer = (px, py, n, force) => { for (let k = 0; k < n; k++) poussiere.push({ x: px + (Math.random() - 0.5) * 24, y: py, vx: (Math.random() - 0.5) * force - force * 0.3, vy: -Math.random() * force * 0.5, reste: 0.45 }); };
  const chuter = (px, py, raison) => { derniereChute = { raison, x: px, tempsVol, ecart: normaliser(angle - Math.atan(pente(px))) }; poussierer(px, py, 16, 200); api.eclat?.(px - camX, py - camY, LIME, 10); return api.perdre(); };

  return {
    reset() {
      const u = U();
      H = []; T = []; x0 = 0; xGen = 0; sections = 0; yBase = h * 0.62; yFin = yBase; ajouter(yBase); ajouter(yBase);
      obstacles = []; bonus = []; boucles = []; boucle = null; phi = 0; vBoucle = 0; prochainJalon = u * JALON;
      lettres = []; mot = []; motsFinis = 0; pointsMot = 0; nouveauMot();
      horloge = 0; dernierAppui = -9; enfoncePrec = false; sautDemande = 0; sautEnCours = false; sautsFaits = 0; astuces = 0;
      x = u * 0.5; assurer(x + w * 3, 0);
      y = sol(x); vx = croisiere(0); vy = 0; auSol = true; tempsVol = 0;
      angle = Math.atan(pente(x)); omega = 0; angleDepart = angle; flips = 0; serie = 0; serieObstacles = 0; obstaclesVol = 0;
      pulse = 0;
      decal = w * 0.32; camX = x - decal; camY = y - h * 0.55; ecrasement = 0; vEcrasement = 0; accumule = 0;
      roue = 0; vRoue = 0; pedale = 0; penche = 0; air = 0; secousse = 0;
      poussiere = []; traits = []; flash = null;
    },
    redimensionner(nw, nh) { w = nw; h = nh; },
    // État lisible de l'extérieur (sondes, bancs d'essai) : jamais utilisé par le rendu.
    etat() { return { auSol, vx, vy, angle, rotation: angle - angleDepart, omega, dist: x, hauteur: sol(x) - y, U: U(), flips, serie, tempsVol, obstacles: obstacles.length, bonus: bonus.length, boucles: boucles.length, enBoucle: boucle !== null, ecranY: y - camY, ecranX: x - camX, mot: mot.join(''), attrapees: attrapees.filter(Boolean).length, lettres: lettres.length, motsFinis, pointsMot, sautsFaits, prochainObstacle: (obstacles.find((o) => !o.passe && o.x >= x)?.x ?? x + 1e9) - x, prochaineLettre: (lettres.find((l) => !l.pris && l.x >= x)?.x ?? x + 1e9) - x, derniereChute }; },
    // PAS FIXE. La physique avance toujours par tranches de PAS_PHYSIQUE, jamais du dt de l'écran.
    // Avec un dt variable (60, 120, 144 Hz, une image en retard, un onglet qui se réveille), la même
    // action ne donnait pas tout à fait le même résultat d'une image à l'autre : l'accélération, le
    // ressort de suspension et la rotation intégraient des tranches inégales, et ça se voyait surtout
    // aux réceptions, en petites saccades. Ici chaque tranche est identique ; seul le nombre de
    // tranches par image change. Le reliquat est reporté à l'image suivante, jamais perdu.
    update(dt, input) {
      // Appuis de l'image, comptés UNE fois (pasPhysique tourne plusieurs fois par image avec la même saisie).
      // Un pointeur ajoute une « tape » ; au clavier, seul le passage de relâché à enfoncé compte.
      horloge += dt;
      let appuis = input.tapes.length;
      if (!appuis && input.enfonce && !enfoncePrec) appuis = 1;
      enfoncePrec = input.enfonce;
      for (let k = 0; k < appuis; k++) {
        if (horloge - dernierAppui < DOUBLE_TAP) { sautDemande = SAUT_TAMPON; dernierAppui = -9; } // un triple tap ne fait pas deux sauts
        else dernierAppui = horloge;
      }
      if (input.sauts) sautDemande = SAUT_TAMPON; // ↑ ou W : saut direct au clavier
      if (motFini > 0) { motFini -= dt; if (motFini <= 0) nouveauMot(); }
      accumule = Math.min(accumule + dt, ACCUM_MAX);
      let fin;
      while (accumule >= PAS_PHYSIQUE) {
        accumule -= PAS_PHYSIQUE;
        fin = this.pasPhysique(PAS_PHYSIQUE, input);
        if (fin !== undefined) { accumule = 0; break; }
      }
      return fin;
    },
    pasPhysique(dt, input) {
      const n = input.niveau; const u = U(); const t = taille();
      const g = GRAVITE * u; const base = croisiere(n); const plafond = maxi(n);

      // --- Saisie : maintenir, ou un tap qui vaut un appui court.
      if (input.tapes.length) pulse = DUREE_TAP;
      const appui = input.enfonce || pulse > 0;
      pulse = Math.max(0, pulse - dt);

      // --- Relief disponible loin devant, et nettoyé loin derrière.
      assurer(x + w * 3, n); elaguer();

      // --- Saut : au sol, ou juste après avoir quitté une crête (coyote). L'élan vertical de la pente est gardé
      // quand il aide (on saute plus haut en montée), jamais quand il freine le saut.
      sautDemande = Math.max(0, sautDemande - dt);
      if (sautDemande > 0 && boucle === null && (auSol || (tempsVol < COYOTE && !sautEnCours))) {
        const v0 = Math.sqrt(2 * g * SAUT_HAUTEUR * u);
        vy = Math.min(auSol ? pente(x) * vx : vy, 0) - v0;
        y -= 1;
        auSol = false; tempsVol = 0; angleDepart = angle; flips = 0; omega = -SAUT_POP; obstaclesVol = 0;
        sautDemande = 0; sautEnCours = true; sautsFaits += 1;
        poussierer(x, y, 6, 120);
        vEcrasement -= 3;
      }

      // --- Dans un looping : le vélo est tenu par le rail, la gravité freine dans la montée et relance dans
      // la descente. On garantit juste assez de vitesse pour ressortir : un anneau où l'on est entré se termine,
      // sinon la punition tomberait bien après la décision, et le joueur ne comprendrait pas ce qu'il a raté.
      const enBoucle = boucle !== null;
      if (enBoucle) {
        const b = boucle;
        vBoucle += -Math.sin(phi) * g * dt;
        if (appui) vBoucle += POUSSEE * u * 0.8 * dt;
        vBoucle = borner(vBoucle, Math.sqrt(BOUCLE_MINI * g * b.r), plafond * 1.35);
        phi += (vBoucle / b.r) * dt;
        x = b.x + Math.sin(phi) * b.r;
        y = b.y - b.r + Math.cos(phi) * b.r;
        angle = -phi; omega = 0;
        vRoue = vBoucle / (t * 0.28); roue += vRoue * dt;
        if (phi >= DEUX_PI) {
          boucle = null; phi = 0;
          x = b.x + PAS; y = sol(x); vy = 0; vx = Math.max(vBoucle, base);
          angle = Math.atan(pente(x)); auSol = true; flips = 0; tempsVol = 0; angleDepart = angle;
          marquer(BOUCLE_POINTS);
          flash = { texte: `🔄 LOOPING +${BOUCLE_POINTS}`, reste: 1.2 };
          api.eclat?.(x - camX, y - camY - t, '#FFD166', 14);
        }
      } else if (auSol) {
        const p = pente(x); const sinus = p / Math.sqrt(1 + p * p);
        if (appui) vx = vx < plafond ? Math.min(plafond, vx + POUSSEE * u * dt) : suivre(vx, plafond, 2, dt); // au-dessus du plafond (descente), l'excès s'use doucement
        else vx = suivre(vx, base, FREIN_MOTEUR, dt);
        vx += -sinus * g * PENTE_EFFET * dt;
        vx = borner(vx, base * VITESSE_PLANCHER, plafond * 1.25);
      }
      if (!enBoucle) x += vx * dt;
      const ySol = sol(x); const p = pente(x);

      if (auSol && !enBoucle) {
        // Le sol se dérobe plus vite que la chute libre (crête, lèvre, falaise) : on décolle avec l'élan de la pente.
        const yLibre = y + vy * dt + 0.5 * g * dt * dt;
        if (yLibre < ySol - 1.5) {
          auSol = false; tempsVol = 0; angleDepart = angle; flips = 0; omega = 0; obstaclesVol = 0;
        } else {
          const vyAvant = vy;
          y = ySol; vy = p * vx;
          angle = suivre(angle, Math.atan(p), SUIVI_PENTE, dt);
          // Suspension : une bosse encaissée = accélération verticale du sol → la fourche s'écrase.
          vEcrasement += ((vy - vyAvant) / u) * 2.5;
          if (trou(x)) return chuter(x, y, 'trou');
        }
      }
      // --- Entrée dans un looping : il faut de l'élan. Trop lent, on passe simplement dessous, sans rien perdre.
      if (auSol && !enBoucle && !boucle) {
        for (const b of boucles) {
          if (b.fait || x < b.x || x > b.x + PAS * 6) continue;
          b.fait = true;
          if (vx * vx >= BOUCLE_ELAN * g * b.r) { boucle = b; phi = 0; vBoucle = vx; y = b.y; angle = 0; omega = 0; }
          else api.effet?.(x - camX, y - camY - t * 1.4, 'TROP LENT', '#FFD166');
        }
      }
      if (!auSol && !enBoucle) {
        tempsVol += dt;
        vy += g * dt; y += vy * dt;
        // Rotation : accélération angulaire tant qu'on maintient (après une petite grâce), sinon amortissement
        // et rappel doux vers l'horizontale. Aucun plafond de tours : celui qui tourne trop retombe de travers.
        if (appui && tempsVol > ROT_GRACE) {
          omega = Math.max(-ROT_MAX, omega - ROT_ACCEL * dt);
        } else {
          omega *= Math.max(0, 1 - dt * ROT_AMORT);
          // Assiette visée : le nez suit un peu la trajectoire (il plonge en redescendant), puis, près du sol,
          // la pente sur laquelle on va retomber. Le vélo s'y aligne au multiple de tour le plus proche.
          const cibleVol = Math.atan2(vy, Math.max(vx, 1)) * 0.4;
          const cibleArrivee = Math.atan(pente(x + vx * 0.18));
          const proche = borner(1 - (ySol - y) / (t * REDRESSE_SOL), 0, 1);
          const cible = cibleVol + (cibleArrivee - cibleVol) * proche;
          const droit = Math.round((angle - cible) / DEUX_PI) * DEUX_PI + cible;
          angle = suivre(angle, droit, REDRESSE * (0.6 + proche * 0.8), dt);
        }
        angle += omega * dt;
        // Un tour complet (un peu avant la fin, pour que l'annonce tombe quand on « revient ») = +1, sans plafond.
        const tours = (angleDepart - angle) / DEUX_PI;
        if (tours >= flips + 1 - 0.06) {
          flips += 1; marquer(1);
          const ex = x - camX; const ey = y - camY - t * 1.6;
          api.effet?.(ex, ey, flips === 1 ? 'BACKFLIP +1' : `×${flips} +1`, flips >= 2 ? '#FFD166' : LIME);
          api.eclat?.(ex, ey + t * 0.6, flips >= 2 ? '#FFD166' : LIME, 6 + flips * 3);
        }
        if (y >= ySol) {
          // Atterrissage. Dans un trou = chute. De travers par rapport à la pente = chute. Sinon : propre.
          if (trou(x)) return chuter(x, ySol, 'trou');
          const attendu = Math.atan(p); const ecart = normaliser(angle - attendu);
          if (Math.abs(ecart) > TOLERANCE) return chuter(x, ySol, 'travers');
          const dur = vy / u; // vitesse verticale d'impact, en U/s
          vEcrasement = Math.min(1.8, dur) * 6;
          secousse = Math.min(6, dur * SECOUSSE * u * 0.35);
          poussierer(x, ySol, 5 + Math.round(dur * 6), 110 + dur * 40);
          if (flips > 0) {
            serie += 1;
            const parfait = Math.abs(ecart) < PARFAIT;
            // Combo : deux tours ou plus dans le même vol rapportent autant de points en prime. C'est ce qui
            // fait qu'on tente le double au lieu d'assurer le simple.
            const combo = flips >= 2 ? flips : 0;
            if (parfait) marquer(1);
            if (combo) marquer(combo);
            // Réception pile dans l'axe : petit coup de fouet. La récompense est dans la relance, pas dans un chiffre.
            if (parfait) vx = Math.min(vx * RELANCE_PARFAITE, plafond * 1.3);
            const prime = `${parfait ? ' +1' : ''}${combo ? ` COMBO +${combo}` : ''}${serie >= 2 ? ` · ×${serie}` : ''}`;
            flash = { texte: `${parfait ? '✨ PARFAIT' : '👌 NICE'}${prime}`, reste: 1.1 };
            api.eclat?.(x - camX, ySol - camY - t * 0.6, parfait ? '#FFD166' : LIME, parfait ? 14 : 8);
          } else serie = 0;
          if (!obstaclesVol) serieObstacles = 0; // la série d'obstacles tient tant que chaque vol en franchit au moins un
          y = ySol; vy = p * vx; angle = attendu + ecart; auSol = true; omega = 0; flips = 0; tempsVol = 0; sautEnCours = false;
        }
      }

      // --- Suspension (ressort amorti), posture, roues
      const vise = auSol ? (appui ? 1 : 0.15) : Math.abs(omega) > 2.5 ? 1.2 : (vy < 0 ? -0.7 : -0.3); // groupé sur le guidon pendant un salto
      penche = suivre(penche, vise, 6, dt);
      air = suivre(air, auSol ? 0 : 1, 8, dt);
      vEcrasement += (-ecrasement * 90 - vEcrasement * 12) * dt;
      ecrasement += vEcrasement * dt;
      if (auSol) { vRoue = vx / (t * 0.28); pedale += vRoue * 0.6 * dt; }
      else vRoue *= Math.max(0, 1 - dt * 0.8);
      roue += vRoue * dt;

      // --- Jalons, obstacles, bonus
      if (x >= prochainJalon) { prochainJalon += u * JALON; marquer(1); api.effet?.(x - camX, y - camY - t * 1.3, '+1'); }
      // Tant que le joueur n'a jamais sauté, les deux premiers obstacles sur la route annoncent la commande.
      if (!sautsFaits && astuces < 2 && auSol) {
        const devant = obstacles.find((o) => o.route && !o.passe && !o.astuce && o.x > x && o.x - x < u * 1.2);
        if (devant) { devant.astuce = true; astuces += 1; flash = { texte: tr('jeux.rider_astuce_saut', '👆👆 Double tap (ou ↑) = saut !'), reste: 2 }; }
      }
      for (const o of obstacles) {
        if (o.passe || x < o.x) continue;
        o.passe = true;
        if (y > sol(o.x) - t * OBSTACLE_HAUT) return chuter(x, y, 'obstacle');
        serieObstacles += 1; obstaclesVol += 1;
        marquer(1); api.effet?.(x - camX, y - camY - t * 1.2, serieObstacles >= 3 ? `+1 ×${serieObstacles}` : '+1');
      }
      for (const l of lettres) {
        l.phase += dt * 3;
        if (l.pris) continue;
        if (Math.hypot(x - l.x, (y - t * 0.55) - l.y) < t * 0.72) {
          l.pris = true; attrapees[l.i] = true; enJeu.delete(l.i);
          marquer(1);
          api.effet?.(l.x - camX, l.y - camY - t * 0.5, `${mot[l.i]} +1`, LIME);
          api.eclat?.(l.x - camX, l.y - camY, LIME, 10);
          if (attrapees.every(Boolean)) {
            // Mot complet : tout ce qui a été marqué pendant ce mot est marqué une seconde fois.
            const prime = pointsMot; pointsMot = 0;
            if (prime > 0) api.marquer(prime);
            const texte = mot.join('');
            flash = { texte: tr('jeux.rider_mot_complet', `🎉 ${texte} ! Points ×2 (+${prime})`, { mot: texte, n: prime }), reste: 2.4 };
            api.eclat?.(x - camX, y - camY - t, '#FFD166', 24);
            api.eclat?.(w / 2, 24, LIME, 16);
            motFini = FETE_MOT; motsFinis += 1;
          }
        }
      }
      for (const b of bonus) {
        b.phase += dt * 3;
        if (b.pris) continue;
        if (Math.hypot(x - b.x, (y - t * 0.55) - b.y) < t * 0.66) {
          b.pris = true; marquer(1);
          api.effet?.(b.x - camX, b.y - camY - t * 0.4, '+1', '#FFD166'); api.eclat?.(b.x - camX, b.y - camY, '#FFD166', 8);
        }
      }

      // --- Caméra : suivi vertical souple, léger recul du vélo quand on va vite, secousse à l'impact.
      decal = suivre(decal, w * (0.32 - CAM_AVANCE * borner(vx / plafond, 0, 1.2)), 3, dt);
      // La caméra suivait x au pixel près : toute variation de vitesse (relance, pente, réception)
      // passait telle quelle dans le défilement du décor. Un rattrapage souple absorbe ces à-coups
      // sans laisser la moto dériver — à la vitesse maximale, le retard reste sous 8 % de l'écran.
      camX = suivre(camX, x - decal, CAM_SUIVI_X, dt);
      camY = suivre(camY, y - h * 0.55 + Math.min(Math.max(0, ySol - y), h * 0.5) * CAM_HAUTEUR, CAM_SUIVI, dt);
      // Filet de sécurité : le suivi souple, volontairement partiel en hauteur, laissait sortir le vélo par le
      // haut sur les très gros sauts de fin de partie — on ne savait plus quand relâcher. Quoi qu’il arrive,
      // il reste dans le cadre.
      camY = borner(camY, y - h * 0.88, y - h * 0.14);
      secousse = Math.max(0, secousse - dt * 18);
      if (vx > plafond * 0.8 && Math.random() < dt * 45) traits.push({ x: x - t * aleatoire(0.6, 1.4), y: y - t * aleatoire(0.1, 1.2), l: t * aleatoire(0.5, 1.3), reste: 0.22 });
      for (const tr of traits) tr.reste -= dt;
      traits = traits.filter((tr) => tr.reste > 0);
      if (flash) { flash.reste -= dt; if (flash.reste <= 0) flash = null; }
      for (const pp of poussiere) { pp.x += pp.vx * dt; pp.y += pp.vy * dt; pp.vy += 200 * dt; pp.reste -= dt; }
      poussiere = poussiere.filter((pp) => pp.reste > 0);
      return undefined;
    },
    draw(ctx) {
      const t = taille(); const u = U();
      const sx = secousse ? (Math.random() - 0.5) * secousse * 2 : 0; const sy = secousse ? (Math.random() - 0.5) * secousse * 2 : 0;
      fondDegrade(ctx, w, h, '#2A2180', '#7B6CF0');
      // Nuages (parallaxe lente)
      ctx.fillStyle = 'rgba(255,255,255,.10)';
      for (let i = 0; i < 4; i++) {
        const cx = ((i * w * 0.37 - camX * 0.1) % (w * 1.4) + w * 1.4) % (w * 1.4) - w * 0.2;
        ctx.beginPath(); ctx.ellipse(cx, h * (0.1 + (i % 2) * 0.09) - camY * 0.05, w * 0.12, h * 0.035, 0, 0, Math.PI * 2); ctx.fill();
      }
      // Bruxelles derrière la piste : trois couches de parallaxe, de la brume au premier plan sombre.
      // Atomium, flèche de l'hôtel de ville, tours de la cathédrale et tissu ordinaire, tirés au sort une
      // fois pour toutes par index de tuile (voir tuileVille) — on livre à Bruxelles, autant que ça se voie.
      const villes = [[0.16, 0.62, 1.25, 'rgba(255,255,255,.12)', false], [0.3, 0.7, 0.95, 'rgba(20,18,31,.24)', false], [0.52, 0.78, 0.7, 'rgba(20,18,31,.42)', true]];
      for (let k = 0; k < villes.length; k++) {
        const [par, hb, ech, couleur, fen] = villes[k];
        const L = u * 2.4 * ech; const s = u * 0.13 * ech;
        const dec = camX * par; const yb = h * hb - camY * par * 0.3;
        const premier = Math.floor(dec / L) - 1; const dernier = premier + Math.ceil(w / L) + 2;
        ctx.beginPath();
        for (let i = premier; i <= dernier; i++) tuileVille(ctx, i, k, i * L - dec, yb, L, s, 'corps');
        ctx.fillStyle = couleur; ctx.fill();
        ctx.beginPath();
        for (let i = premier; i <= dernier; i++) tuileVille(ctx, i, k, i * L - dec, yb, L, s, 'tubes');
        ctx.strokeStyle = couleur; ctx.lineWidth = Math.max(1.4, s * 0.08); ctx.stroke();
        if (!fen) continue;
        ctx.beginPath();
        for (let i = premier; i <= dernier; i++) tuileVille(ctx, i, k, i * L - dec, yb, L, s, 'fenetres');
        ctx.fillStyle = 'rgba(200,240,60,.3)'; ctx.fill();
      }
      // Un aplat sombre sous les silhouettes : la piste se détache et les immeubles ne « flottent » pas.
      // Il monte en fondu sur une trentaine de pixels, sinon la ligne d'horizon coupe le ciel au couteau.
      const yh = h * 0.78 - camY * 0.52 * 0.3;
      const gh = ctx.createLinearGradient(0, yh - h * 0.06, 0, yh + h * 0.02);
      gh.addColorStop(0, 'rgba(20,18,31,0)'); gh.addColorStop(1, 'rgba(20,18,31,.42)');
      ctx.fillStyle = gh; ctx.fillRect(0, yh - h * 0.06, w, h);

      ctx.save();
      ctx.translate(-camX + sx, -camY + sy);
      // La piste : remplissage sombre jusqu'en bas, puis le bord lime. Les murs des trous et falaises
      // apparaissent d'eux-mêmes (deux échantillons voisins très différents).
      const xDeb = Math.floor(camX / PAS) * PAS - PAS; const xFin = camX + w + PAS * 2;
      const bas = camY + h + 20;
      ctx.beginPath(); ctx.moveTo(xDeb, bas);
      for (let px = xDeb; px <= xFin; px += PAS) ctx.lineTo(px, sol(px));
      ctx.lineTo(xFin, bas); ctx.closePath();
      ctx.fillStyle = '#241F38'; ctx.fill();
      // Le liseré lime s'interrompt au-dessus des trous : leur fond était souligné comme le reste de la piste,
      // et on croyait pouvoir s'y poser. Sans liseré, le vide se lit comme du vide.
      ctx.beginPath();
      let coupe = true;
      for (let px = xDeb; px <= xFin; px += PAS) {
        if (trou(px)) { coupe = true; continue; }
        const yy = sol(px);
        if (coupe) { ctx.moveTo(px, yy); coupe = false; } else ctx.lineTo(px, yy);
      }
      ctx.strokeStyle = LIME; ctx.lineWidth = 3; ctx.lineJoin = 'round'; ctx.stroke();
      // Marques au sol qui défilent : c'est elles qui donnent la vitesse à l'œil.
      ctx.strokeStyle = 'rgba(200,240,60,.4)'; ctx.lineWidth = 2;
      const pas = u * 0.11;
      for (let px = Math.floor(camX / pas) * pas; px <= xFin; px += pas) {
        if (trou(px)) continue;
        const yy = sol(px) + 10; const pp = pente(px);
        ctx.beginPath(); ctx.moveTo(px - 6, yy - pp * 6); ctx.lineTo(px + 6, yy + pp * 6); ctx.stroke();
      }
      // Loopings : un rail circulaire posé sur la piste, pas du relief. Le vélo passe derrière quand il est
      // trop lent pour s'y engager, d'où le remplissage très léger : on doit voir la piste au travers.
      for (const b of boucles) {
        if (b.x + b.r < camX - t || b.x - b.r > xFin + t) continue;
        const cy = b.y - b.r;
        ctx.save();
        ctx.globalAlpha = 0.1; ctx.fillStyle = LIME;
        ctx.beginPath(); ctx.arc(b.x, cy, b.r - 4, 0, DEUX_PI); ctx.fill();
        ctx.restore();
        ctx.beginPath(); ctx.arc(b.x, cy, b.r, 0, DEUX_PI);
        ctx.strokeStyle = 'rgba(20,18,31,.6)'; ctx.lineWidth = 9; ctx.stroke();
        ctx.beginPath(); ctx.arc(b.x, cy, b.r, 0, DEUX_PI);
        ctx.strokeStyle = LIME; ctx.lineWidth = 3; ctx.stroke();
      }
      // Obstacles et bonus
      // Obstacles : on les voyait mal (emoji seul sur le décor). Chacun est posé sur une pastille blanche cerclée de
      // rouge, avec une bande de chantier au sol ; à l'approche, un panneau ⚠ rebondit au-dessus pour dire « saute ».
      const uu = U();
      for (const o of obstacles) {
        if (o.x < camX - t * 2 || o.x > xFin + t * 2) continue;
        const yy = sol(o.x); const cy = yy - t * 0.52; const rr = t * 0.57;
        ctx.fillStyle = 'rgba(20,18,31,.22)'; ctx.beginPath(); ctx.ellipse(o.x, yy + 2, t * 0.5, t * 0.11, 0, 0, Math.PI * 2); ctx.fill();
        // Bande de chantier rouge et blanche au sol, sous l'obstacle.
        const bl = t * 1.1; const bh = Math.max(3, t * 0.09);
        ctx.save(); ctx.beginPath(); ctx.rect(o.x - bl / 2, yy - bh, bl, bh); ctx.clip();
        ctx.fillStyle = '#FFFFFF'; ctx.fillRect(o.x - bl / 2, yy - bh, bl, bh);
        ctx.fillStyle = '#E63946';
        for (let k = -bl; k < bl; k += bh * 2) { ctx.beginPath(); ctx.moveTo(o.x + k, yy); ctx.lineTo(o.x + k + bh, yy - bh); ctx.lineTo(o.x + k + bh * 2, yy - bh); ctx.lineTo(o.x + k + bh, yy); ctx.fill(); }
        ctx.restore();
        ctx.beginPath(); ctx.arc(o.x, cy, rr, 0, DEUX_PI); ctx.fillStyle = '#FFFFFF'; ctx.fill();
        ctx.lineWidth = Math.max(2.5, t * 0.085); ctx.strokeStyle = '#E63946'; ctx.stroke();
        emoji(ctx, o.emoji, o.x, cy, t * 0.84);
        const devant = o.x - x;
        if (!o.passe && devant > 0 && devant < uu * ALERTE_OBSTACLE) {
          const k = 1 - devant / (uu * ALERTE_OBSTACLE);
          const by = cy - rr - t * (0.55 + Math.abs(Math.sin(horloge * 9)) * 0.22);
          const ts = t * (0.42 + k * 0.18);
          ctx.globalAlpha = 0.55 + k * 0.45;
          ctx.beginPath(); ctx.moveTo(o.x, by - ts * 0.62); ctx.lineTo(o.x + ts * 0.58, by + ts * 0.4); ctx.lineTo(o.x - ts * 0.58, by + ts * 0.4); ctx.closePath();
          ctx.fillStyle = '#FFD166'; ctx.fill(); ctx.lineWidth = Math.max(2, ts * 0.1); ctx.strokeStyle = '#E63946'; ctx.lineJoin = 'round'; ctx.stroke();
          ctx.fillStyle = INK; ctx.font = `900 ${(ts * 0.52).toFixed(1)}px system-ui, sans-serif`; ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
          ctx.fillText('!', o.x, by + ts * 0.08);
          ctx.globalAlpha = 1;
        }
      }
      // Lettres : une tuile lime qui flotte, bien distincte des sacs (violets) et des obstacles (emoji).
      for (const l of lettres) {
        if (l.pris || l.x < camX - t || l.x > xFin + t) continue;
        const ly = l.y + Math.sin(l.phase) * 4; const c = t * 0.64;
        halo(ctx, l.x, ly, t * 0.8, '200,240,60', 0.5);
        arrondi(ctx, l.x - c / 2, ly - c / 2, c, c, c * 0.24);
        ctx.fillStyle = LIME; ctx.fill();
        ctx.lineWidth = Math.max(1.5, c * 0.08); ctx.strokeStyle = INK; ctx.stroke();
        ctx.fillStyle = INK; ctx.font = `900 ${(c * 0.66).toFixed(1)}px system-ui, sans-serif`;
        ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
        ctx.fillText(mot[l.i], l.x, ly + c * 0.05);
      }
      for (const b of bonus) {
        if (b.pris || b.x < camX - t || b.x > xFin + t) continue;
        const by = b.y + Math.sin(b.phase) * 3;
        halo(ctx, b.x, by, t * 0.6, '255,209,102', 0.5);
        dessinerSacRepas(ctx, b.x, by, t * 0.66, b.emoji, Math.sin(b.phase * 0.7) * 0.12);
      }
      // Ombre du vélo (plus petite et plus pâle quand il est haut)
      const ySolIci = sol(x); const haut = Math.max(0, ySolIci - y);
      if (!trou(x)) {
        ctx.fillStyle = `rgba(0,0,0,${(0.4 * Math.max(0.2, 1 - haut / (u * 0.9))).toFixed(3)})`;
        ctx.beginPath(); ctx.ellipse(x, ySolIci - 2, t * 0.42 * Math.max(0.45, 1 - haut / (u * 1.2)), t * 0.09, 0, 0, Math.PI * 2); ctx.fill();
      }
      // Traînées de vitesse
      ctx.strokeStyle = 'rgba(255,255,255,.45)'; ctx.lineWidth = 2; ctx.lineCap = 'round';
      for (const tr of traits) { ctx.globalAlpha = tr.reste / 0.22; ctx.beginPath(); ctx.moveTo(tr.x, tr.y); ctx.lineTo(tr.x - tr.l, tr.y); ctx.stroke(); }
      ctx.globalAlpha = 1;
      // Poussière
      ctx.fillStyle = 'rgba(200,240,60,.9)';
      for (const pp of poussiere) { ctx.globalAlpha = Math.max(0, pp.reste * 2.2); ctx.beginPath(); ctx.arc(pp.x, pp.y, 2.2, 0, Math.PI * 2); ctx.fill(); }
      ctx.globalAlpha = 1;
      // Le vélo et son cycliste
      dessinerVelo(ctx, x, y, t, angle, roue, pedale, ecrasement, penche, air);
      ctx.restore();

      // Le mot à compléter : une case par lettre, allumée quand elle est attrapée, dorée pendant la fête.
      const c = Math.max(15, Math.min(26, w * 0.055));
      if (mot.length) {
        const ecart = c * 0.18; const total = mot.length * c + (mot.length - 1) * ecart;
        let cx = (w - total) / 2; const haut = 8; const fete = motFini > 0;
        ctx.save();
        ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
        ctx.font = `800 ${(c * 0.62).toFixed(1)}px system-ui, sans-serif`;
        for (let i = 0; i < mot.length; i++) {
          const ok = attrapees[i];
          arrondi(ctx, cx, haut, c, c, c * 0.22);
          ctx.fillStyle = ok ? (fete ? '#FFD166' : LIME) : 'rgba(20,18,31,.35)'; ctx.fill();
          ctx.lineWidth = 1.5; ctx.strokeStyle = ok ? INK : 'rgba(255,255,255,.4)'; ctx.stroke();
          ctx.fillStyle = ok ? INK : 'rgba(255,255,255,.5)';
          ctx.fillText(mot[i], cx + c / 2, haut + c / 2 + 1);
          cx += c + ecart;
        }
        ctx.textAlign = 'left'; ctx.font = `800 ${(c * 0.5).toFixed(1)}px system-ui, sans-serif`;
        ctx.lineWidth = 3; ctx.strokeStyle = INK; ctx.strokeText('×2', cx + ecart * 0.4, haut + c / 2 + 1);
        ctx.fillStyle = '#FFD166'; ctx.fillText('×2', cx + ecart * 0.4, haut + c / 2 + 1);
        ctx.restore();
      }
      if (flash) {
        const yFlash = mot.length ? 8 + c + 8 : 10;
        ctx.save();
        ctx.globalAlpha = Math.min(1, flash.reste * 2);
        ctx.font = `800 ${Math.max(14, Math.min(24, w * 0.07))}px system-ui, sans-serif`;
        ctx.textAlign = 'center'; ctx.textBaseline = 'top';
        ctx.lineWidth = 4; ctx.strokeStyle = INK; ctx.strokeText(flash.texte, w / 2, yFlash);
        ctx.fillStyle = LIME; ctx.fillText(flash.texte, w / 2, yFlash);
        ctx.restore();
      }
    }
  };
}

// Le vélo, dessiné : point de contact (x, y) = le sol sous les roues, taille t ≈ empattement, angle = inclinaison,
// roue = angle des roues, pedale = angle du pédalier, ecrasement = suspension (0 = repos, > 0 = écrasé), penche =
// posture du cycliste (+1 gaz : couché sur le guidon ; -1 en l'air : il tire sur le guidon), air = 0 au sol → 1 en vol
// (le cycliste se lève sur les pédales).
function dessinerVelo(ctx, x, y, t, angle, roue, pedale, ecrasement, penche, air) {
  const r = t * 0.28; // rayon des roues
  ctx.save();
  ctx.translate(x, y);
  ctx.rotate(angle);
  // Suspension : écrasement vertical autour du sol, léger étirement horizontal.
  const sq = Math.max(-0.35, Math.min(0.35, ecrasement));
  ctx.scale(1 + sq * 0.35, 1 - sq * 0.5);
  ctx.lineCap = 'round'; ctx.lineJoin = 'round';
  const arriere = { x: -t * 0.42, y: -r }; const avant = { x: t * 0.42, y: -r };
  // Roues
  for (const rr of [arriere, avant]) {
    ctx.beginPath(); ctx.arc(rr.x, rr.y, r, 0, Math.PI * 2); ctx.fillStyle = INK; ctx.fill();
    ctx.beginPath(); ctx.arc(rr.x, rr.y, r * 0.78, 0, Math.PI * 2); ctx.strokeStyle = LIME; ctx.lineWidth = Math.max(1.5, r * 0.16); ctx.stroke();
    ctx.strokeStyle = 'rgba(200,240,60,.75)'; ctx.lineWidth = Math.max(1, r * 0.09);
    for (let k = 0; k < 5; k++) {
      const a = roue + (k / 5) * Math.PI * 2;
      ctx.beginPath(); ctx.moveTo(rr.x, rr.y); ctx.lineTo(rr.x + Math.cos(a) * r * 0.72, rr.y + Math.sin(a) * r * 0.72); ctx.stroke();
    }
    ctx.beginPath(); ctx.arc(rr.x, rr.y, r * 0.16, 0, Math.PI * 2); ctx.fillStyle = LIME; ctx.fill();
  }
  // Cadre
  const pedalier = { x: -t * 0.04, y: -r * 0.9 }; const selle = { x: -t * 0.2, y: -r * 2.35 }; const guidon = { x: t * 0.3, y: -r * 2.5 };
  ctx.strokeStyle = '#F7F5F0'; ctx.lineWidth = Math.max(2, r * 0.22);
  ctx.beginPath();
  ctx.moveTo(arriere.x, arriere.y); ctx.lineTo(pedalier.x, pedalier.y); ctx.lineTo(selle.x, selle.y); ctx.lineTo(arriere.x, arriere.y);
  ctx.moveTo(selle.x, selle.y); ctx.lineTo(guidon.x - t * 0.02, guidon.y + r * 0.2); ctx.lineTo(pedalier.x, pedalier.y);
  ctx.moveTo(guidon.x - t * 0.02, guidon.y + r * 0.2); ctx.lineTo(avant.x, avant.y);
  ctx.stroke();
  // Guidon et selle
  ctx.lineWidth = Math.max(2, r * 0.2); ctx.strokeStyle = INK;
  ctx.beginPath(); ctx.moveTo(guidon.x - t * 0.06, guidon.y); ctx.lineTo(guidon.x + t * 0.08, guidon.y - r * 0.15); ctx.stroke();
  ctx.beginPath(); ctx.moveTo(selle.x - t * 0.08, selle.y - r * 0.05); ctx.lineTo(selle.x + t * 0.06, selle.y - r * 0.05); ctx.stroke();
  // Pédales (tournent avec les roues, au sol seulement)
  const pa = pedale; const lp = r * 0.45;
  const pied1 = { x: pedalier.x + Math.cos(pa) * lp, y: pedalier.y + Math.sin(pa) * lp };
  const pied2 = { x: pedalier.x - Math.cos(pa) * lp, y: pedalier.y - Math.sin(pa) * lp };
  ctx.strokeStyle = INK; ctx.lineWidth = Math.max(1.5, r * 0.14);
  ctx.beginPath(); ctx.moveTo(pied1.x, pied1.y); ctx.lineTo(pied2.x, pied2.y); ctx.stroke();
  // Cycliste : bassin sur la selle (plus bas quand la suspension s'écrase = il s'accroupit, un peu levé en l'air),
  // buste penché vers le guidon (couché en accélération, redressé/tiré en arrière en l'air).
  const accroupi = Math.max(0, Math.min(1, ecrasement * 2.5));
  const bassin = { x: selle.x + t * 0.02 + accroupi * t * 0.06, y: selle.y - r * 0.25 + accroupi * r * 0.45 - air * r * 0.3 };
  const inclinaison = 0.55 + penche * 0.25 + accroupi * 0.3; // radians par rapport à la verticale, vers l'avant
  const longBuste = r * 1.9;
  const epaule = { x: bassin.x + Math.sin(inclinaison) * longBuste, y: bassin.y - Math.cos(inclinaison) * longBuste };
  // Jambes : cuisse bassin → genou → pied sur la pédale (le genou se déduit, un peu vers l'avant)
  ctx.strokeStyle = '#5B4FE0'; ctx.lineWidth = Math.max(2.5, r * 0.3);
  for (const pied of [pied1, pied2]) {
    const genou = { x: (bassin.x + pied.x) / 2 + r * 0.55, y: (bassin.y + pied.y) / 2 - r * 0.15 };
    ctx.beginPath(); ctx.moveTo(bassin.x, bassin.y); ctx.lineTo(genou.x, genou.y); ctx.lineTo(pied.x, pied.y); ctx.stroke();
  }
  // Le sac isotherme sur le dos : posé le long du buste, du côté opposé au guidon. Dessiné avant le buste
  // pour qu'il passe derrière l'épaule, comme une vraie sangle.
  const dosX = -Math.cos(inclinaison); const dosY = -Math.sin(inclinaison);
  ctx.save();
  ctx.translate((bassin.x + epaule.x) / 2 + dosX * r * 0.62, (bassin.y + epaule.y) / 2 + dosY * r * 0.62);
  ctx.rotate(inclinaison);
  arrondi(ctx, -r * 0.52, -r * 0.66, r * 1.04, r * 1.32, r * 0.22);
  ctx.fillStyle = IRIS; ctx.fill();
  ctx.strokeStyle = INK; ctx.lineWidth = Math.max(1, r * 0.11); ctx.stroke();
  ctx.fillStyle = LIME; ctx.font = `800 ${Math.max(6, r * 0.95).toFixed(1)}px system-ui, sans-serif`;
  ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
  ctx.fillText('f', 0, 0);
  ctx.restore();
  // Buste
  ctx.strokeStyle = '#F7F5F0'; ctx.lineWidth = Math.max(3, r * 0.38);
  ctx.beginPath(); ctx.moveTo(bassin.x, bassin.y); ctx.lineTo(epaule.x, epaule.y); ctx.stroke();
  // Bras vers le guidon (le coude descend quand il tire dessus en l'air)
  ctx.lineWidth = Math.max(2, r * 0.24);
  const coude = { x: (epaule.x + guidon.x) / 2, y: (epaule.y + guidon.y) / 2 + r * (0.35 + air * 0.2) };
  ctx.beginPath(); ctx.moveTo(epaule.x, epaule.y); ctx.lineTo(coude.x, coude.y); ctx.lineTo(guidon.x, guidon.y); ctx.stroke();
  // Tête et casque
  const tete = { x: epaule.x + Math.sin(inclinaison) * r * 0.55, y: epaule.y - Math.cos(inclinaison) * r * 0.55 };
  ctx.beginPath(); ctx.arc(tete.x, tete.y, r * 0.42, 0, Math.PI * 2); ctx.fillStyle = '#F2C9A0'; ctx.fill();
  ctx.beginPath(); ctx.arc(tete.x, tete.y, r * 0.46, Math.PI * 1.05, Math.PI * 2.05); ctx.fillStyle = LIME; ctx.fill();
  ctx.beginPath(); ctx.arc(tete.x, tete.y, r * 0.46, Math.PI * 1.05, Math.PI * 2.05); ctx.strokeStyle = INK; ctx.lineWidth = Math.max(1, r * 0.1); ctx.stroke();
  ctx.restore();
}
