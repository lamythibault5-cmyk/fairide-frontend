import { aleatoire, choix, suivre, emoji, fondDegrade, IRIS, LIME, INK } from './dessin';

// FairRider — le vélo sur la route en bosses. Version « vivante » : plus d'emoji collé au sol qui saute
// d'un angle à l'autre, mais un vélo dessiné (roues qui tournent, cadre, cycliste qui se penche et pédale),
// une suspension qui encaisse les bosses et les atterrissages (écrasement puis rebond), une inclinaison qui
// suit la pente en douceur, la gravité qui accélère dans les descentes et freine dans les montées, un décor
// en parallaxe (collines lointaines, nuages, marques au sol) qui donne la sensation de vitesse.
//
// Commandes : un appui = saut immédiat (pas au relâchement : c'est ce qui rendait l'ancien vélo « en retard »).
// Garder le doigt pendant les premiers 0,18 s du saut le rend plus haut (saut « variable »). Un second appui
// en l'air = double saut. Maintenir en l'air au-delà de 0,3 s = salto. Garder le doigt appuyé une fois au sol
// (après l'atterrissage) = accélération. Espace fait la même chose au clavier.
//
// Unités : u = min(largeur, 1,1 × hauteur) ; toutes les vitesses en fraction de u ou de w par seconde.
const OBSTACLES = ['🪨', '🚧', '🛢️'];
const BONUS = ['🍕', '🍔', '🌮', '🍩'];
const normaliser = (a) => { let r = a % (Math.PI * 2); if (r > Math.PI) r -= Math.PI * 2; if (r < -Math.PI) r += Math.PI * 2; return r; };

