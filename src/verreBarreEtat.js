/* LE VERRE SOUS LA BARRE D'ÉTAT (fondateur, 2026-10-23, version B de maquettes/verre-boutons/verre-boutons.html ; app iPhone
 * seulement, lancé par natif.js). Depuis ios.contentInset « never », la page passe sous l'heure et la batterie : sans rien
 * dessous, un titre qui remonte (« Ton panier ») s'y mêlait aux chiffres. Une bande de verre iris (styles dans verre.css)
 * apparaît dès que la page a défilé, floute ce qui passe dessous et s'estompe par le bas.
 *
 * Sur une fiche de commerce, la photo passe sous la barre d'état exprès : le verre attend que la photo soit sortie, puis
 * apparaît au-dessus de la feuille blanche. La barre d'état garde ses icônes blanches tant que le verre est là (barreEtat.js
 * lit la classe `verre-etat-on`). Regard : au plus une fois par image pendant un défilement.
 *
 * Sur un bandeau iris qui reste collé en haut (la liste : « Livrer à … »), le verre ne sert à rien et se voyait : posé sur
 * l'iris plein, il l'éclaircissait (saturate) et son fondu du bas traçait une ligne sur le bandeau (fondateur, 2026-10-25).
 * Il reste donc caché tant que l'iris plein descend jusqu'à son bord du bas : rien ne peut alors passer sous l'heure. */
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
    let visible = window.scrollY > 4;
    if (visible) {
      const photo = document.querySelector('.fiche-appli .fiche-media');
      if (photo && photo.getBoundingClientRect().bottom > bande.offsetHeight - HAUTEUR_FONDU) visible = false;
    }
    // Le verre ne capte pas le doigt (pointer-events: none) : fondSous() regarde à travers lui.
    if (visible && IRIS.has(fondSous(bande.offsetHeight - 1))) visible = false;
    html.classList.toggle('verre-etat-on', visible);
  };
  const demander = () => { if (!image) image = requestAnimationFrame(regarder); };
  window.addEventListener('scroll', demander, { passive: true });
  window.addEventListener('resize', demander);
  // Changement d'écran : la nouvelle page commence en haut, le verre repart.
  window.addEventListener('popstate', demander);
  regarder();
}
