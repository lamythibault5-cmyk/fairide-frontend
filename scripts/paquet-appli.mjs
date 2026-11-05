// LES MISES À JOUR DIRECTES DES APPLIS (Owen, 2026-11-05) : les écrans corrigés arrivent dans l'appli installée sans
// passer par les stores (src/miseAJourDirecte.js, fairide-backend/paquetsAppli.js).
//
//   node scripts/paquet-appli.mjs env       lignes VITE_PAQUET_ID, VITE_PAQUET_ORDRE, VITE_SOCLE_IOS, VITE_SOCLE_ANDROID
//                                           à ajouter à $GITHUB_ENV AVANT `npm run build` : tous les builds de l'appli
//                                           (stores et paquets) savent ainsi qui ils sont et sur quelle coque ils tournent
//   node scripts/paquet-appli.mjs annoncer <url> <zip>
//                                           le workflow « App mise à jour directe », après avoir déposé le zip : son
//                                           empreinte sha256 et les socles partent au serveur (POST /api/app/paquets,
//                                           secret APP_BUILDS_TOKEN). Échoue si le serveur refuse : sans annonce, aucune
//                                           appli ne recevrait la correction, et le ❌ rouge le dit.
//
// LE SOCLE d'une plate-forme : une empreinte de ce que les écrans supposent dans la coque native, lue dans le commit (pas
// dans les fichiers que les builds modifient ensuite) : capacitor.config.json, les versions des greffons Capacitor, et le
// dossier ios/ ou android/. Une appli n'accepte que les paquets de son propre socle : un changement natif ne part jamais
// vers une coque qui ne l'a pas, il attend la version du store.
// L'ORDRE : l'heure du commit, en secondes ; l'identifiant d'un paquet est <ordre>-<début du commit>.
import { execFileSync } from 'node:child_process';
import { createHash } from 'node:crypto';
import { readFileSync } from 'node:fs';

const API = process.env.VITE_API_BASE || 'https://fairide-backend-production.up.railway.app/api';
const git = (...a) => execFileSync('git', a, { encoding: 'utf8' }).trim();

// Les greffons qui ont du code natif, avec la version installée par le verrou (celle qui entre dans la coque).
function greffons() {
  const paquet = JSON.parse(git('show', 'HEAD:package.json'));
  const verrou = JSON.parse(git('show', 'HEAD:package-lock.json'));
  const outils = new Set(['@capacitor/cli', '@capacitor/assets']);
  return Object.keys({ ...paquet.dependencies, ...paquet.devDependencies })
    .filter((n) => /^@(capacitor|capacitor-community|capgo)\//.test(n) && !outils.has(n))
    .sort()
    .map((n) => `${n}@${verrou.packages?.[`node_modules/${n}`]?.version || '?'}`);
}

function socle(plateforme) {
  const autre = plateforme === 'ios' ? '@capacitor/android@' : '@capacitor/ios@';
  const contenu = {
    config: git('rev-parse', 'HEAD:capacitor.config.json'),
    greffons: greffons().filter((g) => !g.startsWith(autre)),
    coque: git('rev-parse', `HEAD:${plateforme}`)
  };
  return createHash('sha256').update(JSON.stringify(contenu)).digest('hex');
}

const [action, url, zip] = process.argv.slice(2);

if (action === 'env') {
  const ordre = git('log', '-1', '--format=%ct', 'HEAD');
  const id = `${ordre}-${git('rev-parse', '--short=7', 'HEAD')}`;
  console.log(`VITE_PAQUET_ID=${id}`);
  console.log(`VITE_PAQUET_ORDRE=${ordre}`);
  console.log(`VITE_SOCLE_IOS=${socle('ios')}`);
  console.log(`VITE_SOCLE_ANDROID=${socle('android')}`);
  process.exit(0);
}

if (action === 'annoncer') {
  const id = process.env.VITE_PAQUET_ID;
  const jeton = process.env.APP_BUILDS_TOKEN;
  if (!url || !zip || !id) { console.error('Usage : annoncer <url> <zip>, après `env` (VITE_PAQUET_ID absent).'); process.exit(1); }
  if (!jeton) { console.error('::error::Secret APP_BUILDS_TOKEN absent : paquet déposé mais pas annoncé.'); process.exit(1); }
  const checksum = createHash('sha256').update(readFileSync(zip)).digest('hex');
  const r = await fetch(`${API}/app/paquets`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${jeton}` },
    body: JSON.stringify({
      id, commit: process.env.GITHUB_SHA || git('rev-parse', 'HEAD'), url, checksum,
      socles: { ios: process.env.VITE_SOCLE_IOS, android: process.env.VITE_SOCLE_ANDROID }
    }),
    signal: AbortSignal.timeout(30000)
  });
  const texte = await r.text();
  if (!r.ok) { console.error(`::error::Le serveur a refusé le paquet ${id} : ${r.status} ${texte.slice(0, 200)}`); process.exit(1); }
  console.log(`Paquet ${id} annoncé (${checksum.slice(0, 12)}…) : ${texte}`);
  process.exit(0);
}

console.error('Usage : node scripts/paquet-appli.mjs env | annoncer <url> <zip>');
process.exit(1);
