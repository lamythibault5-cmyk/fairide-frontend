// Musique de fond des mini-jeux, synthétisée en Web Audio (aucun fichier). Coupée par défaut ; le joueur choisit
// une piste dans le menu 🎵 (GameFrame) et son choix est retenu (localStorage). Un seul moteur pour la page.
//
// LES PISTES. Cinq morceaux instrumentaux générés, chacun avec sa progression d'accords, sa gamme, son tempo et
// son caractère (nappe feutrée ou claire, basse ronde ou marquée, swing, shaker) — plus un mode « mix » qui
// enchaîne les pistes au hasard, quatre accords par quatre accords. Rien n'est joué deux fois pareil : la basse
// tire son motif, la mélodie ses durées et ses silences, l'octave change, la nappe respire (léger désaccord).
// Tout est planifié sur l'horloge audio, une mesure d'avance, pour ne jamais bégayer. Volume bas : un fond.
const CLE = 'fairide_game_music';
const CLE_PISTE = 'fairide_game_track';

const N = { C: 261.63, Cs: 277.18, D: 293.66, Ds: 311.13, E: 329.63, F: 349.23, Fs: 369.99, G: 392.0, Gs: 415.3, A: 440.0, As: 466.16, B: 493.88 };
export const PISTES = [
  { id: 'balade', bpm: 96, timbre: 'doux', swing: 0, shaker: 1, gamme: [N.C, N.D, N.E, N.G, N.A],
    accords: [[N.C, N.E, N.G, N.B], [N.A / 2, N.C, N.E, N.G], [N.F / 2, N.A / 2, N.C, N.E], [N.G / 2, N.B / 2, N.D, N.E]] },
  { id: 'nuit', bpm: 82, timbre: 'doux', swing: 0.08, shaker: 0.5, gamme: [N.E, N.G, N.A, N.B, N.D * 2],
    accords: [[N.E / 2, N.G / 2, N.B / 2, N.Fs], [N.C / 2, N.E / 2, N.G / 2, N.B / 2], [N.G / 2, N.B / 2, N.D, N.G], [N.Fs / 2, N.A / 2, N.D, N.Fs]] },
  { id: 'lumiere', bpm: 106, timbre: 'clair', swing: 0, shaker: 1.2, gamme: [N.F, N.G, N.A, N.B, N.C * 2, N.D * 2],
    accords: [[N.F / 2, N.A / 2, N.C, N.E], [N.G / 2, N.B / 2, N.D, N.G], [N.A / 2, N.C, N.E, N.G], [N.C / 2, N.E / 2, N.G / 2, N.C]] },
  { id: 'course', bpm: 126, timbre: 'vif', swing: 0, shaker: 1.6, gamme: [N.D, N.E, N.Fs, N.A, N.B, N.D * 2],
    accords: [[N.D / 2, N.Fs / 2, N.A / 2, N.D], [N.B / 2, N.D, N.Fs, N.A], [N.G / 2, N.B / 2, N.D, N.G], [N.A / 2, N.Cs, N.E, N.A]] },
  { id: 'lofi', bpm: 74, timbre: 'doux', swing: 0.22, shaker: 0.8, gamme: [N.A, N.C * 2, N.D * 2, N.E * 2, N.G * 2],
    accords: [[N.A / 2, N.C, N.E, N.G], [N.F / 2, N.A / 2, N.C, N.E], [N.D / 2, N.F / 2, N.A / 2, N.C], [N.E / 2, N.Gs / 2, N.B / 2, N.D]] }
];
const MOTIFS_BASSE = [[0, 2], [0, 1.5, 3], [0, 3], [0, 2, 3.5], [0, 1, 2, 3]];

let ctx = null; let maitre = null; let filtre = null; let bruit = null;
let planificateur = null; let prochainAccord = 0; let indexAccord = 0; let pisteEnCours = null; let precedente = -1;
let active = false; let choixPiste = 'mix';
try { const v = localStorage.getItem(CLE_PISTE); if (v && (v === 'mix' || PISTES.some((p) => p.id === v))) choixPiste = v; } catch { /* sans stockage */ }
const abonnes = new Set();
function prevenir() { abonnes.forEach((f) => f(active, choixPiste)); }
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
  const taille = ctx.sampleRate; const tampon = ctx.createBuffer(1, taille, ctx.sampleRate); const d = tampon.getChannelData(0);
  for (let i = 0; i < taille; i++) d[i] = Math.random() * 2 - 1;
  bruit = tampon;
  return ctx;
}

function nappe(freqs, quand, duree, timbre) {
  for (const f of freqs) {
    const osc = ctx.createOscillator(); osc.type = timbre === 'vif' ? 'sawtooth' : 'triangle'; osc.frequency.value = f;
    osc.detune.value = alea(-6, 6);
    const g = ctx.createGain(); const v = timbre === 'vif' ? 0.028 : timbre === 'clair' ? 0.055 : 0.06;
    g.gain.setValueAtTime(0.0001, quand);
    g.gain.exponentialRampToValueAtTime(v, quand + (timbre === 'vif' ? 0.25 : 0.9));
    g.gain.setValueAtTime(v, quand + duree - 0.8);
    g.gain.exponentialRampToValueAtTime(0.0001, quand + duree + 0.3);
    osc.connect(g).connect(filtre);
    osc.start(quand); osc.stop(quand + duree + 0.4);
  }
}

