import { aleatoire, choix, suivre, emoji, fondDegrade, halo, LIME, INK } from './dessin';

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
const ROT_ACCEL = 16; // accélération angulaire en l'air quand on maintient, rad/s²
const ROT_MAX = 9.5; // vitesse angulaire maxi, rad/s
const ROT_AMORT = 12; // amortissement de la rotation quand on relâche (1/s)
const ROT_GRACE = 0.12; // s d'envol avant que l'appui fasse tourner : les petits sauts de bosse sont immunisés
const REDRESSE = 1.6; // rappel doux vers l'horizontale (multiple de 2π le plus proche) une fois relâché, 1/s
const TOLERANCE = 0.68; // écart angle/pente admis à l'atterrissage (≈ 39°) ; au-delà = chute
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

const OBSTACLES = ['🪨', '🚧', '🛢️'];
const BONUS = ['🍕', '🍔', '🌮', '🍩'];
const DEUX_PI = Math.PI * 2;
const normaliser = (a) => { let r = a % DEUX_PI; if (r > Math.PI) r -= DEUX_PI; if (r < -Math.PI) r += DEUX_PI; return r; };
const lisse = (t) => t * t * (3 - 2 * t);
const borner = (v, a, b) => Math.max(a, Math.min(b, v));

export function creerRider(api) {
  let w = api.w; let h = api.h;
  // Vélo : position monde (x, y = point de contact au sol), vitesse, orientation
  let x = 0; let y = 0; let vx = 0; let vy = 0; let auSol = true; let tempsVol = 0;
  let angle = 0; let omega = 0; let angleDepart = 0; let flips = 0; let serie = 0; let serieObstacles = 0; let obstaclesVol = 0;
  // Saisie
  let pulse = 0;
  // Relief : échantillons tous les PAS px à partir de x0 ; T = 1 dans un trou (y retomber = chute)
  let H = []; let T = []; let x0 = 0; let xGen = 0; let yFin = 0; let yBase = 0; let sections = 0;
  // Objets du monde
  let obstacles = []; let bonus = []; let prochainJalon = 0;
  // Rendu
  let accumule = 0; // reliquat de temps non encore intégré (voir PAS_PHYSIQUE)
  let camX = 0; let camY = 0; let decal = 0; let ecrasement = 0; let vEcrasement = 0;
  let roue = 0; let vRoue = 0; let pedale = 0; let penche = 0; let air = 0; let secousse = 0;
  let poussiere = []; let traits = []; let flash = null; let derniereChute = null;

  const U = () => Math.min(w, h * 1.1);
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
  const poserObstacle = (px) => obstacles.push({ x: px, emoji: choix(OBSTACLES), passe: false });
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
  const genererSection = (n) => {
    const u = U();
    sections += 1;
    if (sections <= 2) { sectionVallons(u, 0); return; }
    const r = Math.random();
    // Le mélange se corse avec le niveau : plus de trous et de falaises, moins de plat.
    const pTrou = 0.08 + n * 0.025; const pChute = 0.06 + n * 0.02; const pTremplin = 0.32;
    if (r < pTremplin) sectionTremplin(u, n);
    else if (r < pTremplin + pTrou) sectionTrou(u, n);
    else if (r < pTremplin + pTrou + pChute) sectionChute(u, n);
    else if (r < 0.85) sectionVallons(u, n);
    else sectionPlat(u);
  };
  const assurer = (jusqua, n) => { while (xGen < jusqua) genererSection(n); };
  const elaguer = () => {
    const u = U();
    if (x - x0 < u * 6) return;
    const k = Math.floor((x - x0 - u * 2) / PAS);
    H.splice(0, k); T.splice(0, k); x0 += k * PAS;
    obstacles = obstacles.filter((o) => o.x > x - u);
    bonus = bonus.filter((b) => b.x > x - u);
  };

  const poussierer = (px, py, n, force) => { for (let k = 0; k < n; k++) poussiere.push({ x: px + (Math.random() - 0.5) * 24, y: py, vx: (Math.random() - 0.5) * force - force * 0.3, vy: -Math.random() * force * 0.5, reste: 0.45 }); };
  const chuter = (px, py, raison) => { derniereChute = { raison, x: px, tempsVol, ecart: normaliser(angle - Math.atan(pente(px))) }; poussierer(px, py, 16, 200); api.eclat?.(px - camX, py - camY, LIME, 10); return api.perdre(); };

  return {
    reset() {
      const u = U();
      H = []; T = []; x0 = 0; xGen = 0; sections = 0; yBase = h * 0.62; yFin = yBase; ajouter(yBase); ajouter(yBase);
      obstacles = []; bonus = []; prochainJalon = u * JALON;
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
    etat() { return { auSol, vx, vy, angle, rotation: angle - angleDepart, omega, dist: x, hauteur: sol(x) - y, U: U(), flips, serie, tempsVol, obstacles: obstacles.length, bonus: bonus.length, derniereChute }; },
    // PAS FIXE. La physique avance toujours par tranches de PAS_PHYSIQUE, jamais du dt de l'écran.
    // Avec un dt variable (60, 120, 144 Hz, une image en retard, un onglet qui se réveille), la même
    // action ne donnait pas tout à fait le même résultat d'une image à l'autre : l'accélération, le
    // ressort de suspension et la rotation intégraient des tranches inégales, et ça se voyait surtout
    // aux réceptions, en petites saccades. Ici chaque tranche est identique ; seul le nombre de
    // tranches par image change. Le reliquat est reporté à l'image suivante, jamais perdu.
    update(dt, input) {
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

      // --- Au sol : gaz / erre, gravité le long de la pente, plancher (le moteur ne cale pas).
      if (auSol) {
        const p = pente(x); const sinus = p / Math.sqrt(1 + p * p);
        if (appui) vx = vx < plafond ? Math.min(plafond, vx + POUSSEE * u * dt) : suivre(vx, plafond, 2, dt); // au-dessus du plafond (descente), l'excès s'use doucement
        else vx = suivre(vx, base, FREIN_MOTEUR, dt);
        vx += -sinus * g * PENTE_EFFET * dt;
        vx = borner(vx, base * VITESSE_PLANCHER, plafond * 1.25);
      }
      x += vx * dt;
      const ySol = sol(x); const p = pente(x);

      if (auSol) {
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
      if (!auSol) {
        tempsVol += dt;
        vy += g * dt; y += vy * dt;
        // Rotation : accélération angulaire tant qu'on maintient (après une petite grâce), sinon amortissement
        // et rappel doux vers l'horizontale. Aucun plafond de tours : celui qui tourne trop retombe de travers.
        if (appui && tempsVol > ROT_GRACE) {
          omega = Math.max(-ROT_MAX, omega - ROT_ACCEL * dt);
        } else {
          omega *= Math.max(0, 1 - dt * ROT_AMORT);
          const droit = Math.round(angle / DEUX_PI) * DEUX_PI;
          angle = suivre(angle, droit, REDRESSE, dt);
        }
        angle += omega * dt;
        // Un tour complet (un peu avant la fin, pour que l'annonce tombe quand on « revient ») = +1, sans plafond.
        const tours = (angleDepart - angle) / DEUX_PI;
        if (tours >= flips + 1 - 0.06) {
          flips += 1; api.marquer(1);
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
            if (parfait) api.marquer(1);
            flash = { texte: parfait ? (serie >= 2 ? `✨ PARFAIT +1 · ×${serie}` : '✨ PARFAIT +1') : (serie >= 2 ? `👌 NICE · ×${serie}` : '👌 NICE'), reste: 1.1 };
            api.eclat?.(x - camX, ySol - camY - t * 0.6, parfait ? '#FFD166' : LIME, parfait ? 14 : 8);
          } else serie = 0;
          if (!obstaclesVol) serieObstacles = 0; // la série d'obstacles tient tant que chaque vol en franchit au moins un
          y = ySol; vy = p * vx; angle = attendu + ecart; auSol = true; omega = 0; flips = 0; tempsVol = 0;
        }
      }

      // --- Suspension (ressort amorti), posture, roues
      const vise = auSol ? (appui ? 1 : 0.15) : (vy < 0 ? -0.7 : -0.3);
      penche = suivre(penche, vise, 6, dt);
      air = suivre(air, auSol ? 0 : 1, 8, dt);
      vEcrasement += (-ecrasement * 90 - vEcrasement * 12) * dt;
      ecrasement += vEcrasement * dt;
      if (auSol) { vRoue = vx / (t * 0.28); pedale += vRoue * 0.6 * dt; }
      else vRoue *= Math.max(0, 1 - dt * 0.8);
      roue += vRoue * dt;

      // --- Jalons, obstacles, bonus
      if (x >= prochainJalon) { prochainJalon += u * JALON; api.marquer(1); api.effet?.(x - camX, y - camY - t * 1.3, '+1'); }
      for (const o of obstacles) {
        if (o.passe || x < o.x) continue;
        o.passe = true;
        if (y > sol(o.x) - t * 0.4) return chuter(x, y, 'obstacle');
        serieObstacles += 1; obstaclesVol += 1;
        api.marquer(1); api.effet?.(x - camX, y - camY - t * 1.2, serieObstacles >= 3 ? `+1 ×${serieObstacles}` : '+1');
      }
      for (const b of bonus) {
        b.phase += dt * 3;
        if (b.pris) continue;
        if (Math.hypot(x - b.x, (y - t * 0.55) - b.y) < t * 0.66) {
          b.pris = true; api.marquer(1);
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
      // Collines lointaines puis proches (parallaxe moyenne) : deux couches, la plus proche plus sombre.
      const couches = [[0.25, 0.12, 'rgba(20,18,31,.18)', 0.48, 0.07], [0.5, 0.25, 'rgba(20,18,31,.3)', 0.58, 0.05]];
      for (const [kx, ky, couleur, base, amp] of couches) {
        ctx.fillStyle = couleur;
        ctx.beginPath(); ctx.moveTo(0, h + 10);
        for (let px = 0; px <= w; px += 6) { const xx = px + camX * kx; ctx.lineTo(px, h * base - camY * ky + Math.sin(xx / (u * 0.3)) * h * amp + Math.sin(xx / (u * 0.13) + 2) * h * amp * 0.4); }
        ctx.lineTo(w, h + 10); ctx.closePath(); ctx.fill();
      }

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
      ctx.beginPath();
      for (let px = xDeb; px <= xFin; px += PAS) { const yy = sol(px); if (px === xDeb) ctx.moveTo(px, yy); else ctx.lineTo(px, yy); }
      ctx.strokeStyle = LIME; ctx.lineWidth = 3; ctx.lineJoin = 'round'; ctx.stroke();
      // Marques au sol qui défilent : c'est elles qui donnent la vitesse à l'œil.
      ctx.strokeStyle = 'rgba(200,240,60,.4)'; ctx.lineWidth = 2;
      const pas = u * 0.11;
      for (let px = Math.floor(camX / pas) * pas; px <= xFin; px += pas) {
        if (trou(px)) continue;
        const yy = sol(px) + 10; const pp = pente(px);
        ctx.beginPath(); ctx.moveTo(px - 6, yy - pp * 6); ctx.lineTo(px + 6, yy + pp * 6); ctx.stroke();
      }
      // Obstacles et bonus
      for (const o of obstacles) {
        if (o.x < camX - t || o.x > xFin + t) continue;
        const yy = sol(o.x);
        ctx.fillStyle = 'rgba(20,18,31,.14)'; ctx.beginPath(); ctx.ellipse(o.x, yy + 2, t * 0.34, t * 0.09, 0, 0, Math.PI * 2); ctx.fill();
        halo(ctx, o.x, yy - t * 0.32, t * 0.5, '255,255,255', 0.4);
        emoji(ctx, o.emoji, o.x, yy - t * 0.32, t * 0.78);
      }
      for (const b of bonus) {
        if (b.pris || b.x < camX - t || b.x > xFin + t) continue;
        const by = b.y + Math.sin(b.phase) * 3;
        halo(ctx, b.x, by, t * 0.52, '255,209,102', 0.55);
        emoji(ctx, b.emoji, b.x, by, t * 0.62, Math.sin(b.phase * 0.7) * 0.15);
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

      if (flash) {
        ctx.save();
        ctx.globalAlpha = Math.min(1, flash.reste * 2);
        ctx.font = `800 ${Math.max(14, Math.min(24, w * 0.07))}px system-ui, sans-serif`;
        ctx.textAlign = 'center'; ctx.textBaseline = 'top';
        ctx.lineWidth = 4; ctx.strokeStyle = INK; ctx.strokeText(flash.texte, w / 2, 10);
        ctx.fillStyle = LIME; ctx.fillText(flash.texte, w / 2, 10);
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
