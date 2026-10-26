/* LE TEXTE DES PAGES PUBLIQUES, LISIBLE SANS JAVASCRIPT (fondateur, 2026-10-22, seo-a-faire.md, point 1).
 *
 * LE CONSTAT. Le pré-rendu (prerender.mjs) posait le <head> de chaque page, mais son <body> restait vide jusqu'à
 * l'exécution du JavaScript : sans lui, chaque page du site disait la même chose, « fairide Le chargement prend plus de
 * temps que prévu. Recharger la page » (70 caractères, relevé le 2026-10-22). Google exécute le JavaScript et voit la vraie
 * page ; Bing le fait mal (il recommande de servir du HTML déjà rendu), Brave encore moins, et les assistants qui lisent les
 * pages pour répondre pas du tout. Résultat le même jour : Bing n'avait indexé aucune page de fairride.be, Brave non plus.
 *
 * CE QUE ÇA FAIT. Pour chaque page pré-rendue, une version simple de SON contenu (titres, textes, liste des commerces avec
 * leurs liens, adresse et carte de chaque commerce, histoire et FAQ) est écrite dans <div id="root">. Mêmes textes que la
 * page (mêmes clés de traduction, mêmes données de l'API) : ce n'est pas un contenu réservé aux robots, Bing le dit
 * explicitement acceptable. React remplace ce bloc à son premier rendu ; d'ici là l'écran de chargement le couvre, et
 * main.jsx attend qu'il ait disparu (`data-prerendu`) avant de retirer l'écran — sinon le visiteur verrait une fraction de
 * seconde ce texte sans mise en forme.
 *
 * PAS DE NAVIGATEUR À LA CONSTRUCTION : des gabarits de chaînes, comme le <head>. Pas de classes CSS du site non plus :
 * scripts/verifier-appli.mjs guette ces classes pendant le chargement de l'app et y verrait un « flash » du site. */
import { cheminLocalise } from '../src/i18n/routing.js';
import { BLOCS_HISTOIRE, QUESTIONS_HISTOIRE } from '../src/seo/contenuHistoire.js';
import { cheminFiche } from '../src/adresseFiche.js';

const LOCALES = { fr: 'fr-BE', nl: 'nl-BE', en: 'en-BE' };
const LANGUES = { fr: 'Français', nl: 'Nederlands', en: 'English' };

// Échappement du texte et des attributs (un nom de commerce peut contenir < & " ').
export function html(texte) {
  return String(texte ?? '')
    .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;').replace(/'/g, '&#39;');
}

// La mise en forme de Rich.jsx (**gras**, *italique*, [libellé](cible)) réduite à son texte, puis échappée.
function texte(brut) {
  return html(String(brut ?? '').replace(/\*\*([^*]+)\*\*/g, '$1').replace(/\*([^*]+)\*/g, '$1').replace(/\[([^\]]+)\]\([^)]+\)/g, '$1'));
}

// « Aide · Fairide », « Restaurants en livraison à Bruxelles · Fairide » → le titre sans la marque, pour le h1.
const sansMarque = (titre) => String(titre || '').replace(/\s*[·|]\s*(fairr?ide(\.be)?)[^·|]*$/i, '').trim();

function prix(valeur, langue) {
  const n = Number(valeur);
  if (!Number.isFinite(n)) return '';
  return new Intl.NumberFormat(LOCALES[langue] || 'fr-BE', { style: 'currency', currency: 'EUR' }).format(n);
}

// Le cadre commun : la marque, trois liens de navigation, la page, les autres langues de la même page.
function cadre({ t, langue, cheminApplicatif, contenu }) {
  const lien = (chemin) => html(cheminLocalise(chemin, langue));
  const langues = Object.keys(LANGUES)
    .map((l) => `<a href="${html(cheminLocalise(cheminApplicatif, l))}" hreflang="${l}" lang="${l}">${LANGUES[l]}</a>`)
    .join(' · ');
  return `<div data-prerendu>
      <header><a href="${lien('/')}">fairride</a>
        <nav><a href="${lien('/restaurants')}">${texte(t('nav.restaurants'))}</a> · <a href="${lien('/notre-histoire')}">${texte(t('story.title'))}</a> · <a href="${lien('/aide')}">${texte(t('nav.help'))}</a></nav>
      </header>
      <main>
${contenu}
      </main>
      <footer><nav>${langues}</nav></footer>
    </div>`;
}

function listeCommerces(commerces, { t, langue }) {
  if (!commerces.length) return '';
  const lignes = commerces.map((r) => {
    const details = [r.cuisine, r.commune].filter(Boolean).map(texte).join(' · ');
    return `          <li><a href="${html(cheminLocalise(cheminFiche(r), langue))}">${texte(r.name)}</a>${details ? ` — ${details}` : ''}</li>`;
  }).join('\n');
  return `        <h2>${texte(t('restoListUi.heading'))}</h2>\n        <ul>\n${lignes}\n        </ul>`;
}

