/* LA BARRE D'ÉTAT SUIT LE BANDEAU (fondateur, 2026-10-19, audit « Look and feel » 6d ; app seulement, lancé par natif.js).
 * Tant qu'un bandeau iris passe sous la barre d'état, elle reste iris, icônes blanches. Quand le bandeau s'est replié en
 * défilant (ou qu'un écran commence en blanc), elle devient blanche, icônes sombres. Avant, elle restait iris partout sur
 * Android : une bande iris collée en haut d'une page blanche.
 *
 * Comment : on regarde ce qui est peint juste sous la barre (elementFromPoint au milieu, à 2 px du haut de la vue web) et on
 * remonte jusqu'au premier fond opaque. Iris ou iris foncé → iris ; tout le reste → blanc. Toutes les 120 ms au plus pendant
 * un défilement (regardSousBarre.js, 2026-10-20 : c'était à chaque image), et le greffon n'est appelé que quand la couleur
 * change : la barre ne clignote pas. iPhone : la barre est transparente, seule la couleur des icônes change. */
import { IRIS, fondSous, surveillerSousBarre } from './regardSousBarre';

export function suivreBarreEtat({ StatusBar, Style, android }) {
  let iris = null;
  const appliquer = () => {
    const fond = fondSous(2);
    // Le verre iris sous la barre d'état (verreBarreEtat.js, iPhone) est translucide : fondSous() regarde à travers. Tant
    // qu'il est là, les icônes restent blanches.
    const estIris = document.documentElement.classList.contains('verre-etat-on') || (fond !== null && IRIS.has(fond));
    if (estIris === iris) return;
    iris = estIris;
    // Style.Dark = icônes claires (sur l'iris), Style.Light = icônes sombres (sur le blanc).
    StatusBar.setStyle({ style: estIris ? Style.Dark : Style.Light }).catch(() => {});
    if (android) StatusBar.setBackgroundColor({ color: estIris ? '#3B2FB5' : '#FFFFFF' }).catch(() => {});
  };
  surveillerSousBarre(appliquer);
}
