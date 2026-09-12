/* Pré-rendu des pages publiques, exécuté après `vite build`.
 *
 * LE PROBLÈME QU'IL RÈGLE. L'application est une SPA : le serveur renvoie le même index.html pour
 * toutes les adresses, avec le <head> de l'accueil, et c'est usePageMeta qui le réécrit une fois le
 * JavaScript exécuté. Google exécute le JavaScript et finit par voir les bons titres — avec un
 * passage d'indexation de retard. Les robots d'aperçu social, eux, n'en exécutent JAMAIS : WhatsApp,
 * Facebook, LinkedIn et Slack lisent le document brut. Tout lien partagé, y compris une fiche de
 * commerce précise, affichait donc la vignette générique de l'accueil.
 *
 * CE QU'IL FAIT. Pour chaque page publique, il écrit un fichier HTML réel dans dist/ : le même
 * document que la SPA, avec SON titre, SA description, SES balises og:*, SON canonical et SES
 * données structurées posés dès le premier octet. L'application démarre par-dessus exactement comme
 * avant — seul le <head> initial change. Aucune dépendance ajoutée, aucun navigateur à installer :
 * du remplacement de chaînes dans un gabarit, en Node.
 *
 * CE QU'IL NE FAIT PAS. Le <body> reste vide jusqu'à l'exécution du JavaScript. Rendre le corps
 * demanderait un navigateur sans écran à la construction (le contenu des pages vient de l'API, via
 * des effets React qu'un rendu de chaîne n'exécute pas). C'est l'étape suivante possible ; celle-ci
 * couvre déjà les aperçus sociaux et donne aux moteurs les métadonnées sans attendre le second
 * passage.
 *
 * LES TEXTES VIENNENT DES MÊMES CLÉS QUE L'APPLICATION (src/i18n/translations.js) et les données
 * structurées des mêmes fonctions (src/seo/jsonLd.js), qui sont pures et sans DOM précisément pour
 * cet usage. Il ne peut donc pas y avoir deux versions d'un même titre.
 *
 * LES FICHES DE COMMERCE sont tirées de l'API publique à la construction. Si l'API ne répond pas,
 * le script continue sans elles plutôt que de casser le déploiement, et le dit clairement dans la
 * sortie. Le sitemap est écrit dans la foulée : c'est la seule façon d'y faire figurer les fiches,
 * qui manquaient jusqu'ici (voir le commentaire de l'ancien public/sitemap.xml).
 */
import { readFile, writeFile, mkdir } from 'node:fs/promises';
import { existsSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

import { translations, DEFAULT_LANGUAGE, SUPPORTED_LANGUAGES } from '../src/i18n/translations.js';
import { cheminLocalise, HREFLANG } from '../src/i18n/routing.js';
import {
  SITE_URL, organizationJsonLd, restaurantJsonLd, restaurantListJsonLd, breadcrumbJsonLd, faqJsonLd
} from '../src/seo/jsonLd.js';

const RACINE = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const DIST = path.join(RACINE, 'dist');
const API = process.env.VITE_API_BASE || 'https://fairide-backend-production.up.railway.app/api';
const MAX_DESCRIPTION = 160;
const OG_LOCALE = { fr: 'fr_BE', nl: 'nl_BE', en: 'en_GB' };

// Même troncature que usePageMeta : au-delà de 160 caractères Google coupe l'extrait, autant couper
// nous-mêmes sur un mot entier. Les deux doivent donner le même résultat, sinon le document servi et
// le document hydraté annonceraient deux descriptions différentes.
function tronquer(texte) {
  if (!texte) return undefined;
  const plat = String(texte).replace(/\s+/g, ' ').trim();
  if (plat.length <= MAX_DESCRIPTION) return plat;
  const coupe = plat.slice(0, MAX_DESCRIPTION - 1);
  return `${coupe.slice(0, coupe.lastIndexOf(' ')).trimEnd()}…`;
}

// Même repli que t() côté application : la langue demandée, puis le français, puis la clé. Une
// traduction manquante ne doit pas produire une page vide, ni surtout un titre vide.
function cle(chemin, langue = DEFAULT_LANGUAGE) {
  const lire = (dico) => chemin.split('.').reduce((o, k) => (o == null ? undefined : o[k]), dico);
  return lire(translations[langue]) ?? lire(translations[DEFAULT_LANGUAGE]) ?? chemin;
}

function remplir(gabarit, valeurs) {
  return gabarit.replace(/\{(\w+)\}/g, (m, k) => (valeurs[k] != null ? String(valeurs[k]) : m));
}

// Échappement pour le contenu d'un attribut HTML. Un nom de commerce peut contenir une apostrophe
// ou un guillemet ; sans cela il refermerait l'attribut et casserait le document.
function attr(texte) {
  return String(texte)
    .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;').replace(/'/g, '&#39;');
}

