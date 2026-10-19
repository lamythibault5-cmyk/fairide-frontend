/* LA PHOTO VOYAGE DE LA CARTE À LA FICHE (fondateur, 2026-10-19, audit « Look and feel » 6b ; app seulement, lancé par
 * demarrerNatif dans natif.js). On touche un commerce dans la liste : sa photo grandit jusqu'en haut de la fiche au lieu
 * que la page change d'un coup ; la croix de la fiche la ramène dans sa carte.
 *
 * Comment : l'API View Transitions du navigateur (WebView Android récente, iPhone iOS 18+). On donne le même nom
 * (`photo-commerce`) à la photo de départ juste avant la transition, et à la photo d'arrivée dès qu'elle est dans la page ;
 * le navigateur fait le morphing. Sans l'API, ou si le téléphone demande moins de mouvement : rien n'est intercepté, le lien
 * fait ce qu'il a toujours fait. La fiche n'a pas encore ses données quand elle s'ouvre : son squelette (SqueletteEcran
 * photo) montre la photo de la carte, déjà chargée — la transition arrive donc sur une vraie image, pas sur un aplat.
 * Le geste de retour (glisser depuis le bord, bouton Retour d'Android) revient sans animation. Styles : « La photo qui
 * voyage » dans styles.css. */
import { mouvementReduit } from './gestes';

const NOM = 'photo-commerce';
const FICHE = /^(?:\/(?:nl|en))?\/restaurants\/([^/]+)$/;
const LISTE = /^(?:\/(?:nl|en))?\/restaurants$/;

let enVol = null; // { id, src } : la photo de la carte touchée, pour le squelette de la fiche

export function photoEnVol(id) {
  return enVol && String(enVol.id) === String(id) ? enVol.src : null;
}

// Attend qu'un élément apparaisse (au plus `ms`) : la page suivante se rend après le changement d'adresse.
function attendre(trouver, ms = 450) {
  return new Promise((resolve) => {
    const debut = performance.now();
    const tour = () => {
      const el = trouver();
      if (el || performance.now() - debut > ms) resolve(el || null);
      else requestAnimationFrame(tour);
    };
    tour();
  });
}

const nommer = (el) => { if (el) el.style.viewTransitionName = NOM; };
const denommer = (el) => { if (el) el.style.viewTransitionName = ''; };

export function installerTransitionPhoto(historique) {
  if (typeof document.startViewTransition !== 'function') return;
  document.addEventListener('click', (e) => {
    if (e.defaultPrevented || e.button !== 0 || e.metaKey || e.ctrlKey || mouvementReduit()) return;
    const lien = e.target.closest?.('a[href]');
    if (!lien) return;
    const url = new URL(lien.href, window.location.href);
    if (url.origin !== window.location.origin) return;
    const ici = window.location.pathname;

    // Liste → fiche : la carte touchée a une photo.
    const versFiche = url.pathname.match(FICHE);
    if (versFiche && !FICHE.test(ici)) {
      const img = lien.querySelector('img.rc-photo, img.une-photo');
      if (!img || !img.complete || !img.naturalWidth) return;
      e.preventDefault();
      enVol = { id: decodeURIComponent(versFiche[1]), src: img.currentSrc || img.src };
      nommer(img);
      const t = document.startViewTransition(async () => {
        denommer(img);
        historique.push(`${url.pathname}${url.search}`);
        // La photo d'arrivée : celle du squelette, ou la couverture déjà affichée si les données étaient en cache.
        nommer(await attendre(() => document.querySelector('.sq-photo-img, img.fiche-couverture')));
      });
      t.finished.finally(() => { document.querySelectorAll('.sq-photo-img, img.fiche-couverture').forEach(denommer); });
      return;
    }

    // Fiche → liste par sa croix : la couverture rentre dans sa carte, si la carte est dans la liste.
    const depuis = ici.match(FICHE);
    if (depuis && LISTE.test(url.pathname) && lien.closest('.flux-entete')) {
      const couverture = document.querySelector('img.fiche-couverture');
      if (!couverture || !couverture.complete || !couverture.naturalWidth) return;
      e.preventDefault();
      const id = decodeURIComponent(depuis[1]);
      nommer(couverture);
      let carte = null;
      const t = document.startViewTransition(async () => {
        denommer(couverture);
        historique.push(`${url.pathname}${url.search}`);
        carte = await attendre(() => [...document.querySelectorAll('a[href] img.rc-photo, a[href] img.une-photo')]
          .find((img) => (new URL(img.closest('a').href).pathname.match(FICHE) || [])[1] === id));
        nommer(carte);
      });
      t.finished.finally(() => denommer(carte));
    }
  }, true);
}
