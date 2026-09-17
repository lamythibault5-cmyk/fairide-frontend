// Musique de fond des mini-jeux, synthétisée en Web Audio (aucun fichier). Coupée par défaut ; le joueur choisit
// une piste dans le menu 🎵 (GameFrame) et son choix est retenu (localStorage). Un seul moteur pour la page.
//
// POURQUOI CETTE RÉÉCRITURE (2026-09-17). Le fondateur : « les musiques sont pas good vibe ». L'ancien moteur
// jouait des nappes d'ondes triangle derrière un filtre passe-bas à 1 400 Hz, une mélodie tirée note à note au
// hasard, et un shaker pour tout rythme : un fond feutré, sans batterie ni refrain, qui sonnait terne et
// endormi. Ici, de VRAIS instruments de synthèse et de vrais morceaux :
//   - piano électrique (synthèse FM, le son « Rhodes »), marimba, guitare pincée (Karplus-Strong), lead 8-bit ;
//   - basse ronde ou funk (filtre qui claque), batterie complète (grosse caisse, caisse claire, clap, charley,
//     shaker, rimshot), craquement de vinyle pour le chill ;
//   - une réverbération (réponse impulsionnelle générée) et un compresseur : de l'espace et de la cohésion ;
//   - une MÉLODIE QUI REVIENT : un motif de deux mesures, rejoué puis varié, régénéré toutes les huit mesures.
//     C'est la répétition qui rend un air entraînant ; une suite de notes au hasard ne se retient jamais.
// Tout est planifié sur l'horloge audio, une mesure d'avance, pour ne jamais bégayer.
const CLE = 'fairide_game_music';
const CLE_PISTE = 'fairide_game_track';

// Grilles de 16 doubles-croches par mesure : 'x' = coup, 'o' = coup accentué (ou octave pour la basse), '.' = rien.
export const PISTES = [
  {
    // House tropicale : marimba en tête, accords pincés à contretemps, grosse caisse douce à chaque temps.
    id: 'soleil', bpm: 110, swing: 0,
    accords: [[57, 60, 64, 67], [53, 57, 60, 64], [55, 60, 64, 67], [55, 59, 62, 67]],
    basses: [45, 41, 48, 43], gamme: [72, 74, 76, 79, 81, 84, 86],
    lead: 'marimba', rythmeLead: ['..x.x..x..x.x...', 'x..x..x...x.x...'], comp: 'pince', rythmeComp: '..x...x...x...x.',
    basse: 'ronde', rythmeBasse: 'x..x..x...x..x..',
    batterie: { kick: 'x...x...x...x...', clap: '....x.......x...', hat: '..x...x...x...x.', shaker: 'xxxxxxxxxxxxxxxx' }
  },
  {
    // Chill hop : piano électrique sur des accords de neuvième, beat posé et swingué, vinyle qui craque.
    id: 'chill', bpm: 86, swing: 0.2,
    accords: [[53, 57, 60, 64], [53, 59, 62, 65], [52, 55, 59, 62], [55, 58, 61, 64]],
    basses: [38, 43, 36, 45], gamme: [69, 72, 74, 76, 79, 81],
    lead: 'rhodes', rythmeLead: ['x...x.....x.....', '..x...x.x.......'], comp: 'rhodes', rythmeComp: 'x.....x.........', compLong: true,
    basse: 'ronde', rythmeBasse: 'x.......x.x.....',
    batterie: { kick: 'x.......x.x.....', snare: '....x.......x...', hat: 'x.x.x.x.x.x.x.xx' }, vinyle: true
  },
  {
    // Funk : basse qui claque en octaves, claps, charley en doubles-croches, piano électrique en coups secs.
    id: 'funk', bpm: 116, swing: 0.08,
    accords: [[55, 59, 62, 66], [55, 61, 64, 66], [55, 59, 62, 66], [57, 63, 66, 69]],
    basses: [40, 45, 40, 47], gamme: [64, 67, 69, 71, 74, 76, 79],
    lead: 'pince', rythmeLead: ['x.x...x.x.......', '....x.x...x.x.x.'], comp: 'rhodes', rythmeComp: '....x..x....x...',
    basse: 'funk', rythmeBasse: 'x..o.xx...x.o..x',
    batterie: { kick: 'x.....x...x.....', clap: '....x.......x...', hat: 'xxx.xxx.xxx.xxx.', ouvert: '...x.......x....' }
  },
  {
    // Arcade : 8-bit joyeux, arpèges rapides et mélodie carrée.
    id: 'arcade', bpm: 128, swing: 0,
    accords: [[60, 64, 67, 72], [55, 59, 62, 67], [57, 60, 64, 69], [53, 57, 60, 65]],
    basses: [36, 43, 45, 41], gamme: [72, 74, 76, 79, 81, 84],
    lead: 'carre', rythmeLead: ['x.x.x...x.x.x...', 'x...x.x.x.x.....'], comp: 'arpege', rythmeComp: 'xxxxxxxxxxxxxxxx',
    basse: 'carree', rythmeBasse: 'x.o.x.o.x.o.x.o.',
    batterie: { kick: 'x...x...x...x...', snare: '....x.......x...', hat: '..x...x...x...x.' }
  },
  {
    // Bossa : guitare pincée, rimshot et shaker, piano électrique qui chante doucement par-dessus.
    id: 'bossa', bpm: 100, swing: 0.1,
    accords: [[53, 57, 60, 64], [53, 55, 59, 62], [52, 55, 59, 64], [55, 58, 61, 67]],
    basses: [38, 43, 36, 45], gamme: [67, 69, 72, 74, 76, 79],
    lead: 'rhodes', rythmeLead: ['x..x......x.....', '..x...x..x......'], comp: 'pince', rythmeComp: 'x..x..x...x..x..',
    basse: 'ronde', rythmeBasse: 'x.......o.......',
    batterie: { kick: 'x..x....x..x....', rim: '...x..x....x..x.', shaker: 'xxxxxxxxxxxxxxxx' }
  }
];

