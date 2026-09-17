// Les six mini-jeux de la page Carte, sous forme de définitions pures : pas de React, pas de DOM.
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
// CONTRAT. api = { w, h, large, marquer(n), perdre(), effet?, eclat?, niveau(), score(), t? }. Le jeu expose :
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

import { aleatoire, choix, emoji, fondDegrade, IRIS, LIME } from './dessin';
import { creerRider } from './rider';

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
//   toucher(o) / manquer(o)       — 'point' | 'perdu' | null quand l'objet touche le joueur / le sol
//   passer?(o, dx, demi, t)       — l'objet vient de passer sous le joueur sans contact : 'point' | 'frole' | 'alerte' | null
// }
// ---------------------------------------------------------------------------------------------------
function creerChute(api, cfg) {
  let w = api.w; let h = api.h;
  let objets = []; let depuisSpawn = 0; let joueurX = w / 2; let cibleX = w / 2; let rebond = 0; let vRebond = 0;
  let horloge = 0; let derniereArrivee = 0; let alerte = 0; let vJoueur = 0; let defile = 0; let vitesseDecor = 0.2;
  const SORTIE = 0.14; // durée de l'effacement d'un objet arrivé au sol
  // Plus grands qu'avant (plafond 36 → 54px) : « on voit rien » disait le fondateur. Bornés aussi par la
  // HAUTEUR, pour qu'un terrain large et bas (téléphone couché) garde le temps de voir l'objet tomber.
  const tailleObjet = () => Math.max(24, Math.min(54, Math.min(w * 0.17, h * 0.15)));
  const largeurJoueur = () => tailleObjet() * 1.7;
  const yJoueur = () => h - tailleObjet() * 1.3;
  const ySol = () => h - tailleObjet() * 0.3; // là où un objet « touche le sol » (le bandeau au bas du terrain)

  return {
    reset() { objets = []; depuisSpawn = 0; joueurX = w / 2; cibleX = w / 2; rebond = 0; vRebond = 0; horloge = 0; derniereArrivee = 0; alerte = 0; vJoueur = 0; defile = 0; },
    redimensionner(nw, nh) {
      const kx = nw / w; const ky = nh / h; w = nw; h = nh;
      joueurX *= kx; cibleX *= kx; vJoueur *= kx;
      const t = tailleObjet();
      for (const o of objets) { o.x *= kx; o.y *= ky; o.depart *= ky; o.trajet *= ky; o.taille = t; }
    },
    etat() { return { objets: objets.length, joueurX, alerte, yJoueur: yJoueur(), taille: tailleObjet(), liste: objets.filter((o) => !o.sortie).map((o) => ({ x: o.x, y: o.y, mauvais: !!o.mauvais, or: !!o.or })) }; },
    update(dt, input) {
      const n = input.niveau;
      const t = tailleObjet(); const lj = largeurJoueur();
      const demiContact = t * (cfg.demiContact ?? 1.35) - 4;
      horloge += dt;
      if (alerte > 0) alerte = Math.max(0, alerte - dt);
      // Le joueur suit le pointeur avec un léger lissage : direct, ça vibre au pixel près ; trop lent,
      // on rate. 18 par seconde = un rattrapage en ~60 ms, imperceptible mais qui gomme le tremblement.
      if (input.x != null) cibleX = borner(input.x, lj / 2, w - lj / 2);
      // Ressort presque critique plutôt qu'un rattrapage exponentiel : le panier accélère, file et se pose sans
      // à-coup quand le doigt s'arrête — un vrai objet avec une masse, toujours aussi réactif (≈ 0,06 s de retard).
      {
        const raideur = 1400; const amorti = 2 * Math.sqrt(raideur) * 0.95;
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
        const o = cfg.nouvelObjet(n);
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
        const dx = Math.abs(o.x - joueurX); const dy = o.y - yJ;
        if (Math.abs(dy) < t * 0.6 && dx < demiContact) {
          const effet = cfg.toucher(o);
          if (effet === 'perdu') return api.perdre();
          if (effet === 'point') {
            const pts = o.points || 1;
            api.marquer(pts);
            api.effet?.(o.x, yJ - t * 0.9, `+${pts}`, o.or ? OR : undefined);
            api.eclat?.(o.x, yJ - t * 0.4, o.or ? OR : cfg.eclat || IRIS, o.or ? 14 : 7);
            vRebond = o.or ? 7 : 5;
          }
          continue;
        }
        // L'objet vient de passer sous le joueur sans contact : esquivé (FairDodge), déchet évité (FairSort).
        if (!o.passe && dy >= t * 0.6) {
          o.passe = true;
          const effet = cfg.passer?.(o, dx, demiContact, t);
          if (effet === 'point') { api.marquer(1); api.effet?.(o.x, yJ - t * 0.9, '+1'); }
          if (effet === 'frole') { api.marquer(2); api.effet?.(o.x, yJ - t * 0.9, `${tx(api, 'jeux.fx_pfiou', 'Pfiou !')} +2`, ORANGE); api.eclat?.(o.x, yJ, ORANGE, 6); }
          if (effet === 'alerte') { alerte = 0.4; api.effet?.(o.x, yJ - t * 0.9, tx(api, 'jeux.fx_ouf', 'Ouf !'), ORANGE); }
        }
        if (o.y > sol) {
          const effet = cfg.manquer(o);
          if (effet === 'perdu') return api.perdre();
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
        // Bas-côtés jaunes et tirets BLANCS francs : la route se lit comme une route, plus comme un fond gris.
        ctx.fillStyle = '#F5B800';
        ctx.fillRect(0, 0, 5, h); ctx.fillRect(w - 5, 0, 5, h);
        ctx.fillStyle = 'rgba(255,255,255,.55)';
        const pasTiret = h * 0.16; const lTiret = h * 0.08;
        for (const xv of [w / 3, (2 * w) / 3]) {
          for (let yv = (defile % pasTiret) - pasTiret; yv < h; yv += pasTiret) ctx.fillRect(xv - 2.5, yv, 5, lTiret);
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
      ctx.fillStyle = 'rgba(255,255,255,.16)';
      ctx.fillRect(0, h - t * 0.55, w, t * 0.55);
      ctx.fillStyle = LIME;
      ctx.fillRect(0, h - t * 0.55, w, 4);
      for (const o of objets) {
        const k = borner(o.y / sol, 0, 1);
        // Objet en train de s'effacer au sol : il rétrécit et pâlit.
        const s = o.sortie > 0 ? o.sortie / 0.14 : 1;
        ctx.globalAlpha = s;
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
        jeton(ctx, o.x, o.y, rj, danger ? (cfg.badges ? 'dechet' : 'danger') : o.or ? 'or' : 'bon');
        emoji(ctx, o.emoji, o.x, o.y, o.taille * 0.82 * (0.7 + 0.3 * s), Math.sin(o.phase) * o.balance + o.rot);
        if (cfg.badges) badge(ctx, o.x + rj * 0.74, o.y - rj * 0.74, Math.max(7, rj * 0.36), !o.mauvais);
        ctx.globalAlpha = 1;
      }
      // Frôlement d'un déchet (FairSort) : le cadre clignote orange, bref.
      if (alerte > 0) {
        ctx.strokeStyle = `rgba(255,169,77,${(alerte / 0.4 * 0.9).toFixed(3)})`; ctx.lineWidth = 6;
        ctx.strokeRect(3, 3, w - 6, h - 6);
      }
      // Le joueur penche légèrement dans le sens de son déplacement et rebondit quand il attrape.
      ctx.save();
      ctx.translate(joueurX, h - t * 0.55);
      const sq = borner(rebond, -0.3, 0.3);
      ctx.scale(1 + sq * 0.5, 1 - sq * 0.6);
      // Socle lime sous le joueur : on le retrouve d'un coup d'œil, même au milieu des objets qui tombent.
      ctx.fillStyle = 'rgba(0,0,0,.28)';
      ctx.beginPath(); ctx.ellipse(0, t * 0.05, t * 0.95, t * 0.2, 0, 0, Math.PI * 2); ctx.fill();
      ctx.fillStyle = LIME; ctx.strokeStyle = '#14121F'; ctx.lineWidth = 3;
      ctx.beginPath(); ctx.arc(0, -t * 0.65, t * 0.86, 0, Math.PI * 2); ctx.fill(); ctx.stroke();
      emoji(ctx, cfg.joueur, 0, -t * 0.65, t * 1.3, borner(vJoueur / (w * 2.2), -0.3, 0.3)); // penche selon sa vitesse réelle
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
const MAUVAIS = ['🗑️', '🦠', '💀', '🧪'];

export const JEUX = [
  {
    key: 'catch', label: 'FairCatch', sub: 'Attrape les plats', emoji: '🧺',
    stockage: 'fairide_food_catch_best', pointsParNiveau: 10, maxNiveau: 8, perdu: '💥 Perdu !',
    regles: [
      'But : des plats tombent du ciel, attrape-les tous dans ton panier avant qu’ils ne touchent le sol.',
      'Score : +1 par plat attrapé, +3 pour un plat doré ✨. Tous les 10 points, niveau supérieur : ça tombe plus vite et plus souvent.',
      'Fin de partie : un seul plat par terre et c’est fini. Ton record est gardé et compte pour le podium.'
    ],
    controles: 'Commandes : glisse le doigt (ou la souris) à gauche et à droite, le panier suit. Clavier : flèches ← →, Échap ou P pour la pause.',
    creer: (api) => creerChute(api, {
      joueur: '🧺', ciel: ['#2A2280', '#5F51EC'], demiContact: 1.35,
      // Un plat sur dix est doré : il vaut 3 et tombe un peu plus vite.
      nouvelObjet: () => (Math.random() < 0.1 ? { emoji: choix(PLATS), or: true, points: 3, vitesseFacteur: 1.2 } : { emoji: choix(PLATS) }),
      intervalle: (n) => Math.max(0.42, 0.96 - n * 0.072),
      vitesse: (n) => aleatoire(0.128 + n * 0.0224, 0.269 + n * 0.035),
      toucher: () => 'point', manquer: () => 'perdu'
    })
  },
  {
    key: 'dodge', label: 'FairDodge', sub: 'Évite les obstacles', emoji: '🚧',
    stockage: 'fairide_dodge_best', pointsParNiveau: 10, maxNiveau: 8, perdu: '💥 Touché !',
    regles: [
      'But : tu livres en scooter et la route est semée d’obstacles (🚧 🪨 🕳️ 🔥 💥), faufile-toi sans rien toucher.',
      'Score : +1 par obstacle évité, +1 de bonus « Pfiou ! » quand il te frôle. Tous les 10 points, la route accélère et les obstacles se rapprochent.',
      'Fin de partie : un seul choc et le scooter s’arrête. Ton record est gardé et compte pour le podium.'
    ],
    controles: 'Commandes : glisse le doigt (ou la souris) à gauche et à droite, le scooter suit. Clavier : flèches ← →, Échap ou P pour la pause.',
    creer: (api) => creerChute(api, {
      // Asphalte sombre (et non plus violet grisé) : les panneaux rouges et blancs des obstacles tranchent dessus.
      joueur: '🛵', ciel: ['#1E1D2B', '#3A3950'], eclat: ORANGE, route: true, tournoie: true,
      // Contact « juste » (1 taille d'objet) : on ne perd pas sur un obstacle qui n'a fait qu'effleurer le dessin.
      demiContact: 1.02,
      nouvelObjet: () => ({ emoji: choix(OBSTACLES) }),
      intervalle: (n) => Math.max(0.54, 1.2 - n * 0.078),
      vitesse: (n) => aleatoire(0.115 + n * 0.019, 0.231 + n * 0.032),
      toucher: () => 'perdu', manquer: () => null,
      // Le point tombe au moment où l'obstacle passe le scooter, pas quand il sort de l'écran : le retour
      // est immédiat. À moins d'un tiers d'objet du contact, c'est un frôlement : « Pfiou ! », +2.
      passer: (o, dx, demi, t) => (dx < demi + t * 0.35 ? 'frole' : 'point')
    })
  },
  {
    key: 'reaction', label: 'FairFlash', sub: 'Réflexes rapides', emoji: '🎯',
    stockage: 'fairide_reaction_best', pointsParNiveau: 8, maxNiveau: 8, perdu: '⏱️ Trop lent !',
    regles: [
      'But : une cible 🎯 surgit quelque part sur le terrain, tape dessus avant que l’anneau autour ne se referme.',
      'Score : +1 par cible touchée, +2 « Parfait ! » si tu tapes pendant que l’anneau est encore doré. Tous les 8 points, l’anneau se referme plus vite.',
      'Fin de partie : l’anneau se referme (il passe au rouge) avant que tu n’aies touché la cible. Taper à côté ne coûte rien.'
    ],
    controles: 'Commandes : tape (ou clique) sur la cible. Clavier : Échap ou P pour la pause.',
    creer(api) {
      let w = api.w; let h = api.h; let cible = null; let reste = 0; let fenetre = 1; let precedente = null;
      // Plus grosse qu'avant (plafond 58 → 96px) : la cible doit sauter aux yeux dès qu'elle apparaît.
      const taille = () => Math.max(46, Math.min(96, Math.min(w, h) * 0.26));
      const PARFAIT = 0.62; // fraction de la fenêtre pendant laquelle l'anneau est doré (Parfait = +2)
      const nouvelleCible = (n) => {
        const t = taille();
        fenetre = Math.max(0.55, 1.5 - n * 0.12);
        reste = fenetre;
        // Jamais sous le doigt : au moins 1,4 taille de la cible précédente (8 tirages, puis on garde le dernier).
        let x = w / 2; let y = h / 2;
        for (let i = 0; i < 8; i++) {
          x = aleatoire(t / 2 + 4, w - t / 2 - 4); y = aleatoire(t / 2 + 4, h - t / 2 - 4);
          if (!precedente || Math.hypot(x - precedente.x, y - precedente.y) >= t * 1.4) break;
        }
        cible = { x, y, age: 0, ratee: false }; precedente = cible;
      };
      return {
        reset() { cible = null; reste = 0; precedente = null; },
        redimensionner(nw, nh) {
          const kx = nw / w; const ky = nh / h; w = nw; h = nh;
          if (cible) { cible.x *= kx; cible.y *= ky; }
        },
        etat() { return { cible: !!cible, x: cible?.x, y: cible?.y, reste, fenetre }; },
        update(dt, input) {
          if (!cible) nouvelleCible(input.niveau);
          const t = taille();
          for (const tape of input.tapes) {
            if (Math.hypot(tape.x - cible.x, tape.y - cible.y) <= t * 0.62) {
              const parfait = reste / fenetre >= PARFAIT;
              api.marquer(parfait ? 2 : 1);
              api.effet?.(cible.x, cible.y - t * 0.8, parfait ? `${tx(api, 'jeux.fx_parfait', 'Parfait !')} +2` : '+1', parfait ? OR : undefined);
              api.eclat?.(cible.x, cible.y, parfait ? OR : '#E8A33C', parfait ? 16 : 10);
              // Le niveau est relu APRÈS le point : la cible suivante doit déjà tenir compte du palier
              // qu'on vient éventuellement de franchir, pas de celui d'avant.
              nouvelleCible(api.niveau());
              return undefined;
            }
          }
          reste -= dt; cible.age += dt;
          if (reste <= 0) { reste = 0; cible.ratee = true; return api.perdre(); }
          return undefined;
        },
        draw(ctx) {
          fondDegrade(ctx, w, h, '#2A0F3D', '#5B2A78');
          // Quadrillage discret : un repère pour l'œil, sans rien qui ressemble à une cible.
          ctx.fillStyle = 'rgba(255,255,255,.07)';
          const pas = Math.max(28, Math.min(w, h) / 8);
          for (let gx = pas / 2; gx < w; gx += pas) for (let gy = pas / 2; gy < h; gy += pas) { ctx.beginPath(); ctx.arc(gx, gy, 1.6, 0, Math.PI * 2); ctx.fill(); }
          if (!cible) return;
          const t = taille(); const k = reste / fenetre;
          // Piste de l'anneau, puis l'anneau qui se referme : la fraction de temps restante, lisible sans
          // chiffre. Doré tant que « Parfait » est possible, vert ensuite, rouge à la fin. Plus épais qu'avant.
          const epais = Math.max(5, t * 0.09);
          ctx.lineWidth = epais; ctx.lineCap = 'round';
          ctx.strokeStyle = 'rgba(255,255,255,.22)';
          ctx.beginPath(); ctx.arc(cible.x, cible.y, t * 0.74, 0, Math.PI * 2); ctx.stroke();
          ctx.beginPath();
          ctx.arc(cible.x, cible.y, t * 0.74, -Math.PI / 2, -Math.PI / 2 + Math.PI * 2 * k);
          ctx.strokeStyle = cible.ratee || k < 0.3 ? ROUGE : k >= PARFAIT ? OR : LIME;
          ctx.stroke();
          // Apparition avec un léger rebond (0,2 s) : l'œil repère la nouvelle cible tout de suite. Sous
          // 0,3 de temps restant, la cible tremble : dernier avertissement.
          const a = Math.min(1, cible.age / 0.2); const echelle = 1 + Math.sin(a * Math.PI) * 0.18 * (1 - a) + (a - 1) * 0.3;
          const tremble = k < 0.3 && !cible.ratee ? Math.sin(cible.age * 60) * 2 : 0;
          // Cible DESSINÉE (anneaux rouges et blancs), plus un emoji : nette à toute taille, et visible même là
          // où la police emoji ne peint rien.
          const r = t * 0.5 * Math.max(0.7, echelle); const cx = cible.x + tremble; const cy = cible.y;
          ctx.fillStyle = 'rgba(0,0,0,.3)';
          ctx.beginPath(); ctx.arc(cx, cy + r * 0.1, r, 0, Math.PI * 2); ctx.fill();
          for (const [f, c] of [[1, '#FFFFFF'], [0.84, '#E0344A'], [0.62, '#FFFFFF'], [0.42, '#E0344A'], [0.2, '#FFFFFF']]) {
            ctx.fillStyle = c; ctx.beginPath(); ctx.arc(cx, cy, r * f, 0, Math.PI * 2); ctx.fill();
          }
        }
      };
    }
  },
  {
    key: 'sort', label: 'FairSort', sub: 'Trie les bons plats', emoji: '🗑️',
    stockage: 'fairide_sort_best', pointsParNiveau: 10, maxNiveau: 8, perdu: '🤢 Mauvais choix !',
    regles: [
      'But : des plats tombent, mais aussi des déchets cerclés de rouge (🗑️ 🦠 💀 🧪). Attrape les plats, laisse tomber les déchets.',
      'Score : +1 par plat attrapé, un plat raté ne coûte rien. Tous les 10 points, niveau supérieur : plus de déchets, et ça tombe plus vite.',
      'Fin de partie : un seul déchet dans le panier. Le cadre clignote orange quand un déchet t’a frôlé : ouf ! Ton record compte pour le podium.'
    ],
    controles: 'Commandes : glisse le doigt (ou la souris) à gauche et à droite, le panier suit. Clavier : flèches ← →, Échap ou P pour la pause.',
    creer: (api) => creerChute(api, {
      // Ciel vert profond (et non plus vert vif) : les jetons blancs cerclés de vert s'y fondaient.
      joueur: '🧺', ciel: ['#0B2A24', '#17614B'], eclat: LIME, demiContact: 1.3, badges: true,
      nouvelObjet: (n) => {
        const mauvais = Math.random() < Math.min(0.45, 0.22 + n * 0.03);
        return { emoji: choix(mauvais ? MAUVAIS : PLATS), mauvais };
      },
      intervalle: (n) => Math.max(0.48, 1.02 - n * 0.066),
      vitesse: (n) => aleatoire(0.128 + n * 0.019, 0.256 + n * 0.032),
      toucher: (o) => (o.mauvais ? 'perdu' : 'point'), manquer: () => null,
      // Un déchet passé à moins d'un tiers d'objet du panier : alerte orange, sans point ni pénalité.
      passer: (o, dx, demi, t) => (o.mauvais && dx < demi + t * 0.35 ? 'alerte' : null)
    })
  },
  {
    key: 'rider', label: 'FairRider', sub: 'Saltos, sauts, loopings, lettres', emoji: '🚴',
    stockage: 'fairide_rider_best', pointsParNiveau: 8, maxNiveau: 8, perdu: '🤕 Chute !',
    regles: [
      'But : maintiens pour mettre les gaz au sol ; en l’air, maintenir fait tourner le vélo en arrière (backflip), relâcher arrête la rotation. Double tap (ou double clic) pour sauter par-dessus les obstacles de la route. Tremplins, crêtes, trous et falaises te font décoller, et les loopings se bouclent tout seuls si tu arrives assez vite.',
      'Lettres : un mot lié à Fairide (7 lettres au plus) est affiché en haut, et chaque mot complété en révèle un plus long. Ses lettres sont sur la route ou en l’air — il faut parfois sauter pour les cueillir. Attrape-les toutes : tous les points gagnés pendant ce mot sont doublés, puis le mot suivant apparaît. Une lettre ratée revient plus loin.',
      'Score : +1 par backflip (un double vaut 2, un triple 3) et autant en prime dès deux tours dans le même vol, +1 si tu retombes pile dans l’axe, +3 par looping, +1 par obstacle franchi en l’air, +1 par lettre, +1 par sac de livraison, +1 par bout de piste. Fin de partie : retomber de travers (au-delà de 65°), tomber dans un trou ou percuter un obstacle au sol.'
    ],
    controles: 'Maintiens (doigt, souris ou Espace) : gaz au sol, backflip en l’air. Double tap, double clic ou double Espace : saut — au clavier, ↑ ou W saute directement. Échap ou P pour la pause.',
    creer: (api) => creerRider(api)
  },
  {
    key: 'arrow', label: 'FairArrow', sub: 'Vise les passages', emoji: '🏹',
    stockage: 'fairide_arrow_best', pointsParNiveau: 8, maxNiveau: 8, perdu: '💢 Dans le mur !',
    regles: [
      'But : ta flèche fonce vers le haut, des murs descendent avec chacun une seule ouverture, vise le passage.',
      'Score : +1 par mur traversé. Le passage à viser est éclairé en vert et la pointe passe au vert quand tu es aligné. Tous les 8 points, les murs accélèrent et les ouvertures rétrécissent.',
      'Fin de partie : la pointe touche un mur. Ton record est gardé et compte pour le podium.'
    ],
    controles: 'Commandes : glisse le doigt (ou la souris) à gauche et à droite, la flèche suit. Clavier : flèches ← →, Échap ou P pour la pause.',
    creer(api) {
      let w = api.w; let h = api.h; let murs = []; let ax = w / 2; let cibleX = w / 2; let depuis = 0; let inclinaison = 0; let traine = []; let dernierCentre = null; let impact = null;
      let vAx = 0; let defile = 0; let vDecor = 0;
      const yFleche = () => h * 0.8;
      const longueur = () => Math.max(34, h * 0.09);
      const espacement = () => h * 0.42;
      const TRAINE = 0.3; // durée de vie d'un point de traînée
      return {
        reset() { murs = []; ax = w / 2; cibleX = w / 2; depuis = espacement(); inclinaison = 0; traine = []; dernierCentre = null; impact = null; vAx = 0; defile = 0; },
        redimensionner(nw, nh) {
          const kx = nw / w; const ky = nh / h; w = nw; h = nh;
          ax *= kx; cibleX *= kx; depuis *= ky;
          if (dernierCentre != null) dernierCentre *= kx;
          const ep = Math.max(10, h * 0.03);
          for (const m of murs) { m.x *= kx; m.largeur *= kx; m.y *= ky; m.ep = ep; }
          for (const tr of traine) { tr.x *= kx; tr.y *= ky; }
        },
        etat() {
          let prochain = null;
          for (const m of murs) if (!m.compte && (!prochain || m.y > prochain.y)) prochain = m;
          return { murs: murs.length, traine: traine.length, ax, passage: prochain ? prochain.x + prochain.largeur / 2 : null };
        },
        update(dt, input) {
          const n = input.niveau;
          const v = h * (0.38 + n * 0.05);
          const ouverture = Math.max(w * 0.2, w * (0.36 - n * 0.02));
          const ep = Math.max(10, h * 0.03);
          if (input.x != null) cibleX = borner(input.x, 10, w - 10);
          // Ressort presque critique (voir creerChute) : la flèche prend son virage et se stabilise sans vibrer.
          {
            const raideur = 1200; const amorti = 2 * Math.sqrt(raideur) * 0.95;
            const sous = Math.max(1, Math.ceil(dt / (1 / 120)));
            for (let i = 0; i < sous; i++) { const d = dt / sous; vAx += ((cibleX - ax) * raideur - vAx * amorti) * d; ax += vAx * d; }
            ax = borner(ax, 10, w - 10);
          }
          inclinaison += ((vAx / (w * 3)) - inclinaison) * Math.min(1, dt * 12);
          depuis += v * dt; defile += v * dt; vDecor = v;
          if (depuis >= espacement()) {
            depuis = 0;
            // L'ouverture suivante reste atteignable : au plus 70 % de la largeur (54 % au dernier palier) de
            // distance avec la précédente — mais jamais au même endroit (au moins une demi-ouverture de décalage).
            const saut = w * (0.7 - n * 0.02);
            const prec = dernierCentre ?? w / 2;
            let centre = prec;
            for (let i = 0; i < 10; i++) {
              centre = aleatoire(Math.max(ouverture / 2, prec - saut), Math.min(w - ouverture / 2, prec + saut));
              if (Math.abs(centre - prec) >= ouverture * 0.5) break;
            }
            dernierCentre = centre;
            murs.push({ y: -ep, x: centre - ouverture / 2, largeur: ouverture, ep, compte: false });
          }
          const yf = yFleche(); const L = longueur(); const pointe = yf - L * 0.6; const demi = 7;
          const restants = [];
          for (const m of murs) {
            m.y += v * dt;
            // Zone de contact : de la pointe au milieu du fût. Les empennes (sous yf) passent sans compter :
            // le mur est déjà franchi quand il les atteint.
            const dansHauteur = m.y < yf + 4 && m.y + m.ep > pointe;
            const dansOuverture = ax - demi > m.x && ax + demi < m.x + m.largeur;
            if (dansHauteur && !dansOuverture) { impact = { x: ax, y: Math.max(pointe, m.y) }; return api.perdre(); }
            if (!m.compte && m.y > yf) { m.compte = true; api.marquer(1); api.effet?.(ax, yf - h * 0.12, '+1'); api.eclat?.(ax, pointe, LIME, 5); }
            if (m.y < h + m.ep) restants.push(m);
          }
          murs = restants;
          // Traînée : les dernières positions de la flèche, qui descendent avec le décor et s'estompent.
          traine.push({ x: ax, y: yf + L * 0.45, reste: TRAINE });
          for (const tr of traine) { tr.reste -= dt; tr.y += v * dt; }
          traine = traine.filter((tr) => tr.reste > 0).slice(-18);
          return undefined;
        },
        draw(ctx) {
          // Nuit violette plus profonde qu'avant : les barrières claires et le passage lime ressortent mieux.
          fondDegrade(ctx, w, h, '#17123A', '#3B31A0');
          // Lignes de vitesse en trois plans, qui filent vers le bas moins vite que les murs : on sent qu'on fonce.
          for (let i = 0; i < 18; i++) {
            const plan = 0.3 + (i % 3) * 0.25;
            const px = (i * 97.3 + 13) % w;
            const lg = h * (0.04 + plan * 0.07) * (1 + vDecor / h * 0.6);
            const py = ((((i * 131) % (h + lg)) + defile * plan) % (h + lg)) - lg;
            ctx.fillStyle = `rgba(255,255,255,${(0.05 + plan * 0.12).toFixed(3)})`;
            ctx.fillRect(px, py, 1.2 + plan, lg);
          }
          const yf = yFleche(); const L = longueur();
          // Le prochain mur à franchir.
          let prochain = null;
          for (const m of murs) if (!m.compte && (!prochain || m.y > prochain.y)) prochain = m;
          const alignee = !prochain || (ax - 7 > prochain.x && ax + 7 < prochain.x + prochain.largeur);
          const accent = alignee ? LIME : OR;

          if (prochain) {
            const bas = prochain.y + prochain.ep;
            // Faisceau lumineux sous le passage : on lit d'un coup d'œil où viser, même de loin.
            const g = ctx.createLinearGradient(0, bas, 0, bas + h * 0.24);
            g.addColorStop(0, 'rgba(200,240,60,.42)'); g.addColorStop(1, 'rgba(200,240,60,0)');
            ctx.fillStyle = g; ctx.fillRect(prochain.x, bas, prochain.largeur, h * 0.24);
            // Chevrons qui montent dans le faisceau : « passe par ici ».
            const pasC = Math.max(12, h * 0.035); const cx = prochain.x + prochain.largeur / 2; const lc = Math.min(prochain.largeur * 0.22, 16);
            ctx.lineWidth = 3; ctx.lineCap = 'round'; ctx.lineJoin = 'round';
            for (let k = 0; k < 3; k++) {
              const yc = bas + pasC * (k + 1) - ((defile * 0.25) % pasC);
              ctx.strokeStyle = `rgba(200,240,60,${(0.85 - k * 0.25).toFixed(2)})`;
              ctx.beginPath(); ctx.moveTo(cx - lc, yc + lc * 0.5); ctx.lineTo(cx, yc - lc * 0.1); ctx.lineTo(cx + lc, yc + lc * 0.5); ctx.stroke();
            }
            // Ligne de visée pointillée, de la pointe au mur : verte si l'on passe, ambre sinon.
            if (bas < yf - L * 0.7) {
              ctx.save();
              ctx.setLineDash([6, 7]); ctx.lineDashOffset = defile * 0.4;
              ctx.strokeStyle = alignee ? 'rgba(200,240,60,.75)' : 'rgba(255,209,102,.8)'; ctx.lineWidth = 2;
              ctx.beginPath(); ctx.moveTo(ax, yf - L * 0.7); ctx.lineTo(ax, bas + 2); ctx.stroke();
              ctx.restore();
            }
          }

          // Les murs : des barrières rayées rouge et blanc, franches ; les suivants, plus loin dans la file,
          // restent estompés pour ne pas voler l'attention au prochain.
          for (const m of murs) {
            const actif = m === prochain;
            ctx.globalAlpha = actif ? 1 : 0.5;
            for (const [x0, lw] of [[0, m.x], [m.x + m.largeur, w - m.x - m.largeur]]) {
              if (lw <= 0) continue;
              ctx.fillStyle = 'rgba(0,0,0,.3)';
              rectArrondi(ctx, x0, m.y + 3, lw, m.ep, Math.min(5, m.ep / 2)); ctx.fill();
              ctx.fillStyle = '#F4F1EA';
              rectArrondi(ctx, x0, m.y, lw, m.ep, Math.min(5, m.ep / 2)); ctx.fill();
              ctx.save();
              rectArrondi(ctx, x0, m.y, lw, m.ep, Math.min(5, m.ep / 2)); ctx.clip();
              ctx.fillStyle = '#E0344A';
              const pasR = m.ep * 1.5;
              for (let sx = x0 - m.ep; sx < x0 + lw + m.ep; sx += pasR) {
                ctx.beginPath(); ctx.moveTo(sx, m.y + m.ep); ctx.lineTo(sx + m.ep * 0.75, m.y + m.ep); ctx.lineTo(sx + m.ep * 1.5, m.y); ctx.lineTo(sx + m.ep * 0.75, m.y); ctx.closePath(); ctx.fill();
              }
              ctx.restore();
            }
            if (actif) {
              // Poteaux lime de part et d'autre du passage, avec un halo : la porte à franchir.
              const hp = m.ep + 10;
              for (const px of [m.x - 3, m.x + m.largeur + 3]) {
                const gh = ctx.createRadialGradient(px, m.y + m.ep / 2, 1, px, m.y + m.ep / 2, hp);
                gh.addColorStop(0, 'rgba(200,240,60,.55)'); gh.addColorStop(1, 'rgba(200,240,60,0)');
                ctx.fillStyle = gh; ctx.beginPath(); ctx.arc(px, m.y + m.ep / 2, hp, 0, Math.PI * 2); ctx.fill();
                ctx.fillStyle = LIME; rectArrondi(ctx, px - 3, m.y - 5, 6, m.ep + 10, 3); ctx.fill();
              }
            }
            ctx.globalAlpha = 1;
          }

          // Traînée : un ruban qui s'affine et pâlit derrière la flèche, de la couleur de la visée.
          if (traine.length > 1) {
            ctx.lineCap = 'round';
            for (let i = 1; i < traine.length; i++) {
              const a = traine[i - 1]; const b = traine[i]; const k = b.reste / TRAINE;
              ctx.globalAlpha = k * 0.6; ctx.strokeStyle = accent; ctx.lineWidth = 1.5 + k * 5;
              ctx.beginPath(); ctx.moveTo(a.x, a.y); ctx.lineTo(b.x, b.y); ctx.stroke();
            }
            ctx.globalAlpha = 1;
          }

          // La flèche : halo, fût épais cerné d'encre, empennage rose et violet, pointe verte (alignée) ou ambre.
          ctx.save(); ctx.translate(ax, yf); ctx.rotate(borner(inclinaison, -0.5, 0.5));
          const gHalo = ctx.createRadialGradient(0, -L * 0.2, 2, 0, -L * 0.2, L * 0.95);
          gHalo.addColorStop(0, alignee ? 'rgba(200,240,60,.35)' : 'rgba(255,209,102,.35)'); gHalo.addColorStop(1, 'rgba(0,0,0,0)');
          ctx.fillStyle = gHalo; ctx.beginPath(); ctx.arc(0, -L * 0.2, L * 0.95, 0, Math.PI * 2); ctx.fill();
          ctx.lineCap = 'round'; ctx.lineJoin = 'round';
          // Empennage
          for (const sens of [-1, 1]) {
            ctx.fillStyle = sens < 0 ? '#FF5C8A' : '#8C7CFF';
            ctx.beginPath(); ctx.moveTo(0, L * 0.18); ctx.lineTo(sens * 11, L * 0.46); ctx.lineTo(sens * 11, L * 0.66); ctx.lineTo(0, L * 0.44); ctx.closePath(); ctx.fill();
            ctx.strokeStyle = '#14121F'; ctx.lineWidth = 1.5; ctx.stroke();
          }
          // Fût
          ctx.strokeStyle = '#14121F'; ctx.lineWidth = 7;
          ctx.beginPath(); ctx.moveTo(0, L * 0.5); ctx.lineTo(0, -L * 0.3); ctx.stroke();
          ctx.strokeStyle = '#F7F5F0'; ctx.lineWidth = 4;
          ctx.beginPath(); ctx.moveTo(0, L * 0.5); ctx.lineTo(0, -L * 0.3); ctx.stroke();
          // Pointe
          ctx.fillStyle = accent;
          ctx.beginPath(); ctx.moveTo(0, -L * 0.66); ctx.lineTo(-13, -L * 0.26); ctx.lineTo(0, -L * 0.34); ctx.lineTo(13, -L * 0.26); ctx.closePath(); ctx.fill();
          ctx.strokeStyle = '#14121F'; ctx.lineWidth = 2; ctx.stroke();
          ctx.restore();

          // Impact : un éclat rouge en étoile et une onde, le temps que la carte de fin apparaisse.
          if (impact) {
            ctx.strokeStyle = ROUGE; ctx.lineWidth = 3; ctx.lineCap = 'round';
            for (let i = 0; i < 10; i++) {
              const a = i * Math.PI / 5;
              ctx.beginPath(); ctx.moveTo(impact.x + Math.cos(a) * 7, impact.y + Math.sin(a) * 7); ctx.lineTo(impact.x + Math.cos(a) * 17, impact.y + Math.sin(a) * 17); ctx.stroke();
            }
            ctx.fillStyle = '#FFFFFF'; ctx.beginPath(); ctx.arc(impact.x, impact.y, 5, 0, Math.PI * 2); ctx.fill();
            ctx.strokeStyle = 'rgba(255,107,107,.6)'; ctx.lineWidth = 2;
            ctx.beginPath(); ctx.arc(impact.x, impact.y, 24, 0, Math.PI * 2); ctx.stroke();
          }
        }
      };
    }
  }
];
