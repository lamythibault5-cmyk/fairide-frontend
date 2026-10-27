/* Chargement des tables de traductions, une langue à la fois.
 *
 * POURQUOI CE FICHIER A CHANGÉ DE NATURE. Il portait les trois langues dans un seul objet, soit
 * 21 582 lignes et 1,3 Mo de source. Vite ne peut pas découper un module : LanguageContext l'importe
 * au premier rendu, donc tout partait d'un bloc. Mesuré en production le 2026-09-19 sur la page
 * d'accueil : 374 Ko transférés rien que pour ce morceau, sur 638 Ko de chemin critique — 59 % du
 * transfert et 55 % du JavaScript à analyser, pour afficher UNE langue. Sur une connexion moyenne,
 * c'est plusieurs secondes d'écran de chargement, et c'est ce qui avait été signalé comme « bloqué
 * sur l'animation ».
 *
 * CE QUI SE PASSE MAINTENANT. Le français est importé statiquement : c'est la langue par défaut, la
 * table de repli de `t()`, et celle dont on a besoin avant le premier pixel — la charger à la demande
 * ajouterait un aller-retour là où il coûte le plus cher. Le néerlandais et l'anglais partent dans
 * leurs propres morceaux, chargés par `import()` seulement si quelqu'un les demande.
 *
 * LE FRANÇAIS LUI-MÊME EST COUPÉ EN DEUX (audit du 27/10/2026). Statiquement, seulement `fr-base` : les
 * espaces des pages du premier chargement (accueil, liste, fiche). Le reste — console, tableaux de bord,
 * textes légaux — arrive par `chargerSuite()` : en tâche de fond une fois la page affichée (LanguageContext),
 * au survol d'un lien (routePrefetch.js), et dans tous les cas avant qu'une page en `lazyPage` s'affiche
 * (lazyPage.js). Le découpage se fait à la construction, fr.js ne bouge pas : voir
 * scripts/vite-decoupe-traductions.mjs.
 *
 * `translations` RESTE UN OBJET, et c'est volontaire : usePageMeta, prerender.mjs et check-i18n.mjs
 * le lisent déjà comme tel. Il commence avec le seul français et se remplit à mesure. Un appelant qui
 * lit `translations.nl` avant chargement obtient `undefined` — c'est le cas que `t()` traite depuis
 * toujours en retombant sur le français (voir LanguageContext), donc rien de nouveau n'est à gérer.
 *
 * Attention à ne pas « optimiser » en important les trois statiquement pour simplifier : ce serait
 * revenir exactement à l'état d'avant, sans que rien ne le signale. */
import fr from './fr-base.js';

// Ordre d'affichage des sélecteurs de langue : les deux langues de Bruxelles d'abord, comme le site (audit design, 2026-10-19).
export const SUPPORTED_LANGUAGES = ['fr', 'nl', 'en'];
export const DEFAULT_LANGUAGE = 'fr';

// Tables chargées. Le français est là dès le départ ; les autres s'ajoutent après chargerLangue().
export const translations = { fr };

/* Les import() sont écrits en clair, un par langue, et non générés depuis une variable : Vite a
   besoin d'un chemin littéral pour savoir quels morceaux produire. Un `import('./' + langue + '.js')`
   compilerait, mais embarquerait TOUS les fichiers du dossier dans le graphe — le contraire du but.
   Le néerlandais et l'anglais sont coupés comme le français (audit du 27/10/2026) : `-base` à la demande de la langue,
   `-suite` avec celle du français. */
const CHARGEURS = {
  en: () => import('./en-base.js'),
  nl: () => import('./nl-base.js')
};
const SUITES = {
  fr: () => import('./fr-suite.js'),
  en: () => import('./en-suite.js'),
  nl: () => import('./nl-suite.js')
};

/* Une table vient d'arriver (une langue, ou la suite d'une langue) : LanguageContext s'abonne pour repasser un rendu, quel
   que soit celui qui l'a demandée. */
const abonnes = new Set();
export function ecouterTables(rappel) {
  abonnes.add(rappel);
  return () => abonnes.delete(rappel);
}
function signalerTable() {
  abonnes.forEach((rappel) => rappel());
}

/* LA SUITE D'UNE LANGUE. Ses espaces sont ajoutés à `translations[langue]` lui-même : `t()` et `traduire()` lisent la table
   au moment de l'appel, donc une clé arrivée se lit tout de suite. Hors construction (Node, développement), `-base` et
   `-suite` renvoient la même table entière : l'ajout ne change rien. */
const suites = {};
const suitesLa = new Set();
let suiteDemandee = false;
function chargerSuiteDe(langue) {
  if (suitesLa.has(langue)) return Promise.resolve();
  if (!suites[langue]) {
    suites[langue] = SUITES[langue]()
      .then((mod) => { Object.assign(translations[langue], mod.default); suitesLa.add(langue); signalerTable(); })
      .catch((err) => { delete suites[langue]; throw err; });
  }
  return suites[langue];
}

/* La suite du français, et celle de chaque langue demandée — y compris une langue encore en route : une page néerlandaise
   chargée à la demande ne doit pas s'afficher avec les textes de la suite en français.
   Contrairement à chargerLangue, un échec est RENDU à l'appelant : lazyPage le traite comme un morceau de code manquant
   (rechargement vers la nouvelle version), plutôt que d'afficher une page pleine de clés brutes. */
export function chargerSuite() {
  suiteDemandee = true;
  return Promise.all([
    chargerSuiteDe(DEFAULT_LANGUAGE),
    ...Object.keys(enCours).map((langue) => enCours[langue].then(() => (translations[langue] ? chargerSuiteDe(langue) : undefined)))
  ]);
}

// Chargements en cours, pour qu'un double appel (deux composants montés en même temps) ne déclenche
// pas deux téléchargements du même morceau.
const enCours = {};

/* Charge une langue si nécessaire. Rend la table, ou celle du français si la langue est inconnue.
   Ne lève jamais : une table qui n'arrive pas (réseau coupé au mauvais moment) doit dégrader vers le
   français, pas casser la page. Une langue demandée après la suite (changement de langue en cours de visite) arrive avec la
   sienne ; si celle-ci manque, `t()` retombe sur le français, comme pour une clé non traduite. */
export function chargerLangue(langue) {
  if (translations[langue]) return Promise.resolve(translations[langue]);
  const chargeur = CHARGEURS[langue];
  if (!chargeur) return Promise.resolve(translations[DEFAULT_LANGUAGE]);
  if (!enCours[langue]) {
    enCours[langue] = chargeur()
      .then((mod) => { translations[langue] = mod.default; signalerTable(); return mod.default; })
      .then((table) => (suiteDemandee ? chargerSuiteDe(langue).catch(() => {}).then(() => table) : table))
      .catch(() => {
        // On oublie la tentative ratée : un prochain changement de langue pourra réessayer.
        delete enCours[langue];
        return translations[DEFAULT_LANGUAGE];
      });
  }
  return enCours[langue];
}

// Vrai si la table est déjà en mémoire — permet d'éviter un rendu intermédiaire en français quand la
// langue demandée est déjà là (cas du changement de langue aller-retour).
export function langueChargee(langue) {
  return !!translations[langue];
}