const hz = (midi) => 440 * 2 ** ((midi - 69) / 12);
const alea = (a, b) => a + Math.random() * (b - a);
const choix = (t) => t[Math.floor(Math.random() * t.length)];

let ctx = null; let maitre = null; let bus = null; let bruit = null; let reverbe = null;
let planificateur = null; let prochaineMesure = 0; let mesure = 0; let pisteEnCours = null; let precedente = -1; let motif = null;
let active = false; let choixPiste = 'mix';
try { const v = localStorage.getItem(CLE_PISTE); if (v && (v === 'mix' || PISTES.some((p) => p.id === v))) choixPiste = v; } catch { /* sans stockage */ }
const abonnes = new Set();
function prevenir() { abonnes.forEach((f) => f(active, choixPiste)); }

function contexte() {
  if (ctx) return ctx;
  const Ctor = window.AudioContext || window.webkitAudioContext;
  if (!Ctor) return null;
  ctx = new Ctor();
  maitre = ctx.createGain(); maitre.gain.value = 0;
  const compresseur = ctx.createDynamicsCompressor();
  compresseur.threshold.value = -16; compresseur.ratio.value = 3; compresseur.attack.value = 0.005; compresseur.release.value = 0.2;
  bus = ctx.createGain(); bus.gain.value = 0.8;
  bus.connect(compresseur);
  // Réverbération : une réponse impulsionnelle de bruit qui s'éteint en 1,8 s, stéréo. Envoyée en parallèle.
  const duree = 1.8; const n = Math.floor(ctx.sampleRate * duree);
  const ir = ctx.createBuffer(2, n, ctx.sampleRate);
  for (let c = 0; c < 2; c++) { const d = ir.getChannelData(c); for (let i = 0; i < n; i++) d[i] = (Math.random() * 2 - 1) * (1 - i / n) ** 3; }
  reverbe = ctx.createConvolver(); reverbe.buffer = ir;
  const retour = ctx.createGain(); retour.gain.value = 0.28;
  reverbe.connect(retour).connect(compresseur);
  compresseur.connect(maitre).connect(ctx.destination);
  const taille = ctx.sampleRate; const tampon = ctx.createBuffer(1, taille, ctx.sampleRate); const d = tampon.getChannelData(0);
  for (let i = 0; i < taille; i++) d[i] = Math.random() * 2 - 1;
  bruit = tampon;
  return ctx;
}

