// Les trois mini-jeux de Mon compte (FairCatch, FairDodge, FairFlash), sous forme de définitions pures : pas de
// React, pas de DOM. Les trois autres (FairSort, FairRider, FairArrow) ont été retirés le 23/09/2026.
// Chaque jeu reçoit un `api` du moteur (GameFrame.jsx) et lui rend un objet { update, draw, ... }.
//
// POURQUOI SORTIR LA LOGIQUE DE REACT. Les versions précédentes tenaient chaque jeu dans un composant
// qui poussait TOUT son état dans React seize fois par seconde (setInterval de 60 ms) : chaque tic
// re-rendait chaque plat en <span>. Résultat : une chute par à-coups, et une saisie qui traînait. Ici
// le moteur tourne à la cadence de l'écran (requestAnimationFrame, dt réel), l'état vit dans des
// fermetures, et le rendu se fait sur un <canvas> — React n'est plus dans la boucle.
//
// UNITÉS. Toutes les vitesses sont exprimées en fraction de la hauteur (ou largeur) du cadre par
// seconde, jamais en pixels : le même jeu tourne dans une colonne de 140px et en plein écran sans
// changer de difficulté. Les valeurs sont celles des anciennes versions, converties (px par tic de
// 60 ms sur un cadre de 260px → fraction de hauteur par seconde).
//
// CONTRAT. api = { w, h, large, marquer(n), perdre(), soigner?, vies?, viesMax?, invincible?, effet?, eclat?, niveau(), score(), t? }.
// perdre() retire un cœur et rend vrai tant que la partie continue (voir VIES dans GameFrame). Le jeu expose :
//   reset()                      — nouvelle partie
//   update(dt, input)            — dt en secondes (plafonné par le moteur), input = { x, y, enfonce,
//                                  tapes: [{x, y}], niveau }
//   draw(ctx)                    — le contexte est déjà mis à l'échelle en pixels CSS
//   redimensionner(w, h)         — le cadre a changé de taille (plein écran, rotation) : les positions
//                                  sont rééchelonnées, rien ne sort du cadre ni ne saute
//   etat()                       — lecture seule, pour les sondes et le banc d'essai (jamais le rendu)
//
// Les textes qui s'affichent DANS le terrain (« Pfiou ! », « Parfait ! ») passent par api.t quand le
// moteur le fournit ; le français de jeux.js n'est que le repli. Les règles (regles + controles) sont
// aussi traduites par le moteur, clé par clé : jeux.<key>_regles_0..3.

import { aleatoire, choix, courbe, emoji, fondDegrade, sacFairide, IRIS, LIME } from './dessin';

const OR = '#FFD166';
const ROUGE = '#FF6B6B';
const ORANGE = '#FFA94D';
const borner = (v, a, b) => Math.max(a, Math.min(b, v));
// Texte traduit par le moteur, ou repli français si la clé manque (ou hors moteur, sur le banc d'essai).
const tx = (api, cle, defaut) => { const v = api.t?.(cle); return v && v !== cle ? v : defaut; };

