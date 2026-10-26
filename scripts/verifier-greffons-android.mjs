// LES GREFFONS DE L'APP ANDROID (2026-10-27). capacitor.config.json › android.includePlugins est une liste BLANCHE : dès
// qu'elle existe, `npx cap sync android` ne met dans l'app Android que les greffons qu'elle nomme. Un greffon Capacitor ajouté
// demain dans package.json, mais oublié dans cette liste, manquerait à l'app Android sans aucune erreur (le site et l'iPhone
// l'auraient). Ce contrôle le dit, dans la CI et avant le build Play Store.
//
// Laissés hors d'Android EXPRÈS, avec leur raison :
const HORS_ANDROID = {
  // Le suivi du livreur téléphone verrouillé (natif.js, suivrePositionCourse) demande FOREGROUND_SERVICE_LOCATION, et Google
  // exige alors une déclaration avec une vidéo de livraison réelle. Pas de livraison au lancement (fondateur, 2026-10-27) :
  // retiré d'Android pour la 1.0, l'app y retombe sur le suivi au premier plan. À remettre dans la mise à jour qui ouvre la
  // livraison, avec la vidéo d'un vrai livreur (Play Console › App content › Foreground service permissions).
  '@capacitor-community/background-geolocation': 'suivi en arrière-plan du livreur, pas de livraison au lancement'
};

import { readFileSync } from 'node:fs';
import { createRequire } from 'node:module';

const exiger = createRequire(import.meta.url);
const paquet = JSON.parse(readFileSync(new URL('../package.json', import.meta.url), 'utf8'));
const config = JSON.parse(readFileSync(new URL('../capacitor.config.json', import.meta.url), 'utf8'));
const liste = new Set(config.android?.includePlugins || []);

// Un greffon Capacitor a une clé « capacitor » dans son package.json.
const greffons = Object.keys({ ...paquet.dependencies, ...paquet.devDependencies }).filter((nom) => {
  try { return !!exiger(`${nom}/package.json`).capacitor; } catch { return false; }
});
const oublies = greffons.filter((g) => !liste.has(g) && !HORS_ANDROID[g]);
const inconnus = [...liste].filter((g) => !greffons.includes(g));

if (oublies.length || inconnus.length) {
  if (oublies.length) console.error(`❌ Greffons absents de capacitor.config.json › android.includePlugins : ${oublies.join(', ')}\n   Ajoute-les à la liste (ou dans HORS_ANDROID de ce script, avec la raison).`);
  if (inconnus.length) console.error(`❌ Nommés dans android.includePlugins mais pas installés : ${inconnus.join(', ')}`);
  process.exit(1);
}
console.log(`✅ App Android : ${liste.size} greffons ; hors Android exprès : ${Object.keys(HORS_ANDROID).join(', ') || 'aucun'}`);
