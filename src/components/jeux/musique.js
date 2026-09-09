// Musique de fond des mini-jeux, synthétisée en Web Audio (aucun fichier). Coupée par défaut ; le joueur
// l'active d'un bouton (GameFrame), son choix est retenu (localStorage). Un seul moteur pour la page.
//
// CE QUI JOUE — et pourquoi ça ne tourne pas en rond. Trois « ambiances » (une progression d'accords, une
// gamme, un tempo) tirées au sort à chaque tour de quatre accords, jamais deux fois la même d'affilée.
// Sur chaque accord : une nappe feutrée (triangles filtrés, attaque lente), une basse ronde qui joue la
// fondamentale sur un motif rythmique choisi au hasard, une mélodie d'arpège dans la gamme de l'ambiance
// avec des durées variées (croches, noires, silences) et une octave qui change, un shaker discret (bruit
// filtré) qui pose le tempo. Tout est planifié sur l'horloge audio, par avance, pour que rien ne bégaie
// quand l'onglet est chargé. Volume global bas : c'est un fond, pas un morceau.
const CLE = 'fairide_game_music';

// Fréquences par nom de note (octave 4), pour écrire les ambiances lisiblement.
const N = { C: 261.63, Cs: 277.18, D: 293.66, Ds: 311.13, E: 329.63, F: 349.23, Fs: 369.99, G: 392.0, Gs: 415.3, A: 440.0, As: 466.16, B: 493.88 };
const AMBIANCES = [
  { // Doux, majeur : Cmaj7 · Am7 · Fmaj7 · G6, pentatonique de do
    bpm: 96, gamme: [N.C, N.D, N.E, N.G, N.A],
    accords: [[N.C, N.E, N.G, N.B], [N.A / 2, N.C, N.E, N.G], [N.F / 2, N.A / 2, N.C, N.E], [N.G / 2, N.B / 2, N.D, N.E]]
  },
  { // Rêveur, mineur : Em9 · Cmaj7 · G · D/F#, pentatonique de mi mineur
    bpm: 88, gamme: [N.E, N.G, N.A, N.B, N.D * 2],
    accords: [[N.E / 2, N.G / 2, N.B / 2, N.Fs], [N.C / 2, N.E / 2, N.G / 2, N.B / 2], [N.G / 2, N.B / 2, N.D, N.G], [N.Fs / 2, N.A / 2, N.D, N.Fs]]
  },
  { // Lumineux, lydien : Fmaj7 · G · Am7 · C, pentatonique de fa avec si naturel
    bpm: 104, gamme: [N.F, N.G, N.A, N.B, N.C * 2],
    accords: [[N.F / 2, N.A / 2, N.C, N.E], [N.G / 2, N.B / 2, N.D, N.G], [N.A / 2, N.C, N.E, N.G], [N.C / 2, N.E / 2, N.G / 2, N.C]]
  }
];
const MOTIFS_BASSE = [[0, 2], [0, 1.5, 3], [0, 3], [0, 2, 3.5]]; // temps (sur 4) où la basse joue

let ctx = null; let maitre = null; let filtre = null; let bruit = null;
let planificateur = null; let prochainAccord = 0; let indexAccord = 0; let ambiance = null; let ambiancePrec = -1;
let active = false;
const abonnes = new Set();
function prevenir() { abonnes.forEach((f) => f(active)); }
const alea = (a, b) => a + Math.random() * (b - a);
const choix = (t) => t[Math.floor(Math.random() * t.length)];

function contexte() {
  if (ctx) return ctx;
  const Ctor = window.AudioContext || window.webkitAudioContext;
  if (!Ctor) return null;
  ctx = new Ctor();
  filtre = ctx.createBiquadFilter(); filtre.type = 'lowpass'; filtre.frequency.value = 1400; filtre.Q.value = 0.5;
  maitre = ctx.createGain(); maitre.gain.value = 0;
  filtre.connect(maitre).connect(ctx.destination);
  // Une seconde de bruit blanc, rejouée en boucle par le shaker.
  const taille = ctx.sampleRate; const tampon = ctx.createBuffer(1, taille, ctx.sampleRate); const d = tampon.getChannelData(0);
  for (let i = 0; i < taille; i++) d[i] = Math.random() * 2 - 1;
  bruit = tampon;
  return ctx;
}

