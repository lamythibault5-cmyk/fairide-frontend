// LES DÉCISIONS DE MISE À JOUR DES APPLIS (Owen, 2026-11-04 : « quand je pousse un changement, Claude décide si c'est
// conseillé ou obligatoire »). Un fichier par changement dans mises-a-jour/ (règles dans mises-a-jour/LISEZMOI.md) :
//
//   node scripts/mises-a-jour.mjs verifier                 la CI : chaque fichier est lisible et respecte les règles
//   node scripts/mises-a-jour.mjs envoyer <android|ios> <build>
//                                                          les workflows de build, après l'envoi au store : toutes les
//                                                          décisions du commit construit partent au serveur (POST
//                                                          /api/app/builds, secret APP_BUILDS_TOKEN). Le serveur retient le
//                                                          premier build qui porte chacune et ne l'applique qu'une fois ce
//                                                          build en ligne dans le store (fairide-backend/versionsApplis.js).
//
// L'envoi n'arrête jamais un build : sans jeton ou si le serveur ne répond pas, un avertissement, et le build suivant
// renverra les mêmes décisions (le serveur garde le plus petit build qui les porte).
import { readdirSync, readFileSync } from 'node:fs';

const DOSSIER = new URL('../mises-a-jour/', import.meta.url);
const NIVEAUX = ['conseillee', 'obligatoire'];
const LANGUES = ['fr', 'nl', 'en'];
const API = process.env.VITE_API_BASE || 'https://fairide-backend-production.up.railway.app/api';

function lire() {
  const entrees = [];
  const erreurs = [];
  for (const nom of readdirSync(DOSSIER).filter((f) => f.endsWith('.json')).sort()) {
    const id = nom.replace(/\.json$/, '');
    const dire = (m) => erreurs.push(`mises-a-jour/${nom} : ${m}`);
    if (!/^\d{4}-\d{2}-\d{2}-[a-z0-9][a-z0-9-]{1,60}$/.test(id)) { dire('nom attendu AAAA-MM-JJ-sujet.json (minuscules, chiffres, tirets)'); continue; }
    let e;
    try { e = JSON.parse(readFileSync(new URL(nom, DOSSIER), 'utf8')); } catch (err) { dire(`JSON illisible (${err.message})`); continue; }
    const avant = erreurs.length;
    const cles = Object.keys(e || {});
    if (cles.some((c) => !['niveau', 'raison', 'lignes'].includes(c))) dire('seules les clés niveau, raison et lignes sont permises');
    if (!NIVEAUX.includes(e?.niveau)) dire(`niveau doit être ${NIVEAUX.join(' ou ')}`);
    if (typeof e?.raison !== 'string' || !e.raison.trim() || e.raison.length > 300) dire('raison : une phrase (300 caractères au plus)');
    const lignes = e?.lignes || {};
    for (const l of LANGUES) {
      const liste = lignes[l];
      if (!Array.isArray(liste) || liste.length > 3) { dire(`lignes.${l} : une liste de 0 à 3 lignes`); continue; }
      liste.forEach((t, i) => { if (typeof t !== 'string' || !t.trim() || t.length > 80) dire(`lignes.${l}[${i}] : un texte de 1 à 80 caractères`); });
    }
    if (new Set(LANGUES.map((l) => (Array.isArray(lignes[l]) ? lignes[l].length : -1))).size > 1) dire('lignes : autant de lignes en fr, nl et en');
    if (erreurs.length === avant) entrees.push({ id, niveau: e.niveau, raison: e.raison.trim(), lignes: Object.fromEntries(LANGUES.map((l) => [l, lignes[l].map((t) => t.trim())])) });
  }
  return { entrees, erreurs };
}

const [action, plateforme, build] = process.argv.slice(2);
const { entrees, erreurs } = lire();

if (action === 'verifier') {
  for (const m of erreurs) console.error(`✗ ${m}`);
  console.log(`${entrees.length} décision(s) de mise à jour valable(s)${erreurs.length ? `, ${erreurs.length} erreur(s)` : ''}.`);
  process.exit(erreurs.length ? 1 : 0);
}

if (action === 'envoyer') {
  const avertir = (m) => { console.log(`::warning::Mises à jour des applis : ${m}`); process.exit(0); };
  if (!['android', 'ios'].includes(plateforme) || !(Number(build) > 0)) { console.error('Usage : envoyer <android|ios> <build>'); process.exit(1); }
  for (const m of erreurs) console.log(`::warning::${m} (ignorée)`);
  const jeton = process.env.APP_BUILDS_TOKEN;
  if (!jeton) avertir('pas de secret APP_BUILDS_TOKEN, décisions non envoyées.');
  try {
    const r = await fetch(`${API}/app/builds`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${jeton}` },
      body: JSON.stringify({ plateforme, build: Number(build), commit: process.env.GITHUB_SHA || '', entrees }),
      signal: AbortSignal.timeout(30000)
    });
    const texte = await r.text();
    if (!r.ok) avertir(`le serveur a répondu ${r.status} (${texte.slice(0, 200)}).`);
    console.log(`Build ${plateforme} ${build} : ${entrees.length} décision(s) envoyée(s). Réponse : ${texte}`);
  } catch (err) {
    avertir(`serveur injoignable (${err.message}).`);
  }
  process.exit(0);
}

console.error('Usage : node scripts/mises-a-jour.mjs verifier | envoyer <android|ios> <build>');
process.exit(1);
