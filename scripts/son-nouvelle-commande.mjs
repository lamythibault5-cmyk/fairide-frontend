// LE SON LONG D'UNE NOUVELLE COMMANDE, TÉLÉPHONE VERROUILLÉ (bug hunt avant GO, G43 ; décision d'Owen, 2026-11-06).
//
// Appli en arrière-plan, la sonnerie de la page (useNewOrderAlert.js) se tait : il ne restait que le « ding » court du
// système. Ce script écrit le son que la notification d'une nouvelle commande joue à la place : la « petite mélodie » de
// la page (même notes, même onde à sommet plat), deux fois par cycle de 4 s comme l'alarme de la page, quatre cycles
// (~14 s : iOS en joue 30 s au plus, Android le fichier entier). WAV PCM 16 bits mono 16 kHz, lu par les deux systèmes.
//
//   node scripts/son-nouvelle-commande.mjs
//
// écrit public/sons/nouvelle_commande.wav (copié dans Library/Sounds sur iPhone par src/pushNatif.js) et
// android/app/src/main/res/raw/nouvelle_commande.wav (canal « commandes2 »). Le serveur nomme ce son (fairide-backend/fcm.js).
import { mkdirSync, writeFileSync } from 'node:fs';

const TAUX = 16000;
const CYCLES = 4;
const CYCLE_S = 4;
const MELODIE = [[659.25, 0.16], [783.99, 0.16], [880, 0.16], [1318.5, 0.5]];
const CRETE = 0.8; // sous la pleine échelle : le volume du téléphone fait le reste

const duree = (CYCLES - 1) * CYCLE_S + 2.2;
const echantillons = new Float32Array(Math.ceil(duree * TAUX));
function ton(freq, debut, longueur) {
  const a = Math.round(debut * TAUX);
  const n = Math.round(longueur * TAUX);
  for (let i = 0; i < n; i++) {
    const t = i / TAUX;
    // Montée de 10 ms, tenue, relâche de 60 ms : pas de clic.
    const enveloppe = Math.min(1, t / 0.01, (longueur - t) / 0.06);
    const x = 2 * Math.PI * freq * t;
    echantillons[a + i] += (CRETE / 0.866) * Math.max(0, enveloppe) * (Math.sin(x) + Math.sin(3 * x) / 6);
  }
}
for (let c = 0; c < CYCLES; c++) {
  for (const reprise of [0, 1]) {
    MELODIE.forEach(([f, d], i) => ton(f, c * CYCLE_S + reprise + i * 0.17, d));
  }
}

const donnees = Buffer.alloc(echantillons.length * 2);
echantillons.forEach((v, i) => donnees.writeInt16LE(Math.round(Math.max(-1, Math.min(1, v)) * 32767), i * 2));
const entete = Buffer.alloc(44);
entete.write('RIFF', 0); entete.writeUInt32LE(36 + donnees.length, 4); entete.write('WAVE', 8);
entete.write('fmt ', 12); entete.writeUInt32LE(16, 16); entete.writeUInt16LE(1, 20); entete.writeUInt16LE(1, 22);
entete.writeUInt32LE(TAUX, 24); entete.writeUInt32LE(TAUX * 2, 28); entete.writeUInt16LE(2, 32); entete.writeUInt16LE(16, 34);
entete.write('data', 36); entete.writeUInt32LE(donnees.length, 40);
const fichier = Buffer.concat([entete, donnees]);

for (const dossier of ['public/sons', 'android/app/src/main/res/raw']) {
  const url = new URL(`../${dossier}/`, import.meta.url);
  mkdirSync(url, { recursive: true });
  writeFileSync(new URL('nouvelle_commande.wav', url), fichier);
}
console.log(`nouvelle_commande.wav : ${duree.toFixed(1)} s, ${Math.round(fichier.length / 1024)} Ko`);
