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
 * voyage » dans styles.css.
 *
 * RETOURS DU TEST ANDROID (fondateur, 2026-10-20, Maestro Pizza) : « fermer avec la croix est très lent, et la photo devient
 * rectangulaire une seconde ». Trois causes, trois corrections :
 *   - on attendait jusqu'à 450 ms que la carte (ou la fiche) existe, page figée pendant ce temps : la liste et la fiche
 *     déjà lues s'affichent maintenant dès la première image (cacheDonnees.js), l'attente tombe à 150 ms ;
 *   - l'arrondi de la photo venait de son parent (la carte coupe ce qui dépasse), que la capture de la transition ne voit
 *     pas : la photo voyageait en rectangle. Les photos portent maintenant leur arrondi elles-mêmes, et le cadre de la
 *     transition passe de l'arrondi de départ à celui d'arrivée (--photo-rayon-depart / --photo-rayon-arrivee, posés ici) ;
 *   - la carte d'arrivée, en chargement paresseux, refaisait son fondu depuis le transparent : elle est chargée tout de
 *     suite et décodée avant la capture (au plus 100 ms), et une photo déjà vue ne fond plus (images.js, photoVue). */
import { mouvementReduit } from './gestes';

const NOM = 'photo-commerce';
const FICHE = /^(?:\/(?:nl|en))?\/restaurants\/([^/]+)$/;
const LISTE = /^(?:\/(?:nl|en))?\/restaurants$/;

let enVol = null; // { id, src, at } : la photo de la carte touchée, pour le squelette et la couverture de la fiche

export function photoEnVol(id) {
  return enVol && String(enVol.id) === String(id) ? enVol.src : null;
}

// La fiche s'ouvre-t-elle par la photo qui grandit ? Alors elle ne rejoue pas sa propre entrée (RestaurantMenu.jsx). Dix
// secondes : au-delà, la fiche attendait ses données derrière son squelette, et c'est un nouvel affichage.
export function entreeParPhoto(id) {
  return !!enVol && String(enVol.id) === String(id) && performance.now() - enVol.at < 10000;
}

// L'arrondi de la photo dans sa carte : celui de la carte (qui la coupe), en haut seulement quand le texte de la carte est
// dessous (.rest-card), aux quatre coins quand la photo remplit la carte (.une-carte). La fiche : bord à bord, carrée.
function rayonDansCarte(img) {
  const carte = img.closest('.rest-card, .une-carte');
  if (!carte) return '0px';
  const r = getComputedStyle(carte).borderTopLeftRadius || '0px';
  const enBas = Math.abs(carte.getBoundingClientRect().bottom - img.getBoundingClientRect().bottom) < 3;
  return enBas ? r : `${r} ${r} 0px 0px`;
}
function poserRayons(depart, arrivee) {
  const s = document.documentElement.style;
  s.setProperty('--photo-rayon-depart', depart);
  s.setProperty('--photo-rayon-arrivee', arrivee);
}

// Attend qu'un élément apparaisse (au plus `ms`) : la page suivante se rend après le changement d'adresse. 150 ms : la page
// est figée pendant l'attente, et avec les données gardées (cacheDonnees.js) l'élément est là dès la première image.
// MINUTEUR, PAS requestAnimationFrame (2026-10-23, app iPhone : 4 à 10 s avant d'ouvrir ou de quitter une fiche). Pendant la
// mise à jour d'une View Transition, le navigateur suspend le rendu : rAF ne se déclenchait plus, le plafond de 150 ms n'était
// jamais relu, et la transition attendait le délai du navigateur lui-même (~4 s, écran figé, touchers ignorés). Mesuré :
// 4 150 ms avant, 420 ms après.
function attendre(trouver, ms = 150) {
  return new Promise((resolve) => {
    const debut = performance.now();
    const tour = () => {
      const el = trouver();
      if (el || performance.now() - debut > ms) resolve(el || null);
      else setTimeout(tour, 16);
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
      enVol = { id: decodeURIComponent(versFiche[1]), src: img.currentSrc || img.src, at: performance.now() };
      poserRayons(rayonDansCarte(img), '0px');
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
      poserRayons('0px', '0px');
      let carte = null;
      const t = document.startViewTransition(async () => {
        denommer(couverture);
        historique.push(`${url.pathname}${url.search}`);
        carte = await attendre(() => [...document.querySelectorAll('a[href] img.rc-photo, a[href] img.une-photo')]
          .find((img) => (new URL(img.closest('a').href).pathname.match(FICHE) || [])[1] === id));
        if (!carte) return;
        // La carte d'arrivée est souvent en chargement paresseux : on la charge tout de suite, et on lui laisse 100 ms pour
        // être décodée (elle sort du cache du navigateur), sinon la capture la prendrait vide.
        carte.loading = 'eager';
        carte.classList.add('rc-photo--vue');
        await Promise.race([carte.decode().catch(() => {}), new Promise((r) => { setTimeout(r, 100); })]);
        poserRayons('0px', rayonDansCarte(carte));
        nommer(carte);
      });
      t.finished.finally(() => denommer(carte));
    }
  }, true);
}