// Les pages publiques statiques. Le titre et la description sont lus dans les mêmes clés que la
// page elle-même passe à usePageMeta : toute modification de texte suit automatiquement.
const PAGES = [
  {
    chemin: '/',
    titre: null,
    description: 'seo.homeDescription',
    jsonLd: () => [{ id: 'ld-organization', donnees: organizationJsonLd() }]
  },
  {
    chemin: '/restaurants',
    titre: 'restoListUi.pageTitle',
    description: 'seo.listDescription',
    jsonLd: ({ commerces, langue }) => [
      { id: 'ld-list', donnees: restaurantListJsonLd(commerces, { url: `${SITE_URL}${cheminLocalise('/restaurants', langue)}` }) },
      {
        id: 'ld-breadcrumb',
        donnees: breadcrumbJsonLd([
          { name: 'Fairide', path: cheminLocalise('/', langue) },
          { name: cle('restoListUi.heading', langue), path: cheminLocalise('/restaurants', langue) }
        ])
      }
    ]
  },
  {
    chemin: '/notre-histoire',
    titre: 'story.pageTitle',
    description: 'story.metaDescription',
    jsonLd: ({ langue }) => [
      { id: 'ld-faq', donnees: faqJsonLd([1, 2, 3, 4].map((n) => ({ question: cle(`story.faqQ${n}`, langue), answer: cle(`story.faqA${n}`, langue) }))) },
      {
        id: 'ld-breadcrumb',
        donnees: breadcrumbJsonLd([
          { name: 'Fairide', path: cheminLocalise('/', langue) },
          { name: cle('story.h1', langue), path: cheminLocalise('/notre-histoire', langue) }
        ])
      }
    ]
  },
  { chemin: '/aide', titre: 'help.pageTitle', description: 'seo.homeDescription' },
  { chemin: '/mentions-legales', titre: 'legalNotice.pageTitle' },
  { chemin: '/confidentialite', titre: 'privacy.pageTitle' },
  { chemin: '/cgv', titre: 'terms.pageTitle' },
  { chemin: '/cookies', titre: 'cookiesPolicy.pageTitle' }
];

// Remplace une balise si elle existe, l'ajoute avant </head> sinon. Le gabarit d'index.html ne les
// porte pas toutes (og:locale, twitter:url), et une balise manquante ne doit pas faire retomber la
// page sur les métadonnées de l'accueil.
function poser(html, motif, balise) {
  return motif.test(html) ? html.replace(motif, balise) : html.replace('</head>', `    ${balise}\n  </head>`);
}

/* Le plan des langues, servi dans le document. Les trois versions se déclarent mutuellement, et
   chacune se déclare elle-même : une page qui s'omet de sa propre liste invalide le groupe entier
   pour Google. x-default désigne le français, à la racine — c'est ce qui rend légitime le fait
   qu'il n'ait pas de préfixe /fr/. */
function liensDeLangue(cheminApplicatif) {
  const liens = SUPPORTED_LANGUAGES.map((lang) =>
    `<link rel="alternate" hreflang="${HREFLANG[lang] || lang}" href="${SITE_URL}${cheminLocalise(cheminApplicatif, lang)}" />`);
  liens.push(`<link rel="alternate" hreflang="x-default" href="${SITE_URL}${cheminLocalise(cheminApplicatif, DEFAULT_LANGUAGE)}" />`);
  return liens.join('\n    ');
}