function nappe(freqs, quand, duree) {
  for (const f of freqs) {
    const osc = ctx.createOscillator(); osc.type = 'triangle'; osc.frequency.value = f;
    osc.detune.value = alea(-6, 6); // léger désaccord : la nappe respire
    const g = ctx.createGain();
    g.gain.setValueAtTime(0.0001, quand);
    g.gain.exponentialRampToValueAtTime(0.06, quand + 0.9);
    g.gain.setValueAtTime(0.06, quand + duree - 1.0);
    g.gain.exponentialRampToValueAtTime(0.0001, quand + duree + 0.3);
    osc.connect(g).connect(filtre);
    osc.start(quand); osc.stop(quand + duree + 0.4);
  }
}

function basse(freq, quand, duree) {
  const osc = ctx.createOscillator(); osc.type = 'sine'; osc.frequency.value = freq / 2;
  const g = ctx.createGain();
  g.gain.setValueAtTime(0.0001, quand);
  g.gain.exponentialRampToValueAtTime(0.16, quand + 0.03);
  g.gain.exponentialRampToValueAtTime(0.0001, quand + duree);
  osc.connect(g).connect(filtre);
  osc.start(quand); osc.stop(quand + duree + 0.05);
}

function note(freq, quand, duree, volume, pan) {
  const osc = ctx.createOscillator(); osc.type = 'sine'; osc.frequency.value = freq;
  const osc2 = ctx.createOscillator(); osc2.type = 'triangle'; osc2.frequency.value = freq * 2; // une harmonique, pour le brillant
  const g = ctx.createGain(); const g2 = ctx.createGain(); g2.gain.value = 0.25;
  g.gain.setValueAtTime(0.0001, quand);
  g.gain.exponentialRampToValueAtTime(volume, quand + 0.015);
  g.gain.exponentialRampToValueAtTime(0.0001, quand + duree);
  let sortie = g;
  if (ctx.createStereoPanner) { const p = ctx.createStereoPanner(); p.pan.value = pan; g.connect(p); sortie = p; }
  osc.connect(g); osc2.connect(g2).connect(g); sortie.connect(filtre);
  osc.start(quand); osc2.start(quand); osc.stop(quand + duree + 0.05); osc2.stop(quand + duree + 0.05);
}

function shaker(quand, volume) {
  const src = ctx.createBufferSource(); src.buffer = bruit;
  const f = ctx.createBiquadFilter(); f.type = 'highpass'; f.frequency.value = 6000;
  const g = ctx.createGain();
  g.gain.setValueAtTime(0.0001, quand);
  g.gain.exponentialRampToValueAtTime(volume, quand + 0.005);
  g.gain.exponentialRampToValueAtTime(0.0001, quand + 0.08);
  src.connect(f).connect(g).connect(maitre);
  src.start(quand); src.stop(quand + 0.1);
}

