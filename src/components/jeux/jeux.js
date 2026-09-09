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

import { aleatoire, choix, suivre, emoji, fondDegrade, IRIS, LIME, INK } from './dessin';
import { creerRider } from './rider';

// ---------------------------------------------------------------------------------------------------
// Base commune aux trois jeux « ça tombe » : attraper, esquiver, trier. Seules changent les règles de
// contact (toucher un objet, ou le laisser passer) et la population d'objets.
// ---------------------------------------------------------------------------------------------------
function creerChute(api, cfg) {
  let w = api.w; let h = api.h;
  let objets = []; let depuisSpawn = 0; let joueurX = w / 2; let cibleX = w / 2; let rebond = 0; let vRebond = 0;
  const tailleObjet = () => Math.max(20, Math.min(36, w * 0.16));
  const largeurJoueur = () => tailleObjet() * 1.7;

  return {
    reset() { objets = []; depuisSpawn = 0; joueurX = w / 2; cibleX = w / 2; rebond = 0; vRebond = 0; },
    redimensionner(nw, nh) { w = nw; h = nh; },
    update(dt, input) {
      const n = input.niveau;
      const t = tailleObjet(); const lj = largeurJoueur();
      // Le joueur suit le pointeur avec un léger lissage : direct, ça vibre au pixel près ; trop lent,
      // on rate. 18 par seconde = un rattrapage en ~60 ms, imperceptible mais qui gomme le tremblement.
      if (input.x != null) cibleX = Math.max(lj / 2, Math.min(w - lj / 2, input.x));
      joueurX += (cibleX - joueurX) * Math.min(1, dt * 18);
      // Ressort du panier : un petit rebond à chaque prise, qui retombe de lui-même.
      vRebond += (-rebond * 120 - vRebond * 11) * dt; rebond += vRebond * dt;

      depuisSpawn += dt;
      if (depuisSpawn >= cfg.intervalle(n)) {
        depuisSpawn = 0;
        const o = cfg.nouvelObjet(n);
        objets.push({ ...o, x: aleatoire(t / 2, w - t / 2), y: -t, v: cfg.vitesse(n) * h, taille: t, id: Math.random(), phase: Math.random() * Math.PI * 2, balance: aleatoire(0.12, 0.28) });
      }
      const yJoueur = h - t * 1.3;
      const restants = [];
      for (const o of objets) {
        o.y += o.v * dt; o.phase += dt * 3;
        const touche = Math.abs(o.y - yJoueur) < t * 0.6 && Math.abs(o.x - joueurX) < (lj + t) / 2 - 4;
        if (touche) {
          const effet = cfg.toucher(o);
          if (effet === 'perdu') return api.perdre();
          if (effet === 'point') { api.marquer(1); api.effet?.(o.x, yJoueur - t * 0.9, '+1'); api.eclat?.(o.x, yJoueur - t * 0.4, cfg.eclat || IRIS, 7); vRebond = 5; }
          continue;
        }
        if (o.y > h + t) {
          const effet = cfg.manquer(o);
          if (effet === 'perdu') return api.perdre();
          if (effet === 'point') { api.marquer(1); api.effet?.(o.x, h - t * 1.6, '+1'); }
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
      for (const o of objets) {
        // Ombre au sol qui grandit à l'approche : on lit où l'objet va tomber.
        const k = Math.max(0, Math.min(1, o.y / h));
        ctx.fillStyle = `rgba(20,18,31,${(0.05 + k * 0.13).toFixed(3)})`;
        ctx.beginPath(); ctx.ellipse(o.x, h - t * 0.45, t * (0.2 + k * 0.25), t * 0.07, 0, 0, Math.PI * 2); ctx.fill();
        emoji(ctx, o.emoji, o.x, o.y, o.taille, Math.sin(o.phase) * o.balance);
      }
      // Le joueur penche légèrement dans le sens de son déplacement et rebondit quand il attrape.
      ctx.save();
      ctx.translate(joueurX, h - t * 0.55);
      const sq = Math.max(-0.3, Math.min(0.3, rebond));
      ctx.scale(1 + sq * 0.5, 1 - sq * 0.6);
      emoji(ctx, cfg.joueur, 0, -t * 0.65, t * 1.45, Math.max(-0.25, Math.min(0.25, (cibleX - joueurX) / (w * 0.6))));
      ctx.restore();
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
        cible = { x: aleatoire(t / 2, w - t / 2), y: aleatoire(t / 2, h - t / 2), age: 0 };
      };
      return {
        reset() { cible = null; reste = 0; },
        redimensionner(nw, nh) { w = nw; h = nh; },
        update(dt, input) {
          if (!cible) nouvelleCible(input.niveau);
          const t = taille();
          for (const tape of input.tapes) {
            if (Math.hypot(tape.x - cible.x, tape.y - cible.y) <= t * 0.62) {
              api.marquer(1); api.effet?.(cible.x, cible.y - t * 0.8, '+1'); api.eclat?.(cible.x, cible.y, '#E8A33C', 10);
              // Le niveau est relu APRÈS le point : la cible suivante doit déjà tenir compte du palier
              // qu'on vient éventuellement de franchir, pas de celui d'avant.
              nouvelleCible(api.niveau());
              return undefined;
            }
          }
          reste -= dt; cible.age += dt;
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
          // Apparition avec un léger rebond (0,2 s) : l'œil repère la nouvelle cible tout de suite.
          const k = Math.min(1, cible.age / 0.2); const echelle = 1 + Math.sin(k * Math.PI) * 0.18 * (1 - k) + (k - 1) * 0.3;
          emoji(ctx, '🎯', cible.x, cible.y, t * Math.max(0.7, echelle));
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
      'Tu roules sur une route en bosses. Tape pour sauter, tape à nouveau en l’air pour un double saut. Garde le doigt appuyé après l’atterrissage pour accélérer.',
      'Saute par-dessus les obstacles (🪨 🚧 🛢️) : en toucher un au sol, c’est la chute. Chaque obstacle franchi, chaque plat attrapé en vol et chaque bout de route rapportent un point.',
      'En l’air, maintiens appuyé pour tourner : chaque salto complet vaut 1 point. Relâche pour te redresser avant le sol — retomber de travers, c’est la chute.'
    ],
    controles: 'Tape pour sauter (deux fois pour un double saut) ; maintiens (doigt, souris ou Espace) pour tourner en l’air, et après l’atterrissage pour accélérer.',
    creer: (api) => creerRider(api)
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
      let w = api.w; let h = api.h; let murs = []; let ax = w / 2; let cibleX = w / 2; let depuis = 0; let inclinaison = 0; let traine = [];
      const yFleche = () => h * 0.8;
      return {
        reset() { murs = []; ax = w / 2; cibleX = w / 2; depuis = 0; inclinaison = 0; traine = []; },
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
            if (!m.compte && m.y > yf) { m.compte = true; api.marquer(1); api.effet?.(ax, yf - h * 0.12, '+1'); }
            if (m.y < h + m.ep) restants.push(m);
          }
          murs = restants;
          // Traînée : les dernières positions de la flèche, dessinées en s'estompant.
          traine.push({ x: ax, reste: 0.25 }); for (const tr of traine) tr.reste -= dt; traine = traine.filter((tr) => tr.reste > 0).slice(-14);
          return undefined;
        },
        draw(ctx) {
          fondDegrade(ctx, w, h, '#FFFFFF', '#EEF0FF');
          const yt = yFleche();
          for (const tr of traine) { ctx.globalAlpha = tr.reste / 0.25 * 0.35; ctx.fillStyle = IRIS; ctx.beginPath(); ctx.arc(tr.x, yt + h * 0.05, 3, 0, Math.PI * 2); ctx.fill(); }
          ctx.globalAlpha = 1;
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
