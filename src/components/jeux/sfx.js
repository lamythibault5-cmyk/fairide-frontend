// Petits sons des mini-jeux, synthétisés (aucun fichier à charger) : un « pop » par point, un tintement pour un
// bonus, une montée pour un combo, un choc sourd à la fin. Ils suivent le réglage de la musique (musique.js) :
// musique coupée = sons coupés, un seul interrupteur pour le joueur. Le contexte audio ne naît qu'au premier
// geste (navigateurs), et tout est silencieux hors navigateur (bancs d'essai).
import { musique } from './musique';

let ctx = null; let maitre = null; let actif = false;
function contexte() {
  if (typeof window === 'undefined') return null;
  const AC = window.AudioContext || window.webkitAudioContext; if (!AC) return null;
  if (!ctx) { ctx = new AC(); maitre = ctx.createGain(); maitre.gain.value = 0.35; maitre.connect(ctx.destination); }
  if (ctx.state === 'suspended') ctx.resume().catch(() => {});
  return ctx;
}
try { musique.abonner?.((a) => { actif = !!a; }); } catch { /* hors moteur */ }

// Une note : oscillateur + enveloppe courte. `glisse` = fréquence d'arrivée (montée ou descente).
function note(freq, { type = 'sine', duree = 0.12, gain = 0.5, glisse = null, quand = 0 } = {}) {
  const c = contexte(); if (!c || !actif) return;
  const t0 = c.currentTime + quand;
  const o = c.createOscillator(); const g = c.createGain();
  o.type = type; o.frequency.setValueAtTime(freq, t0);
  if (glisse) o.frequency.exponentialRampToValueAtTime(glisse, t0 + duree);
  g.gain.setValueAtTime(0.0001, t0); g.gain.exponentialRampToValueAtTime(gain, t0 + 0.008); g.gain.exponentialRampToValueAtTime(0.0001, t0 + duree);
  o.connect(g); g.connect(maitre); o.start(t0); o.stop(t0 + duree + 0.02);
}

export const sfx = {
  // Point ordinaire : un pop bref, un peu plus aigu à mesure que la série monte (on entend le combo grimper).
  point(serie = 0) { note(520 + Math.min(serie, 12) * 28, { type: 'triangle', duree: 0.09, gain: 0.35, glisse: 760 + Math.min(serie, 12) * 28 }); },
  // Bonus (plat doré, nitro, aimant…) : deux notes claires.
  bonus() { note(880, { duree: 0.1, gain: 0.35 }); note(1320, { duree: 0.16, gain: 0.3, quand: 0.07 }); },
  // Palier de combo : une petite montée à trois notes.
  combo() { note(660, { duree: 0.08, gain: 0.3 }); note(830, { duree: 0.08, gain: 0.3, quand: 0.07 }); note(1100, { duree: 0.18, gain: 0.32, quand: 0.14 }); },
  // Frôlement / alerte : un « tic » sec.
  alerte() { note(300, { type: 'square', duree: 0.05, gain: 0.18 }); },
  // Nouveau record : un accord qui monte.
  record() { [523, 659, 784, 1047].forEach((f, i) => note(f, { duree: 0.28, gain: 0.3, quand: i * 0.09 })); },
  // Un cœur perdu (la partie continue) : un choc plus court et plus clair que celui de la fin.
  touche() { note(330, { type: 'sawtooth', duree: 0.18, gain: 0.28, glisse: 150 }); },
  // Un cœur rendu : deux notes qui montent, plus douces que le bonus.
  vie() { note(660, { duree: 0.12, gain: 0.3 }); note(990, { duree: 0.2, gain: 0.3, quand: 0.09 }); },
  // Fin de partie : choc sourd qui descend.
  perdu() { note(220, { type: 'sawtooth', duree: 0.35, gain: 0.35, glisse: 60 }); },
  // À appeler sur un geste utilisateur (Commencer) : crée ou réveille le contexte, sinon le premier son est avalé.
  reveiller() { contexte(); }
};