export function creerRider(api) {
  let w = api.w; let h = api.h;
  // Mouvement
  let dist = 0; let y = 0; let vy = 0; let vx = 0; let auSol = true; let sautsRestants = 0; let tempsSaut = 0;
  // Orientation
  let angle = 0; let vitesseAngulaire = 0; let rotation = 0;
  // Saisie
  let appuiPrec = false; let dureeAppui = 0; let appuiDepuisSol = false;
  // Rendu
  let camY = 0; let ecrasement = 0; let vEcrasement = 0; let roue = 0; let pedale = 0; let vRoue = 0; let penche = 0; let poussiere = []; let flash = null; let traits = [];
  // Monde
  let obstacles = []; let bonus = []; let prochainObstacle = 0; let prochainBonus = 0; let prochainJalon = 0; let serie = 0;

  const u = () => Math.min(w, h * 1.1);
  const taille = () => Math.max(26, Math.min(46, w * 0.2));
  const xEcran = () => w * 0.3;
  // Relief : trois ondulations aux périodes irrationnelles entre elles (rien ne se répète à l'œil), plus une très
  // longue qui fait varier l'altitude générale, comme une vraie route de campagne.
  const sol = (x) => h * 0.68
    + Math.sin(x / (w * 0.23)) * w * 0.085
    + Math.sin(x / (w * 0.127) + 1.7) * w * 0.04
    + Math.sin(x / (w * 0.061) + 0.6) * w * 0.011
    + Math.sin(x / (w * 0.93) + 2.1) * h * 0.045;
  const pente = (x) => (sol(x + 2) - sol(x - 2)) / 4;
  const decoller = (impulsion) => { auSol = false; vy = Math.min(vy, 0) - impulsion; tempsSaut = 0; };
  const poussierer = (px, py, n, force) => { for (let k = 0; k < n; k++) poussiere.push({ x: px + (Math.random() - 0.5) * 24, y: py, vx: (Math.random() - 0.5) * force, vy: -Math.random() * force * 0.5, reste: 0.45 }); };

  return {
    reset() {
      dist = 0; y = sol(xEcran()); vy = 0; vx = w * 0.5; auSol = true; sautsRestants = 0; tempsSaut = 0;
      angle = Math.atan(pente(xEcran())); vitesseAngulaire = 0; rotation = 0;
      appuiPrec = false; dureeAppui = 0; appuiDepuisSol = false;
      camY = 0; ecrasement = 0; vEcrasement = 0; roue = 0; pedale = 0; vRoue = 0; penche = 0; poussiere = []; flash = null; traits = [];
      obstacles = []; bonus = []; prochainObstacle = xEcran() + w * 2.6; prochainBonus = xEcran() + w * 1.4; prochainJalon = w * 3; serie = 0;
    },
    redimensionner(nw, nh) { w = nw; h = nh; },
    // État lisible de l'extérieur (sondes, tests) : jamais utilisé par le rendu.
    etat() { return { auSol, vx, vy, angle, rotation, sautsRestants, dist, obstacles: obstacles.length, bonus: bonus.length }; },
    update(dt, input) {
      const n = input.niveau;
      const U = u(); const t = taille();
      const base = w * (0.5 + n * 0.05); const maxi = base * 1.5;

      // --- Saisie : le front montant déclenche le saut tout de suite.
      let presse = input.tapes.length > 0;
      if (!presse && input.enfonce && !appuiPrec) presse = true;
      if (input.enfonce) dureeAppui += dt; else { dureeAppui = 0; appuiDepuisSol = false; }
      if (presse) {
        if (auSol) { decoller(U * 0.88); sautsRestants = 1; rotation = 0; poussierer(xEcran(), y, 5, 80); }
        else if (sautsRestants > 0) { sautsRestants--; decoller(U * 0.78); poussierer(xEcran(), y, 7, 60); }
        appuiDepuisSol = false;
      }
      appuiPrec = input.enfonce;

      // --- Vitesse : accélération tenue au sol, gravité le long de la pente, plafond selon le niveau.
      const xmAvant = xEcran() + dist;
      const pIci = pente(xmAvant);
      if (auSol) {
        const boost = input.enfonce && appuiDepuisSol && dureeAppui > 0.12;
        const cible = boost ? maxi : base;
        vx = suivre(vx, cible, boost ? 2.4 : 1.6, dt);
        vx += -pIci * U * 0.9 * dt; // descente : plus vite ; montée : moins vite
        vx = Math.max(base * 0.72, Math.min(maxi * 1.08, vx));
      }
      dist += vx * dt;
      const xm = xEcran() + dist;
      const ySol = sol(xm); const p = pente(xm);
      const g = U * 1.35;

      // --- Sol / vol
      if (auSol) {
        const yLibre = y + vy * dt + 0.5 * g * dt * dt;
        if (yLibre < ySol - 1.5) { auSol = false; sautsRestants = 1; tempsSaut = 0; rotation = 0; }
        else {
          y = ySol; vy = p * vx;
          angle = suivre(angle, Math.atan(p), 10, dt); // l'inclinaison suit la pente sans à-coup (≈ 0,25 s pour se redresser)
          rotation = 0; vitesseAngulaire = 0;
          if (input.enfonce && !presse) appuiDepuisSol = true;
        }
      }
      if (!auSol) {
        tempsSaut += dt;
        // Saut variable : garder le doigt pendant le début de l'envol le prolonge un peu.
        if (input.enfonce && tempsSaut < 0.18 && vy < 0) vy -= U * 1.2 * dt;
        vy += g * dt; y += vy * dt;
        // Salto seulement si l'appui a commencé pour sauter (ou en l'air) : un doigt gardé depuis le sol pour accélérer
        // ne fait pas tourner le vélo quand une bosse le décolle — sinon on chutait « sans rien faire ».
        // Salto : rotation plus lente (un tour en ≈ 0,9 s) qui monte en douceur, et plafonnée : au-delà de
        // trois tours dans un même vol, le vélo se redresse de lui-même — cinq saltos d'un coup, ça n'existe pas.
        if (input.enfonce && dureeAppui > 0.3 && !appuiDepuisSol && rotation < Math.PI * 2 * 3) {
          vitesseAngulaire = suivre(vitesseAngulaire, -7, 5, dt);
        } else {
          vitesseAngulaire *= Math.max(0, 1 - dt * 8);
          const droit = Math.round(angle / (Math.PI * 2)) * Math.PI * 2;
          angle = suivre(angle, droit, 6, dt); // relâché : le vélo se redresse, sans à-coup
        }
        angle += vitesseAngulaire * dt; rotation += Math.abs(vitesseAngulaire * dt);
        if (y >= ySol) {
          const attendu = Math.atan(p);
          if (Math.abs(normaliser(angle - attendu)) > Math.PI * 0.5) { poussierer(xEcran(), ySol, 12, 160); return api.perdre(); }
          const saltos = Math.floor((rotation + Math.PI * 0.35) / (Math.PI * 2));
          if (saltos > 0) {
            api.marquer(saltos);
            flash = { texte: saltos === 1 ? 'SALTO ! +1' : `SALTO ×${saltos} ! +${saltos}`, reste: 1 };
            api.eclat?.(xEcran(), ySol - t * 0.6, LIME, 12);
          }
          // Atterrissage : écrasement proportionnel à la vitesse de chute, puis rebond de la suspension.
          vEcrasement = Math.min(1.6, vy / (U * 1.1)) * 6;
          poussierer(xEcran(), ySol, 6 + Math.round(vy / (U * 0.3)), 120);
          // Pas de « clac » à l'atterrissage : l'angle garde son écart (ramené entre -π et π) et le sol le rattrape en douceur.
          y = ySol; vy = p * vx; angle = attendu + normaliser(angle - attendu); auSol = true; rotation = 0; sautsRestants = 0; vitesseAngulaire = 0;
          if (input.enfonce) appuiDepuisSol = true;
        }
      }

      // --- Suspension (ressort amorti) et posture du cycliste
      const accel = auSol ? (input.enfonce && appuiDepuisSol ? 1 : 0) : (vy < 0 ? -0.6 : 0.6);
      penche = suivre(penche, accel, 6, dt);
      vEcrasement += (-ecrasement * 90 - vEcrasement * 12) * dt;
      ecrasement += vEcrasement * dt;
      if (auSol) { vRoue = vx / (t * 0.28); pedale += vRoue * 0.6 * dt; }
      else vRoue *= Math.max(0, 1 - dt * 1.2);
      roue += vRoue * dt;

      // --- Points de route, obstacles, bonus
      if (dist >= prochainJalon) { prochainJalon += w * 3; api.marquer(1); api.effet?.(xEcran(), y - t * 1.3, '+1'); }
      if (xm + w * 1.5 >= prochainObstacle) {
        let ox = prochainObstacle;
        for (let k = 0; k < 200 && pente(ox) < 0.06; k++) ox += 4; // jamais dans une montée raide : le saut doit être jouable
        obstacles.push({ x: ox, emoji: choix(OBSTACLES), passe: false });
        prochainObstacle = ox + w * (1.6 + Math.random() * 1.5) * Math.max(0.55, 1 - n * 0.06);
      }
      if (xm + w * 1.5 >= prochainBonus) {
        const bx = prochainBonus; const haut = U * aleatoire(0.32, 0.6);
        bonus.push({ x: bx, y: sol(bx) - haut, emoji: choix(BONUS), pris: false, phase: Math.random() * 6 });
        prochainBonus = bx + w * (1.1 + Math.random() * 1.4);
      }
      for (const o of obstacles) {
        if (o.passe || xm < o.x) continue;
        o.passe = true;
        if (auSol && y > sol(o.x) - t * 0.35) { poussierer(xEcran(), y, 14, 180); return api.perdre(); }
        serie += 1;
        api.marquer(1); api.effet?.(xEcran(), y - t * 1.2, serie >= 3 ? `+1 ×${serie}` : '+1');
      }
      for (const b of bonus) {
        b.phase += dt * 3;
        if (b.pris) continue;
        if (Math.hypot(xm - b.x, (y - t * 0.55) - b.y) < t * 0.62) { b.pris = true; api.marquer(1); api.effet?.(xEcran(), b.y - t * 0.4, '+1', '#FFD166'); api.eclat?.(xEcran(), b.y, '#FFD166', 8); }
      }
      obstacles = obstacles.filter((o) => o.x > dist - w * 0.5);
      bonus = bonus.filter((b) => b.x > dist - w * 0.5 && !(b.pris && b.phase > 99));
      if (auSol && ecrasement < 0.01 && serie && vx < base * 1.05 && Math.random() < dt * 0.4) serie = Math.max(0, serie); // la série tient tant qu'on ne touche pas le sol devant un obstacle

      // --- Caméra, traînées de vitesse, effets
      camY = suivre(camY, Math.max(0, h * 0.3 - y), 7, dt);
      if (vx > base * 1.18 && Math.random() < dt * 40) traits.push({ x: xEcran() - t * (0.6 + Math.random() * 0.8), y: y - t * aleatoire(0.15, 1.1), l: t * aleatoire(0.5, 1.2), reste: 0.22 });
      for (const tr of traits) { tr.x -= vx * dt * 0.9; tr.reste -= dt; }
      traits = traits.filter((tr) => tr.reste > 0);
      if (flash) { flash.reste -= dt; if (flash.reste <= 0) flash = null; }
      for (const pp of poussiere) { pp.x += pp.vx * dt; pp.y += pp.vy * dt; pp.vy += 200 * dt; pp.reste -= dt; }
      poussiere = poussiere.filter((pp) => pp.reste > 0);
      return undefined;
    },
    draw(ctx) {
      const t = taille();
      fondDegrade(ctx, w, h, '#2A2180', '#7B6CF0');
      // Nuages (parallaxe lente)
      ctx.fillStyle = 'rgba(255,255,255,.10)';
      for (let i = 0; i < 4; i++) {
        const cx = ((i * w * 0.37 - dist * 0.12) % (w * 1.4) + w * 1.4) % (w * 1.4) - w * 0.2;
        ctx.beginPath(); ctx.ellipse(cx, h * (0.1 + (i % 2) * 0.09) + camY * 0.15, w * 0.12, h * 0.035, 0, 0, Math.PI * 2); ctx.fill();
      }
      // Collines lointaines (parallaxe moyenne)
      ctx.fillStyle = 'rgba(20,18,31,.22)';
      ctx.beginPath(); ctx.moveTo(0, h + 10);
      for (let sx = 0; sx <= w; sx += 4) { const xx = sx + dist * 0.35; ctx.lineTo(sx, h * 0.5 + camY * 0.5 + Math.sin(xx / (w * 0.3)) * h * 0.06 + Math.sin(xx / (w * 0.13) + 2) * h * 0.025); }
      ctx.lineTo(w, h + 10); ctx.closePath(); ctx.fill();

      ctx.save();
      ctx.translate(0, camY);
      // Route
      ctx.beginPath(); ctx.moveTo(0, h + camY + 10);
      for (let sx = 0; sx <= w; sx += 3) ctx.lineTo(sx, sol(sx + dist));
      ctx.lineTo(w, h + camY + 10); ctx.closePath();
      ctx.fillStyle = '#17151F'; ctx.fill();
      ctx.beginPath();
      for (let sx = 0; sx <= w; sx += 3) { const yy = sol(sx + dist); if (sx === 0) ctx.moveTo(sx, yy); else ctx.lineTo(sx, yy); }
      ctx.strokeStyle = LIME; ctx.lineWidth = 3; ctx.lineJoin = 'round'; ctx.stroke();
      // Marques au sol qui défilent : c'est elles qui donnent la vitesse à l'œil.
      ctx.strokeStyle = 'rgba(200,240,60,.45)'; ctx.lineWidth = 2;
      const pas = w * 0.11; const decal = ((dist % pas) + pas) % pas;
      for (let sx = -decal; sx <= w; sx += pas) {
        const xx = sx + dist; const yy = sol(xx) + 10; const pp = pente(xx);
        ctx.beginPath(); ctx.moveTo(sx - 6, yy - pp * 6); ctx.lineTo(sx + 6, yy + pp * 6); ctx.stroke();
      }
      // Obstacles et bonus
      for (const o of obstacles) {
        const sx = o.x - dist;
        if (sx < -t || sx > w + t) continue;
        ctx.fillStyle = 'rgba(20,18,31,.14)'; ctx.beginPath(); ctx.ellipse(sx, sol(o.x) + 2, t * 0.34, t * 0.09, 0, 0, Math.PI * 2); ctx.fill();
        emoji(ctx, o.emoji, sx, sol(o.x) - t * 0.32, t * 0.78);
      }
      for (const b of bonus) {
        const sx = b.x - dist;
        if (sx < -t || sx > w + t || b.pris) continue;
        emoji(ctx, b.emoji, sx, b.y + Math.sin(b.phase) * 3, t * 0.62, Math.sin(b.phase * 0.7) * 0.15);
      }
      // Ombre du vélo (plus petite quand il est haut)
      const ySolIci = sol(xEcran() + dist);
      const haut = Math.max(0, ySolIci - y);
      ctx.fillStyle = `rgba(0,0,0,${(0.4 * Math.max(0.25, 1 - haut / (h * 0.6))).toFixed(3)})`;
      ctx.beginPath(); ctx.ellipse(xEcran(), ySolIci - 2, t * 0.42 * Math.max(0.5, 1 - haut / (h * 0.9)), t * 0.09, 0, 0, Math.PI * 2); ctx.fill();
      // Traînées de vitesse
      ctx.strokeStyle = 'rgba(255,255,255,.45)'; ctx.lineWidth = 2; ctx.lineCap = 'round';
      for (const tr of traits) { ctx.globalAlpha = tr.reste / 0.22; ctx.beginPath(); ctx.moveTo(tr.x, tr.y); ctx.lineTo(tr.x - tr.l, tr.y); ctx.stroke(); }
      ctx.globalAlpha = 1;
      // Poussière
      ctx.fillStyle = 'rgba(200,240,60,.9)';
      for (const pp of poussiere) { ctx.globalAlpha = Math.max(0, pp.reste * 2.2); ctx.beginPath(); ctx.arc(pp.x, pp.y, 2.2, 0, Math.PI * 2); ctx.fill(); }
      ctx.globalAlpha = 1;
      // Le vélo et son cycliste
      dessinerVelo(ctx, xEcran(), y, t, angle, roue, pedale, ecrasement, penche);
      ctx.restore();

      if (flash) {
        ctx.save();
        ctx.globalAlpha = Math.min(1, flash.reste * 2);
        ctx.font = `800 ${Math.max(14, Math.min(26, w * 0.085))}px system-ui, sans-serif`;
        ctx.textAlign = 'center'; ctx.textBaseline = 'top';
        ctx.lineWidth = 4; ctx.strokeStyle = INK; ctx.strokeText(flash.texte, w / 2, 10);
        ctx.fillStyle = LIME; ctx.fillText(flash.texte, w / 2, 10);
        ctx.restore();
      }
    }
  };
}