// ---------------------------------------------------------------------------------------------------
// Base commune aux trois jeux « ça tombe » : attraper, esquiver, trier. Seules changent les règles de
// contact (toucher un objet, le laisser passer, le frôler) et la population d'objets.
//
// cfg = {
//   joueur, ciel, eclat?          — emoji du joueur, dégradé du fond, couleur des éclats
//   nouvelObjet(n)                — { emoji, points?, or?, mauvais?, vitesseFacteur? }
//   intervalle(n), vitesse(n)     — cadence de spawn (s) et vitesse (fraction de h par s) au niveau n
//   demiContact                   — demi-largeur de contact, en tailles d'objet (1,35 = généreux, 1 = juste)
//   echelle?                      — facteur sur la taille des objets et de tout le terrain (1 = plein, 0,78 = plus aéré)
//   toucher(o) / manquer(o)       — 'point' | 'perdu' | null quand l'objet touche le joueur / le sol
//   passer?(o, dx, demi, t)       — l'objet vient de passer sous le joueur sans contact : 'point' | 'frole' | 'alerte' | null
// }
// ---------------------------------------------------------------------------------------------------
function creerChute(api, cfg) {
  let w = api.w; let h = api.h;
  let objets = []; let depuisSpawn = 0; let joueurX = w / 2; let cibleX = w / 2; let rebond = 0; let vRebond = 0;
  let horloge = 0; let derniereArrivee = 0; let alerte = 0; let vJoueur = 0; let defile = 0; let vitesseDecor = 0.2;
  // Bonus : aimant (FairCatch, les plats viennent au sac pendant AIMANT s), bouclier (FairSort, encaisse UN déchet),
  // nitro (FairDodge, EXPRESS s d'invincibilité). Commande du client (FairCatch) : trois plats à attraper, +5.
  let aimant = 0; let bouclier = false; let nitro = 0; let commande = null; let commandesLivrees = 0;
  const AIMANT = 5; const EXPRESS = 3.2; const PRIME_COMMANDE = 5;
  const nouvelleCommande = () => { const pool = [...PLATS].sort(() => Math.random() - 0.5); commande = { plats: pool.slice(0, 3).map((e) => ({ emoji: e, fait: false })), age: 0 }; };
  const SORTIE = 0.14; // durée de l'effacement d'un objet arrivé au sol
  // Bornés aussi par la HAUTEUR, pour qu'un terrain large et bas (téléphone couché) garde le temps de voir
  // l'objet tomber. cfg.echelle réduit tout le terrain d'un jeu (objets, joueur, décor, ombres, jetons — tout
  // est exprimé en tailles d'objet) : le fondateur trouvait FairCatch et FairDodge trop chargés (2026-09-19),
  // on voit désormais plus de terrain et les objets arrivent de plus loin.
  const tailleObjet = () => Math.max(22, Math.min(64, Math.min(w * 0.17, h * 0.15)) * (cfg.echelle ?? 1));
  const largeurJoueur = () => tailleObjet() * 1.7;
  const yJoueur = () => h - tailleObjet() * 1.3;
  const ySol = () => h - tailleObjet() * 0.3; // là où un objet « touche le sol » (le bandeau au bas du terrain)

  return {
    reset() { objets = []; depuisSpawn = 0; joueurX = w / 2; cibleX = w / 2; rebond = 0; vRebond = 0; horloge = 0; derniereArrivee = 0; alerte = 0; vJoueur = 0; defile = 0; aimant = 0; bouclier = false; nitro = 0; commande = null; commandesLivrees = 0; if (cfg.commandes) nouvelleCommande(); },
    redimensionner(nw, nh) {
      const kx = nw / w; const ky = nh / h; w = nw; h = nh;
      joueurX *= kx; cibleX *= kx; vJoueur *= kx;
      const t = tailleObjet();
      for (const o of objets) { o.x *= kx; o.y *= ky; o.depart *= ky; o.trajet *= ky; o.taille = t; }
    },
    etat() { return { objets: objets.length, joueurX, alerte, yJoueur: yJoueur(), taille: tailleObjet(), aimant, bouclier, nitro, commandesLivrees, commande: commande ? commande.plats.filter((p) => p.fait).length : -1, liste: objets.filter((o) => !o.sortie).map((o) => ({ x: o.x, y: o.y, mauvais: !!o.mauvais, or: !!o.or, bonus: o.bonus || null })) }; },
    update(dt, input) {
      const n = input.niveau;
      const t = tailleObjet(); const lj = largeurJoueur();
      const demiContact = t * (cfg.demiContact ?? 1.35) - 4;
      horloge += dt;
      if (alerte > 0) alerte = Math.max(0, alerte - dt);
      if (aimant > 0) aimant = Math.max(0, aimant - dt);
      if (nitro > 0) nitro = Math.max(0, nitro - dt);
      if (commande) commande.age += dt;
      // Le joueur suit le pointeur avec un léger lissage : direct, ça vibre au pixel près ; trop lent,
      // on rate. 18 par seconde = un rattrapage en ~60 ms, imperceptible mais qui gomme le tremblement.
      if (input.x != null) cibleX = borner(input.x, lj / 2, w - lj / 2);
      // Ressort presque critique plutôt qu'un rattrapage exponentiel : le panier accélère, file et se pose sans
      // à-coup quand le doigt s'arrête — un vrai objet avec une masse, toujours aussi réactif (≈ 0,06 s de retard).
      {
        const raideur = 2200; const amorti = 2 * Math.sqrt(raideur) * 0.95;
        const sous = Math.max(1, Math.ceil(dt / (1 / 120)));
        for (let i = 0; i < sous; i++) {
          const d = dt / sous;
          vJoueur += ((cibleX - joueurX) * raideur - vJoueur * amorti) * d;
          joueurX += vJoueur * d;
        }
        if (joueurX < lj / 2) { joueurX = lj / 2; vJoueur = Math.max(0, vJoueur); }
        if (joueurX > w - lj / 2) { joueurX = w - lj / 2; vJoueur = Math.min(0, vJoueur); }
      }
      // Ressort du panier : un petit rebond à chaque prise, qui retombe de lui-même.
      vRebond += (-rebond * 120 - vRebond * 11) * dt; rebond += vRebond * dt;

      depuisSpawn += dt;
      if (depuisSpawn >= cfg.intervalle(n)) {
        depuisSpawn = 0;
        // Un bonus de temps en temps (jamais deux à l'écran, jamais pendant qu'un est actif), sinon l'objet du jeu.
        const bonusPresent = objets.some((x) => x.bonus) || aimant > 0 || nitro > 0 || bouclier;
        // Un cœur manque : un bonus sur trois devient un cœur qui en rend un (voir VIES dans GameFrame).
        const blesse = (api.vies?.() ?? 0) < (api.viesMax?.() ?? 0);
        const o = cfg.bonus && !bonusPresent && Math.random() < 0.06 + n * 0.004 ? (blesse && Math.random() < 0.35 ? { ...COEUR } : cfg.bonus(n)) : cfg.nouvelObjet(n);
        let v = cfg.vitesse(n) * h * (o.vitesseFacteur || 1);
        // Équité : deux objets n'atteignent jamais le sol à moins de `ecart` s l'un de l'autre, quel que
        // soit le tirage des vitesses. Sans ça, un plat lent rattrapé par un plat rapide arrivaient
        // ensemble aux deux bords du terrain, et personne ne pouvait attraper les deux. L'écart suit la
        // cadence de spawn : plus court, il ferait s'agglutiner derrière un objet lent tout ce qui suit.
        const trajet = ySol() + t;
        const ecart = Math.max(0.3, cfg.intervalle(n) * 0.75);
        const arrivee = Math.max(horloge + trajet / v, derniereArrivee + ecart);
        v = trajet / (arrivee - horloge);
        derniereArrivee = arrivee;
        vitesseDecor += (v / h - vitesseDecor) * 0.3;
        // Chute accélérée (la gravité, freinée par l'air) plutôt qu'à vitesse constante : l'objet part doucement et
        // arrive vite. L'heure d'arrivée au sol reste exactement celle calculée ci-dessus : l'équité est intacte.
        objets.push({ ...o, x: aleatoire(t / 2, w - t / 2), y: -t, depart: -t, trajet, t0: horloge, duree: arrivee - horloge, taille: t, phase: Math.random() * Math.PI * 2, balance: aleatoire(0.12, 0.28), rot: 0, spin: aleatoire(-0.9, 0.9) * (o.mauvais || cfg.tournoie ? 1.6 : 0.5), passe: false, sortie: 0 });
      }
      const yJ = yJoueur(); const sol = ySol();
      const restants = [];
      for (const o of objets) {
        // Objet arrivé au sol : il s'efface (SORTIE s) sans plus interagir.
        if (o.sortie > 0) { o.sortie -= dt; if (o.sortie > 0) restants.push(o); continue; }
        {
          const p = (horloge - o.t0) / o.duree;
          // Sur la route (FairDodge), les obstacles viennent à la vitesse du scooter : vitesse constante, c'est le réalisme.
          const lin = cfg.route ? 1 : CHUTE_LIN;
          const f = p <= 1 ? lin * p + (1 - lin) * p * p : 1 + (2 - lin) * (p - 1);
          o.y = o.depart + o.trajet * f;
        }
        o.phase += dt * 3; o.rot += o.spin * dt;
        // Aimant (FairCatch) : les bons objets à portée glissent vers le sac.
        if (aimant > 0 && !o.mauvais && !o.bonus && o.y > yJ - h * 0.55) o.x += (joueurX - o.x) * Math.min(1, dt * 4.5);
        const dx = Math.abs(o.x - joueurX); const dy = o.y - yJ;
        // `inoffensif` : l'objet a traversé le joueur pendant sa grâce (il clignote) — il finit sa course sans plus rien toucher.
        if (!o.inoffensif && Math.abs(dy) < t * 0.6 && dx < demiContact) {
          // Bonus attrapé : il s'active, +2, et un mot dans le terrain.
          if (o.bonus) {
            api.bonus?.(); api.enchainer?.(); api.marquer(2); vRebond = 7;
            api.eclat?.(o.x, yJ - t * 0.4, OR, 16);
            if (o.bonus === 'aimant') { aimant = AIMANT; api.effet?.(o.x, yJ - t * 0.9, `🧲 ${tx(api, 'jeux.fx_aimant', 'Aimant !')}`, OR); }
            if (o.bonus === 'bouclier') { bouclier = true; api.effet?.(o.x, yJ - t * 0.9, `🛡️ ${tx(api, 'jeux.fx_bouclier', 'Bouclier !')}`, OR); }
            if (o.bonus === 'nitro') { nitro = EXPRESS; api.effet?.(o.x, yJ - t * 0.9, `⚡ ${tx(api, 'jeux.fx_express', 'Express !')}`, OR); }
            if (o.bonus === 'pourboire') { api.marquer(1); api.effet?.(o.x, yJ - t * 0.9, `💶 +3`, OR); }
            if (o.bonus === 'vie') { api.soigner?.(); api.effet?.(o.x, yJ - t * 0.9, `+1 ♥ ${tx(api, 'jeux.fx_vie', 'Vie !')}`, ROUGE); }
            continue;
          }
          const effet = cfg.toucher(o);
          if (effet === 'perdu') {
            // Bouclier : il encaisse ce déchet et disparaît. Nitro : l'obstacle éclate, et compte comme évité.
            if (bouclier) { bouclier = false; api.rompre?.(); api.secouer?.(0.5); api.effet?.(o.x, yJ - t * 0.9, `🛡️ ${tx(api, 'jeux.fx_encaisse', 'Encaissé !')}`, OR); api.eclat?.(o.x, yJ - t * 0.4, '#FFFFFF', 18); continue; }
            if (nitro > 0) { api.enchainer?.(); api.marquer(1); api.effet?.(o.x, yJ - t * 0.9, `⚡ +1`, LIME); api.eclat?.(o.x, yJ - t * 0.4, LIME, 12); continue; }
            // Pendant la grâce, l'obstacle traverse le joueur, estompé. Sinon il éclate et coûte un cœur.
            if ((api.invincible?.() ?? 0) > 0) { o.inoffensif = true; restants.push(o); continue; }
            if ((api.vies?.() ?? 1) > 0) api.eclat?.(o.x, yJ - t * 0.4, ROUGE, 14);
            api.perdre();
            o.inoffensif = true; o.sortie = SORTIE; restants.push(o);
            continue;
          }
          if (effet === 'point') {
            const pts = o.points || 1;
            api.enchainer?.();
            api.marquer(pts);
            api.effet?.(o.x, yJ - t * 0.9, `+${pts}`, o.or ? OR : undefined);
            api.eclat?.(o.x, yJ - t * 0.4, o.or ? OR : cfg.eclat || IRIS, o.or ? 14 : 7);
            vRebond = o.or ? 7 : 5;
            // Commande du client (FairCatch) : ce plat en faisait-il partie ? Les trois réunis = commande livrée, +5.
            if (commande) {
              const p = commande.plats.find((x) => !x.fait && x.emoji === o.emoji);
              if (p) { p.fait = true; if (commande.plats.every((x) => x.fait)) { commandesLivrees += 1; api.marquer(PRIME_COMMANDE); api.bonus?.(); api.effet?.(w / 2, h * 0.32, `🛍️ ${tx(api, 'jeux.fx_commande', 'Commande livrée !')} +${PRIME_COMMANDE}`, OR); api.eclat?.(w / 2, h * 0.3, OR, 24); nouvelleCommande(); } }
            }
          }
          continue;
        }
        // L'objet vient de passer sous le joueur sans contact : esquivé (FairDodge), déchet évité (FairSort).
        if (!o.passe && dy >= t * 0.6) {
          o.passe = true;
          // Un bonus manqué ne rapporte rien, un obstacle traversé pendant la grâce non plus.
          const effet = o.bonus || o.inoffensif ? null : cfg.passer?.(o, dx, demiContact, t);
          if (effet === 'point') { api.enchainer?.(); api.marquer(1); api.effet?.(o.x, yJ - t * 0.9, '+1'); }
          if (effet === 'frole') { api.enchainer?.(); api.marquer(2); api.effet?.(o.x, yJ - t * 0.9, `${tx(api, 'jeux.fx_pfiou', 'Pfiou !')} +2`, ORANGE); api.eclat?.(o.x, yJ, ORANGE, 6); }
          if (effet === 'alerte') { alerte = 0.4; api.effet?.(o.x, yJ - t * 0.9, tx(api, 'jeux.fx_ouf', 'Ouf !'), ORANGE); }
          // Un bon plat passé sous le sac sans être pris (FairSort, FairCatch avec bouclier…) casse la série.
          if (!o.mauvais && !o.bonus && !cfg.route) api.rompre?.();
        }
        if (o.y > sol) {
          const effet = o.bonus || o.inoffensif ? null : cfg.manquer(o);
          if (effet === 'perdu') {
            if (bouclier) { bouclier = false; api.rompre?.(); api.secouer?.(0.5); api.effet?.(o.x, sol - t * 1.2, `🛡️ ${tx(api, 'jeux.fx_encaisse', 'Encaissé !')}`, OR); o.sortie = SORTIE; restants.push(o); continue; }
            // Un plat par terre : un cœur de moins (sauf pendant la grâce, où il s'efface sans rien coûter).
            if (!((api.invincible?.() ?? 0) > 0) && (api.vies?.() ?? 1) > 0) { api.effet?.(o.x, sol - t * 1.2, '−1 ♥', ROUGE); api.eclat?.(o.x, sol - t * 0.4, ROUGE, 10); }
            api.perdre();
            o.sortie = SORTIE; restants.push(o);
            continue;
          }
          if (effet === 'point') { api.marquer(1); api.effet?.(o.x, sol - t * 1.2, '+1'); }
          o.sortie = SORTIE;
        }
        restants.push(o);
      }
      objets = restants;
      defile += vitesseDecor * h * dt;
      return undefined;
    },
    draw(ctx) {
      fondDegrade(ctx, w, h, cfg.ciel[0], cfg.ciel[1]);
      const t = tailleObjet(); const sol = ySol();
      // Route qui défile (FairDodge) : des tirets de voie qui descendent à la vitesse des obstacles — on sent
      // qu'on roule. Ailleurs, une fine pluie de points lumineux en parallaxe donne la même sensation de mouvement.
      if (cfg.route) {
        // Une vraie rue qui défile : trottoirs pavés, bordures jaunes, grain d'asphalte, lampadaires au halo chaud,
        // tirets de voie francs. Tout avance à la vitesse des obstacles : on sent qu'on roule, et à quelle allure.
        const trottoir = Math.max(12, w * 0.065);
        ctx.fillStyle = '#4B4862';
        ctx.fillRect(0, 0, trottoir, h); ctx.fillRect(w - trottoir, 0, trottoir, h);
        ctx.fillStyle = 'rgba(0,0,0,.22)';
        const pasPave = Math.max(14, h * 0.05);
        for (let yv = (defile % pasPave) - pasPave; yv < h; yv += pasPave) { ctx.fillRect(0, yv, trottoir, 2); ctx.fillRect(w - trottoir, yv, trottoir, 2); }
        ctx.fillStyle = '#F5B800';
        ctx.fillRect(trottoir - 4, 0, 4, h); ctx.fillRect(w - trottoir, 0, 4, h);
        // Grain de l'asphalte
        ctx.fillStyle = 'rgba(255,255,255,.06)';
        for (let i = 0; i < 40; i++) {
          const gx = trottoir + ((i * 73.7) % (w - trottoir * 2));
          const gy = (((i * 157) % h) + defile) % h;
          ctx.fillRect(gx, gy, 2, 2);
        }
        // Tirets de voie
        ctx.fillStyle = 'rgba(255,255,255,.7)';
        const pasTiret = h * 0.16; const lTiret = h * 0.08;
        for (const xv of [w / 3, (2 * w) / 3]) {
          for (let yv = (defile % pasTiret) - pasTiret; yv < h; yv += pasTiret) ctx.fillRect(xv - 3, yv, 6, lTiret);
        }
        // Lampadaires, en quinconce sur les deux trottoirs : halo chaud au sol, tête lumineuse.
        const pasLampe = h * 0.55;
        for (let k = -1; k < 4; k++) {
          const yl = (defile % pasLampe) + k * pasLampe;
          const gauche = ((Math.floor(defile / pasLampe) - k) % 2 + 2) % 2 === 0;
          const xl = gauche ? trottoir * 0.5 : w - trottoir * 0.5;
          const gl = ctx.createRadialGradient(xl, yl, 2, xl, yl, w * 0.28);
          gl.addColorStop(0, 'rgba(255,214,140,.30)'); gl.addColorStop(1, 'rgba(255,214,140,0)');
          ctx.fillStyle = gl; ctx.beginPath(); ctx.arc(xl, yl, w * 0.28, 0, Math.PI * 2); ctx.fill();
          ctx.fillStyle = '#FFE3A8'; ctx.beginPath(); ctx.arc(xl, yl, Math.max(4, trottoir * 0.28), 0, Math.PI * 2); ctx.fill();
          ctx.strokeStyle = 'rgba(20,18,31,.6)'; ctx.lineWidth = 2; ctx.stroke();
        }
        // Phare du scooter : un cône de lumière vers l'avant, qui suit le joueur — on voit ce qui arrive droit devant.
        {
          const yp = h - t * 1.4; const portee = h * 0.42;
          const gp = ctx.createLinearGradient(0, yp, 0, yp - portee);
          gp.addColorStop(0, 'rgba(255,244,200,.30)'); gp.addColorStop(1, 'rgba(255,244,200,0)');
          ctx.fillStyle = gp;
          ctx.beginPath(); ctx.moveTo(joueurX - t * 0.25, yp); ctx.lineTo(joueurX - t * 1.6, yp - portee); ctx.lineTo(joueurX + t * 1.6, yp - portee); ctx.lineTo(joueurX + t * 0.25, yp); ctx.closePath(); ctx.fill();
        }
      } else {
        ctx.fillStyle = 'rgba(255,255,255,.10)';
        for (let i = 0; i < 14; i++) {
          const px = ((i * 97.3) % 1) * w + ((i * 53) % w);
          const py = (((i * 71) % h) + defile * (0.25 + (i % 3) * 0.12)) % h;
          ctx.beginPath(); ctx.arc(px % w, py, 1 + (i % 3) * 0.6, 0, Math.PI * 2); ctx.fill();
        }
      }
      // Sol : une bande CLAIRE, pas une ombre. En sombre sur un ciel sombre, la ligne d'arrivée des
      // objets disparaissait — c'est pourtant là que tout se joue. Le liseré lime la souligne franchement.
      if (cfg.decor === 'marche') {
        // Guirlande lumineuse sous l'auvent : ampoules colorées sur un fil qui pend, avec leur halo.
        const yFil = t * 1.15;
        ctx.strokeStyle = 'rgba(20,18,31,.55)'; ctx.lineWidth = 1.5;
        ctx.beginPath();
        for (let px = 0; px <= w; px += 8) { const yy = yFil + Math.sin((px / w) * Math.PI * 3) * t * 0.18 + t * 0.18; if (px === 0) ctx.moveTo(px, yy); else ctx.lineTo(px, yy); }
        ctx.stroke();
        const COUL = ['200,240,60', '255,92,138', '255,209,102', '140,124,255'];
        const nb = Math.max(6, Math.round(w / 48));
        for (let i = 0; i < nb; i++) {
          const px = (i + 0.5) * (w / nb); const yy = yFil + Math.sin((px / w) * Math.PI * 3) * t * 0.18 + t * 0.18 + 4;
          const c = COUL[i % COUL.length]; const eclat = 0.6 + 0.4 * Math.sin(horloge * 2.2 + i * 1.3);
          const gg = ctx.createRadialGradient(px, yy, 1, px, yy, t * 0.55);
          gg.addColorStop(0, `rgba(${c},${(0.45 * eclat).toFixed(3)})`); gg.addColorStop(1, `rgba(${c},0)`);
          ctx.fillStyle = gg; ctx.beginPath(); ctx.arc(px, yy, t * 0.55, 0, Math.PI * 2); ctx.fill();
          ctx.fillStyle = `rgb(${c})`; ctx.beginPath(); ctx.arc(px, yy, Math.max(3, t * 0.09), 0, Math.PI * 2); ctx.fill();
        }
        // Colonne de visée : une lumière douce au-dessus du panier, pour voir où tomberont les plats rattrapés.
        const gv = ctx.createLinearGradient(0, h - t * 1.5, 0, h * 0.25);
        gv.addColorStop(0, 'rgba(200,240,60,.16)'); gv.addColorStop(1, 'rgba(200,240,60,0)');
        ctx.fillStyle = gv; ctx.fillRect(joueurX - largeurJoueur() / 2, h * 0.25, largeurJoueur(), h * 0.75 - t * 1.5);
        // Comptoir en bois : planches, chant clair, ombre portée — la ligne d'arrivée se lit comme un vrai plan.
        const yc = h - t * 0.55;
        const gb = ctx.createLinearGradient(0, yc, 0, h);
        gb.addColorStop(0, '#9A6844'); gb.addColorStop(1, '#5C3B25');
        ctx.fillStyle = gb; ctx.fillRect(0, yc, w, h - yc);
        ctx.fillStyle = 'rgba(0,0,0,.18)';
        for (let px = 35; px < w; px += 70) ctx.fillRect(px, yc + 5, 2, h - yc - 5);
        ctx.fillStyle = '#D79E6E'; ctx.fillRect(0, yc, w, 4);
        ctx.fillStyle = 'rgba(0,0,0,.25)'; ctx.fillRect(0, yc - 3, w, 3);
      } else {
        ctx.fillStyle = 'rgba(255,255,255,.16)';
        ctx.fillRect(0, h - t * 0.55, w, t * 0.55);
        ctx.fillStyle = LIME;
        ctx.fillRect(0, h - t * 0.55, w, 4);
      }
      for (const o of objets) {
        const k = borner(o.y / sol, 0, 1);
        // Objet en train de s'effacer au sol : il rétrécit et pâlit.
        const s = o.sortie > 0 ? o.sortie / 0.14 : 1;
        ctx.globalAlpha = s * (o.inoffensif && !o.sortie ? 0.4 : 1); // traversé pendant la grâce : estompé
        // Ombre au sol qui grandit à l'approche : on lit où l'objet va tomber.
        ctx.fillStyle = `rgba(0,0,0,${(0.12 + k * 0.28).toFixed(3)})`;
        ctx.beginPath(); ctx.ellipse(o.x, h - t * 0.45, t * (0.2 + k * 0.25) * s, t * 0.07, 0, 0, Math.PI * 2); ctx.fill();
        // UN JETON SOUS CHAQUE OBJET, dont la couleur dit quoi en faire avant même de reconnaître l'objet.
        // Un halo blanc très doux ne suffisait pas : sur le ciel, les objets restaient flous et petits.
        // Vert = à attraper, doré = bonus, rouge façon panneau = à éviter (obstacle, déchet).
        const danger = o.mauvais || cfg.route;
        const pulse = o.or || danger ? 1 + Math.sin(o.phase * 2) * 0.05 : 1;
        const rj = t * 0.66 * pulse * (0.7 + 0.3 * s);
        // FairSort : un déchet porte un anneau d'alerte pointillé qui palpite, en plus de son jeton rouge — le
        // tri doit se faire à la COULEUR et à la FORME, sans avoir à reconnaître un petit emoji en pleine chute.
        if (cfg.badges && o.mauvais) {
          ctx.save();
          ctx.strokeStyle = `rgba(255,92,110,${(0.55 + Math.sin(o.phase * 3) * 0.35).toFixed(3)})`;
          ctx.lineWidth = Math.max(2, rj * 0.1); ctx.setLineDash([rj * 0.32, rj * 0.22]); ctx.lineDashOffset = -o.phase * rj * 0.4;
          ctx.beginPath(); ctx.arc(o.x, o.y, rj * 1.22, 0, Math.PI * 2); ctx.stroke();
          ctx.restore();
        }
        if (cfg.route && !o.sortie) {
          // Halo rouge sous l'obstacle : il « brûle » sur l'asphalte sombre.
          const gd = ctx.createRadialGradient(o.x, o.y, rj * 0.6, o.x, o.y, rj * 1.7);
          gd.addColorStop(0, 'rgba(255,70,90,.32)'); gd.addColorStop(1, 'rgba(255,70,90,0)');
          ctx.fillStyle = gd; ctx.beginPath(); ctx.arc(o.x, o.y, rj * 1.7, 0, Math.PI * 2); ctx.fill();
          // Il vient d'entrer par le haut : un ▼ rouge clignote au bord, pour lire sa colonne avant qu'il n'arrive.
          if (o.y < t * 1.4) {
            ctx.save();
            ctx.globalAlpha = 0.6 + Math.sin(o.phase * 6) * 0.4;
            ctx.fillStyle = '#FF4D63'; ctx.strokeStyle = '#FFFFFF'; ctx.lineWidth = 2;
            const tt = Math.max(9, t * 0.32);
            ctx.beginPath(); ctx.moveTo(o.x - tt, 4); ctx.lineTo(o.x + tt, 4); ctx.lineTo(o.x, 4 + tt * 1.2); ctx.closePath(); ctx.fill(); ctx.stroke();
            ctx.restore();
          }
        }
        // Un bonus : jeton doré qui palpite avec un halo lime, quel que soit le jeu.
        if (o.bonus) {
          const gb = ctx.createRadialGradient(o.x, o.y, rj * 0.5, o.x, o.y, rj * 2);
          gb.addColorStop(0, 'rgba(200,240,60,.35)'); gb.addColorStop(1, 'rgba(200,240,60,0)');
          ctx.fillStyle = gb; ctx.beginPath(); ctx.arc(o.x, o.y, rj * 2, 0, Math.PI * 2); ctx.fill();
        }
        jeton(ctx, o.x, o.y, rj, o.bonus ? 'or' : danger ? (cfg.badges ? 'dechet' : 'danger') : o.or ? 'or' : 'bon');
        emoji(ctx, o.emoji, o.x, o.y, o.taille * 0.82 * (0.7 + 0.3 * s), o.bonus ? Math.sin(o.phase * 2) * 0.2 : Math.sin(o.phase) * o.balance + o.rot);
        if (cfg.badges) badge(ctx, o.x + rj * 0.74, o.y - rj * 0.74, Math.max(7, rj * 0.36), !o.mauvais);
        if (o.or && !o.sortie) {
          // Plat doré : quatre étincelles qui tournent autour, on le repère avant même qu'il n'approche.
          ctx.fillStyle = '#FFE38A';
          for (let k = 0; k < 4; k++) {
            const a = o.phase * 1.4 + k * Math.PI / 2; const d = rj * 1.35; const ss = Math.max(2.5, rj * 0.14) * (0.7 + 0.3 * Math.sin(o.phase * 4 + k));
            const ex = o.x + Math.cos(a) * d; const ey = o.y + Math.sin(a) * d;
            ctx.beginPath(); ctx.moveTo(ex, ey - ss * 1.8); ctx.lineTo(ex + ss * 0.5, ey - ss * 0.5); ctx.lineTo(ex + ss * 1.8, ey); ctx.lineTo(ex + ss * 0.5, ey + ss * 0.5);
            ctx.lineTo(ex, ey + ss * 1.8); ctx.lineTo(ex - ss * 0.5, ey + ss * 0.5); ctx.lineTo(ex - ss * 1.8, ey); ctx.lineTo(ex - ss * 0.5, ey - ss * 0.5); ctx.closePath(); ctx.fill();
          }
        }
        ctx.globalAlpha = 1;
      }
      if (cfg.decor === 'marche') {
        // L'auvent du restaurant, en haut : bandes iris et crème, bord festonné. Les plats en sortent au lieu
        // d'apparaître dans le vide — on comprend d'où ils viennent.
        const ha = t * 0.95; const bande = Math.max(22, w / 10);
        ctx.fillStyle = 'rgba(0,0,0,.25)'; ctx.fillRect(0, 0, w, ha + 6);
        for (let i = 0, px = 0; px < w; i++, px += bande) {
          ctx.fillStyle = i % 2 ? '#F4EFE4' : '#3B2FB5';
          ctx.beginPath(); ctx.moveTo(px, 0); ctx.lineTo(px + bande, 0); ctx.lineTo(px + bande, ha);
          ctx.arc(px + bande / 2, ha, bande / 2, 0, Math.PI, false); ctx.closePath(); ctx.fill();
        }
        ctx.fillStyle = '#14121F'; ctx.fillRect(0, 0, w, Math.max(4, t * 0.12));
      }
      // Frôlement d'un déchet (FairSort) : le cadre clignote orange, bref.
      if (alerte > 0) {
        ctx.strokeStyle = `rgba(255,169,77,${(alerte / 0.4 * 0.9).toFixed(3)})`; ctx.lineWidth = 6;
        ctx.strokeRect(3, 3, w - 6, h - 6);
      }
      // Commande du client (FairCatch) : une petite fiche en haut à gauche, les trois plats attendus, cochés au fur et à mesure.
      if (commande) {
        // Cartouche du HUD : il garde sa taille pleine, hors du facteur cfg.echelle qui aère le terrain.
        const th = t / (cfg.echelle ?? 1); const cx = 8; const cy = 8; const lc = th * 0.62; const hc = th * 0.78;
        const pop = 1 + Math.max(0, 0.25 - commande.age) * 1.2;
        ctx.save(); ctx.translate(cx, cy); ctx.scale(pop, pop);
        ctx.fillStyle = 'rgba(255,255,255,.92)';
        rectArrondi(ctx, 0, 0, lc * 3 + 24, hc + 6, 10); ctx.fill();
        ctx.strokeStyle = IRIS; ctx.lineWidth = 2; ctx.stroke();
        ctx.fillStyle = IRIS; ctx.font = `800 ${Math.max(9, th * 0.2)}px system-ui, sans-serif`; ctx.textAlign = 'left'; ctx.textBaseline = 'top';
        ctx.fillText(tx(api, 'jeux.fx_commandeTitre', 'Commande'), 8, 4);
        commande.plats.forEach((p, i) => {
          const px = 8 + i * lc + lc * 0.5 - 2; const py = hc * 0.62;
          ctx.globalAlpha = p.fait ? 0.35 : 1;
          emoji(ctx, p.emoji, px, py, th * 0.46);
          ctx.globalAlpha = 1;
          if (p.fait) badge(ctx, px + th * 0.17, py - th * 0.17, Math.max(5, th * 0.12), true);
        });
        ctx.restore();
      }
      // Nitro (FairDodge) : la route passe au vert et un chrono ⚡ s'affiche.
      if (nitro > 0) {
        ctx.fillStyle = `rgba(200,240,60,${(0.06 + Math.sin(horloge * 14) * 0.03).toFixed(3)})`; ctx.fillRect(0, 0, w, h);
        ctx.fillStyle = LIME; ctx.font = `900 ${Math.max(12, t * 0.3)}px system-ui, sans-serif`; ctx.textAlign = 'left'; ctx.textBaseline = 'top';
        ctx.fillText(`⚡ ${nitro.toFixed(1)}s`, 10, 10);
      }
      if (aimant > 0) {
        ctx.fillStyle = OR; ctx.font = `900 ${Math.max(12, t * 0.3)}px system-ui, sans-serif`; ctx.textAlign = 'right'; ctx.textBaseline = 'bottom';
        ctx.fillText(`🧲 ${aimant.toFixed(1)}s`, w - 10, h - t * 0.7);
      }
      // Le joueur penche légèrement dans le sens de son déplacement et rebondit quand il attrape.
      ctx.save();
      // Grâce après un cœur perdu : le joueur clignote, comme dans tous les jeux d'arcade — on comprend sans lire.
      if ((api.invincible?.() ?? 0) > 0) ctx.globalAlpha = Math.sin(horloge * 28) > 0 ? 0.3 : 1;
      ctx.translate(joueurX, h - t * 0.55);
      const sq = borner(rebond, -0.3, 0.3);
      ctx.scale(1 + sq * 0.5, 1 - sq * 0.6);
      if (cfg.route) {
        // Traits de vitesse qui filent derrière le scooter, plus longs quand la route accélère.
        ctx.strokeStyle = 'rgba(255,255,255,.45)'; ctx.lineWidth = 2; ctx.lineCap = 'round';
        const lv = t * (0.5 + vitesseDecor * 1.5);
        for (const [dx, dec] of [[-t * 0.95, 0], [t * 0.95, 0.5], [-t * 0.7, 0.25], [t * 0.7, 0.75]]) {
          const yv = t * 0.1 + ((defile * 0.02 + dec) % 1) * t * 0.5;
          ctx.beginPath(); ctx.moveTo(dx, yv - t * 0.4); ctx.lineTo(dx, yv - t * 0.4 + lv); ctx.stroke();
        }
      }
      // Socle lime sous le joueur : on le retrouve d'un coup d'œil, même au milieu des objets qui tombent.
      ctx.fillStyle = 'rgba(0,0,0,.28)';
      ctx.beginPath(); ctx.ellipse(0, t * 0.05, t * 0.95, t * 0.2, 0, 0, Math.PI * 2); ctx.fill();
      // Auras des bonus actifs : lime tournante pour l'aimant, anneau blanc pour le bouclier, traînée verte pour la nitro.
      if (aimant > 0 || bouclier || nitro > 0) {
        ctx.save(); ctx.translate(0, -t * 0.65);
        ctx.lineWidth = Math.max(3, t * 0.09); ctx.lineCap = 'round';
        if (aimant > 0) { ctx.strokeStyle = 'rgba(255,209,102,.9)'; ctx.setLineDash([t * 0.3, t * 0.2]); ctx.lineDashOffset = -horloge * t * 1.2; ctx.beginPath(); ctx.arc(0, 0, t * 1.15, 0, Math.PI * 2); ctx.stroke(); ctx.setLineDash([]); }
        if (bouclier) { ctx.strokeStyle = `rgba(255,255,255,${(0.7 + Math.sin(horloge * 5) * 0.25).toFixed(3)})`; ctx.beginPath(); ctx.arc(0, 0, t * 1.1, 0, Math.PI * 2); ctx.stroke(); }
        if (nitro > 0) { ctx.strokeStyle = LIME; ctx.beginPath(); ctx.arc(0, 0, t * 1.12, 0, Math.PI * 2); ctx.stroke(); }
        ctx.restore();
      }
      if (cfg.sac) {
        // Le sac Fairide à la place du panier : socle lime, sac iris penché selon la vitesse.
        ctx.fillStyle = LIME; ctx.strokeStyle = '#14121F'; ctx.lineWidth = 3;
        ctx.beginPath(); ctx.ellipse(0, -t * 0.1, t * 1.05, t * 0.32, 0, 0, Math.PI * 2); ctx.fill(); ctx.stroke();
        sacFairide(ctx, 0, -t * 0.72, t * 1.15, borner(vJoueur / (w * 2.2), -0.3, 0.3));
      } else {
        ctx.fillStyle = LIME; ctx.strokeStyle = '#14121F'; ctx.lineWidth = 3;
        ctx.beginPath(); ctx.arc(0, -t * 0.65, t * 0.86, 0, Math.PI * 2); ctx.fill(); ctx.stroke();
        emoji(ctx, cfg.joueur, 0, -t * 0.65, t * 1.3, borner(vJoueur / (w * 2.2), -0.3, 0.3)); // penche selon sa vitesse réelle
      }
      ctx.restore();
    }
  };
}