function basse(freq, quand, duree, timbre) {
  const osc = ctx.createOscillator(); osc.type = timbre === 'vif' ? 'triangle' : 'sine'; osc.frequency.value = freq / 2;
  const g = ctx.createGain();
  g.gain.setValueAtTime(0.0001, quand);
  g.gain.exponentialRampToValueAtTime(timbre === 'vif' ? 0.2 : 0.16, quand + 0.03);
  g.gain.exponentialRampToValueAtTime(0.0001, quand + duree);
  osc.connect(g).connect(filtre);
  osc.start(quand); osc.stop(quand + duree + 0.05);
}

function note(freq, quand, duree, volume, pan, timbre) {
  const osc = ctx.createOscillator(); osc.type = 'sine'; osc.frequency.value = freq;
  const osc2 = ctx.createOscillator(); osc2.type = timbre === 'clair' ? 'triangle' : 'sine'; osc2.frequency.value = freq * 2;
  const g = ctx.createGain(); const g2 = ctx.createGain(); g2.gain.value = timbre === 'doux' ? 0.15 : 0.3;
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

function pisteSuivante() {
  if (choixPiste !== 'mix') return PISTES.find((p) => p.id === choixPiste) || PISTES[0];
  let i; do { i = Math.floor(Math.random() * PISTES.length); } while (PISTES.length > 1 && i === precedente);
  precedente = i; return PISTES[i];
}

// Planifie l'accord suivant sur l'horloge audio, une seconde avant la fin de l'accord en cours.
function planifier() {
  if (!ctx || !active) return;
  if (ctx.currentTime + 1.0 < prochainAccord) return;
  if (indexAccord % 4 === 0 || !pisteEnCours) pisteEnCours = pisteSuivante();
  const P = pisteEnCours; const temps = 60 / P.bpm; const duree = temps * 4;
  const t0 = Math.max(prochainAccord, ctx.currentTime + 0.05);
  const accord = P.accords[indexAccord % 4];
  const sw = (k) => (k % 2 ? P.swing * temps / 2 : 0); // swing : les contretemps sont légèrement en retard
  nappe(accord, t0, duree, P.timbre);
  const motif = choix(MOTIFS_BASSE);
  for (const b of motif) basse(accord[0], t0 + b * temps + (b % 1 ? P.swing * temps / 2 : 0), temps * (b % 1 ? 0.45 : 0.9), P.timbre);
  let t = t0 + (Math.random() < 0.5 ? 0 : temps / 2); let k = t === t0 ? 0 : 1;
  let prec = Math.floor(Math.random() * P.gamme.length);
  const octave = Math.random() < 0.3 ? 2 : 1;
  const densite = P.timbre === 'vif' ? 0.12 : 0.24; // silences plus rares sur la piste rapide
  while (t < t0 + duree - 0.05) {
    const d = P.timbre === 'vif' ? choix([temps / 2, temps / 2, temps / 4, temps]) : choix([temps / 2, temps / 2, temps, temps * 1.5]);
    if (Math.random() < densite) { t += d; k++; continue; }
    const pas = choix([-2, -1, -1, 1, 1, 2, 3]);
    prec = Math.max(0, Math.min(P.gamme.length - 1, prec + pas));
    note(P.gamme[prec] * octave, t + sw(k), Math.min(d * 1.6, 1.4), alea(0.035, 0.06), alea(-0.5, 0.5), P.timbre);
    t += d; k++;
  }
  for (let i = 0; i < 8; i++) shaker(t0 + i * temps / 2 + sw(i), (i % 4 === 2 ? 0.05 : 0.02) * P.shaker * alea(0.7, 1.15));
  prochainAccord = t0 + duree;
  indexAccord++;
}

export const musique = {
  pistes: PISTES.map((p) => p.id),
  preference() { try { return localStorage.getItem(CLE) === 'on'; } catch { return false; } },
  estActive() { return active; },
  piste() { return choixPiste; },
  abonner(f) { abonnes.add(f); return () => abonnes.delete(f); },
  // Choisir une piste (ou 'mix') : démarre la musique si besoin, sinon enchaîne sur la nouvelle piste au prochain accord.
  async choisir(id) {
    choixPiste = id === 'mix' || PISTES.some((p) => p.id === id) ? id : 'mix';
    try { localStorage.setItem(CLE_PISTE, choixPiste); } catch { /* sans stockage */ }
    pisteEnCours = null; indexAccord = 0;
    if (!active) return this.demarrer();
    prevenir(); return true;
  },
  // À appeler depuis un geste de l'utilisateur : les navigateurs refusent le son avant.
  async demarrer() {
    const c = contexte(); if (!c) return false;
    if (c.state === 'suspended') { try { await c.resume(); } catch { return false; } }
    if (!active) {
      active = true;
      maitre.gain.cancelScheduledValues(c.currentTime);
      maitre.gain.setValueAtTime(0.0001, c.currentTime);
      maitre.gain.exponentialRampToValueAtTime(0.12, c.currentTime + 1.5);
      prochainAccord = c.currentTime; indexAccord = 0; pisteEnCours = null;
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
