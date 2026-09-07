// Musique de fond des mini-jeux : une nappe détente synthétisée en Web Audio, sans aucun fichier à
// télécharger ni à héberger. Coupée par défaut ; le joueur l'active d'un bouton (GameFrame) et son choix
// est retenu (localStorage). Un seul moteur pour toute la page : changer de jeu ne coupe pas la musique,
// quitter la page Carte oui (GameSwitcher l'arrête en se démontant).
//
// CE QUI JOUE. Quatre accords qui tournent en boucle (Cmaj7, Am7, Fmaj7, G6 — une progression douce, sans
// tension), chacun tenu quatre secondes par trois oscillateurs triangle passés dans un filtre passe-bas,
// avec une attaque et une extinction lentes pour qu'aucun accord ne « claque ». Par-dessus, un arpège
// clairsemé de notes sinus très courtes, une toutes les 0,9 s environ, décalées d'un demi-temps une fois
// sur deux pour ne pas donner une horloge. Volume global bas (0,11) : c'est un fond, pas un morceau.
const CLE = 'fairide_game_music';
const PROGRESSION = [
  [261.63, 329.63, 392.0, 493.88], // Cmaj7
  [220.0, 261.63, 329.63, 392.0], // Am7
  [174.61, 220.0, 261.63, 329.63], // Fmaj7
  [196.0, 246.94, 293.66, 329.63] // G6
];
const DUREE_ACCORD = 4;

let ctx = null; let maitre = null; let filtre = null; let boucle = null; let arpege = null;
let indexAccord = 0; let active = false;
const abonnes = new Set();

function prevenir() { abonnes.forEach((f) => f(active)); }

function contexte() {
  if (ctx) return ctx;
  const Ctor = window.AudioContext || window.webkitAudioContext;
  if (!Ctor) return null;
  ctx = new Ctor();
  filtre = ctx.createBiquadFilter(); filtre.type = 'lowpass'; filtre.frequency.value = 900; filtre.Q.value = 0.4;
  maitre = ctx.createGain(); maitre.gain.value = 0;
  filtre.connect(maitre).connect(ctx.destination);
  return ctx;
}

function jouerAccord(freqs, quand) {
  for (const f of freqs) {
    const osc = ctx.createOscillator(); osc.type = 'triangle'; osc.frequency.value = f / 2; // une octave sous la note : plus feutré
    const g = ctx.createGain();
    g.gain.setValueAtTime(0.0001, quand);
    g.gain.exponentialRampToValueAtTime(0.09, quand + 1.2);
    g.gain.setValueAtTime(0.09, quand + DUREE_ACCORD - 1.4);
    g.gain.exponentialRampToValueAtTime(0.0001, quand + DUREE_ACCORD + 0.4);
    osc.connect(g).connect(filtre);
    osc.start(quand); osc.stop(quand + DUREE_ACCORD + 0.5);
  }
}

function noteArpege(freq, quand) {
  const osc = ctx.createOscillator(); osc.type = 'sine'; osc.frequency.value = freq * 2;
  const g = ctx.createGain();
  g.gain.setValueAtTime(0.0001, quand);
  g.gain.exponentialRampToValueAtTime(0.07, quand + 0.02);
  g.gain.exponentialRampToValueAtTime(0.0001, quand + 0.9);
  osc.connect(g).connect(filtre);
  osc.start(quand); osc.stop(quand + 1);
}

function demarrerBoucle() {
  const tick = () => {
    const accord = PROGRESSION[indexAccord % PROGRESSION.length];
    const t0 = ctx.currentTime + 0.05;
    jouerAccord(accord, t0);
    // Trois ou quatre notes d'arpège par accord, jamais sur la grille exacte.
    const n = 3 + (indexAccord % 2);
    for (let i = 0; i < n; i++) noteArpege(accord[(i + indexAccord) % accord.length], t0 + 0.4 + i * 0.9 + (i % 2) * 0.25);
    indexAccord++;
  };
  tick();
  boucle = setInterval(tick, DUREE_ACCORD * 1000);
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
      maitre.gain.exponentialRampToValueAtTime(0.11, c.currentTime + 1.5);
      demarrerBoucle();
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
    clearInterval(boucle); boucle = null; clearTimeout(arpege); arpege = null;
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