// Jeton rond posé sous un objet : fond clair plein, anneau épais de la couleur du sens (bon, or, danger),
// petite ombre portée pour le décoller du ciel. Rayon r en pixels.
const JETONS = {
  bon: { fond: '#FFFFFF', anneau: '#2BB673' },
  or: { fond: '#FFF3C9', anneau: '#F5B800' },
  danger: { fond: '#FFFFFF', anneau: '#E0344A' },
  dechet: { fond: '#FFE3E6', anneau: '#D0263D' }
};
// Petite pastille posée sur le jeton (FairSort) : ✓ vert = à attraper, ✕ rouge = à laisser tomber. Tracée au
// trait, pas en texte : nette à toute taille et indépendante des polices.
function badge(ctx, x, y, r, bon) {
  ctx.fillStyle = bon ? '#1E9E5A' : '#D0263D';
  ctx.beginPath(); ctx.arc(x, y, r, 0, Math.PI * 2); ctx.fill();
  ctx.strokeStyle = '#FFFFFF'; ctx.lineWidth = Math.max(1.5, r * 0.22); ctx.stroke();
  ctx.lineCap = 'round'; ctx.lineJoin = 'round'; ctx.lineWidth = Math.max(2, r * 0.3);
  ctx.beginPath();
  if (bon) { ctx.moveTo(x - r * 0.45, y + r * 0.02); ctx.lineTo(x - r * 0.1, y + r * 0.38); ctx.lineTo(x + r * 0.48, y - r * 0.36); }
  else { ctx.moveTo(x - r * 0.38, y - r * 0.38); ctx.lineTo(x + r * 0.38, y + r * 0.38); ctx.moveTo(x + r * 0.38, y - r * 0.38); ctx.lineTo(x - r * 0.38, y + r * 0.38); }
  ctx.stroke();
}
function jeton(ctx, x, y, r, genre) {
  const j = JETONS[genre];
  ctx.fillStyle = 'rgba(0,0,0,.25)';
  ctx.beginPath(); ctx.arc(x, y + r * 0.12, r, 0, Math.PI * 2); ctx.fill();
  ctx.fillStyle = j.fond;
  ctx.beginPath(); ctx.arc(x, y, r, 0, Math.PI * 2); ctx.fill();
  ctx.strokeStyle = j.anneau; ctx.lineWidth = Math.max(3, r * 0.16);
  ctx.beginPath(); ctx.arc(x, y, r - ctx.lineWidth / 2, 0, Math.PI * 2); ctx.stroke();
}

