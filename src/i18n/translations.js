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
 * `translations` RESTE UN OBJET, et c'est volontaire : usePageMeta, prerender.mjs et check-i18n.mjs
 * le lisent déjà comme tel. Il commence avec le seul français et se remplit à mesure. Un appelant qui
 * lit `translations.nl` avant chargement obtient `undefined` — c'est le cas que `t()` traite depuis
 * toujours en retombant sur le français (voir LanguageContext), donc rien de nouveau n'est à gérer.
 *
 * Attention à ne pas « optimiser » en important les trois statiquement pour simplifier : ce serait
 * revenir exactement à l'état d'avant, sans que rien ne le signale. */
import fr from './fr.js';

export const SUPPORTED_LANGUAGES = ['fr', 'en', 'nl'];
export const DEFAULT_LANGUAGE = 'fr';

// Tables chargées. Le français est là dès le départ ; les autres s'ajoutent après chargerLangue().
export const translations = { fr };

/* Les import() sont écrits en clair, un par langue, et non générés depuis une variable : Vite a
   besoin d'un chemin littéral pour savoir quels morceaux produire. Un `import('./' + langue + '.js')`
   compilerait, mais embarquerait TOUS les fichiers du dossier dans le graphe — le contraire du but. */
const CHARGEURS = {
  en: () => import('./en.js'),
  nl: () => import('./nl.js')
};

// Chargements en cours, pour qu'un double appel (deux composants montés en même temps) ne déclenche
// pas deux téléchargements du même morceau.
const enCours = {};

/* Charge une langue si nécessaire. Rend la table, ou celle du français si la langue est inconnue.
   Ne lève jamais : une table qui n'arrive pas (réseau coupé au mauvais moment) doit dégrader vers le
   français, pas casser la page. */
export function chargerLangue(langue) {
  if (translations[langue]) return Promise.resolve(translations[langue]);
  const chargeur = CHARGEURS[langue];
  if (!chargeur) return Promise.resolve(translations[DEFAULT_LANGUAGE]);
  if (!enCours[langue]) {
    enCours[langue] = chargeur()
      .then((mod) => { translations[langue] = mod.default; return mod.default; })
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