export function corpsAccueil({ t, langue, commerces }) {
  const contenu = [
    `        <h1>${texte(t('landing.titreAccueil1'))} ${texte(t('landing.titreAccueil2'))}</h1>`,
    `        <p>${texte(t('landing.subAdresse'))}</p>`,
    `        <h2>${texte(t('landing.altTitre'))}</h2>\n        <p>${texte(t('landing.sub'))}</p>`,
    `        <h2>${texte(t('landing.featureLocalTitle'))}</h2>\n        <p>${texte(t('landing.featureLocalText'))}</p>`,
    `        <h2>${texte(t('landing.featureFairTitle'))}</h2>\n        <p>${texte(t('landing.featureFairText'))}</p>`,
    listeCommerces(commerces, { t, langue })
  ].filter(Boolean).join('\n');
  return cadre({ t, langue, cheminApplicatif: '/', contenu });
}

export function corpsListe({ t, langue, commerces }) {
  const contenu = [
    `        <h1>${texte(t('restoListUi.heading'))}</h1>`,
    `        <p>${texte(t('seo.listDescription'))}</p>`,
    listeCommerces(commerces, { t, langue })
  ].filter(Boolean).join('\n');
  return cadre({ t, langue, cheminApplicatif: '/restaurants', contenu });
}

// La fiche : nom, cuisine et commune, description, adresse, puis la carte rangée par catégorie, dans l'ordre de l'API.
// Les plats indisponibles ou retirés n'y figurent pas, comme sur la page.
export function corpsFiche({ t, langue, commerce: r }) {
  const plats = (r.menu || []).filter((m) => m && m.name && m.available !== false && !m.withdrawn);
  const categories = new Map();
  for (const m of plats) {
    const c = m.category || '';
    if (!categories.has(c)) categories.set(c, []);
    categories.get(c).push(m);
  }
  const carte = [...categories.entries()].map(([categorie, liste]) => {
    const lignes = liste.map((m) => `          <li>${texte(m.name)} — ${html(prix(m.price, langue))}${m.desc ? `<br>${texte(m.desc)}` : ''}</li>`).join('\n');
    return `${categorie ? `        <h3>${texte(categorie)}</h3>\n` : ''}        <ul>\n${lignes}\n        </ul>`;
  }).join('\n');
  const contenu = [
    `        <h1>${texte(r.name)}</h1>`,
    `        <p>${[r.cuisine, r.commune].filter(Boolean).map(texte).join(' · ')}</p>`,
    r.desc ? `        <p>${texte(r.desc)}</p>` : '',
    // Espace avant les deux-points en français seulement.
    r.address ? `        <p>${texte(t('restaurantMenu.addressLabel'))}${langue === 'fr' ? ' :' : ':'} ${texte(r.address)}</p>` : '',
    plats.length ? `        <h2>${texte(t('seo.carteStatique'))}</h2>\n${carte}` : '',
    `        <p><a href="${html(cheminLocalise('/restaurants', langue))}">${texte(t('restaurantMenu.backToRestaurants'))}</a></p>`
  ].filter(Boolean).join('\n');
  return cadre({ t, langue, cheminApplicatif: cheminFiche(r), contenu });
}

export function corpsHistoire({ t, langue }) {
  const blocs = BLOCS_HISTOIRE.map(([cle, forme, n]) => {
    const titre = `        <h2>${texte(t(`story.${cle}Title`))}</h2>`;
    if (forme === 'p') return `${titre}\n        <p>${texte(t(`story.${cle}`))}</p>`;
    const items = Array.from({ length: n }, (_, k) => `          <li>${texte(t(`story.${cle}${k + 1}`))}</li>`).join('\n');
    return `${titre}\n        <ul>\n${items}\n        </ul>`;
  }).join('\n');
  const faq = QUESTIONS_HISTOIRE.map((n) => `        <h3>${texte(t(`story.faqQ${n}`))}</h3>\n        <p>${texte(t(`story.faqA${n}`))}</p>`).join('\n');
  const contenu = [
    `        <h1>${texte(t('story.h1'))}</h1>`,
    `        <p>${texte(t('story.intro'))}</p>`,
    blocs,
    `        <h2>${texte(t('story.faqTitle'))}</h2>`,
    faq
  ].join('\n');
  return cadre({ t, langue, cheminApplicatif: '/notre-histoire', contenu });
}

// Les autres pages (aide, connexion, pages légales…) : leur titre et leur description, et la navigation. Leur texte complet
// n'apporte rien à la recherche ; ce qui compte est qu'elles ne disent plus toutes « Le chargement prend plus de temps ».
export function corpsSimple({ t, langue, cheminApplicatif, titre, description }) {
  const contenu = [
    `        <h1>${html(sansMarque(titre))}</h1>`,
    description ? `        <p>${html(description)}</p>` : ''
  ].filter(Boolean).join('\n');
  return cadre({ t, langue, cheminApplicatif, contenu });
}
