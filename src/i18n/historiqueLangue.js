/* Historique du routeur qui porte le préfixe de langue — pour changer de langue SANS recharger la page.
 *
 * POURQUOI. Avec `<BrowserRouter basename="/nl">`, le préfixe était figé au montage : changer de langue
 * imposait un rechargement complet, qui effaçait tout ce que le visiteur était en train de saisir
 * (inscription à moitié remplie, commande en cours) et le renvoyait en haut de la page.
 *
 * COMMENT. Cet historique joue le rôle du basename, mais avec un préfixe MODIFIABLE :
 *  - ce que lisent les composants (`location`) est toujours le chemin sans préfixe — `/restaurants`,
 *    que l'adresse soit /restaurants, /nl/restaurants ou /en/restaurants ;
 *  - ce qui part vers la barre d'adresse (`createHref`, `push`, `replace`) reçoit le préfixe courant,
 *    donc les 156 liens de l'application suivent la langue sans changer ;
 *  - `changerLangue` remplace l'adresse en place (replaceState) : même page, même état React, même
 *    défilement, seul le préfixe change. Les moteurs de recherche continuent de voir trois adresses.
 *
 * `encodeLocation` reste SANS préfixe : React Router s'en sert pour comparer un lien à la page courante
 * (NavLink actif), pas pour construire une adresse.
 *
 * Reprend le fonctionnement de createBrowserHistory de React Router 7 (index dans history.state, un seul
 * écouteur, notification immédiate en v5Compat), dont on ne peut pas remplacer la construction d'adresse.
 */
import { createPath, parsePath } from 'react-router-dom';
import { PREFIXES, cheminSansPrefixe, cheminLocalise, langueDepuisChemin, memoriserLangue } from './routing.js';

let prefixe = PREFIXES[langueDepuisChemin(window.location.pathname).langue] || '';
let langue = langueDepuisChemin(window.location.pathname).langue;

const globalHistory = window.history;
let action = 'POP';
let listener = null;
let index = getIndex();
if (index == null) {
  index = 0;
  globalHistory.replaceState({ ...globalHistory.state, idx: index }, '');
}

function getIndex() {
  return (globalHistory.state || { idx: null }).idx;
}

function cle() {
  return Math.random().toString(36).slice(2, 10);
}

function lireLocation() {
  const { pathname, search, hash } = window.location;
  const st = globalHistory.state;
  return {
    pathname: cheminSansPrefixe(pathname),
    search,
    hash,
    state: (st && st.usr) || null,
    key: (st && st.key) || 'default',
  };
}

function versLocation(to, state) {
  const courant = lireLocation();
  const cible = typeof to === 'string' ? parsePath(to) : to;
  return {
    pathname: courant.pathname,
    search: '',
    hash: '',
    ...cible,
    state: state === undefined ? null : state,
    key: (to && to.key) || cle(),
  };
}

// Préfixe ajouté aux seuls chemins absolus : un lien relatif (`?onglet=2`, `#avis`) se résout contre
// l'adresse courante, qui porte déjà le préfixe.
function avecPrefixe(to) {
  const chemin = typeof to === 'string' ? to : createPath(to);
  if (!prefixe || !chemin.startsWith('/') || chemin.startsWith('//')) return chemin;
  const p = parsePath(chemin);
  return createPath({ ...p, pathname: cheminLocalise(p.pathname || '/', langue) });
}

function etatHistorique(location, idx) {
  return { usr: location.state, key: location.key, idx };
}

// Retour arrière vers une page vue dans une autre langue : on reste dans la langue choisie par le
// visiteur et on corrige l'adresse en place, plutôt que de lui rebasculer l'interface sous les yeux.
function alignerAdresse() {
  const { pathname, search, hash } = window.location;
  if (langueDepuisChemin(pathname).langue === langue) return;
  globalHistory.replaceState(globalHistory.state, '', `${cheminLocalise(cheminSansPrefixe(pathname), langue)}${search}${hash}`);
}

function handlePop() {
  action = 'POP';
  alignerAdresse();
  const suivant = getIndex();
  const delta = suivant == null ? null : suivant - index;
  index = suivant;
  if (listener) listener({ action, location: historiqueLangue.location, delta });
}

const abonnes = new Set();

export const historiqueLangue = {
  get action() { return action; },
  get location() { return lireLocation(); },
  listen(fn) {
    if (listener) throw new Error('A history only accepts one active listener');
    window.addEventListener('popstate', handlePop);
    listener = fn;
    return () => { window.removeEventListener('popstate', handlePop); listener = null; };
  },
  createHref(to) { return avecPrefixe(to); },
  createURL(to) { return new URL(avecPrefixe(to), window.location.origin); },
  encodeLocation(to) {
    const url = new URL(typeof to === 'string' ? to : createPath(to), window.location.origin);
    return { pathname: url.pathname, search: url.search, hash: url.hash };
  },
  push(to, state) {
    action = 'PUSH';
    const location = versLocation(to, state);
    // Navigation déclenchée par un bouton (navigate()) : la barre de progression démarre aussi, pas seulement
    // sur un clic de lien (voir NavigationFeedback.jsx).
    if (location.pathname !== lireLocation().pathname) window.dispatchEvent(new Event('fairide:navigation'));
    index = (getIndex() ?? index) + 1;
    const url = avecPrefixe(location);
    try {
      globalHistory.pushState(etatHistorique(location, index), '', url);
    } catch (e) {
      if (e instanceof DOMException && e.name === 'DataCloneError') throw e;
      window.location.assign(url);
    }
    if (listener) listener({ action, location: historiqueLangue.location, delta: 1 });
  },
  replace(to, state) {
    action = 'REPLACE';
    const location = versLocation(to, state);
    index = getIndex() ?? index;
    globalHistory.replaceState(etatHistorique(location, index), '', avecPrefixe(location));
    if (listener) listener({ action, location: historiqueLangue.location, delta: 0 });
  },
  go(n) { return globalHistory.go(n); },
};

export function langueHistorique() { return langue; }

/* Change la langue en place : adresse réécrite (sans nouvelle entrée d'historique), préférence mémorisée.
   Aucun rechargement, aucune navigation du routeur — la page et ses champs restent tels quels. */
export function changerLangue(nouvelle) {
  if (!(nouvelle in PREFIXES) || nouvelle === langue) return;
  langue = nouvelle;
  prefixe = PREFIXES[nouvelle];
  memoriserLangue(nouvelle);
  const { pathname, search, hash } = window.location;
  globalHistory.replaceState(globalHistory.state, '', `${cheminLocalise(cheminSansPrefixe(pathname), nouvelle)}${search}${hash}`);
  abonnes.forEach((fn) => fn(nouvelle));
}

export function ecouterLangue(fn) {
  abonnes.add(fn);
  return () => abonnes.delete(fn);
}