// Rectangle arrondi, avec repli quand ctx.roundRect manque (iPhone d'avant iOS 16 : FairArrow y plantait au premier mur).
function rectArrondi(ctx, x, y, l, ht, r) {
  ctx.beginPath();
  if (ctx.roundRect) { ctx.roundRect(x, y, l, ht, r); return; }
  const rr = Math.max(0, Math.min(r, l / 2, ht / 2));
  ctx.moveTo(x + rr, y); ctx.arcTo(x + l, y, x + l, y + ht, rr); ctx.arcTo(x + l, y + ht, x, y + ht, rr);
  ctx.arcTo(x, y + ht, x, y, rr); ctx.arcTo(x, y, x + l, y, rr); ctx.closePath();
}

// Part linéaire de la courbe de chute (le reste est accéléré) : 0,7 = départ à 70 % de la vitesse moyenne, arrivée à 130 %.
const CHUTE_LIN = 0.7;
const PLATS = ['🍕', '🍔', '🍟', '🍩', '🍣', '🌮', '🥐', '🍦'];
const OBSTACLES = ['🚧', '🪨', '🕳️', '🔥', '💥'];
// Le cœur qui tombe quand il en manque un (FairCatch, FairDodge) : un bonus comme les autres, un peu lent pour qu'on l'ait.
const COEUR = { emoji: '❤️', bonus: 'vie', vitesseFacteur: 0.85 };

