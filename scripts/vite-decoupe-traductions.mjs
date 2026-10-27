/* LE FRANÇAIS EN DEUX MORCEAUX, À LA CONSTRUCTION (audit du 27/10/2026).
 *
 * POURQUOI. fr.js est la langue par défaut, donc importée statiquement (voir l'en-tête de src/i18n/translations.js) :
 * ses 10 000 clés partaient toutes dans le premier chargement, console d'administration, contrats et politique de
 * confidentialité compris — 668 Ko (224 Ko compressés) pour afficher l'accueil, la liste et une fiche. Mesuré le 27/10 :
 * les pages du premier chargement n'utilisent que 48 des 190 espaces, soit 164 Ko des 617 Ko de la table.
 *
 * CE QUE FAIT CE PLUGIN (pour le français ; le néerlandais et l'anglais suivent la même règle, voir LANGUES plus bas).
 * src/i18n/fr-base.js et fr-suite.js sont, dans le dépôt, deux simples renvois vers fr.js (Node,
 * check-i18n, prérendu et développement lisent donc la table entière, comme avant). À la construction, ce plugin les
 * remplace : fr-base ne garde que les espaces cités par le code du premier chargement, fr-suite tout le reste, chargé à la
 * demande (chargerSuite, translations.js).
 *
 * POURQUOI fr.js NE BOUGE PAS. Les tests du backend le lisent tel quel (les textes `terms.*` et `privacy.*` y sont
 * hachés, cgu.js) : couper le fichier en deux casserait ce lien. Le découpage vit donc ici, et seulement dans dist/.
 *
 * COMMENT LA LISTE EST TROUVÉE. Écrite à la main, elle serait fausse au prochain écran ajouté. Le plugin suit les `import`
 * statiques depuis src/main.jsx, plus les `lazy(() => import(…))` ordinaires (la carte d'une fiche, l'amorce des
 * notifications : rendus par une page du premier chargement sans attendre la suite) ; il s'arrête aux pages en
 * `lazyPage(…)`, qui attendent la suite avant de s'afficher (src/lazyPage.js), et à routePrefetch.js. Dans ces fichiers,
 * toute chaîne qui commence par le nom d'un espace suivi d'un point ('landing.', `orderStatus.${…}`) garde cet espace. En
 * trop, ça ne coûte que quelques octets ; en moins, une clé brute s'afficherait le temps que la suite arrive.
 *
 * `apply: 'build'` : en développement, la table entière reste servie par les renvois, et un changement de fr.js se
 * recharge comme avant. */
import fs from 'node:fs';
import path from 'node:path';
import { pathToFileURL } from 'node:url';

const EXTENSIONS = ['', '.js', '.jsx', '/index.js', '/index.jsx'];

function resoudre(depuis, chemin) {
  if (!chemin.startsWith('.')) return null;
  const base = path.resolve(path.dirname(depuis), chemin);
  for (const ext of EXTENSIONS) {
    const candidat = base + ext;
    if (fs.existsSync(candidat) && fs.statSync(candidat).isFile()) return candidat;
  }
  return null;
}

export function espacesDuPremierChargement(dossierSrc, espaces) {
  const vus = new Set();
  const aLire = [path.join(dossierSrc, 'main.jsx')];
  while (aLire.length) {
    const fichier = aLire.pop();
    if (vus.has(fichier)) continue;
    vus.add(fichier);
    // Les tables elles-mêmes, et le préchargement des pages (il nomme toutes les pages : les suivre ramènerait tout).
    if (!/\.jsx?$/.test(fichier) || /[\\/]i18n[\\/](fr|en|nl)(-base|-suite)?\.js$/.test(fichier) || /[\\/]routePrefetch\.js$/.test(fichier)) continue;
    const source = fs.readFileSync(fichier, 'utf8').replace(/\/\*[\s\S]*?\*\//g, '').replace(/^\s*\/\/.*$/gm, '')
      // Une page en lazyPage attend la suite : on ne la suit pas.
      .replace(/lazyPage\(\s*\(\)\s*=>\s*import\([^)]*\)\s*\)/g, '');
    const suivre = (m) => { const r = resoudre(fichier, m[1]); if (r) aLire.push(r); };
    for (const m of source.matchAll(/(?:^|[;\n])\s*(?:import|export)\s+(?:[^'"`;]*?\s+from\s+)?['"]([^'"]+)['"]/g)) suivre(m);
    for (const m of source.matchAll(/import\(\s*['"]([^'"]+)['"]\s*\)/g)) suivre(m);
  }
  const utilises = new Set();
  for (const fichier of vus) {
    if (!/\.jsx?$/.test(fichier) || /[\\/]i18n[\\/]/.test(fichier)) continue;
    const source = fs.readFileSync(fichier, 'utf8');
    for (const m of source.matchAll(/['"`]([a-zA-Z]+)\.[a-zA-Z_$]/g)) if (espaces.has(m[1])) utilises.add(m[1]);
  }
  return utilises;
}

/* LE NÉERLANDAIS ET L'ANGLAIS, COUPÉS DE LA MÊME FAÇON (27/10/2026). Chargés seulement pour leur langue, ils partaient
 * pourtant en entier (≈ 200 Ko compressés chacun) avant que /nl ou /en affiche son texte. Mêmes espaces que le français :
 * la liste dit ce que le code du premier chargement lit, quelle que soit la langue. */
const LANGUES = ['fr', 'nl', 'en'];

export default function decoupeTraductions() {
  let racine;
  let garder = null;
  const decoupes = {};
  const ko = (objet) => Math.round(JSON.stringify(objet).length / 1024);
  const table = async (langue) => (await import(pathToFileURL(path.join(racine, 'src', 'i18n', `${langue}.js`)).href)).default;

  // Les espaces à garder, lus une fois pour les trois langues : la table française les nomme tous (check-i18n le garantit).
  async function espacesAGarder() {
    if (!garder) garder = (async () => espacesDuPremierChargement(path.join(racine, 'src'), new Set(Object.keys(await table('fr')))))();
    return garder;
  }

  function decouper(langue) {
    if (!decoupes[langue]) {
      decoupes[langue] = (async () => {
        const [entiere, espaces] = await Promise.all([table(langue), espacesAGarder()]);
        const base = {};
        const suite = {};
        for (const [espace, valeur] of Object.entries(entiere)) (espaces.has(espace) ? base : suite)[espace] = valeur;
        console.log(`\n[traductions] ${langue} au premier chargement : ${Object.keys(base).length} espaces, ${ko(base)} Ko ; à la demande : ${Object.keys(suite).length} espaces, ${ko(suite)} Ko`);
        return { base, suite };
      })();
    }
    return decoupes[langue];
  }

  return {
    name: 'decoupe-traductions',
    apply: 'build',
    configResolved(config) { racine = config.root; },
    async load(id) {
      const trouve = id.replace(/\\/g, '/').match(/\/src\/i18n\/(fr|nl|en)-(base|suite)\.js$/);
      if (!trouve || !LANGUES.includes(trouve[1])) return null;
      const morceau = (await decouper(trouve[1]))[trouve[2]];
      // JSON.parse d'une chaîne s'analyse plus vite qu'un littéral objet de cette taille (recommandation V8).
      return `export default JSON.parse(${JSON.stringify(JSON.stringify(morceau))});`;
    }
  };
}