// Le vélo, dessiné : point de contact (x, y) = le sol sous les roues, taille t ≈ empattement, angle = inclinaison,
// roue = angle des roues (elles tournent avec la distance), ecrasement = suspension (0 = repos), penche = posture
// du cycliste (-1 en l'air vers le haut, +1 en accélération : il se couche sur le guidon).
function dessinerVelo(ctx, x, y, t, angle, roue, pedale, ecrasement, penche) {
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
  // Pédales (tournent avec les roues)
  const pa = pedale; const lp = r * 0.45;
  const pied1 = { x: pedalier.x + Math.cos(pa) * lp, y: pedalier.y + Math.sin(pa) * lp };
  const pied2 = { x: pedalier.x - Math.cos(pa) * lp, y: pedalier.y - Math.sin(pa) * lp };
  ctx.strokeStyle = INK; ctx.lineWidth = Math.max(1.5, r * 0.14);
  ctx.beginPath(); ctx.moveTo(pied1.x, pied1.y); ctx.lineTo(pied2.x, pied2.y); ctx.stroke();
  // Cycliste : bassin sur la selle, buste penché vers le guidon (plus couché en accélération, redressé en l'air)
  const bassin = { x: selle.x + t * 0.02, y: selle.y - r * 0.25 };
  const inclinaison = 0.55 + penche * 0.25; // radians par rapport à la verticale, vers l'avant
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
  // Bras vers le guidon
  ctx.lineWidth = Math.max(2, r * 0.24);
  const coude = { x: (epaule.x + guidon.x) / 2, y: (epaule.y + guidon.y) / 2 + r * 0.35 };
  ctx.beginPath(); ctx.moveTo(epaule.x, epaule.y); ctx.lineTo(coude.x, coude.y); ctx.lineTo(guidon.x, guidon.y); ctx.stroke();
  // Tête et casque
  const tete = { x: epaule.x + Math.sin(inclinaison) * r * 0.55, y: epaule.y - Math.cos(inclinaison) * r * 0.55 };
  ctx.beginPath(); ctx.arc(tete.x, tete.y, r * 0.42, 0, Math.PI * 2); ctx.fillStyle = '#F2C9A0'; ctx.fill();
  ctx.beginPath(); ctx.arc(tete.x, tete.y, r * 0.46, Math.PI * 1.05, Math.PI * 2.05); ctx.fillStyle = LIME; ctx.fill();
  ctx.beginPath(); ctx.arc(tete.x, tete.y, r * 0.46, Math.PI * 1.05, Math.PI * 2.05); ctx.strokeStyle = INK; ctx.lineWidth = Math.max(1, r * 0.1); ctx.stroke();
  ctx.restore();
}
