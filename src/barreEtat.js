/* LA BARRE D'ÉTAT SUIT LE BANDEAU (fondateur, 2026-10-19, audit « Look and feel » 6d ; app seulement, lancé par natif.js).
 * Tant qu'un bandeau iris passe sous la barre d'état, elle reste iris, icônes blanches. Quand le bandeau s'est replié en
 * défilant (ou qu'un écran commence en blanc), elle devient blanche, icônes sombres. Avant, elle restait iris partout sur
 * Android : une bande iris collée en haut d'une page blanche.
 *
 * Comment : on regarde ce qui est peint juste sous la barre (elementFromPoint au milieu, à 2 px du haut de la vue web) et on
 * remonte jusqu'au premier fond opaque. Iris ou iris foncé → iris ; tout le reste → blanc. Toutes les 120 ms au plus pendant
 * un défilement (regardSousBarre.js, 2026-10-20 : c'était à chaque image), et le greffon n'est appelé que quand la couleur
 * change : la barre ne clignote pas.
 *
 * iPHONE AUSSI (fondateur, 2026-10-31, build iOS 234). La barre n'y est PAS transparente : overlaysWebView: false
 * (capacitor.config.json) fait poser par le greffon une vue native iris de la hauteur de la barre, et la vue web commence
 * dessous. Seule la couleur des icônes changeait, la vue restait iris : sur la carte, la bande blanche du haut
 * (ecran-liste.css) ne remplissait que les quelques points entre cette vue et la carte. Le greffon 7 sait la recolorer sur
 * iPhone (StatusBar.swift › setBackgroundColor) : même règle que sur Android. */
import { IRIS, fondSous, surveillerSousBarre } from './regardSousBarre';

export function suivreBarreEtat({ StatusBar, Style }) {
  let iris = null;
  const appliquer = () => {
    const fond = fondSous(2);
    // Le verre blanc sous la barre d'état (verreBarreEtat.js) est translucide : fondSous() regarde à travers. Tant qu'il est
    // là, les icônes sont sombres, même si un bout d'iris passe dessous (2026-10-30 ; il était iris, icônes blanches).
    const verre = document.documentElement.classList.contains('verre-etat-on');
    const estIris = !verre && fond !== null && IRIS.has(fond);
    if (estIris === iris) return;
    iris = estIris;
    // Style.Dark = icônes claires (sur l'iris), Style.Light = icônes sombres (sur le blanc).
    StatusBar.setStyle({ style: estIris ? Style.Dark : Style.Light }).catch(() => {});
    StatusBar.setBackgroundColor({ color: estIris ? '#3B2FB5' : '#FFFFFF' }).catch(() => {});
  };
  surveillerSousBarre(appliquer);
}
