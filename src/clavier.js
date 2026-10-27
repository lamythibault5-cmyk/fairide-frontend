/* LE CHAMP RESTE AU-DESSUS DU CLAVIER (fondateur, 2026-10-27, test du commerce sur iPhone : « quand le clavier s'ouvre, il
 * cache ce que tu tapes, fais que ça n'arrive jamais » ; le champ « Ce que tu vends, en quelques mots » de la création du
 * commerce était sous les touches). App seulement, lancé par natif.js.
 *
 * Pourquoi c'est à nous de le faire : sur iPhone, le greffon Keyboard (mode « body » de capacitor.config.json) débranche la
 * vue web des notifications du clavier. WebKit ne fait donc plus ce qu'il fait dans Safari (remonter le champ touché au-dessus
 * des touches), et la page ne gagne aucune place en bas : un champ près du bas restait dessous, sans moyen de le remonter.
 *   - `--clavier` (hauteur du clavier) sur <html> et une cale de cette hauteur sous la page (styles.css, html.clavier-ouvert) :
 *     la page peut toujours défiler assez pour qu'un champ du bas passe au-dessus des touches ;
 *   - à l'ouverture du clavier, et à chaque champ suivant (flèches ‹ › de la barre du clavier), si le champ est caché (sous
 *     les touches ou sous le bandeau du haut), on le fait défiler au milieu de ce qui reste visible.
 * Android redimensionne lui-même la vue web et remonte le champ (adjustResize) : rien à faire là-bas.
 *
 * LA BARRE AU-DESSUS DU CLAVIER (même jour) : ‹ › pour passer au champ suivant et « OK » pour fermer le clavier, celle de
 * Safari. Le greffon la masque d'office ; on la remet, un champ sans moyen visible de fermer le clavier laissait coincé. */
import { defilement } from './gestes';

const CHAMPS = 'input:not([type=checkbox]):not([type=radio]):not([type=range]):not([type=button]):not([type=submit]):not([type=file]), textarea, select, [contenteditable=""], [contenteditable="true"]';
// Sous la barre d'état et le bandeau iris de l'app.
const MARGE_HAUT = 96;
// Entre le champ et le haut du clavier.
const MARGE_BAS = 16;

// Le premier ancêtre qui défile lui-même (une feuille, une fenêtre), sinon la page.
function conteneurDefilant(el) {
  for (let p = el.parentElement; p && p !== document.body && p !== document.documentElement; p = p.parentElement) {
    const oy = getComputedStyle(p).overflowY;
    if ((oy === 'auto' || oy === 'scroll') && p.scrollHeight > p.clientHeight) return p;
  }
  return window;
}

function montrerChamp(clavier) {
  const champ = document.activeElement;
  if (!clavier || !champ?.matches?.(CHAMPS)) return;
  const r = champ.getBoundingClientRect();
  const bas = window.innerHeight - clavier - MARGE_BAS;
  if (r.top >= MARGE_HAUT && r.bottom <= bas) return;
  // Au milieu de la bande visible ; un champ plus haut qu'elle (grand texte) montre son début.
  const cible = MARGE_HAUT + Math.max(0, (bas - MARGE_HAUT - r.height) / 2);
  conteneurDefilant(champ).scrollBy({ top: r.top - cible, behavior: defilement() });
}

export function installerClavier({ Keyboard, ios }) {
  const html = document.documentElement;
  let hauteur = 0;
  if (ios) Keyboard.setAccessoryBarVisible({ isVisible: true }).catch(() => {});
  Keyboard.addListener('keyboardWillShow', (info) => {
    html.classList.add('clavier-ouvert');
    if (!ios) return;
    hauteur = info?.keyboardHeight || 0;
    html.style.setProperty('--clavier', `${hauteur}px`);
  });
  Keyboard.addListener('keyboardDidShow', () => montrerChamp(hauteur));
  Keyboard.addListener('keyboardWillHide', () => {
    html.classList.remove('clavier-ouvert');
    hauteur = 0;
    html.style.removeProperty('--clavier');
  });
  // D'un champ à l'autre, clavier déjà ouvert : keyboardDidShow ne repasse pas.
  if (ios) document.addEventListener('focusin', () => { if (hauteur) requestAnimationFrame(() => montrerChamp(hauteur)); });
}
