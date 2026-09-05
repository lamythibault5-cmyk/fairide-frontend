// Garde-fou i18n — `npm run check:i18n`.
//
// 1. Les trois langues de src/i18n/translations.js portent exactement les mêmes clés : une clé
//    présente en français seulement s'afficherait en français à un néerlandophone, sans erreur.
// 2. Chaque t('ns.key') / tr('ns.key') littéral du code existe (sinon l'écran montre la clé).
// 3. Aucun t(…) / tr(…) au niveau module : t n'existe que dans un composant (hook useLanguage) ;
//    hors fonction, c'est une ReferenceError au chargement de la page entière.
// 4. Chaque fonction nommée qui appelle t('…') / tr('…') dispose bien de t : hook useLanguage(),
//    paramètre, ou constante locale. Sinon : ReferenceError au rendu de CE composant (c'est ce qui
//    a rendu la section Carte inaccessible en septembre 2026 — TrackingWithGames sans son hook).
//
// Sort avec un code d'erreur si l'un des points échoue, pour brancher en CI.
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../src') + path.sep;
const { translations } = await import(pathToFileURL(path.join(ROOT, 'i18n/translations.js')).href);
let erreurs = 0;

function aplatir(o, prefixe = '', out = new Set()) {
  for (const [k, v] of Object.entries(o)) { const c = prefixe ? `${prefixe}.${k}` : k; if (v && typeof v === 'object') aplatir(v, c, out); else out.add(c); }
  return out;
}
const cles = Object.fromEntries(Object.keys(translations).map((l) => [l, aplatir(translations[l])]));
console.log(Object.entries(cles).map(([l, s]) => `${l} ${s.size}`).join(' · '));
for (const l of Object.keys(cles)) {
  if (l === 'fr') continue;
  const manque = [...cles.fr].filter((k) => !cles[l].has(k));
  const trop = [...cles[l]].filter((k) => !cles.fr.has(k));
  if (manque.length) { erreurs++; console.log(`Manque en ${l} : ${manque.join(', ')}`); }
  if (trop.length) { erreurs++; console.log(`Absent du fr mais présent en ${l} : ${trop.join(', ')}`); }
}

