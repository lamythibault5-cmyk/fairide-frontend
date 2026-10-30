/* LE VERRE SOUS LA BARRE D'ÉTAT (fondateur, 2026-10-23, version B de maquettes/verre-boutons/verre-boutons.html ; app iPhone
 * seulement, lancé par natif.js). Depuis ios.contentInset « never », la page passe sous l'heure et la batterie : sans rien
 * dessous, un titre qui remonte (« Ton panier ») s'y mêlait aux chiffres. Une bande de verre iris (styles dans verre.css)
 * apparaît dès que la page a défilé, floute ce qui passe dessous et s'estompe par le bas.
 *
 * Sur une fiche de commerce, la photo passe sous la barre d'état exprès : le verre attend que la photo soit sortie, puis
 * apparaît au-dessus de la feuille blanche. Regard : au plus une fois par image pendant un défilement.
 *
 * BLANC, PLUS IRIS (fondateur, 2026-10-30 : « blanc dès qu'il y a du blanc dessous »). Le verre ne s'allume que quand ce qui
 * passe sous l'heure n'est pas l'iris plein, c'est-à-dire sur une page blanche : il est donc blanc, et la barre d'état prend
 * des icônes sombres tant qu'il est là (barreEtat.js lit la classe `verre-etat-on`).
 *
 * Sur un bandeau iris qui reste collé en haut (la liste : « Livrer à … »), le verre ne sert à rien et se voyait : posé sur
 * l'iris plein, il l'éclaircissait (saturate) et son fondu du bas traçait une ligne sur le bandeau (fondateur, 2026-10-25).
 * Il reste donc caché tant que l'iris plein descend jusqu'à son bord du bas : rien ne peut alors passer sous l'heure. Caché
 * aussi tant que l'iris est sous l'heure elle-même (2026-10-30) : un bandeau qui remonte (« Recherche ») a son champ blanc au
 * bord du bas du verre et l'iris dessus, le verre blanc s'y posait sur l'iris.
 *
 * ANDROID 15 ET PLUS (2026-10-26, maquettes/iphone-android) : l'app y est bord à bord (cible API 36), la page passe aussi sous
 * l'heure, transparente, et le titre d'une fiche s'y mêlait aux chiffres. Même verre, lancé aussi sur Android. Sur Android 14
 * et moins, la barre d'état est pleine, au-dessus de la page : env(safe-area-inset-top) vaut 0, la bande n'a aucune hauteur
 * (verre.css) et ne s'allume jamais : la barre native y suit seule ce qui est dessous (barreEtat.js). */
import { IRIS, fondSous } from './regardSousBarre';

const HAUTEUR_FONDU = 18;

export function installerVerreBarreEtat() {
  if (document.querySelector('.verre-etat')) return;
  const bande = document.createElement('div');
  bande.className = 'verre-etat';
  bande.setAttribute('aria-hidden', 'true');
  document.body.appendChild(bande);
  const html = document.documentElement;
  let image = 0;
  const regarder = () => {
    image = 0;
    let visible = bande.offsetHeight > 0 && window.scrollY > 4;
    if (visible) {
      const photo = document.querySelector('.fiche-appli .fiche-media');
      if (photo && photo.getBoundingClientRect().bottom > bande.offsetHeight - HAUTEUR_FONDU) visible = false;
    }
    // Le verre ne capte pas le doigt (pointer-events: none) : fondSous() regarde à travers lui.
    if (visible && (IRIS.has(fondSous(bande.offsetHeight - 1)) || IRIS.has(fondSous(2)))) visible = false;
    html.classList.toggle('verre-etat-on', visible);
  };
  const demander = () => { if (!image) image = requestAnimationFrame(regarder); };
  window.addEventListener('scroll', demander, { passive: true });
  window.addEventListener('resize', demander);
  // Changement d'écran : la nouvelle page commence en haut, le verre repart.
  window.addEventListener('popstate', demander);
  // Fin d'une transition d'écran (transitionPhoto.js) : pendant qu'elle joue, le navigateur suspend requestAnimationFrame et la
  // page est recouverte par ses captures, le regard lancé au popstate n'a rien vu de juste (le verre de la fiche restait allumé
  // sur la liste). On regarde tout de suite, avant que le verre, caché pendant la transition, ne réapparaisse.
  window.addEventListener('fairide:transition-finie', regarder);
  regarder();
}