// Sortie d'une voix : vers le bus, avec un peu de réverbération et un placement stéréo.
function sortie(noeud, envoi = 0.2, pan = 0) {
  let n = noeud;
  if (pan && ctx.createStereoPanner) { const p = ctx.createStereoPanner(); p.pan.value = pan; n.connect(p); n = p; }
  n.connect(bus);
  if (envoi > 0) { const s = ctx.createGain(); s.gain.value = envoi; n.connect(s).connect(reverbe); }
}
function enveloppe(g, quand, volume, attaque, duree) {
  g.gain.setValueAtTime(0.0001, quand);
  g.gain.exponentialRampToValueAtTime(volume, quand + attaque);
  g.gain.exponentialRampToValueAtTime(0.0001, quand + duree);
}

// ---- Instruments mélodiques ----------------------------------------------------------------------------------

// Piano électrique : synthèse FM (porteuse + modulatrice au même rapport, indice qui retombe) = attaque en cloche
// qui s'adoucit, le timbre d'un Rhodes.
function rhodes(midi, quand, duree, volume, pan = 0) {
  const f = hz(midi);
  const car = ctx.createOscillator(); car.type = 'sine'; car.frequency.value = f;
  const mod = ctx.createOscillator(); mod.type = 'sine'; mod.frequency.value = f;
  const indice = ctx.createGain();
  indice.gain.setValueAtTime(f * 2.2, quand); indice.gain.exponentialRampToValueAtTime(f * 0.25, quand + 0.5);
  mod.connect(indice).connect(car.frequency);
  // Petite « tige » aiguë au début de la note.
  const tige = ctx.createOscillator(); tige.type = 'sine'; tige.frequency.value = f * 7;
  const gt = ctx.createGain(); enveloppe(gt, quand, volume * 0.12, 0.002, 0.12);
  const g = ctx.createGain(); enveloppe(g, quand, volume, 0.006, duree);
  car.connect(g); tige.connect(gt).connect(g);
  sortie(g, 0.3, pan);
  for (const o of [car, mod, tige]) { o.start(quand); o.stop(quand + duree + 0.05); }
}

// Marimba : fondamentale + partiel à 4× qui s'éteint très vite (le « toc » de la lame).
function marimba(midi, quand, duree, volume, pan = 0) {
  const f = hz(midi);
  const g = ctx.createGain(); enveloppe(g, quand, volume, 0.002, Math.min(duree, 0.6));
  const o1 = ctx.createOscillator(); o1.type = 'sine'; o1.frequency.value = f;
  const o2 = ctx.createOscillator(); o2.type = 'sine'; o2.frequency.value = f * 4;
  const g2 = ctx.createGain(); enveloppe(g2, quand, volume * 0.35, 0.001, 0.07);
  o1.connect(g); o2.connect(g2).connect(g);
  sortie(g, 0.25, pan);
  for (const o of [o1, o2]) { o.start(quand); o.stop(quand + 0.65); }
}

// Corde pincée (Karplus-Strong) : une rafale de bruit qui boucle dans une ligne à retard filtrée. Calculée une fois
// par hauteur de note puis gardée en cache : c'est le seul instrument qui coûte, et il ne coûte qu'au premier coup.
const cordes = new Map();
function corde(midi) {
  if (cordes.has(midi)) return cordes.get(midi);
  const sr = ctx.sampleRate; const n = Math.floor(sr * 1.1); const b = ctx.createBuffer(1, n, sr); const d = b.getChannelData(0);
  const p = Math.max(2, Math.round(sr / hz(midi)));
  for (let i = 0; i < p; i++) d[i] = Math.random() * 2 - 1;
  for (let i = p; i < n; i++) d[i] = 0.996 * 0.5 * (d[i - p] + d[i - p + 1]);
  cordes.set(midi, b);
  return b;
}
function pince(midi, quand, duree, volume, pan = 0) {
  const src = ctx.createBufferSource(); src.buffer = corde(midi);
  const f = ctx.createBiquadFilter(); f.type = 'lowpass'; f.frequency.value = 3200;
  const g = ctx.createGain(); g.gain.setValueAtTime(volume, quand); g.gain.exponentialRampToValueAtTime(0.0001, quand + Math.min(1.05, duree + 0.25));
  src.connect(f).connect(g);
  sortie(g, 0.22, pan);
  src.start(quand); src.stop(quand + 1.1);
}

