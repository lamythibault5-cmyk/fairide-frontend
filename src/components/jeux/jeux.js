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

import { aleatoire, choix, emoji, fondDegrade, halo, IRIS, LIME } from './dessin';

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
  const tailleObjet = () => Math.max(20, Math.min(36, w * 0.16));
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
        ctx.fillStyle = 'rgba(255,255,255,.16)';
        const pasTiret = h * 0.16; const lTiret = h * 0.07;
        for (const xv of [w / 3, (2 * w) / 3]) {
          for (let yv = (defile % pasTiret) - pasTiret; yv < h; yv += pasTiret) ctx.fillRect(xv - 2, yv, 4, lTiret);
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
      ctx.fillStyle = 'rgba(255,255,255,.13)';
      ctx.fillRect(0, h - t * 0.55, w, t * 0.55);
      ctx.fillStyle = 'rgba(200,240,60,.9)';
      ctx.fillRect(0, h - t * 0.55, w, 2.5);
      for (const o of objets) {
        const k = borner(o.y / sol, 0, 1);
        // Objet en train de s'effacer au sol : il rétrécit et pâlit.
        const s = o.sortie > 0 ? o.sortie / 0.14 : 1;
        ctx.globalAlpha = s;
        // Ombre au sol qui grandit à l'approche : on lit où l'objet va tomber.
        ctx.fillStyle = `rgba(0,0,0,${(0.12 + k * 0.28).toFixed(3)})`;
        ctx.beginPath(); ctx.ellipse(o.x, h - t * 0.45, t * (0.2 + k * 0.25) * s, t * 0.07, 0, 0, Math.PI * 2); ctx.fill();
        // Halo : doré pour le plat à 3 points, rouge pour un déchet (FairSort) — le tri se lit de loin.
        if (o.or || o.mauvais) {
          const pulse = 1 + Math.sin(o.phase * 2) * 0.06;
          ctx.fillStyle = o.or ? 'rgba(255,209,102,.30)' : 'rgba(255,80,80,.28)';
          ctx.beginPath(); ctx.arc(o.x, o.y, t * 0.78 * pulse, 0, Math.PI * 2); ctx.fill();
          ctx.strokeStyle = o.or ? OR : ROUGE; ctx.lineWidth = 2;
          ctx.beginPath(); ctx.arc(o.x, o.y, t * 0.78 * pulse, 0, Math.PI * 2); ctx.stroke();
        }
        // Le halo passe sous l'emoji : c'est lui qui rend l'objet lisible sur un fond sombre.
        halo(ctx, o.x, o.y, t * 0.82, '255,255,255', 0.45);
        emoji(ctx, o.emoji, o.x, o.y, o.taille * (0.7 + 0.3 * s), Math.sin(o.phase) * o.balance + o.rot);
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
      halo(ctx, 0, -t * 0.65, t * 1.0, '255,255,255', 0.4);
      emoji(ctx, cfg.joueur, 0, -t * 0.65, t * 1.45, borner(vJoueur / (w * 2.2), -0.3, 0.3)); // penche selon sa vitesse réelle
      ctx.restore();
    }
  };
}

// Part linéaire de la courbe de chute (le reste est accéléré) : 0,7 = départ à 70 % de la vitesse moyenne, arrivée à 130 %.
const CHUTE_LIN = 0.7;
const PLATS = ['🍕', '🍔', '🍟', '🍩', '🍣', '🌮', '🥐', '🍦'];
const OBSTACLES = ['🚧', '🪨', '🕳️', '🔥', '💥'];

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
      joueur: '🛵', ciel: ['#2E2752', '#7A6FB0'], eclat: ORANGE, route: true, tournoie: true,
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
      const taille = () => Math.max(30, Math.min(58, w * 0.22));
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
          fondDegrade(ctx, w, h, '#4A1C66', '#A64FBC');
          if (!cible) return;
          const t = taille(); const k = reste / fenetre;
          // Piste de l'anneau, puis l'anneau qui se referme : la fraction de temps restante, lisible sans
          // chiffre. Doré tant que « Parfait » est possible, vert ensuite, rouge à la fin.
          ctx.lineWidth = 4; ctx.lineCap = 'round';
          ctx.strokeStyle = 'rgba(255,255,255,.14)';
          ctx.beginPath(); ctx.arc(cible.x, cible.y, t * 0.72, 0, Math.PI * 2); ctx.stroke();
          ctx.beginPath();
          ctx.arc(cible.x, cible.y, t * 0.72, -Math.PI / 2, -Math.PI / 2 + Math.PI * 2 * k);
          ctx.strokeStyle = cible.ratee || k < 0.3 ? ROUGE : k >= PARFAIT ? OR : LIME;
          ctx.stroke();
          // Apparition avec un léger rebond (0,2 s) : l'œil repère la nouvelle cible tout de suite. Sous
          // 0,3 de temps restant, la cible tremble : dernier avertissement.
          const a = Math.min(1, cible.age / 0.2); const echelle = 1 + Math.sin(a * Math.PI) * 0.18 * (1 - a) + (a - 1) * 0.3;
          const tremble = k < 0.3 && !cible.ratee ? Math.sin(cible.age * 60) * 2 : 0;
          emoji(ctx, '🎯', cible.x + tremble, cible.y, t * Math.max(0.7, echelle));
        }
      };
    }
  }
  // TROIS JEUX, PLUS SIX. FairSort, FairRider et FairArrow sont partis : trois de plus ne
  // donnaient pas trois fois plus d'envie de jouer, ils donnaient six onglets a lire avant de
  // choisir. Restent les trois qui se comprennent sans notice - attraper, eviter, viser vite.
  // FairRider emportait avec lui rider.js et ses 902 lignes, la piece la plus complexe du lot et
  // celle qui avait deja demande plusieurs passes de corrections (saltos, receptions, obstacles).
];
