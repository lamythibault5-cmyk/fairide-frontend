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

function emoji(ctx, e, x, y, taille, angle = 0) {
  ctx.save();
  ctx.translate(x, y);
  if (angle) ctx.rotate(angle);
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
    key: 'rider', label: 'FairRider', sub: 'Roule et fais des saltos', emoji: '🚴',
    stockage: 'fairide_rider_best', pointsParNiveau: 6, maxNiveau: 8, perdu: '🤕 Chute !',
    regles: [
      'Tu roules sur une route en bosses. Maintiens appuyé pour accélérer, relâche pour ralentir.',
      'Lancé sur une bosse, tu décolles. En l’air, maintiens appuyé pour faire une roue arrière… et un salto.',
      'Chaque salto complet réussi rapporte un point, et chaque bout de route parcouru aussi. Retomber de travers, c’est la chute.'
    ],
    controles: 'Maintiens le doigt (ou la souris, ou la touche Espace) : accélère au sol, tourne en l’air.',
    creer(api) {
      let w = api.w; let h = api.h;
      let dist = 0; let y = 0; let vy = 0; let vx = 0; let angle = 0; let rotation = 0; let auSol = true;
      let prochainJalon = 0;
      const sol = (x) => h * 0.72 + Math.sin(x / (w * 0.28)) * h * 0.11 + Math.sin(x / (w * 0.125) + 1.7) * h * 0.05;
      const pente = (x) => (sol(x + 2) - sol(x - 2)) / 4;
      const xEcran = () => w * 0.3;
      return {
        reset() { dist = 0; y = sol(xEcran()); vy = 0; vx = w * 0.9; angle = Math.atan(pente(xEcran())); rotation = 0; auSol = true; prochainJalon = w * 3; },
        redimensionner(nw, nh) { w = nw; h = nh; },
        update(dt, input) {
          const n = input.niveau;
          const base = w * (0.9 + n * 0.1); const maxi = base * 1.7;
          const cibleV = input.enfonce ? maxi : base;
          vx += (cibleV - vx) * Math.min(1, dt * (input.enfonce ? 2.2 : 1.4));
          dist += vx * dt;
          const xm = xEcran() + dist;
          const g = h * 2.4;
          if (auSol) {
            const p = pente(xm);
            const ySol = sol(xm);
            // Décollage : si la chute libre nous laisserait AU-DESSUS du sol qui descend, on quitte la route.
            const yLibre = y + vy * dt + 0.5 * g * dt * dt;
            if (yLibre < ySol - 1.5 && p < -0.12) { auSol = false; vy = vy; }
            else { y = ySol; vy = p * vx; angle = Math.atan(p); rotation = 0; }
          }
          if (!auSol) {
            vy += g * dt; y += vy * dt;
            // Roue arrière : tirer sur le guidon fait tourner en arrière (sens trigonométrique à l’écran).
            const va = input.enfonce ? -5.6 : 0;
            angle += va * dt; rotation += Math.abs(va * dt);
            const ySol = sol(xm);
            if (y >= ySol) {
              const p = pente(xm);
              const attendu = Math.atan(p);
              let ecart = (angle - attendu) % (Math.PI * 2);
              if (ecart > Math.PI) ecart -= Math.PI * 2; if (ecart < -Math.PI) ecart += Math.PI * 2;
              if (Math.abs(ecart) > Math.PI * 0.42) return api.perdre();
              const saltos = Math.floor(rotation / (Math.PI * 2));
              if (saltos > 0) api.marquer(saltos);
              y = ySol; vy = p * vx; angle = attendu; auSol = true; rotation = 0;
            }
          }
          if (dist >= prochainJalon) { prochainJalon += w * 3; api.marquer(1); }
          return undefined;
        },
        draw(ctx) {
          fondDegrade(ctx, w, h, '#EEF0FF', '#FFFFFF');
          // Nuages qui défilent lentement : le sens de la vitesse sans un seul chiffre.
          ctx.fillStyle = 'rgba(59,47,181,.07)';
          for (let i = 0; i < 4; i++) {
            const cx = ((i * w * 0.37 - dist * 0.15) % (w * 1.4) + w * 1.4) % (w * 1.4) - w * 0.2;
            ctx.beginPath(); ctx.ellipse(cx, h * (0.12 + (i % 2) * 0.1), w * 0.11, h * 0.035, 0, 0, Math.PI * 2); ctx.fill();
          }
          // La route : un polygone échantillonné sur toute la largeur.
          ctx.beginPath(); ctx.moveTo(0, h);
          for (let sx = 0; sx <= w; sx += 4) ctx.lineTo(sx, sol(sx + dist));
          ctx.lineTo(w, h); ctx.closePath();
          ctx.fillStyle = IRIS; ctx.fill();
          ctx.beginPath();
          for (let sx = 0; sx <= w; sx += 4) { const yy = sol(sx + dist); if (sx === 0) ctx.moveTo(sx, yy); else ctx.lineTo(sx, yy); }
          ctx.strokeStyle = LIME; ctx.lineWidth = 3; ctx.stroke();
          const t = Math.max(26, Math.min(44, w * 0.2));
          emoji(ctx, '🚴', xEcran(), y - t * 0.42, t, angle);
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