function documentPour(gabarit, { titre, description, url, image, type = 'website', blocs = [], langue = DEFAULT_LANGUAGE, cheminApplicatif = '/' }) {
  let html = gabarit;
  // index.html porte lang="fr" en dur : la version néerlandaise s'annoncerait comme française, ce
  // que les lecteurs d'écran comme les moteurs prennent au mot.
  html = html.replace(/<html lang="[^"]*"/, `<html lang="${langue}"`);
  html = html.replace(/<title>[\s\S]*?<\/title>/, `<title>${attr(titre)}</title>`);
  html = poser(html, /<meta property="og:locale"[^>]*>/, `<meta property="og:locale" content="${OG_LOCALE[langue] || 'fr_BE'}" />`);
  html = html.replace('</head>', `    ${liensDeLangue(cheminApplicatif)}\n  </head>`);
  html = poser(html, /<link rel="canonical"[^>]*>/, `<link rel="canonical" href="${attr(url)}" />`);
  if (description) {
    html = poser(html, /<meta name="description"[^>]*>/, `<meta name="description" content="${attr(description)}" />`);
    html = poser(html, /<meta property="og:description"[^>]*>/, `<meta property="og:description" content="${attr(description)}" />`);
    html = poser(html, /<meta name="twitter:description"[^>]*>/, `<meta name="twitter:description" content="${attr(description)}" />`);
  }
  html = poser(html, /<meta property="og:title"[^>]*>/, `<meta property="og:title" content="${attr(titre)}" />`);
  html = poser(html, /<meta name="twitter:title"[^>]*>/, `<meta name="twitter:title" content="${attr(titre)}" />`);
  html = poser(html, /<meta property="og:url"[^>]*>/, `<meta property="og:url" content="${attr(url)}" />`);
  html = poser(html, /<meta property="og:type"[^>]*>/, `<meta property="og:type" content="${attr(type)}" />`);
  if (image) html = poser(html, /<meta property="og:image"[^>]*>/, `<meta property="og:image" content="${attr(image)}" />`);
  if (image) html = poser(html, /<meta name="twitter:image"[^>]*>/, `<meta name="twitter:image" content="${attr(image)}" />`);

  // CHAQUE BLOC REPREND L'ID QUE LUI DONNE LA PAGE CÔTÉ CLIENT, et ce n'est pas cosmétique :
  // useJsonLd fait `document.getElementById(id)?.remove()` avant d'insérer le sien. Avec le même id,
  // le bloc servi est donc remplacé à l'hydratation ; avec un id différent, les deux coexisteraient
  // et le document annoncerait deux FAQPage ou deux Restaurant, cas où Google n'en retient aucun.
  // Les ids sont ceux de RestaurantList.jsx, RestaurantMenu.jsx, Landing.jsx et OurStory.jsx.
  const utiles = blocs.filter((b) => b && b.donnees);
  if (utiles.length) {
    const scripts = utiles
      .map((b) => `<script type="application/ld+json" id="${b.id}">${JSON.stringify(b.donnees)}</script>`)
      .join('\n    ');
    html = html.replace('</head>', `    ${scripts}\n  </head>`);
  }
  return html;
}