// Lead 8-bit : onde carrée adoucie, léger vibrato.
function carre(midi, quand, duree, volume, pan = 0) {
  const o = ctx.createOscillator(); o.type = 'square'; o.frequency.value = hz(midi);
  const vib = ctx.createOscillator(); vib.frequency.value = 5.5; const pv = ctx.createGain(); pv.gain.value = hz(midi) * 0.006;
  vib.connect(pv).connect(o.frequency);
  const f = ctx.createBiquadFilter(); f.type = 'lowpass'; f.frequency.value = 2600;
  const g = ctx.createGain(); enveloppe(g, quand, volume * 0.45, 0.004, duree);
  o.connect(f).connect(g);
  sortie(g, 0.15, pan);
  for (const x of [o, vib]) { x.start(quand); x.stop(quand + duree + 0.05); }
}

const INSTRUMENTS = { rhodes, marimba, pince, carre };

// ---- Basses ---------------------------------------------------------------------------------------------------
function basse(genre, midi, quand, duree) {
  const f = hz(midi);
  if (genre === 'funk') {
    // Dent de scie derrière un filtre qui s'ouvre puis se referme vite : le « pop » d'une basse slappée.
    const o = ctx.createOscillator(); o.type = 'sawtooth'; o.frequency.value = f;
    const filtre = ctx.createBiquadFilter(); filtre.type = 'lowpass'; filtre.Q.value = 6;
    filtre.frequency.setValueAtTime(2200, quand); filtre.frequency.exponentialRampToValueAtTime(260, quand + 0.16);
    const g = ctx.createGain(); enveloppe(g, quand, 0.34, 0.004, Math.max(0.12, duree));
    o.connect(filtre).connect(g); sortie(g, 0);
    o.start(quand); o.stop(quand + duree + 0.05);
    return;
  }
  const o = ctx.createOscillator(); o.type = genre === 'carree' ? 'square' : 'sine'; o.frequency.value = f;
  const o2 = ctx.createOscillator(); o2.type = 'triangle'; o2.frequency.value = f * 2;
  const g2 = ctx.createGain(); g2.gain.value = genre === 'carree' ? 0 : 0.18;
  const filtre = ctx.createBiquadFilter(); filtre.type = 'lowpass'; filtre.frequency.value = genre === 'carree' ? 900 : 700;
  const g = ctx.createGain(); enveloppe(g, quand, genre === 'carree' ? 0.16 : 0.42, 0.008, Math.max(0.15, duree));
  o.connect(filtre); o2.connect(g2).connect(filtre); filtre.connect(g); sortie(g, 0);
  for (const x of [o, o2]) { x.start(quand); x.stop(quand + duree + 0.05); }
}