export const JEUX = [
  {
    key: 'catch', label: 'FairCatch', sub: 'Attrape les plats', emoji: '🧺',
    stockage: 'fairide_food_catch_best', pointsParNiveau: 10, maxNiveau: 20, perdu: '💥 Perdu !',
    regles: [
      'But : des plats tombent du ciel, attrape-les tous dans ton panier avant qu’ils ne touchent le sol.',
      'Score : +1 par plat attrapé, +3 pour un plat doré ✨, +5 quand tu complètes la commande du client affichée en haut. 5 prises d’affilée = points ×2, 10 = ×3. L’aimant 🧲 attire les plats pendant 5 s. À chaque niveau (paliers de plus en plus longs), ça tombe un peu plus vite.',
      'Vies : tu as 3 cœurs ♥. Un plat par terre en coûte un, puis tu clignotes un instant sans rien risquer. Un cœur ❤️ tombe parfois quand il t’en manque un : attrape-le. Plus de cœurs, c’est fini ; ton record compte pour le podium.'
    ],
    controles: 'Commandes : glisse le doigt (ou la souris) à gauche et à droite, le panier suit. Clavier : flèches ← →, Échap ou P pour la pause.',
    creer: (api) => creerChute(api, {
      // Décor « marché » : auvent rayé d'où sortent les plats, guirlande, comptoir en bois (voir draw).
      joueur: '🧺', ciel: ['#241C74', '#5F51EC'], demiContact: 1.35, decor: 'marche', sac: true, commandes: true, echelle: 0.78,
      // Bonus : l'aimant 🧲 — pendant 5 s les plats viennent d'eux-mêmes vers le sac.
      bonus: () => ({ emoji: '🧲', bonus: 'aimant', vitesseFacteur: 0.9 }),
      // Un plat sur dix est doré : il vaut 3 et tombe un peu plus vite.
      nouvelObjet: () => (Math.random() < 0.1 ? { emoji: choix(PLATS), or: true, points: 3, vitesseFacteur: 1.2 } : { emoji: choix(PLATS) }),
      intervalle: (n) => courbe(n, 0.96, 0.30, 6),
      vitesse: (n) => aleatoire(courbe(n, 0.128, 0.44, 7), courbe(n, 0.269, 0.70, 7)),
      toucher: () => 'point', manquer: () => 'perdu'
    })
  },
  {
    key: 'dodge', label: 'FairDodge', sub: 'Évite les obstacles', emoji: '🚧',
    stockage: 'fairide_dodge_best', pointsParNiveau: 10, maxNiveau: 20, perdu: '💥 Touché !',
    regles: [
      'But : tu livres en scooter et la route est semée d’obstacles (🚧 🪨 🕳️ 🔥 💥), faufile-toi sans rien toucher.',
      'Score : +1 par obstacle évité, +2 « Pfiou ! » quand il te frôle, +3 par pourboire 💶 ramassé. 5 esquives d’affilée = points ×2, 10 = ×3. La nitro ⚡ te rend invincible 3 s : les obstacles éclatent. À chaque niveau (paliers de plus en plus longs), la route accélère un peu.',
      'Vies : tu as 3 cœurs ♥. Un choc en coûte un, puis tu clignotes un instant et les obstacles te traversent. Un cœur ❤️ apparaît parfois sur la route quand il t’en manque un. Plus de cœurs, le scooter s’arrête ; ton record compte pour le podium.'
    ],
    controles: 'Commandes : glisse le doigt (ou la souris) à gauche et à droite, le scooter suit. Clavier : flèches ← →, Échap ou P pour la pause.',
    creer: (api) => creerChute(api, {
      // Asphalte sombre (et non plus violet grisé) : les panneaux rouges et blancs des obstacles tranchent dessus.
      joueur: '🛵', ciel: ['#1E1D2B', '#3A3950'], eclat: ORANGE, route: true, tournoie: true, echelle: 0.78,
      // Bonus sur la route : la nitro ⚡ (3 s d'invincibilité « Express », les obstacles éclatent) ou un pourboire 💶 (+3).
      bonus: () => (Math.random() < 0.55 ? { emoji: '⚡', bonus: 'nitro' } : { emoji: '💶', bonus: 'pourboire' }),
      // Contact « juste » (1 taille d'objet) : on ne perd pas sur un obstacle qui n'a fait qu'effleurer le dessin.
      demiContact: 1.02,
      nouvelObjet: () => ({ emoji: choix(OBSTACLES) }),
      intervalle: (n) => courbe(n, 1.2, 0.40, 6),
      vitesse: (n) => aleatoire(courbe(n, 0.115, 0.36, 7), courbe(n, 0.231, 0.56, 7)),
      toucher: () => 'perdu', manquer: () => null,
      // Le point tombe au moment où l'obstacle passe le scooter, pas quand il sort de l'écran : le retour
      // est immédiat. À moins d'un tiers d'objet du contact, c'est un frôlement : « Pfiou ! », +2.
      passer: (o, dx, demi, t) => (dx < demi + t * 0.35 ? 'frole' : 'point')
    })
  },
  {
    key: 'reaction', label: 'FairFlash', sub: 'Réflexes rapides', emoji: '🎯',
    stockage: 'fairide_reaction_best', pointsParNiveau: 8, maxNiveau: 20, perdu: '⏱️ Trop lent !', invincible: 0,
    regles: [
      'But : une cible 🎯 surgit quelque part sur le terrain, tape dessus avant que l’anneau autour ne se referme.',
      'Score : +1 par cible touchée, +2 « Parfait ! » si tu tapes pendant que l’anneau est doré. 5 d’affilée = points ×2, 10 = ×3. Dès le niveau 2 la cible bouge ; toutes les 10 cibles, 3 s de Frénésie 🔥 où tout vaut Parfait. À chaque niveau (paliers de plus en plus longs), l’anneau se referme un peu plus vite.',
      'Vies : tu as 3 cœurs ♥. Une cible ratée (l’anneau se referme) en coûte un, une bombe 💣 touchée aussi — elles apparaissent dès le niveau 3. Chaque Frénésie t’en rend un. Taper dans le vide ne coûte rien.'
    ],
    controles: 'Commandes : tape (ou clique) sur la cible. Clavier : Échap ou P pour la pause.',
    creer(api) {
      let w = api.w; let h = api.h; let cible = null; let reste = 0; let fenetre = 1; let precedente = null;
      let horloge = 0; let touches = []; // ondes laissées par les cibles touchées (x, y, age, parfait, r)
      let frenesie = 0; let touchees = 0; // frénésie : FRENESIE s pendant lesquelles l'anneau ne se referme pas, on tape à la volée
      // Bombe 💣 (24/09/2026) : dès le niveau 3, une cible sur trois environ arrive avec une bombe posée ailleurs.
      // Taper dessus coûte un cœur. Jusque-là, taper partout sans viser ne coûtait rien : il fallait donner une raison
      // de regarder avant de taper. Elle disparaît avec sa cible. `fini` : dernier cœur perdu, on ne fait plus rien.
      let bombe = null; let fini = false;
      const FRENESIE = 3;
      // Cible bien visible sans manger le terrain : le fondateur l'a demandée un peu plus petite (2026-09-19, × 0,8),
      // ses ondes et son viseur suivent puisque tout est exprimé en tailles de cible.
      const ECHELLE = 0.8;
      const taille = () => Math.max(38, Math.min(96, Math.min(w, h) * 0.26) * ECHELLE);
      const PARFAIT = 0.62; // fraction de la fenêtre pendant laquelle l'anneau est doré (Parfait = +2)
      const nouvelleCible = (n) => {
        const t = taille();
        fenetre = courbe(n, 1.5, 0.38, 6);
        reste = fenetre;
        // Jamais sous le doigt : au moins 1,4 taille de la cible précédente (8 tirages, puis on garde le dernier).
        let x = w / 2; let y = h / 2;
        for (let i = 0; i < 8; i++) {
          x = aleatoire(t / 2 + 4, w - t / 2 - 4); y = aleatoire(t / 2 + 4, h - t / 2 - 4);
          if (!precedente || Math.hypot(x - precedente.x, y - precedente.y) >= t * 1.4) break;
        }
        // Dès le niveau 2 la cible dérive (et rebondit sur les bords) : il faut la viser, pas seulement la voir.
        const vit = n >= 2 ? Math.min(w, h) * courbe(n - 2, 0.1, 0.36, 7) : 0; const dir = Math.random() * Math.PI * 2;
        cible = { x, y, age: 0, ratee: false, vx: Math.cos(dir) * vit, vy: Math.sin(dir) * vit }; precedente = cible;
        // La bombe, loin de la cible (au moins 1,6 taille) : on ne doit jamais la toucher en visant juste.
        bombe = null;
        if (n >= 2 && Math.random() < Math.min(0.45, 0.22 + n * 0.02)) {
          for (let i = 0; i < 10; i++) {
            const bx = aleatoire(t / 2 + 4, w - t / 2 - 4); const by = aleatoire(t / 2 + 4, h - t / 2 - 4);
            if (Math.hypot(bx - x, by - y) >= t * 1.6) { bombe = { x: bx, y: by, age: 0 }; break; }
          }
        }
      };
      return {
        reset() { cible = null; reste = 0; precedente = null; touches = []; frenesie = 0; touchees = 0; bombe = null; fini = false; },
        redimensionner(nw, nh) {
          const kx = nw / w; const ky = nh / h; w = nw; h = nh;
          if (cible) { cible.x *= kx; cible.y *= ky; }
          if (bombe) { bombe.x *= kx; bombe.y *= ky; }
        },
        etat() { return { cible: !!cible, x: cible?.x, y: cible?.y, reste, fenetre, frenesie, touchees, bombe: bombe ? { x: bombe.x, y: bombe.y } : null }; },
        update(dt, input) {
          if (!cible) nouvelleCible(input.niveau);
          const t = taille();
          horloge += dt;
          for (const o of touches) o.age += dt;
          touches = touches.filter((o) => o.age < 0.5);
          if (fini) return undefined; // ralenti de fin : les ondes finissent de s'étendre, rien d'autre
          if (frenesie > 0) frenesie = Math.max(0, frenesie - dt);
          if (bombe) bombe.age += dt;
          // Dérive de la cible, rebond sur les bords du terrain.
          if (cible.vx || cible.vy) {
            cible.x += cible.vx * dt; cible.y += cible.vy * dt;
            if (cible.x < t / 2 + 4 || cible.x > w - t / 2 - 4) { cible.vx = -cible.vx; cible.x = borner(cible.x, t / 2 + 4, w - t / 2 - 4); }
            if (cible.y < t / 2 + 4 || cible.y > h - t / 2 - 4) { cible.vy = -cible.vy; cible.y = borner(cible.y, t / 2 + 4, h - t / 2 - 4); }
          }
          for (const tape of input.tapes) {
            if (Math.hypot(tape.x - cible.x, tape.y - cible.y) <= t * 0.62) {
              const parfait = frenesie > 0 || reste / fenetre >= PARFAIT;
              touches.push({ x: cible.x, y: cible.y, age: 0, parfait, r: t * 0.5 });
              if (frenesie <= 0) {
                api.enchainer?.();
                touchees += 1;
                // La Frénésie rend aussi un cœur s'il en manque un.
                if (touchees % 10 === 0) { frenesie = FRENESIE; api.bonus?.(); api.effet?.(w / 2, h * 0.3, `🔥 ${tx(api, 'jeux.fx_frenesie', 'Frénésie !')}`, OR); if (api.soigner?.()) api.effet?.(w / 2, h * 0.3 + 26, `+1 ♥ ${tx(api, 'jeux.fx_vie', 'Vie !')}`, ROUGE); }
              }
              api.marquer(parfait ? 2 : 1);
              api.effet?.(cible.x, cible.y - t * 0.8, parfait ? `${tx(api, 'jeux.fx_parfait', 'Parfait !')} +2` : '+1', parfait ? OR : undefined);
              api.eclat?.(cible.x, cible.y, parfait ? OR : '#E8A33C', parfait ? 16 : 10);
              // Le niveau est relu APRÈS le point : la cible suivante doit déjà tenir compte du palier
              // qu'on vient éventuellement de franchir, pas de celui d'avant.
              nouvelleCible(api.niveau());
              return undefined;
            }
            // À côté de la cible mais sur la bombe : elle saute, un cœur de moins. La cible, elle, continue.
            if (bombe && Math.hypot(tape.x - bombe.x, tape.y - bombe.y) <= t * 0.55) {
              api.effet?.(bombe.x, bombe.y - t * 0.7, `💥 ${tx(api, 'jeux.fx_boum', 'Boum !')}`, ROUGE);
              api.eclat?.(bombe.x, bombe.y, ORANGE, 22); api.eclat?.(bombe.x, bombe.y, ROUGE, 12);
              bombe = null;
              api.rompre?.();
              if (!api.perdre()) { fini = true; return undefined; }
            }
          }
          // En frénésie l'anneau ne se referme pas : tape à la volée, chaque cible vaut « Parfait ».
          if (frenesie <= 0) reste -= dt;
          cible.age += dt;
          if (reste <= 0) {
            // Anneau refermé : un cœur de moins et une nouvelle cible ailleurs — ou, au dernier cœur, la fin au ralenti.
            reste = 0; cible.ratee = true;
            api.eclat?.(cible.x, cible.y, ROUGE, 12);
            if (api.perdre()) { api.effet?.(cible.x, cible.y - t * 0.8, '−1 ♥', ROUGE); nouvelleCible(api.niveau()); } else fini = true;
          }
          return undefined;
        },
        draw(ctx) {
          fondDegrade(ctx, w, h, '#23093A', '#57237A');
          // Lumières douces qui dérivent lentement : de la profondeur, sans rien qui ressemble à une cible.
          const base = Math.min(w, h);
          for (let i = 0; i < 6; i++) {
            const bx = w * (0.15 + ((i * 0.37) % 0.8)) + Math.sin(horloge * 0.25 + i * 1.7) * base * 0.08;
            const by = h * (0.2 + ((i * 0.53) % 0.7)) + Math.cos(horloge * 0.2 + i) * base * 0.06;
            const br = base * (0.14 + (i % 3) * 0.05);
            const gb = ctx.createRadialGradient(bx, by, 1, bx, by, br);
            gb.addColorStop(0, i % 2 ? 'rgba(255,92,138,.16)' : 'rgba(140,124,255,.18)'); gb.addColorStop(1, 'rgba(0,0,0,0)');
            ctx.fillStyle = gb; ctx.beginPath(); ctx.arc(bx, by, br, 0, Math.PI * 2); ctx.fill();
          }
          // Quadrillage discret : un repère pour l'œil.
          ctx.fillStyle = 'rgba(255,255,255,.08)';
          const pas = Math.max(28, base / 8);
          for (let gx = pas / 2; gx < w; gx += pas) for (let gy = pas / 2; gy < h; gy += pas) { ctx.beginPath(); ctx.arc(gx, gy, 1.6, 0, Math.PI * 2); ctx.fill(); }
          // Ondes des cibles touchées : dorées pour un « Parfait », vertes sinon.
          for (const o of touches) {
            const k2 = o.age / 0.5;
            ctx.strokeStyle = o.parfait ? `rgba(255,209,102,${(1 - k2).toFixed(3)})` : `rgba(200,240,60,${(1 - k2).toFixed(3)})`;
            ctx.lineWidth = 5 * (1 - k2) + 1;
            ctx.beginPath(); ctx.arc(o.x, o.y, o.r * (1 + k2 * 2.2), 0, Math.PI * 2); ctx.stroke();
          }
          // Frénésie : voile chaud qui pulse, chrono en haut.
          if (frenesie > 0) {
            ctx.fillStyle = `rgba(255,209,102,${(0.08 + Math.sin(horloge * 12) * 0.04).toFixed(3)})`; ctx.fillRect(0, 0, w, h);
            ctx.fillStyle = OR; ctx.font = `900 ${api.large ? 16 : 13}px system-ui, sans-serif`; ctx.textAlign = 'left'; ctx.textBaseline = 'top';
            ctx.fillText(`🔥 ${frenesie.toFixed(1)}s`, 10, 10);
          }
          if (bombe) {
            // La bombe : jeton sombre cerclé de rouge pointillé qui tourne, mèche qui grésille — elle se lit « à
            // éviter » à la forme et à la couleur, avant même de reconnaître l'emoji. Apparition en rebond, comme la cible.
            const tb = taille(); const a = Math.min(1, bombe.age / 0.2);
            const rb = tb * 0.42 * (1 + Math.sin(a * Math.PI) * 0.18 * (1 - a) + (a - 1) * 0.3);
            ctx.save();
            ctx.strokeStyle = `rgba(255,77,99,${(0.6 + Math.sin(bombe.age * 8) * 0.3).toFixed(3)})`;
            ctx.lineWidth = Math.max(2, rb * 0.12); ctx.setLineDash([rb * 0.35, rb * 0.25]); ctx.lineDashOffset = -bombe.age * rb * 2;
            ctx.beginPath(); ctx.arc(bombe.x, bombe.y, rb * 1.3, 0, Math.PI * 2); ctx.stroke();
            ctx.restore();
            jeton(ctx, bombe.x, bombe.y, rb, 'dechet');
            emoji(ctx, '💣', bombe.x, bombe.y, rb * 1.5, Math.sin(bombe.age * 20) * 0.08);
            ctx.fillStyle = Math.sin(bombe.age * 30) > 0 ? '#FFD166' : '#FF6B6B';
            ctx.beginPath(); ctx.arc(bombe.x + rb * 0.45, bombe.y - rb * 0.6, Math.max(2, rb * 0.1), 0, Math.PI * 2); ctx.fill();
          }
          if (!cible) return;
          const t = taille(); const k = reste / fenetre;
          // Viseur : deux fines lignes qui traversent le terrain jusqu'à la cible, pour la trouver d'un regard.
          ctx.strokeStyle = 'rgba(255,255,255,.13)'; ctx.lineWidth = 1;
          ctx.beginPath(); ctx.moveTo(0, cible.y); ctx.lineTo(cible.x - t * 0.9, cible.y); ctx.moveTo(cible.x + t * 0.9, cible.y); ctx.lineTo(w, cible.y);
          ctx.moveTo(cible.x, 0); ctx.lineTo(cible.x, cible.y - t * 0.9); ctx.moveTo(cible.x, cible.y + t * 0.9); ctx.lineTo(cible.x, h); ctx.stroke();
          // Urgence : sous 30 % du temps, une lueur rouge palpite autour de la cible.
          if (k < 0.3 && !cible.ratee) {
            const gu = ctx.createRadialGradient(cible.x, cible.y, t * 0.4, cible.x, cible.y, t * 1.25);
            gu.addColorStop(0, `rgba(255,77,99,${(0.35 + Math.sin(cible.age * 18) * 0.15).toFixed(3)})`); gu.addColorStop(1, 'rgba(255,77,99,0)');
            ctx.fillStyle = gu; ctx.beginPath(); ctx.arc(cible.x, cible.y, t * 1.25, 0, Math.PI * 2); ctx.fill();
          }
          // Onde d'apparition (0,25 s) : l'œil est attiré là où la cible vient de surgir.
          if (cible.age < 0.25) {
            const ka = cible.age / 0.25;
            ctx.strokeStyle = `rgba(255,255,255,${(0.8 * (1 - ka)).toFixed(3)})`; ctx.lineWidth = 3;
            ctx.beginPath(); ctx.arc(cible.x, cible.y, t * (0.5 + ka * 1.1), 0, Math.PI * 2); ctx.stroke();
          }
          // Anneau du temps restant : doré tant que « Parfait » est possible, vert ensuite, rouge à la fin.
          const epais = Math.max(6, t * 0.1);
          ctx.lineWidth = epais; ctx.lineCap = 'round';
          ctx.strokeStyle = 'rgba(255,255,255,.18)';
          ctx.beginPath(); ctx.arc(cible.x, cible.y, t * 0.76, 0, Math.PI * 2); ctx.stroke();
          ctx.beginPath();
          ctx.arc(cible.x, cible.y, t * 0.76, -Math.PI / 2, -Math.PI / 2 + Math.PI * 2 * k);
          ctx.strokeStyle = cible.ratee || k < 0.3 ? ROUGE : k >= PARFAIT ? OR : LIME;
          ctx.stroke();
          // Apparition avec un léger rebond (0,2 s). Sous 0,3 de temps restant, la cible tremble.
          const a = Math.min(1, cible.age / 0.2); const echelle = 1 + Math.sin(a * Math.PI) * 0.18 * (1 - a) + (a - 1) * 0.3;
          const tremble = k < 0.3 && !cible.ratee ? Math.sin(cible.age * 60) * 2 : 0;
          // Cible dessinée : ombre, anneaux rouges et blancs, liseré d'encre, reflet.
          const r = t * 0.5 * Math.max(0.7, echelle); const cx = cible.x + tremble; const cy = cible.y;
          ctx.fillStyle = 'rgba(0,0,0,.35)';
          ctx.beginPath(); ctx.arc(cx, cy + r * 0.12, r * 1.02, 0, Math.PI * 2); ctx.fill();
          for (const [fr, c] of [[1, '#FFFFFF'], [0.84, '#E0344A'], [0.62, '#FFFFFF'], [0.42, '#E0344A'], [0.2, '#FFFFFF']]) {
            ctx.fillStyle = c; ctx.beginPath(); ctx.arc(cx, cy, r * fr, 0, Math.PI * 2); ctx.fill();
          }
          ctx.strokeStyle = '#14121F'; ctx.lineWidth = Math.max(2, r * 0.06);
          ctx.beginPath(); ctx.arc(cx, cy, r, 0, Math.PI * 2); ctx.stroke();
          ctx.fillStyle = 'rgba(255,255,255,.35)';
          ctx.beginPath(); ctx.ellipse(cx - r * 0.35, cy - r * 0.45, r * 0.28, r * 0.13, -0.6, 0, Math.PI * 2); ctx.fill();
        }
      };
    }
  }
];