async function ecrire(chemin, html) {
  const dossier = chemin === '/' ? DIST : path.join(DIST, chemin.replace(/^\//, ''));
  await mkdir(dossier, { recursive: true });
  await writeFile(path.join(dossier, 'index.html'), html, 'utf8');
}

async function commercesPublics() {
  try {
    const reponse = await fetch(`${API}/restaurants`, { headers: { accept: 'application/json' } });
    if (!reponse.ok) throw new Error(`HTTP ${reponse.status}`);
    const donnees = await reponse.json();
    const liste = Array.isArray(donnees) ? donnees : (donnees?.restaurants || []);
    return liste.filter((r) => r && r.id);
  } catch (e) {
    // Un déploiement ne doit pas échouer parce que l'API dort : les pages statiques valent d'être
    // publiées seules, et les fiches seront reprises au déploiement suivant.
    console.warn(`[prerender] fiches de commerce ignorées, l'API n'a pas répondu : ${e.message}`);
    return null;
  }
}

function sitemap(entrees) {
  const jour = new Date().toISOString().slice(0, 10);
  const urls = entrees.map(({ chemin, cheminApplicatif, priorite, frequence, date }) => {
    // Les alternates dans le plan du site disent la même chose que les balises hreflang du
    // document. Les deux ensemble, c'est ce que Google demande pour un site multilingue : le plan
    // fait découvrir les trois adresses, les balises disent qu'elles n'en font qu'une.
    const alternates = SUPPORTED_LANGUAGES.map((lang) =>
      `    <xhtml:link rel="alternate" hreflang="${HREFLANG[lang] || lang}" href="${SITE_URL}${cheminLocalise(cheminApplicatif, lang)}" />`).join('\n');
    return [
      '  <url>',
      `    <loc>${SITE_URL}${chemin}</loc>`,
      alternates,
      `    <lastmod>${date || jour}</lastmod>`,
      `    <changefreq>${frequence}</changefreq>`,
      `    <priority>${priorite}</priority>`,
      '  </url>'
    ].join('\n');
  }).join('\n');
  return `<?xml version="1.0" encoding="UTF-8"?>
<!-- Produit par scripts/prerender.mjs à chaque construction. Ne pas modifier à la main : les fiches
     de commerce sont tirées de l'API au moment du build, et toute retouche serait écrasée. -->
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9" xmlns:xhtml="http://www.w3.org/1999/xhtml">
${urls}
</urlset>
`;
}

async function principal() {
  const gabaritChemin = path.join(DIST, 'index.html');
  if (!existsSync(gabaritChemin)) {
    console.error('[prerender] dist/index.html est absent : lancer `vite build` avant.');
    process.exit(1);
  }
  const gabarit = await readFile(gabaritChemin, 'utf8');
  const commerces = await commercesPublics();
  const ctx = { commerces: commerces || [] };
  const entrees = [];

  // Chaque page existe dans les trois langues, à trois adresses distinctes (voir
  // src/i18n/routing.js). C'est tout l'objet de l'adressage par langue : sans cela, les versions
  // néerlandaise et anglaise n'étaient explorables nulle part.
  for (const langue of SUPPORTED_LANGUAGES) {
    for (const page of PAGES) {
      const chemin = cheminLocalise(page.chemin, langue);
      const titre = cle(page.titre || 'seo.defaultTitle', langue);
      const description = page.description ? tronquer(cle(page.description, langue)) : undefined;
      const html = documentPour(gabarit, {
        langue,
        cheminApplicatif: page.chemin,
        titre,
        description,
        url: `${SITE_URL}${chemin}`,
        blocs: page.jsonLd ? page.jsonLd({ ...ctx, langue }) : []
      });
      await ecrire(chemin, html);
      entrees.push({
        chemin,
        cheminApplicatif: page.chemin,
        priorite: page.chemin === '/' ? '1.0' : page.chemin === '/restaurants' ? '0.9' : page.chemin === '/notre-histoire' ? '0.8' : '0.4',
        frequence: page.chemin === '/restaurants' ? 'daily' : page.chemin === '/' ? 'weekly' : 'monthly'
      });
    }
  }

  let fiches = 0;
  for (const langue of SUPPORTED_LANGUAGES) {
    for (const r of commerces || []) {
      const applicatif = `/restaurants/${r.id}`;
      const chemin = cheminLocalise(applicatif, langue);
      const commune = r.commune || r.city || 'Bruxelles';
      // La virgule du gabarit reste orpheline quand la cuisine n'est pas renseignée
      // (« Chez Pierre, à Ixelles · Fairide ») : on la referme plutôt que de publier la faute.
      const titre = remplir(cle('seo.restaurantTitle', langue), { name: r.name, cuisine: r.cuisine || '', commune })
        .replace(/,\s+(?=à |in |te )/, ' ').replace(/\s{2,}/g, ' ').trim();
      const description = tronquer(remplir(cle('seo.restaurantDescription', langue), { name: r.name, commune }));
      const html = documentPour(gabarit, {
        langue,
        cheminApplicatif: applicatif,
        titre,
        description,
        url: `${SITE_URL}${chemin}`,
        image: r.imageUrl || r.image || undefined,
        blocs: [
          { id: 'ld-restaurant', donnees: restaurantJsonLd(r, { url: `${SITE_URL}${chemin}` }) },
          {
            id: 'ld-breadcrumb',
            donnees: breadcrumbJsonLd([
              { name: 'Fairide', path: cheminLocalise('/', langue) },
              { name: cle('restoListUi.heading', langue), path: cheminLocalise('/restaurants', langue) },
              { name: r.name, path: chemin }
            ])
          }
        ]
      });
      await ecrire(chemin, html);
      entrees.push({ chemin, cheminApplicatif: applicatif, priorite: '0.7', frequence: 'weekly' });
      fiches += 1;
    }
  }

  await writeFile(path.join(DIST, 'sitemap.xml'), sitemap(entrees), 'utf8');
  console.log(`[prerender] ${PAGES.length} pages publiques × ${SUPPORTED_LANGUAGES.length} langues + ${fiches} fiches, sitemap de ${entrees.length} adresses.`);
}

principal().catch((e) => {
  console.error('[prerender]', e);
  process.exit(1);
});