function sansCommentaires(s) {
  return s.replace(/(^|[\s{(;,=])\/\*[\s\S]*?\*\//g, (m, p) => p + m.slice(p.length).replace(/[^\n]/g, ' '))
    .split('\n').map((l) => { const i = l.indexOf('//'); if (i < 0) return l; const avant = l.slice(0, i); if (/https?:$/.test(avant) || (avant.split("'").length - 1) % 2 || (avant.split('"').length - 1) % 2 || (avant.split('`').length - 1) % 2) return l; return avant; }).join('\n');
}

// Corps d'une fonction à partir de l'index de son accolade ouvrante (accolades équilibrées, en
// ignorant chaînes et gabarits pour ne pas se laisser piéger par un « } » dans un texte).
function corpsDepuis(s, ouvrante) {
  let profondeur = 0; let i = ouvrante; let chaine = null;
  for (; i < s.length; i++) {
    const c = s[i];
    if (chaine) { if (c === '\\') i++; else if (c === chaine) chaine = null; continue; }
    if (c === "'" || c === '"' || c === '`') { chaine = c; continue; }
    if (c === '{') profondeur++;
    else if (c === '}') { profondeur--; if (profondeur === 0) break; }
  }
  return s.slice(ouvrante + 1, i);
}

const inconnues = new Map(); const horsFonction = []; const sansT = [];
function scan(file) {
  const brut = fs.readFileSync(file, 'utf8').replace(/\r\n/g, '\n');
  for (const m of brut.matchAll(/\b(?:t|tr)\(\s*'([a-zA-Z0-9_.]+)'/g)) {
    if (!cles.fr.has(m[1])) { if (!inconnues.has(m[1])) inconnues.set(m[1], new Set()); inconnues.get(m[1]).add(path.relative(ROOT, file)); }
  }
  const s = sansCommentaires(brut);
  const pile = []; let ligne = 1;
  for (let i = 0; i < s.length; i++) {
    const c = s[i];
    if (c === '\n') ligne++;
    if (c === '{' || c === '[' || c === '(') { const avant = s.slice(Math.max(0, i - 40), i).replace(/\s+$/, ''); pile.push(c === '{' ? /\)$|=>$/.test(avant) : /=>$/.test(avant)); }
    else if (c === '}' || c === ']' || c === ')') pile.pop();
    else if (c === 't' && /[^A-Za-z0-9_.$]/.test(s[i - 1] || ' ')) {
      const appel = (s[i + 1] === '(' && /['"`]/.test(s[i + 2] || '')) || (s[i + 1] === 'r' && s[i + 2] === '(' && /['"`]/.test(s[i + 3] || ''));
      if (appel && !pile.some(Boolean)) horsFonction.push(`${path.relative(ROOT, file)}:${ligne}`);
    }
  }
  // Point 4 : fonctions nommées de premier niveau (composants et helpers).
  for (const d of s.matchAll(/^(?:export\s+(?:default\s+)?)?(?:async\s+)?function\s+([A-Za-z0-9_]+)\s*\(/gm)) {
    let i = d.index + d[0].length; let prof = 1;
    for (; i < s.length && prof > 0; i++) { if (s[i] === '(') prof++; else if (s[i] === ')') prof--; }
    const params = s.slice(d.index + d[0].length, i - 1);
    const ouvrante = s.indexOf('{', i);
    if (ouvrante < 0) continue;
    const corps = corpsDepuis(s, ouvrante);
    const appels = new Set([...corps.matchAll(/(?<![A-Za-z0-9_.$])(t|tr)\(\s*['"`]/g)].map((m) => m[1]));
    for (const nom of appels) {
      const ok = new RegExp(`\\{[^}]*\\b(?:t: ${nom}|${nom})\\b[^}]*\\} = useLanguage\\(\\)`).test(corps)
        || new RegExp(`\\b${nom}\\b`).test(params)
        || new RegExp(`(const|let|var)\\s+${nom}\\s*=`).test(corps)
        // Un composant enfant défini dans le corps peut porter son propre hook : on ne juge que les
        // appels situés hors de toute fonction imbriquée déclarant t.
        || new RegExp(`\\b${nom}\\b[^\\n]*=>|\\(${nom}\\)|\\(${nom},|, ${nom}\\)`).test(corps);
      if (!ok) sansT.push(`${path.relative(ROOT, file)} → ${d[1]}() appelle ${nom}() sans le définir`);
    }
  }
}
function walk(d) {
  for (const e of fs.readdirSync(d, { withFileTypes: true })) {
    const p = path.join(d, e.name);
    if (e.isDirectory()) { if (!/i18n|__probe__/.test(p)) walk(p); }
    else if (/\.(jsx|js)$/.test(e.name)) scan(p);
  }
}
walk(ROOT);
if (inconnues.size) {
  // `t('resa.' + x)` laisse une clé vide « resa. » : dynamique, pas une erreur.
  const reelles = [...inconnues].filter(([k]) => !k.endsWith('.'));
  if (reelles.length) { erreurs++; console.log('Clés inconnues :'); for (const [k, f] of reelles) console.log(`  ${k}  ← ${[...f].join(', ')}`); }
}
if (horsFonction.length) { erreurs++; console.log('Appels t()/tr() hors de toute fonction :\n  ' + horsFonction.join('\n  ')); }
if (sansT.length) { erreurs++; console.log('Fonctions qui traduisent sans disposer de t/tr :\n  ' + sansT.join('\n  ')); }
console.log(erreurs ? `❌ ${erreurs} problème(s)` : '✅ i18n cohérent');
process.exit(erreurs ? 1 : 0);
