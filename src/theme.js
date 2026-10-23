/* LE MODE SOMBRE DE L'APPLICATION (fondateur, 2026-10-23, version C « Tout en nuit » de maquettes/mode-sombre/mode-sombre.html).
 *
 * Trois choix, dans Mon compte › Apparence : « auto » (par défaut : suit le réglage du téléphone), « clair », « sombre ».
 * Le choix vit sur l'appareil (localStorage), comme le réglage du téléphone qu'il remplace. Il ne vaut que dans l'app
 * (native ou site ajouté à l'écran d'accueil, html.appli) : le site reste clair (fondateur, même jour).
 *
 * En sombre, <html> porte la classe `sombre` ; les couleurs sont dans theme-sombre.css (jetons et fonds écrits en dur).
 * Appelé avant le premier rendu (main.jsx, juste après garderLesLiensDansLApp qui pose html.appli) : pas d'éclair blanc.
 *
 * « auto » dans l'app native : il faut que le téléphone dise à la vue web s'il est en sombre. Jusqu'au 2026-10-23 l'app
 * était bloquée en clair (Info.plist UIUserInterfaceStyle = Light, thème Android Light) ; ces deux réglages suivent
 * maintenant le téléphone. Une app installée avant cette version reste en clair en « auto » jusqu'à sa mise à jour. */

const CLE = 'fairide_theme';
export const CHOIX_THEME = ['auto', 'clair', 'sombre'];
// Le fond de nuit (le fond de l'icône sombre) : barre d'état, theme-color.
export const NUIT = '#15113A';

export function choixTheme() {
  try {
    const v = localStorage.getItem(CLE);
    return CHOIX_THEME.includes(v) ? v : 'auto';
  } catch { return 'auto'; }
}

const telephoneSombre = () => {
  try { return window.matchMedia?.('(prefers-color-scheme: dark)').matches === true; } catch { return false; }
};

// L'écran « Clair ou sombre ? » de l'arrivée (ChoixApparenceArrivee.jsx) montre un choix avant qu'il soit enregistré.
let apercu = null;

// Le client a-t-il déjà choisi (là ou dans Mon compte) ? Sinon, l'écran de l'arrivée le lui demande une fois.
export function themeChoisi() {
  try { return localStorage.getItem(CLE) !== null; } catch { return true; }
}

function appliquer() {
  const html = document.documentElement;
  const choix = apercu || choixTheme();
  const sombre = html.classList.contains('appli') && (choix === 'sombre' || (choix === 'auto' && telephoneSombre()));
  if (sombre === html.classList.contains('sombre')) return;
  html.classList.toggle('sombre', sombre);
  // La couleur que le système peint autour de la page (barre d'état de l'écran d'accueil, haut de l'écran en défilant).
  document.querySelector('meta[name="theme-color"]')?.setAttribute('content', sombre ? NUIT : '#3B2FB5');
  window.dispatchEvent(new CustomEvent('fairide:theme', { detail: { sombre } }));
}

export function definirTheme(choix) {
  try { localStorage.setItem(CLE, CHOIX_THEME.includes(choix) ? choix : 'auto'); } catch { /* stockage bloqué */ }
  apercu = null;
  appliquer();
}

// Montre `choix` sans l'enregistrer ; null revient au choix enregistré.
export function apercuTheme(choix) {
  apercu = CHOIX_THEME.includes(choix) ? choix : null;
  appliquer();
}

export const estSombre = () => document.documentElement.classList.contains('sombre');

export function suivreTheme() {
  appliquer();
  try { window.matchMedia?.('(prefers-color-scheme: dark)').addEventListener('change', appliquer); } catch { /* ancien navigateur */ }
  // Un autre onglet (écran d'accueil + navigateur) a changé le choix.
  window.addEventListener('storage', (e) => { if (e.key === CLE) appliquer(); });
}