// Planifie l'accord suivant sur l'horloge audio. Appelé toutes les 0,4 s ; ne fait quelque chose que quand
// l'accord en cours touche à sa fin (une seconde d'avance), pour rester précis sans empiler des timers.
function planifier() {
  if (!ctx || !active) return;
  if (ctx.currentTime + 1.0 < prochainAccord) return;
  if (indexAccord % 4 === 0) {
    let i; do { i = Math.floor(Math.random() * AMBIANCES.length); } while (AMBIANCES.length > 1 && i === ambiancePrec);
    ambiancePrec = i; ambiance = AMBIANCES[i];
  }
  const temps = 60 / ambiance.bpm; const duree = temps * 4; // un accord = une mesure à 4 temps
  const t0 = Math.max(prochainAccord, ctx.currentTime + 0.05);
  const accord = ambiance.accords[indexAccord % 4];
  nappe(accord, t0, duree);
  // Basse : la fondamentale, sur un motif tiré au sort, un temps sur deux plus court.
  const motif = choix(MOTIFS_BASSE);
  for (const b of motif) basse(accord[0], t0 + b * temps, temps * (b % 1 ? 0.45 : 0.9));
  // Mélodie : des croches et des noires piochées dans la gamme, avec des silences ; l'octave monte parfois.
  let t = t0 + (Math.random() < 0.5 ? 0 : temps / 2);
  let precedente = Math.floor(Math.random() * ambiance.gamme.length);
  const octave = Math.random() < 0.3 ? 2 : 1;
  while (t < t0 + duree - 0.05) {
    const d = choix([temps / 2, temps / 2, temps, temps * 1.5]);
    if (Math.random() < 0.22) { t += d; continue; } // silence
    const pas = choix([-2, -1, -1, 1, 1, 2, 3]); // mouvement conjoint surtout, un saut de temps en temps
    precedente = Math.max(0, Math.min(ambiance.gamme.length - 1, precedente + pas));
    note(ambiance.gamme[precedente] * octave, t, Math.min(d * 1.6, 1.4), alea(0.035, 0.06), alea(-0.5, 0.5));
    t += d;
  }
  // Shaker : chaque demi-temps, plus fort sur les temps 2 et 4, un peu de hasard.
  for (let k = 0; k < 8; k++) shaker(t0 + k * temps / 2, (k % 4 === 2 ? 0.05 : 0.02) * alea(0.7, 1.15));
  prochainAccord = t0 + duree;
  indexAccord++;
}

export const musique = {
  preference() { try { return localStorage.getItem(CLE) === 'on'; } catch { return false; } },
  estActive() { return active; },
  abonner(f) { abonnes.add(f); return () => abonnes.delete(f); },
  // À appeler depuis un geste de l'utilisateur : les navigateurs refusent le son avant.
  async demarrer() {
    const c = contexte(); if (!c) return false;
    if (c.state === 'suspended') { try { await c.resume(); } catch { return false; } }
    if (!active) {
      active = true;
      maitre.gain.cancelScheduledValues(c.currentTime);
      maitre.gain.setValueAtTime(0.0001, c.currentTime);
      maitre.gain.exponentialRampToValueAtTime(0.12, c.currentTime + 1.5);
      prochainAccord = c.currentTime; indexAccord = 0;
      planifier();
      planificateur = setInterval(planifier, 400);
      try { localStorage.setItem(CLE, 'on'); } catch { /* sans stockage */ }
      prevenir();
    }
    return true;
  },
  arreter({ oublier = true } = {}) {
    if (!active) return;
    active = false;
    if (ctx) {
      maitre.gain.cancelScheduledValues(ctx.currentTime);
      maitre.gain.setValueAtTime(maitre.gain.value || 0.0001, ctx.currentTime);
      maitre.gain.exponentialRampToValueAtTime(0.0001, ctx.currentTime + 0.6);
    }
    clearInterval(planificateur); planificateur = null;
    if (oublier) { try { localStorage.setItem(CLE, 'off'); } catch { /* sans stockage */ } }
    prevenir();
  },
  async basculer() { if (active) this.arreter(); else await this.demarrer(); return active; }
};

// Onglet en arrière-plan : on coupe (sans oublier la préférence) ; au retour, on relance si c'était voulu.
if (typeof document !== 'undefined') {
  let coupeParVisibilite = false;
  document.addEventListener('visibilitychange', () => {
    if (document.hidden && active) { musique.arreter({ oublier: false }); coupeParVisibilite = true; }
    else if (!document.hidden && coupeParVisibilite) { coupeParVisibilite = false; musique.demarrer(); }
  });
}
