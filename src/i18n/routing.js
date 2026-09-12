/* Adressage par langue : /… en français, /nl/… en néerlandais, /en/… en anglais.
 *
 * POURQUOI. Le sélecteur de langue échangeait les textes sur PLACE, à adresse constante : les trois
 * versions du site partageaient une seule URL. Pour un moteur de recherche, il n'existait donc qu'une
 * seule page, en français — les versions néerlandaise et anglaise n'étaient indexables nulle part,
 * dans une ville où la moitié des recherches se font en néerlandais. Elles existent maintenant comme
 * des adresses distinctes, explorables chacune pour elle-même, et reliées entre elles par des
 * balises hreflang (voir usePageMeta).
 *
 * POURQUOI LE FRANÇAIS RESTE À LA RACINE, et non /fr/. Le site est déjà indexé sous ses adresses
 * actuelles. Les déplacer toutes vers /fr/ imposerait une redirection permanente sur chaque page
 * existante, et ferait repartir leur historique à zéro pour un gain nul : une langue par défaut à la
 * racine est un schéma que Google documente et traite exactement comme les autres, à condition
 * qu'elle soit déclarée en x-default. C'est ce que fait usePageMeta.
 *
 * COMMENT, SANS TOUCHER AUX 156 LIENS DE L'APPLICATION. Le préfixe est passé en `basename` à
 * BrowserRouter (voir main.jsx). React Router le retire de ce que lisent les composants et le
 * remet devant chaque `to` : `<Link to="/restaurants">` mène à /restaurants en français et à
 * /nl/restaurants en néerlandais, sans qu'aucun appel ne change. C'est aussi pour cela que les
 * comparaisons de chemin déjà en place (`location.pathname === '/'` dans Layout.jsx, la liste
 * DASHBOARD_PATHS, ProtectedRoute) continuent de fonctionner mot pour mot : elles voient toujours
 * le chemin sans préfixe.
 */
// Extension explicite : ce module est aussi importé par scripts/prerender.mjs, exécuté par Node,
// qui n'invente pas les extensions manquantes comme le fait Vite.
import { SUPPORTED_LANGUAGES, DEFAULT_LANGUAGE } from './translations.js';

// Le français n'a pas de préfixe : il EST la racine.
export const PREFIXES = { fr: '', nl: '/nl', en: '/en' };

// Correspondance hreflang. Le Belgique dans les trois cas : c'est un site bruxellois, et un
// néerlandophone des Pays-Bas n'est pas la cible — mais nl-BE le couvre quand même, hreflang
// étant une préférence, pas un filtre.
export const HREFLANG = { fr: 'fr-BE', nl: 'nl-BE', en: 'en-BE' };

/* Lit la langue dans l'adresse. Renvoie aussi le basename à donner au routeur, qui vaut '/' en
   français — BrowserRouter n'accepte pas la chaîne vide. */
export function langueDepuisChemin(pathname) {
  const segment = (pathname || '/').split('/')[1];
  const langue = SUPPORTED_LANGUAGES.includes(segment) && segment !== DEFAULT_LANGUAGE ? segment : DEFAULT_LANGUAGE;
  return { langue, basename: PREFIXES[langue] || '/' };
}

/* Retire le préfixe de langue d'un chemin complet, pour obtenir le chemin « applicatif » — celui
   que les composants manipulent et que usePageMeta reçoit. */
export function cheminSansPrefixe(pathname) {
  const { langue } = langueDepuisChemin(pathname);
  const prefixe = PREFIXES[langue];
  if (!prefixe) return pathname || '/';
  const reste = pathname.slice(prefixe.length);
  return reste.startsWith('/') ? reste : `/${reste}`;
}

/* Chemin complet d'une page dans une langue donnée. `/` en néerlandais donne `/nl`, et non `/nl/` :
   les deux fonctionnent, mais une seule doit figurer dans les canonical et le plan du site, sans
   quoi Google voit deux adresses pour une même page. */
export function cheminLocalise(chemin, langue) {
  const prefixe = PREFIXES[langue] || '';
  const propre = chemin === '/' ? '' : chemin;
  return `${prefixe}${propre}` || '/';
}

/* La préférence de langue reste mémorisée, mais elle ne décide plus de ce qui s'affiche : l'adresse
   décide, toujours. Elle ne sert qu'à une chose, aiguiller un visiteur qui revient par la racine
   sans préfixe (voir main.jsx). Un robot n'a pas de stockage, il n'est donc jamais redirigé et voit
   bien le français à la racine — c'est ce qui permet de garder cette commodité sans brouiller
   l'indexation. */
export const STORAGE_KEY = 'fairide_language';

export function languePreferee() {
  try {
    const stockee = localStorage.getItem(STORAGE_KEY);
    if (stockee && SUPPORTED_LANGUAGES.includes(stockee)) return stockee;
  } catch { /* stockage indisponible */ }
  return null;
}

export function memoriserLangue(langue) {
  try { localStorage.setItem(STORAGE_KEY, langue); } catch { /* stockage indisponible */ }
}

export { SUPPORTED_LANGUAGES, DEFAULT_LANGUAGE };
