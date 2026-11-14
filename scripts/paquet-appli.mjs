// LES MISES À JOUR DIRECTES DES APPLIS (Owen, 2026-11-05) : les écrans corrigés arrivent dans l'appli installée sans
// passer par les stores (src/miseAJourDirecte.js, fairide-backend/paquetsAppli.js).
//
//   node scripts/paquet-appli.mjs env       lignes VITE_PAQUET_ID, VITE_PAQUET_ORDRE, VITE_SOCLE_IOS, VITE_SOCLE_ANDROID
//                                           à ajouter à $GITHUB_ENV AVANT `npm run build` : tous les builds de l'appli
//                                           (stores et paquets) savent ainsi qui ils sont et sur quelle coque ils tournent.
//                                           Aussi SOCLES_ANCIENS_IOS / _ANDROID et PAQUET_ETIQUETTE (voir plus bas).
//   node scripts/paquet-appli.mjs annoncer <url> <zip>
//                                           le workflow « App mise à jour directe », après avoir déposé le zip : son
//                                           empreinte sha256 et les socles partent au serveur (POST /api/app/paquets,
//                                           secret APP_BUILDS_TOKEN). Échoue si le serveur refuse : sans annonce, aucune
//                                           appli ne recevrait la correction, et le ❌ rouge le dit.
//   node scripts/paquet-appli.mjs elaguer   lit la liste des zips de la release (« <date> <id> <nom> » par ligne) et
//                                           écrit les id des zips à retirer (voir LES VIEUX ZIPS).
//   node scripts/paquet-appli.mjs socles [commit]
//                                           les socles d'un commit (normalisé, brut, anciens), en JSON : pour vérifier.
//   node scripts/paquet-appli.mjs verifier  la CI (npm run check:socle) : un numéro de version ne change pas le socle,
//                                           et l'élagage garde le dernier zip de chaque socle.
//
// LE SOCLE d'une plate-forme : une empreinte de ce que les écrans supposent dans la coque native, lue dans le commit (pas
// dans les fichiers que les builds modifient ensuite) : capacitor.config.json, les versions des greffons Capacitor, et le
// dossier ios/ ou android/. Une appli n'accepte que les paquets de son propre socle : un changement natif ne part jamais
// vers une coque qui ne l'a pas, il attend la version du store.
// L'ORDRE : l'heure du commit, en secondes ; l'identifiant d'un paquet est <ordre>-<début du commit>.
//
// LES NUMÉROS DE VERSION NE COMPTENT PAS (2026-11-13). Apple ferme une version après chaque approbation : chaque sortie
// au store monte MARKETING_VERSION dans ios/ (940fc7a7, 1.0 → 1.0.1, le 12/11). Ce numéro n'est pas un changement de la
// coque, mais il était dans l'empreinte : l'iPhone App Store 1.0 (build 301) n'a plus reçu aucun paquet après #421,
// la correction du double paiement comprise. Le socle se calcule donc sur le dossier dont les lignes de version
// (MARKETING_VERSION et CURRENT_PROJECT_VERSION dans le projet Xcode, versionName et versionCode dans
// android/app/build.gradle) sont remises aux valeurs d'avant la 1.0.1 (NORMALES) : il redevient celui des builds 1.0.
// LES ANCIENS SOCLES : les builds construits entre la 1.0.1 et cette règle (TestFlight puis App Store 1.0.1, build 315
// compris) ont gardé dans leurs écrans le socle brut, numéro 1.0.1 compris. Chaque paquet est donc aussi annoncé sous ce
// socle-là (ANCIENS), avec un identifiant un caractère plus long (<ordre>-<début du commit + 1>, même ordre) : la clé du
// serveur est (plate-forme, identifiant), un même identifiant ne peut pas porter deux socles. Une fois un tel paquet en
// place, l'appli annonce le socle normalisé de ses nouveaux écrans et suit les paquets ordinaires. Retirer un paquet
// (Admin, POST /api/admin/app/paquets/<id>/retrait) retire aussi son identifiant long : le serveur retire toutes les lignes
// du même commit (fairide-backend, paquetsAppli.retirer, revue du 2026-11-14). La liste ANCIENS se vide quand
// plus aucune appli 1.0.1 d'avant cette règle ne tourne (une version plus récente obligatoire au store).
import { execFileSync } from 'node:child_process';
import { createHash, randomBytes } from 'node:crypto';
import { readFileSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

const API = process.env.VITE_API_BASE || 'https://fairide-backend-production.up.railway.app/api';
const git = (...a) => execFileSync('git', a, { encoding: 'utf8' }).trim();

// Les lignes de version de chaque coque, et les valeurs qu'elles avaient jusqu'à la 1.0 (le socle normalisé est le socle
// brut de ces builds-là : la 1.0 du store garde ses paquets).
const VERSIONS = {
  ios: {
    fichier: 'App/App.xcodeproj/project.pbxproj',
    normales: { marketing: '1.0', build: '1' },
    remettre: (t, v) => t
      .replace(/(\bMARKETING_VERSION = )[^;\n]*;/g, (_, a) => `${a}${v.marketing};`)
      .replace(/(\bCURRENT_PROJECT_VERSION = )[^;\n]*;/g, (_, a) => `${a}${v.build};`)
  },
  android: {
    fichier: 'app/build.gradle',
    normales: { marketing: '1.0', build: '1' },
    // Toutes les écritures Gradle (Groovy et Kotlin) : versionName "x", 'x', = "x", ("x") ; versionCode : chaque nombre de
    // sa ligne (revue du 2026-11-14 ; seule la première était reconnue). \b après versionName : versionNameSuffix reste.
    remettre: (t, v) => t
      .replace(/(\bversionName\b\s*(?:=\s*)?\(?\s*)(["'])[^"'\n]*\2/g, (_, a, q) => `${a}${q}${v.marketing}${q}`)
      .replace(/^(\s*versionCode\b.*)$/gm, (ligne) => ligne.replace(/\d+/g, v.build))
  }
};
// Les numéros sous lesquels des builds ont gardé le socle BRUT (avant le 13/11) : chaque paquet est aussi annoncé sous
// ces socles-là, tant que la liste n'est pas vidée (voir LES ANCIENS SOCLES).
const ANCIENS = {
  ios: [{ marketing: '1.0.1', build: '1' }],
  android: []
};

// Les greffons qui ont du code natif, avec la version installée par le verrou (celle qui entre dans la coque).
function greffons(rev) {
  const paquet = JSON.parse(git('show', `${rev}:package.json`));
  const verrou = JSON.parse(git('show', `${rev}:package-lock.json`));
  const outils = new Set(['@capacitor/cli', '@capacitor/assets']);
  return Object.keys({ ...paquet.dependencies, ...paquet.devDependencies })
    .filter((n) => /^@(capacitor|capacitor-community|capgo)\//.test(n) && !outils.has(n))
    .sort()
    .map((n) => `${n}@${verrou.packages?.[`node_modules/${n}`]?.version || '?'}`);
}

// L'arbre git du dossier ios/ ou android/, ses lignes de version remises à `valeurs` (null : tel quel). Calculé dans un
// index temporaire : rien n'est écrit dans le dépôt ni dans la copie de travail.
function arbre(rev, plateforme, valeurs, texteDe) {
  const brut = git('rev-parse', `${rev}:${plateforme}`);
  if (!valeurs) return brut;
  const { fichier, remettre } = VERSIONS[plateforme];
  // latin1 : octet pour octet, les remplacements sont en ASCII.
  const avant = texteDe ? texteDe(rev, plateforme, fichier)
    : execFileSync('git', ['show', `${rev}:${plateforme}/${fichier}`], { encoding: 'latin1', maxBuffer: 64 << 20 });
  const apres = remettre(avant, valeurs);
  // texteDe (la vérification seule) : le dossier tel qu'il serait avec ce texte-là, recalculé même sans changement.
  if (apres === avant && !texteDe) return brut;
  const index = join(tmpdir(), `socle-${randomBytes(6).toString('hex')}.index`);
  const env = { ...process.env, GIT_INDEX_FILE: index };
  const g = (args, input) => execFileSync('git', args, { env, input, encoding: 'utf8' }).trim();
  try {
    g(['read-tree', `${rev}:${plateforme}`]);
    const mode = g(['ls-files', '-s', '--', fichier]).split(/\s/)[0] || '100644';
    const blob = execFileSync('git', ['hash-object', '--stdin'], { input: Buffer.from(apres, 'latin1') }).toString().trim();
    g(['update-index', '--cacheinfo', `${mode},${blob},${fichier}`]);
    return g(['write-tree', '--missing-ok']);
  } finally {
    rmSync(index, { force: true });
  }
}

function socle(plateforme, { rev = 'HEAD', valeurs = VERSIONS[plateforme].normales, texteDe } = {}) {
  const autre = plateforme === 'ios' ? '@capacitor/android@' : '@capacitor/ios@';
  const contenu = {
    config: git('rev-parse', `${rev}:capacitor.config.json`),
    greffons: greffons(rev).filter((g) => !g.startsWith(autre)),
    coque: arbre(rev, plateforme, valeurs, texteDe)
  };
  return createHash('sha256').update(JSON.stringify(contenu)).digest('hex');
}

// Les anciens socles encore à servir, sans le normalisé ni les doublons.
function anciens(plateforme, rev = 'HEAD') {
  const normal = socle(plateforme, { rev });
  return [...new Set(ANCIENS[plateforme].map((valeurs) => socle(plateforme, { rev, valeurs })))].filter((s) => s !== normal);
}

const court = (s) => s.slice(0, 8);

// LES VIEUX ZIPS. La release garde les 60 zips les plus récents (de quoi revenir en arrière de plusieurs jours) ET, pour
// chaque socle, tous les zips de ses 2 derniers commits (ordres distincts) : le serveur donne le plus récent non retiré d'un
// socle, parfois pendant des semaines à une coque restée en arrière ; effacé, l'appli recevrait une adresse morte et
// resterait sur les écrans de son store. Les socles d'un zip sont dans son nom (…-s<ios8>-<android8>[-<ancien8>…].zip,
// depuis le 13/11) ; un zip d'avant n'a que la règle des 60.
export function aRetirer(lignes, { garder = 60, parSocle = 2 } = {}) {
  const zips = lignes.map((l) => l.trim()).filter(Boolean).map((l) => {
    const [date, id, nom = ''] = l.split(/\s+/);
    const m = /^fairride-(\d+)-[0-9a-f]+-\d+-\d+(?:-s([0-9a-f-]+))?\.zip$/.exec(nom);
    return { date, id, ordre: Number(m?.[1]) || 0, socles: m?.[2] ? m[2].split('-').filter(Boolean) : [] };
  });
  const garde = new Set(
    [...zips].sort((a, b) => b.date.localeCompare(a.date)).slice(0, garder).map((z) => z.id)
  );
  // Les 2 derniers COMMITS (ordres distincts) du socle, avec tous leurs zips : un workflow relancé sur le même commit dépose
  // un second zip, qui comptait pour un second commit, et le zip du commit d'avant (le vrai repli) partait (revue du
  // 2026-11-14).
  for (const s of new Set(zips.flatMap((z) => z.socles))) {
    const duSocle = zips.filter((z) => z.socles.includes(s));
    const ordres = new Set([...new Set(duSocle.map((z) => z.ordre))].sort((a, b) => b - a).slice(0, parSocle));
    duSocle.filter((z) => ordres.has(z.ordre)).forEach((z) => garde.add(z.id));
  }
  return zips.filter((z) => !garde.has(z.id)).map((z) => z.id);
}

const [action, url, zip] = process.argv.slice(2);

if (action === 'env') {
  const ordre = git('log', '-1', '--format=%ct', 'HEAD');
  const id = `${ordre}-${git('rev-parse', '--short=7', 'HEAD')}`;
  const ios = socle('ios');
  const android = socle('android');
  const vieux = { ios: anciens('ios'), android: anciens('android') };
  console.log(`VITE_PAQUET_ID=${id}`);
  console.log(`VITE_PAQUET_ORDRE=${ordre}`);
  console.log(`VITE_SOCLE_IOS=${ios}`);
  console.log(`VITE_SOCLE_ANDROID=${android}`);
  console.log(`SOCLES_ANCIENS_IOS=${vieux.ios.join(',')}`);
  console.log(`SOCLES_ANCIENS_ANDROID=${vieux.android.join(',')}`);
  console.log(`PAQUET_ETIQUETTE=s${[ios, android, ...vieux.ios, ...vieux.android].map(court).join('-')}`);
  process.exit(0);
}

if (action === 'annoncer') {
  const id = process.env.VITE_PAQUET_ID;
  const jeton = process.env.APP_BUILDS_TOKEN;
  if (!url || !zip || !id) { console.error('Usage : annoncer <url> <zip>, après `env` (VITE_PAQUET_ID absent).'); process.exit(1); }
  if (!jeton) { console.error('::error::Secret APP_BUILDS_TOKEN absent : paquet déposé mais pas annoncé.'); process.exit(1); }
  const checksum = createHash('sha256').update(readFileSync(zip)).digest('hex');
  const commit = process.env.GITHUB_SHA || git('rev-parse', 'HEAD');
  const [ordre, debut] = id.split('-');
  const liste = (v) => String(v || '').split(',').filter(Boolean);
  const vieux = { ios: liste(process.env.SOCLES_ANCIENS_IOS), android: liste(process.env.SOCLES_ANCIENS_ANDROID) };
  // Le paquet sous son socle, puis sous chaque ancien socle (identifiant un caractère plus long à chaque fois).
  const annonces = [{ id, socles: { ios: process.env.VITE_SOCLE_IOS, android: process.env.VITE_SOCLE_ANDROID } }];
  for (let k = 0; k < Math.max(vieux.ios.length, vieux.android.length); k++) {
    if (!commit.startsWith(debut)) { console.error(`::error::Commit ${commit} et paquet ${id} ne correspondent pas.`); process.exit(1); }
    annonces.push({ id: `${ordre}-${commit.slice(0, debut.length + 1 + k)}`, socles: { ios: vieux.ios[k], android: vieux.android[k] } });
  }
  for (const a of annonces) {
    const r = await fetch(`${API}/app/paquets`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${jeton}` },
      body: JSON.stringify({ id: a.id, commit, url, checksum, socles: a.socles }),
      signal: AbortSignal.timeout(30000)
    });
    const texte = await r.text();
    if (!r.ok) { console.error(`::error::Le serveur a refusé le paquet ${a.id} : ${r.status} ${texte.slice(0, 200)}`); process.exit(1); }
    console.log(`Paquet ${a.id} annoncé (${checksum.slice(0, 12)}…) : ${texte}`);
  }
  process.exit(0);
}

if (action === 'elaguer') {
  const lignes = readFileSync(0, 'utf8').split('\n');
  for (const id of aRetirer(lignes)) console.log(id);
  process.exit(0);
}

if (action === 'socles') {
  const rev = url || 'HEAD';
  const r = {};
  for (const p of ['ios', 'android']) r[p] = { normalise: socle(p, { rev }), brut: socle(p, { rev, valeurs: null }), anciens: anciens(p, rev) };
  console.log(JSON.stringify(r, null, 2));
  process.exit(0);
}

if (action === 'verifier') {
  const erreurs = [];
  const dire = (m) => erreurs.push(m);
  // 1. Un numéro de version quelconque dans le dossier (même texte, autres numéros) donne le même socle normalisé.
  for (const p of ['ios', 'android']) {
    const { fichier, remettre } = VERSIONS[p];
    const texte = execFileSync('git', ['show', `HEAD:${p}/${fichier}`], { encoding: 'latin1', maxBuffer: 64 << 20 });
    const autre = remettre(texte, { marketing: '9.8.7', build: '654' });
    if (autre === texte) dire(`${p}/${fichier} : aucune ligne de version trouvée (le socle ne les remet plus à zéro).`);
    const normal = socle(p);
    const avecAutre = socle(p, { texteDe: () => autre });
    if (avecAutre !== normal) dire(`${p} : un autre numéro de version change le socle normalisé.`);
    if (socle(p, { valeurs: { marketing: '9.8.7', build: '654' } }) === normal) dire(`${p} : le socle brut ne voit pas les numéros (empreinte suspecte).`);
  }
  // 1 bis. Les autres écritures Gradle des lignes de version (revue du 2026-11-14) : guillemets simples, `=`, parenthèses.
  //    Deux numéros différents donnent le même texte normalisé ; versionNameSuffix ne bouge pas.
  const { remettre: remettreAndroid, normales } = VERSIONS.android;
  const formes = [
    (n, c) => `versionName "${n}"\nversionCode ${c}`,
    (n, c) => `versionName '${n}'\nversionCode ${c}`,
    (n, c) => `versionName = "${n}"\nversionCode = ${c}`,
    (n, c) => `versionName = '${n}'\nversionCode = ${c}`,
    (n, c) => `versionName("${n}")\nversionCode(${c})`,
    (n, c) => `versionName('${n}')\nversionCode('${c}'.toInteger())`,
    (n, c) => `    versionName "${n}"\n    versionCode((System.getenv('VERSION_CODE') ?: '${c}') as Integer)`
  ];
  for (const forme of formes) {
    const a = remettreAndroid(`${forme('1.0.1', 7)}\nversionNameSuffix '-test'`, normales);
    const b = remettreAndroid(`${forme('2.3', 315)}\nversionNameSuffix '-test'`, normales);
    if (a !== b || !a.includes(forme(normales.marketing, normales.build)) || !a.endsWith("versionNameSuffix '-test'")) {
      dire(`android : la forme « ${forme('X', 'N').replace(/\n/g, ' / ')} » n'est pas remise aux numéros normaux (${JSON.stringify(a)}).`);
    }
  }
  // 2. L'élagage : le dernier zip d'un socle reste, même au-delà des 60 plus récents.
  const zips = [];
  for (let i = 0; i < 70; i++) {
    const s = i < 5 ? 'saaaaaaaa-bbbbbbbb' : 'scccccccc-bbbbbbbb-dddddddd';
    zips.push(`2026-11-${String(1 + Math.floor(i / 3)).padStart(2, '0')}T${String(i % 3 + 10)}:00:00Z ${1000 + i} fairride-${1700000000 + i}-abcdef${i % 10}-${i}-1-${s}.zip`);
  }
  zips.push('2026-10-01T10:00:00Z 999 fairride-1600000000-abcdef0-1-1.zip');
  const retires = new Set(aRetirer(zips));
  if (retires.has('1004') || retires.has('1003')) dire('élagage : les 2 derniers zips du socle aaaaaaaa sont retirés.');
  if (!retires.has('1002') || !retires.has('999')) dire('élagage : un vieux zip qui n\'est le dernier de rien est gardé.');
  if (retires.size !== 70 + 1 - 60 - 2) dire(`élagage : ${retires.size} zips retirés au lieu de ${70 + 1 - 60 - 2}.`);
  // 3. Un workflow relancé sur le même commit (revue du 2026-11-14) : deux zips du commit 300, puis 200 et 100, tous
  //    plus vieux que les 60 récents. Les 2 derniers COMMITS du socle restent (300, ses deux zips, et 200) ; 100 part.
  const relance = [...Array(60)].map((_, i) => `2026-11-20T${String(10 + Math.floor(i / 6)).padStart(2, '0')}:${String(i % 6)}0:00Z ${5000 + i} fairride-${1800000000 + i}-1234567-${i}-1-sffffffff.zip`);
  relance.push('2026-11-10T12:00:00Z 3002 fairride-300-abcdef3-12-2-seeeeeeee.zip', '2026-11-10T10:00:00Z 3001 fairride-300-abcdef3-12-1-seeeeeeee.zip',
    '2026-11-09T10:00:00Z 2001 fairride-200-abcdef2-11-1-seeeeeeee.zip', '2026-11-08T10:00:00Z 1001 fairride-100-abcdef1-10-1-seeeeeeee.zip');
  const sansRelance = new Set(aRetirer(relance));
  if (sansRelance.has('2001')) dire('élagage : un workflow relancé compte pour deux commits, le zip du commit d\'avant (200) est retiré.');
  if (sansRelance.has('3001') || sansRelance.has('3002')) dire('élagage : un zip du dernier commit du socle est retiré.');
  if (!sansRelance.has('1001') || sansRelance.size !== 1) dire(`élagage (relance) : retirés ${[...sansRelance].join(', ')} au lieu de 1001 seul.`);
  for (const m of erreurs) console.error(`✗ ${m}`);
  console.log(erreurs.length ? `${erreurs.length} erreur(s) dans le socle des applis.` : 'Socle des applis : numéros de version ignorés, derniers zips de chaque socle gardés.');
  process.exit(erreurs.length ? 1 : 0);
}

console.error('Usage : node scripts/paquet-appli.mjs env | annoncer <url> <zip> | elaguer | socles [commit] | verifier');
process.exit(1);