// ---- Batterie -------------------------------------------------------------------------------------------------
function bruitFiltre(quand, type, frequence, q, volume, duree, envoi = 0.05, pan = 0) {
  const src = ctx.createBufferSource(); src.buffer = bruit;
  const f = ctx.createBiquadFilter(); f.type = type; f.frequency.value = frequence; f.Q.value = q;
  const g = ctx.createGain(); enveloppe(g, quand, volume, 0.001, duree);
  src.connect(f).connect(g); sortie(g, envoi, pan);
  src.start(quand, Math.random() * 0.8); src.stop(quand + duree + 0.02);
}
const FUTS = {
  kick(quand, v) {
    const o = ctx.createOscillator(); o.type = 'sine';
    o.frequency.setValueAtTime(130, quand); o.frequency.exponentialRampToValueAtTime(42, quand + 0.13);
    const g = ctx.createGain(); enveloppe(g, quand, 0.85 * v, 0.002, 0.38);
    o.connect(g); sortie(g, 0);
    o.start(quand); o.stop(quand + 0.42);
  },
  snare(quand, v) {
    bruitFiltre(quand, 'bandpass', 1900, 0.7, 0.42 * v, 0.17, 0.18);
    const o = ctx.createOscillator(); o.type = 'triangle'; o.frequency.setValueAtTime(220, quand); o.frequency.exponentialRampToValueAtTime(160, quand + 0.08);
    const g = ctx.createGain(); enveloppe(g, quand, 0.22 * v, 0.001, 0.09);
    o.connect(g); sortie(g, 0.1); o.start(quand); o.stop(quand + 0.12);
  },
  clap(quand, v) {
    for (let i = 0; i < 3; i++) bruitFiltre(quand + i * 0.011, 'bandpass', 1500, 1.1, 0.3 * v, 0.03, 0.1);
    bruitFiltre(quand + 0.033, 'bandpass', 1400, 0.9, 0.26 * v, 0.16, 0.3);
  },
  hat(quand, v) { bruitFiltre(quand, 'highpass', 7500, 0.5, 0.11 * v, 0.045, 0.02, 0.25); },
  ouvert(quand, v) { bruitFiltre(quand, 'highpass', 7000, 0.5, 0.09 * v, 0.24, 0.08, 0.25); },
  shaker(quand, v) { bruitFiltre(quand, 'highpass', 5200, 0.8, 0.045 * v, 0.06, 0.02, -0.3); },
  rim(quand, v) {
    const o = ctx.createOscillator(); o.type = 'square'; o.frequency.value = 1750;
    const f = ctx.createBiquadFilter(); f.type = 'bandpass'; f.frequency.value = 1750; f.Q.value = 4;
    const g = ctx.createGain(); enveloppe(g, quand, 0.18 * v, 0.001, 0.035);
    o.connect(f).connect(g); sortie(g, 0.15, 0.2); o.start(quand); o.stop(quand + 0.05);
  }
};

// ---- Composition ----------------------------------------------------------------------------------------------

// Motif mélodique de deux mesures : un rythme tiré des gabarits de la piste, des hauteurs en marche douce dans la
// gamme (petits pas surtout), et une fin qui retombe sur une note stable. Rejoué, puis varié : c'est l'accroche.
function nouveauMotif(P) {
  const mesures = [];
  let deg = Math.floor(P.gamme.length / 2);
  for (let m = 0; m < 2; m++) {
    const rythme = P.rythmeLead[m % P.rythmeLead.length];
    const notes = [];
    for (let s = 0; s < 16; s++) {
      if (rythme[s] === '.') continue;
      deg = Math.max(0, Math.min(P.gamme.length - 1, deg + choix([-2, -1, -1, 0, 1, 1, 2])));
      let long = 1; while (s + long < 16 && rythme[s + long] === '.' && long < 4) long++;
      notes.push({ s, deg, long });
    }
    mesures.push(notes);
  }
  const derniere = mesures[1][mesures[1].length - 1];
  if (derniere) derniere.deg = choix([0, 2, 4].filter((d) => d < P.gamme.length));
  return mesures;
}

function pisteSuivante() {
  if (choixPiste !== 'mix') return PISTES.find((p) => p.id === choixPiste) || PISTES[0];
  let i; do { i = Math.floor(Math.random() * PISTES.length); } while (PISTES.length > 1 && i === precedente);
  precedente = i; return PISTES[i];
}

