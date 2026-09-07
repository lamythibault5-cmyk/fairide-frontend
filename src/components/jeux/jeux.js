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
// CONTRAT. api = { w, h, large, marquer(n), perdre() }. Le jeu expose :
//   reset()                      — nouvelle partie
//   update(dt, input)            — dt en secondes (plafonné par le moteur), input = { x, y, enfonce,
//                                  tapes: [{x, y}], niveau }
//   draw(ctx)                    — le contexte est déjà mis à l'échelle en pixels CSS
//   redimensionner(w, h)         — le cadre a changé de taille (plein écran, rotation)

const aleatoire = (a, b) => a + Math.random() * (b - a);
const choix = (tab) => tab[Math.floor(Math.random() * tab.length)];

function emoji(ctx, e, x, y, taille, angle = 0, miroir = false) {
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

function fondDegrade(ctx, w, h, haut, bas) {
  const g = ctx.createLinearGradient(0, 0, 0, h);
  g.addColorStop(0, haut);
  g.addColorStop(1, bas);
  ctx.fillStyle = g;
  ctx.fillRect(0, 0, w, h);
}

const IRIS = '#3B2FB5';
const LIME = '#C8F03C';
const INK = '#14121F';

// ---------------------------------------------------------------------------------------------------
// Base commune aux trois jeux « ça tombe » : attraper, esquiver, trier. Seules changent les règles de
// contact (toucher un objet, ou le laisser passer) et la population d'objets.
// ---------------------------------------------------------------------------------------------------
function creerChute(api, cfg) {
  let w = api.w; let h = api.h;
  let objets = []; let depuisSpawn = 0; let joueurX = w / 2; let cibleX = w / 2;
  const tailleObjet = () => Math.max(20, Math.min(36, w * 0.16));
  const largeurJoueur = () => tailleObjet() * 1.7;

  return {
    reset() { objets = []; depuisSpawn = 0; joueurX = w / 2; cibleX = w / 2; },
    redimensionner(nw, nh) { w = nw; h = nh; },
    update(dt, input) {
      const n = input.niveau;
      const t = tailleObjet(); const lj = largeurJoueur();
      // Le joueur suit le pointeur avec un léger lissage : direct, ça vibre au pixel près ; trop lent,
      // on rate. 18 par seconde = un rattrapage en ~60 ms, imperceptible mais qui gomme le tremblement.
      if (input.x != null) cibleX = Math.max(lj / 2, Math.min(w - lj / 2, input.x));
      joueurX += (cibleX - joueurX) * Math.min(1, dt * 18);

      depuisSpawn += dt;
      if (depuisSpawn >= cfg.intervalle(n)) {
        depuisSpawn = 0;
        const o = cfg.nouvelObjet(n);
        objets.push({ ...o, x: aleatoire(t / 2, w - t / 2), y: -t, v: cfg.vitesse(n) * h, taille: t, id: Math.random() });
      }
      const yJoueur = h - t * 1.3;
      const restants = [];
      for (const o of objets) {
        o.y += o.v * dt;
        const touche = Math.abs(o.y - yJoueur) < t * 0.6 && Math.abs(o.x - joueurX) < (lj + t) / 2 - 4;
        if (touche) {
          const effet = cfg.toucher(o);
          if (effet === 'perdu') return api.perdre();
          if (effet === 'point') api.marquer(1);
          continue;
        }
        if (o.y > h + t) {
          const effet = cfg.manquer(o);
          if (effet === 'perdu') return api.perdre();
          if (effet === 'point') api.marquer(1);
          continue;
        }
        restants.push(o);
      }
      objets = restants;
      return undefined;
    },
    draw(ctx) {
      fondDegrade(ctx, w, h, cfg.ciel[0], cfg.ciel[1]);
      const t = tailleObjet();
      // Sol : une bande qui ancre le joueur, sinon il flotte.
      ctx.fillStyle = 'rgba(20,18,31,.08)';
      ctx.fillRect(0, h - t * 0.55, w, t * 0.55);
      for (const o of objets) emoji(ctx, o.emoji, o.x, o.y, o.taille);
      emoji(ctx, cfg.joueur, joueurX, h - t * 1.2, t * 1.45);
    }
  };
}

const PLATS = ['🍕', '🍔', '🍟', '🍩', '🍣', '🌮', '🥐', '🍦'];
const OBSTACLES = ['🚧', '🪨', '🕳️', '🔥', '💥'];
const MAUVAIS = ['🗑️', '🦠', '💀', '🧪'];

export const JEUX = [
  {
    key: 'catch', label: 'FairCatch', sub: 'Attrape les plats', emoji: '🧺',
    stockage: 'fairide_food_catch_best', pointsParNiveau: 10, maxNiveau: 8, perdu: '💥 Perdu !',
    regles: [
      'Des plats tombent du haut de l’écran : attrape-les tous avec ton panier.',
      'Chaque plat attrapé rapporte un point. Un seul plat qui touche le sol, et c’est perdu.',
      'Tous les 10 points, ça tombe plus vite et plus souvent.'
    ],
    controles: 'Glisse le doigt (ou la souris) de gauche à droite : le panier suit.',
    creer: (api) => creerChute(api, {
      joueur: '🧺', ciel: ['#EEF0FF', '#FFFFFF'],
      nouvelObjet: () => ({ emoji: choix(PLATS) }),
      intervalle: (n) => Math.max(0.42, 0.96 - n * 0.072),
      vitesse: (n) => aleatoire(0.128 + n * 0.0224, 0.269 + n * 0.035),
      toucher: () => 'point', manquer: () => 'perdu'
    })
  },
  {
    key: 'dodge', label: 'FairDodge', sub: 'Évite les obstacles', emoji: '🚧',
    stockage: 'fairide_dodge_best', pointsParNiveau: 10, maxNiveau: 8, perdu: '💥 Touché !',
    regles: [
      'Tu es le livreur. Des obstacles dévalent la route : évite-les tous.',
      'Chaque obstacle qui passe sans te toucher rapporte un point. Un seul contact, et c’est perdu.',
      'Tous les 10 points, la route s’accélère.'
    ],
    controles: 'Glisse le doigt (ou la souris) de gauche à droite : le scooter suit.',
    creer: (api) => creerChute(api, {
      joueur: '🛵', ciel: ['#F4F2ED', '#FFFFFF'],
      nouvelObjet: () => ({ emoji: choix(OBSTACLES) }),
      intervalle: (n) => Math.max(0.54, 1.2 - n * 0.078),
      vitesse: (n) => aleatoire(0.115 + n * 0.019, 0.231 + n * 0.032),
      toucher: () => 'perdu', manquer: () => 'point'
    })
  },
  {
    key: 'reaction', label: 'FairFlash', sub: 'Réflexes rapides', emoji: '🎯',
    stockage: 'fairide_reaction_best', pointsParNiveau: 8, maxNiveau: 8, perdu: '⏱️ Trop lent !',
    regles: [
      'Une cible apparaît quelque part : tape dessus avant qu’elle ne disparaisse.',
      'L’anneau autour de la cible se referme : c’est le temps qu’il te reste.',
      'Tous les 8 points, tu as un peu moins de temps.'
    ],
    controles: 'Tape (ou clique) sur la cible.',
    creer(api) {
      let w = api.w; let h = api.h; let cible = null; let reste = 0; let fenetre = 1;
      const taille = () => Math.max(30, Math.min(58, w * 0.22));
      const nouvelleCible = (n) => {
        const t = taille();
        fenetre = Math.max(0.55, 1.5 - n * 0.12);
        reste = fenetre;
        cible = { x: aleatoire(t / 2, w - t / 2), y: aleatoire(t / 2, h - t / 2) };
      };
      return {
        reset() { cible = null; reste = 0; },
        redimensionner(nw, nh) { w = nw; h = nh; },
        update(dt, input) {
          if (!cible) nouvelleCible(input.niveau);
          const t = taille();
          for (const tape of input.tapes) {
            if (Math.hypot(tape.x - cible.x, tape.y - cible.y) <= t * 0.62) {
              api.marquer(1);
              // Le niveau est relu APRÈS le point : la cible suivante doit déjà tenir compte du palier
              // qu'on vient éventuellement de franchir, pas de celui d'avant.
              nouvelleCible(api.niveau());
              return undefined;
            }
          }
          reste -= dt;
          if (reste <= 0) { cible = null; return api.perdre(); }
          return undefined;
        },
        draw(ctx) {
          fondDegrade(ctx, w, h, '#FFF7EC', '#FFFFFF');
          if (!cible) return;
          const t = taille();
          // L’anneau qui se referme : la fraction de temps restante, lisible sans chiffre.
          ctx.beginPath();
          ctx.arc(cible.x, cible.y, t * 0.72, -Math.PI / 2, -Math.PI / 2 + Math.PI * 2 * (reste / fenetre));
          ctx.strokeStyle = reste / fenetre < 0.3 ? '#D92D3C' : IRIS;
          ctx.lineWidth = 4;
          ctx.lineCap = 'round';
          ctx.stroke();
          emoji(ctx, '🎯', cible.x, cible.y, t);
        }
      };
    }
  },
  {
    key: 'sort', label: 'FairSort', sub: 'Trie les bons plats', emoji: '🗑️',
    stockage: 'fairide_sort_best', pointsParNiveau: 10, maxNiveau: 8, perdu: '🤢 Mauvais choix !',
    regles: [
      'Des plats tombent, mais pas que : des déchets aussi. Attrape les plats, laisse passer le reste.',
      'Un bon plat attrapé rapporte un point. Attraper un déchet, c’est perdu. Rater un plat ne coûte rien.',
      'Plus tu montes, plus il y a de déchets dans le lot.'
    ],
    controles: 'Glisse le doigt (ou la souris) de gauche à droite : le panier suit.',
    creer: (api) => creerChute(api, {
      joueur: '🧺', ciel: ['#EAF7EE', '#FFFFFF'],
      nouvelObjet: (n) => {
        const mauvais = Math.random() < Math.min(0.45, 0.22 + n * 0.03);
        return { emoji: choix(mauvais ? MAUVAIS : PLATS), mauvais };
      },
      intervalle: (n) => Math.max(0.48, 1.02 - n * 0.066),
      vitesse: (n) => aleatoire(0.128 + n * 0.019, 0.256 + n * 0.032),
      toucher: (o) => (o.mauvais ? 'perdu' : 'point'), manquer: () => null
    })
  },
  {
    key: 'rider', label: 'FairRider', sub: 'Saute, double-saute, enchaîne les saltos', emoji: '🚴',
    stockage: 'fairide_rider_best', pointsParNiveau: 8, maxNiveau: 8, perdu: '🤕 Chute !',
    regles: [
      'Tu roules sur une route en bosses. Tape brièvement pour sauter, tape à nouveau en l’air pour un double saut (plus haut, plus longtemps). Maintiens appuyé pour accélérer.',
      'Saute par-dessus les obstacles (🪨 🚧 🛢️) : en toucher un au sol, c’est la chute. Chaque obstacle franchi et chaque bout de route rapportent un point.',
      'En l’air, maintiens appuyé pour tourner : chaque salto complet vaut 1 point, et un enchaînement paie plus (2 saltos = +1 bonus, 3 = +2). Relâche pour te redresser avant le sol — retomber de travers, c’est la chute.'
    ],
    controles: 'Tape pour sauter (deux fois pour un double saut) ; maintiens (doigt, souris ou Espace) pour accélérer au sol et tourner en l’air.',
    // Toutes les grandeurs sont en fraction d'une « unité » u = min(largeur, 1,1 × hauteur) : le même jeu dans la
    // colonne étroite et en plein écran, sans qu'un double saut sorte du cadre en grand (une caméra suit de
    // toute façon le cycliste quand il monte haut). Un appui bref (< 0,28 s) est un saut, au sol comme en l'air
    // (une fois par envol) ; un appui long accélère au sol et fait tourner en l'air — la rotation ne démarre
    // qu'après 0,25 s d'appui, pour qu'un tap de double saut ne fasse pas pivoter le vélo.
    creer(api) {
      let w = api.w; let h = api.h;
      let dist = 0; let y = 0; let vy = 0; let vx = 0; let angle = 0; let rotation = 0; let auSol = true;
      let prochainJalon = 0; let obstacles = []; let prochainObstacle = 0; let appuiPrec = false; let dureeAppui = 0;
      let sautsRestants = 0; let camY = 0; let flash = null; let poussiere = [];
      const OBSTACLES = ['🪨', '🚧', '🛢️'];
      const u = () => Math.min(w, h * 1.1);
      const sol = (x) => h * 0.72 + Math.sin(x / (w * 0.30)) * w * 0.09 + Math.sin(x / (w * 0.13) + 1.7) * w * 0.035;
      const pente = (x) => (sol(x + 2) - sol(x - 2)) / 4;
      const xEcran = () => w * 0.3;
      const normaliser = (a) => { let r = a % (Math.PI * 2); if (r > Math.PI) r -= Math.PI * 2; if (r < -Math.PI) r += Math.PI * 2; return r; };
      const decoller = (impulsion) => { auSol = false; vy = Math.min(vy, 0) - impulsion; };
      return {
        reset() { dist = 0; y = sol(xEcran()); vy = 0; vx = w * 0.6; angle = Math.atan(pente(xEcran())); rotation = 0; auSol = true; prochainJalon = w * 3; obstacles = []; prochainObstacle = xEcran() + w * 3; appuiPrec = false; dureeAppui = 0; sautsRestants = 0; camY = 0; flash = null; poussiere = []; },
        redimensionner(nw, nh) { w = nw; h = nh; },
        update(dt, input) {
          const n = input.niveau;
          const base = w * (0.6 + n * 0.07); const maxi = base * 1.6;
          if (auSol) {
            const cibleV = input.enfonce ? maxi : base;
            vx += (cibleV - vx) * Math.min(1, dt * (input.enfonce ? 2.2 : 1.4));
          }
          // Saut au relâchement d'un appui bref : au sol, ou en l'air une fois (double saut).
          if (input.enfonce) dureeAppui += dt;
          if (!input.enfonce && appuiPrec && dureeAppui < 0.28) {
            if (auSol) { decoller(u() * 1.15); sautsRestants = 1; rotation = 0; }
            else if (sautsRestants > 0) { sautsRestants--; decoller(u() * 1.15); for (let k = 0; k < 6; k++) poussiere.push({ x: xEcran() + (Math.random() - 0.5) * 20, y, vx: (Math.random() - 0.5) * 60, vy: 40 + Math.random() * 60, reste: 0.5 }); }
          }
          if (!input.enfonce) dureeAppui = 0;
          appuiPrec = input.enfonce;
          dist += vx * dt;
          const xm = xEcran() + dist;
          const g = u() * 2.0;
          const ySol = sol(xm); const p = pente(xm);
          if (auSol) {
            const yLibre = y + vy * dt + 0.5 * g * dt * dt;
            if (yLibre < ySol - 1) { auSol = false; sautsRestants = 1; }
            else { y = ySol; vy = p * vx; angle = Math.atan(p); rotation = 0; }
          }
          if (!auSol) {
            vy += g * dt; y += vy * dt;
            if (input.enfonce && dureeAppui > 0.25) {
              // Roue arrière rapide : un tour en 0,48 s, de quoi en enchaîner trois sur un double saut (~2 s de vol).
              const va = -13; angle += va * dt; rotation += Math.abs(va * dt);
            } else {
              const droit = Math.round(angle / (Math.PI * 2)) * Math.PI * 2;
              angle += (droit - angle) * Math.min(1, dt * 6);
            }
            if (y >= ySol) {
              const attendu = Math.atan(p);
              if (Math.abs(normaliser(angle - attendu)) > Math.PI * 0.45) return api.perdre();
              const saltos = Math.floor((rotation + Math.PI * 0.35) / (Math.PI * 2));
              if (saltos > 0) {
                const bonus = saltos >= 3 ? 2 : saltos === 2 ? 1 : 0;
                api.marquer(saltos + bonus);
                flash = { texte: saltos === 1 ? 'SALTO !' : `SALTO ×${saltos}${bonus ? ` +${bonus} bonus` : ''} !`, reste: 1 };
              }
              for (let k = 0; k < 8; k++) poussiere.push({ x: xEcran() + (Math.random() - 0.5) * 24, y: ySol, vx: (Math.random() - 0.5) * 120, vy: -Math.random() * 60, reste: 0.45 });
              y = ySol; vy = p * vx; angle = attendu; auSol = true; rotation = 0; sautsRestants = 0;
            }
          }
          if (dist >= prochainJalon) { prochainJalon += w * 3; api.marquer(1); }
          const t = Math.max(26, Math.min(44, w * 0.2));
          if (xm + w * 1.5 >= prochainObstacle) {
            let ox = prochainObstacle;
            for (let k = 0; k < 200 && pente(ox) < 0.08; k++) ox += 4;
            obstacles.push({ x: ox, emoji: OBSTACLES[Math.floor(Math.random() * OBSTACLES.length)], passe: false });
            prochainObstacle = ox + w * (1.7 + Math.random() * 1.6) * Math.max(0.55, 1 - n * 0.06);
          }
          for (const o of obstacles) {
            if (o.passe || xm < o.x) continue;
            o.passe = true;
            if (auSol) return api.perdre();
            api.marquer(1);
          }
          obstacles = obstacles.filter((o) => o.x > dist - w * 0.5);
          // Caméra : quand le cycliste monte au-dessus du tiers haut, la scène descend en douceur pour le garder visible.
          const cibleCam = Math.max(0, h * 0.3 - y);
          camY += (cibleCam - camY) * Math.min(1, dt * 7);
          if (flash) { flash.reste -= dt; if (flash.reste <= 0) flash = null; }
          for (const pp of poussiere) { pp.x += pp.vx * dt; pp.y += pp.vy * dt; pp.reste -= dt; }
          poussiere = poussiere.filter((pp) => pp.reste > 0);
          return undefined;
        },
        draw(ctx) {
          fondDegrade(ctx, w, h, '#EEF0FF', '#FFFFFF');
          ctx.fillStyle = 'rgba(59,47,181,.07)';
          for (let i = 0; i < 4; i++) {
            const cx = ((i * w * 0.37 - dist * 0.15) % (w * 1.4) + w * 1.4) % (w * 1.4) - w * 0.2;
            ctx.beginPath(); ctx.ellipse(cx, h * (0.12 + (i % 2) * 0.1) + camY * 0.2, w * 0.11, h * 0.035, 0, 0, Math.PI * 2); ctx.fill();
          }
          ctx.save();
          ctx.translate(0, camY);
          ctx.beginPath(); ctx.moveTo(0, h + camY + 10);
          for (let sx = 0; sx <= w; sx += 3) ctx.lineTo(sx, sol(sx + dist));
          ctx.lineTo(w, h + camY + 10); ctx.closePath();
          ctx.fillStyle = IRIS; ctx.fill();
          ctx.beginPath();
          for (let sx = 0; sx <= w; sx += 3) { const yy = sol(sx + dist); if (sx === 0) ctx.moveTo(sx, yy); else ctx.lineTo(sx, yy); }
          ctx.strokeStyle = LIME; ctx.lineWidth = 3; ctx.stroke();
          const t = Math.max(26, Math.min(44, w * 0.2));
          for (const o of obstacles) {
            const sx = o.x - dist;
            if (sx < -t || sx > w + t) continue;
            emoji(ctx, o.emoji, sx, sol(o.x) - t * 0.3, t * 0.75);
          }
          if (!auSol) {
            const ySolIci = sol(xEcran() + dist);
            ctx.fillStyle = 'rgba(20,18,31,.18)';
            ctx.beginPath(); ctx.ellipse(xEcran(), ySolIci - 2, t * 0.38, t * 0.1, 0, 0, Math.PI * 2); ctx.fill();
          }
          ctx.fillStyle = 'rgba(200,240,60,.9)';
          for (const pp of poussiere) { ctx.globalAlpha = Math.max(0, pp.reste * 2); ctx.beginPath(); ctx.arc(pp.x, pp.y, 2.2, 0, Math.PI * 2); ctx.fill(); }
          ctx.globalAlpha = 1;
          emoji(ctx, '🚴', xEcran(), y - t * 0.42, t, angle, true);
          ctx.restore();
          if (flash) {
            ctx.save();
            ctx.globalAlpha = Math.min(1, flash.reste * 2);
            ctx.font = `800 ${Math.max(14, Math.min(26, w * 0.085))}px sans-serif`;
            ctx.textAlign = 'center'; ctx.textBaseline = 'top';
            ctx.lineWidth = 4; ctx.strokeStyle = INK; ctx.strokeText(flash.texte, w / 2, 10);
            ctx.fillStyle = LIME; ctx.fillText(flash.texte, w / 2, 10);
            ctx.restore();
          }
        }
      };
    }
  },
  {
    key: 'arrow', label: 'FairArrow', sub: 'Vise les passages', emoji: '🏹',
    stockage: 'fairide_arrow_best', pointsParNiveau: 8, maxNiveau: 8, perdu: '💢 Dans le mur !',
    regles: [
      'Ta flèche file vers le haut. Des murs descendent, chacun avec une seule ouverture.',
      'Guide la flèche dans l’ouverture : chaque mur franchi rapporte un point. Toucher un mur, c’est perdu.',
      'Tous les 8 points, les murs vont plus vite et les ouvertures se resserrent.'
    ],
    controles: 'Glisse le doigt (ou la souris) de gauche à droite : la flèche suit.',
    creer(api) {
      let w = api.w; let h = api.h; let murs = []; let ax = w / 2; let cibleX = w / 2; let depuis = 0; let inclinaison = 0;
      const yFleche = () => h * 0.8;
      return {
        reset() { murs = []; ax = w / 2; cibleX = w / 2; depuis = 0; inclinaison = 0; },
        redimensionner(nw, nh) { w = nw; h = nh; },
        update(dt, input) {
          const n = input.niveau;
          const v = h * (0.38 + n * 0.05);
          const espacement = h * 0.42;
          const ouverture = Math.max(w * 0.2, w * (0.36 - n * 0.02));
          const ep = Math.max(10, h * 0.03);
          if (input.x != null) cibleX = Math.max(10, Math.min(w - 10, input.x));
          const avant = ax;
          ax += (cibleX - ax) * Math.min(1, dt * 16);
          inclinaison += (((ax - avant) / Math.max(dt, 0.001)) / (w * 3) - inclinaison) * Math.min(1, dt * 10);
          depuis += v * dt;
          if (!murs.length || depuis >= espacement) {
            depuis = 0;
            murs.push({ y: -ep, x: aleatoire(0, w - ouverture), largeur: ouverture, ep, compte: false });
          }
          const yf = yFleche(); const demi = 7;
          const restants = [];
          for (const m of murs) {
            m.y += v * dt;
            const dansHauteur = yf - h * 0.06 < m.y + m.ep && yf + demi > m.y;
            const dansOuverture = ax - demi > m.x && ax + demi < m.x + m.largeur;
            if (dansHauteur && !dansOuverture) return api.perdre();
            if (!m.compte && m.y > yf) { m.compte = true; api.marquer(1); }
            if (m.y < h + m.ep) restants.push(m);
          }
          murs = restants;
          return undefined;
        },
        draw(ctx) {
          fondDegrade(ctx, w, h, '#FFFFFF', '#EEF0FF');
          for (const m of murs) {
            ctx.fillStyle = INK;
            ctx.beginPath(); ctx.roundRect(0, m.y, Math.max(0, m.x), m.ep, 4); ctx.fill();
            ctx.beginPath(); ctx.roundRect(m.x + m.largeur, m.y, Math.max(0, w - m.x - m.largeur), m.ep, 4); ctx.fill();
          }
          // La flèche : un fût et une pointe, inclinés dans le sens du mouvement.
          const yf = yFleche(); const L = Math.max(34, h * 0.09);
          ctx.save(); ctx.translate(ax, yf); ctx.rotate(Math.max(-0.5, Math.min(0.5, inclinaison)));
          ctx.strokeStyle = IRIS; ctx.lineWidth = 3; ctx.lineCap = 'round';
          ctx.beginPath(); ctx.moveTo(0, L * 0.45); ctx.lineTo(0, -L * 0.35); ctx.stroke();
          ctx.fillStyle = LIME; ctx.beginPath(); ctx.moveTo(0, -L * 0.6); ctx.lineTo(-9, -L * 0.3); ctx.lineTo(9, -L * 0.3); ctx.closePath(); ctx.fill();
          ctx.strokeStyle = IRIS; ctx.lineWidth = 2; ctx.stroke();
          ctx.beginPath(); ctx.moveTo(0, L * 0.45); ctx.lineTo(-7, L * 0.62); ctx.moveTo(0, L * 0.45); ctx.lineTo(7, L * 0.62); ctx.stroke();
          ctx.restore();
        }
      };
    }
  }
];