// Planifie la mesure suivante sur l'horloge audio, dès qu'elle commence dans moins d'une seconde.
function planifier() {
  if (!ctx || !active) return;
  if (ctx.currentTime + 1.0 < prochaineMesure) return;
  // En mix, on change de morceau toutes les 16 mesures ; motif régénéré toutes les 8.
  if (!pisteEnCours || (choixPiste === 'mix' && mesure % 16 === 0)) { pisteEnCours = pisteSuivante(); motif = null; }
  const P = pisteEnCours;
  if (!motif || mesure % 8 === 0) motif = nouveauMotif(P);
  const pas = 60 / P.bpm / 4;
  const t0 = Math.max(prochaineMesure, ctx.currentTime + 0.05);
  const quand = (s) => t0 + s * pas + (s % 2 ? P.swing * pas : 0);
  const idx = mesure % 4;
  const accord = P.accords[idx];
  // Intro douce : la première mesure d'un morceau, sans batterie ni mélodie.
  const intro = mesure === 0;
  // Respiration : toutes les 8 mesures, la dernière laisse tomber la mélodie.
  const avecLead = !intro && mesure % 8 !== 7;

  // Batterie
  if (!intro) {
    for (const [fut, grille] of Object.entries(P.batterie)) {
      for (let s = 0; s < 16; s++) {
        if (grille[s] === '.') continue;
        const accent = grille[s] === 'o' ? 1.25 : 1;
        FUTS[fut](quand(s), accent * (fut === 'hat' || fut === 'shaker' ? (s % 4 === 0 ? 1 : alea(0.55, 0.85)) : 1));
      }
    }
    // Petit roulement de clap/caisse en fin de phrase.
    if (mesure % 8 === 7) { const fut = P.batterie.clap ? 'clap' : P.batterie.snare ? 'snare' : 'rim'; for (const s of [13, 14, 15]) FUTS[fut](quand(s), 0.6); }
  }
  // Basse
  for (let s = 0; s < 16; s++) {
    const c = P.rythmeBasse[s]; if (c === '.') continue;
    let long = 1; while (s + long < 16 && P.rythmeBasse[s + long] === '.') long++;
    basse(P.basse, P.basses[idx] + (c === 'o' ? 12 : 0), quand(s), Math.min(long, 4) * pas * 0.95);
  }
  // Accompagnement
  if (P.comp === 'arpege') {
    for (let s = 0; s < 16; s++) carre(accord[s % accord.length] + 12, quand(s), pas * 0.8, 0.22, s % 2 ? 0.3 : -0.3);
  } else {
    const jouer = INSTRUMENTS[P.comp];
    for (let s = 0; s < 16; s++) {
      if (P.rythmeComp[s] === '.') continue;
      const duree = P.compLong ? pas * 10 : pas * 2.2;
      accord.forEach((note, i) => jouer(note, quand(s) + i * 0.012, duree, 0.1, (i - 1.5) * 0.25));
    }
  }
  // Mélodie : motif A (mesures 1-2), A (3-4), puis variation des dernières notes.
  if (avecLead) {
    const notes = motif[mesure % 2].map((n) => ({ ...n }));
    if (mesure % 4 >= 2 && notes.length > 1) {
      const v = notes[notes.length - 1]; v.deg = Math.max(0, Math.min(P.gamme.length - 1, v.deg + choix([-2, 1, 2])));
    }
    const jouer = INSTRUMENTS[P.lead];
    for (const n of notes) jouer(P.gamme[n.deg], quand(n.s), Math.max(pas * 1.5, n.long * pas * 1.1), P.lead === 'carre' ? 0.3 : 0.2, alea(-0.2, 0.2));
  }
  // Vinyle : quelques craquements discrets.
  if (P.vinyle) for (let i = 0; i < 6; i++) bruitFiltre(t0 + Math.random() * pas * 16, 'highpass', 3000, 0.5, alea(0.01, 0.035), 0.008, 0);

  prochaineMesure = t0 + pas * 16;
  mesure++;
}

export const musique = {
  pistes: PISTES.map((p) => p.id),
  preference() { try { return localStorage.getItem(CLE) === 'on'; } catch { return false; } },
  estActive() { return active; },
  piste() { return choixPiste; },
  abonner(f) { abonnes.add(f); return () => abonnes.delete(f); },
  // Choisir une piste (ou 'mix') : démarre la musique si besoin, sinon enchaîne sur la nouvelle piste à la mesure suivante.
  async choisir(id) {
    choixPiste = id === 'mix' || PISTES.some((p) => p.id === id) ? id : 'mix';
    try { localStorage.setItem(CLE_PISTE, choixPiste); } catch { /* sans stockage */ }
    pisteEnCours = null; motif = null; mesure = 1; // 1 : pas d'intro silencieuse quand on change en cours de route
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
      maitre.gain.exponentialRampToValueAtTime(0.5, c.currentTime + 1.2);
      prochaineMesure = c.currentTime; mesure = 0; pisteEnCours = null; motif = null;
      planifier();
      planificateur = setInterval(planifier, 250);
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
