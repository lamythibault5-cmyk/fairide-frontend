import { useEffect, useRef, useState } from 'react';
import { useLanguage } from '../context/LanguageContext';
import { sectionLabel } from '../menuCategories';
import { defilement } from '../gestes';

// Barre de navigation rapide entre sections du menu (Entrées, Plats, Desserts, Boissons...), fixée en
// haut de l'écran pendant qu'on parcourt le menu. Met en évidence la section actuellement lue, fait
// défiler la barre elle-même pour garder ce bouton visible (utile en mobile où tous les boutons ne
// tiennent pas à l'écran à la fois), et fait défiler jusqu'au début d'une section au clic. Le panier
// lui-même vit dans FloatingCart (bulle persistante en bas à gauche, sur toutes les pages) — pas de
// second accès panier ici pour éviter le doublon. Repose sur les ids `menu-cat-<id>` (id de section)
// posés par MenuCategorySections. `categories` attend des objets { id, name } (une section de
// restaurant.sections).

// Une section n'est "active" qu'une fois son titre passé SOUS la barre, pas simplement entré
// quelque part dans le haut de l'écran.
//
// C'ÉTAIT UN NOMBRE EN DUR, et il a été faux deux fois. D'abord parce que le commentaire annonçait
// 140px quand la constante valait 100 ; puis le 2026-09-21, quand le bandeau du parcours (croix,
// nom, recherche) est devenu collant au-dessus de cette barre et l'a poussée de 56px vers le bas —
// le seuil de 70 désignait alors un point situé au-dessus de la barre elle-même, et la section
// s'allumait avant d'être atteinte.
// On mesure donc le bas réel de la barre à chaque calcul. Elle est collante : la valeur est stable
// une fois la page défilée, et elle suit toute seule un changement de hauteur — police plus grande,
// traduction plus longue, bandeau modifié. Plus aucun chiffre à tenir à jour.
// Le repli de 70 ne sert qu'à l'instant où le composant se mesure avant d'être posé.
const SEUIL_REPLI_PX = 70;
// De quoi le titre ne colle pas au bord inférieur de la barre au moment où il bascule.
const MARGE_SEUIL_PX = 8;

// `verre` (fiche d'un commerce dans l'app, 2026-10-16) : la bande devient une bande de verre et la section lue est
// marquée par une LENTILLE qui glisse d'une section à l'autre au défilement — comme celle de la barre d'onglets. Le geste
// (appuyer, glisser la lentille) vit dans bandeSectionsVerre.js, chargé à la demande dans l'app seulement.
// `pouce` (fiche d'un commerce sur le site, 2026-10-16, « Blanc plein » de maquettes/site-ordinateur/site-ordinateur.html) : la même pastille
// iris qui glisse d'une section à l'autre, sur une bande blanche pleine — sans verre ni geste au doigt (rien de plus à charger).
/* LE SAUT VERS UNE SECTION, AU RYTHME DE LA BARRE D'ONGLETS (fondateur, 2026-10-17 : « l'animation est un peu trop longue ;
 * même style et même durée que la barre des tâches »). Le défilement « smooth » du navigateur choisit sa propre durée —
 * plus d'une seconde vers une section éloignée. Il est remplacé par un défilement à durée fixe : 0,42 s et la courbe
 * --ressort-ui, celles de la pastille qui glisse sous les onglets (styles.css, .nav-curseur). Le doigt ou la molette
 * l'interrompent. Sans mouvement (prefers-reduced-motion) : on y est tout de suite. */
const DUREE_SAUT_MS = 420;
// --ressort-ui (styles.css) : la même courbe, en points réguliers, interpolée entre deux points.
const RESSORT_UI = [0, 0.158, 0.413, 0.626, 0.773, 0.868, 0.925, 0.958, 0.977, 0.987, 1];
function ressortUi(t) {
  const x = Math.min(1, Math.max(0, t)) * (RESSORT_UI.length - 1);
  const i = Math.min(RESSORT_UI.length - 2, Math.floor(x));
  return RESSORT_UI[i] + (RESSORT_UI[i + 1] - RESSORT_UI[i]) * (x - i);
}
function defilerVers(cible, fin) {
  const depart = window.scrollY;
  const ecart = cible - depart;
  if (!window.matchMedia || window.matchMedia('(prefers-reduced-motion: reduce)').matches || Math.abs(ecart) < 2) {
    window.scrollTo(0, cible); fin(); return;
  }
  let arrete = false;
  const arreter = () => { arrete = true; };
  const gestes = ['touchstart', 'wheel', 'keydown'];
  gestes.forEach((g) => window.addEventListener(g, arreter, { passive: true, once: true }));
  const t0 = performance.now();
  const pas = (maintenant) => {
    if (arrete) { gestes.forEach((g) => window.removeEventListener(g, arreter)); fin(); return; }
    const t = (maintenant - t0) / DUREE_SAUT_MS;
    window.scrollTo(0, depart + ecart * ressortUi(t));
    if (t < 1) requestAnimationFrame(pas);
    else { gestes.forEach((g) => window.removeEventListener(g, arreter)); fin(); }
  };
  requestAnimationFrame(pas);
}

export default function CategoryQuickNav({ categories, verre = false, pouce = false }) {
  const avecLentille = verre || pouce;
  const { t, language } = useLanguage();
  const [active, setActive] = useState(categories[0]?.id);
  const categoriesRef = useRef(categories);
  categoriesRef.current = categories;
  const buttonRefs = useRef(new Map());
  const barreRef = useRef(null);
  const rangeeRef = useRef(null);
  const lentilleRef = useRef(null);
  const activeAvant = useRef(null);
  // Pendant le défilement lancé par un clic, le suivi est suspendu : la barre ne s'allume pas sur chaque section
  // traversée, elle reste sur celle qu'on a demandée (voir jumpTo).
  const verrou = useRef(0);

  useEffect(() => {
    // Scroll-spy par position plutôt que par IntersectionObserver : la section active est la DERNIÈRE
    // dont le titre a déjà franchi la barre (en descendant la liste dans l'ordre du menu) — recalculée
    // à chaque scroll, jamais dépendante d'un événement d'entrée/sortie individuel qui pourrait être
    // manqué (un scroll rapide peut faire passer un titre sous la barre sans jamais déclencher son
    // propre événement "entrée" si un autre événement du même lot prend le dessus). Plus classique
    // (technique "scrollspy" standard) et plus fiable qu'un suivi par intersection.
    let ticking = false;
    function computeActive() {
      ticking = false;
      if (Date.now() < verrou.current) return;
      const bas = barreRef.current?.getBoundingClientRect().bottom;
      const seuil = (bas > 0 ? bas : SEUIL_REPLI_PX) + MARGE_SEUIL_PX;
      let current = categoriesRef.current[0]?.id;
      for (const c of categoriesRef.current) {
        const el = document.getElementById(`menu-cat-${c.id}`);
        if (!el) continue;
        if (el.getBoundingClientRect().top <= seuil) {
          current = c.id;
        } else {
          break;
        }
      }
      setActive(current);
    }
    function onScroll() {
      if (ticking) return;
      ticking = true;
      requestAnimationFrame(computeActive);
    }
    computeActive();
    window.addEventListener('scroll', onScroll, { passive: true });
    window.addEventListener('resize', onScroll);
    return () => {
      window.removeEventListener('scroll', onScroll);
      window.removeEventListener('resize', onScroll);
    };
  }, [categories]);

  // Fait défiler HORIZONTALEMENT la barre elle-même pour garder le bouton actif visible (ex: sur un
  // menu avec beaucoup de sections en mobile, arrivé à "Boissons" tout à la fin, le bouton correspondant
  // serait sinon resté hors champ à droite tant qu'on n'a pas fait glisser la barre à la main).
  // block: 'nearest' pour ne jamais provoquer de scroll VERTICAL de la page en plus (le bouton est déjà
  // visible verticalement puisque la barre est sticky en haut) — seul le défilement horizontal compte ici.
  //
  // PLUS DE scrollIntoView ICI (2026-10-01). Même en « nearest », il fait défiler TOUS les ancêtres — et Chrome
  // comme Safari interrompent alors le défilement doux de la page en cours : en touchant « Desserts » au bout de la
  // carte, la page s'arrêtait à mi-chemin, sur la première section traversée. On ne fait défiler que la rangée.
  useEffect(() => {
    const btn = buttonRefs.current.get(active);
    const rangee = rangeeRef.current;
    if (!btn || !rangee) return;
    const cible = btn.offsetLeft - (rangee.clientWidth - btn.offsetWidth) / 2;
    rangee.scrollTo({ left: Math.max(0, cible), behavior: defilement() });
  }, [active]);

  // La lentille se pose sur la section allumée : sa largeur, sa hauteur, sa place dans la rangée (qui défile de côté —
  // offsetLeft et non la position à l'écran). Reposée aussi quand la bande change de taille (police chargée, rotation).
  useEffect(() => {
    if (!avecLentille) return undefined;
    const lentille = lentilleRef.current;
    const rangee = rangeeRef.current;
    if (!lentille || !rangee) return undefined;
    function poser() {
      const btn = buttonRefs.current.get(active);
      if (!btn) return;
      const repos = `translateX(${btn.offsetLeft}px)`;
      lentille.dataset.repos = repos;
      lentille.style.transform = repos;
      lentille.style.width = `${btn.offsetWidth}px`;
      lentille.style.height = `${btn.offsetHeight}px`;
      lentille.style.top = `${btn.offsetTop}px`;
    }
    poser();
    // La goutte qui s'étire en changeant de section (pas au premier affichage ; coupée si le système réduit les animations).
    if (activeAvant.current !== null && activeAvant.current !== active) {
      lentille.classList.remove('quicknav-lentille--etire');
      void lentille.offsetWidth;
      lentille.classList.add('quicknav-lentille--etire');
    }
    activeAvant.current = active;
    if (typeof ResizeObserver === 'undefined') return undefined;
    const obs = new ResizeObserver(poser);
    obs.observe(rangee);
    return () => obs.disconnect();
  }, [active, avecLentille, categories]);

  // Le geste de la lentille : chargé seulement quand la bande est en verre (l'app), jamais sur le site.
  useEffect(() => {
    if (!verre || categories.length < 2) return undefined;
    let debrancher = null;
    let annule = false;
    import('../bandeSectionsVerre').then(({ brancherBandeSections }) => {
      if (annule || !barreRef.current || !rangeeRef.current || !lentilleRef.current) return;
      debrancher = brancherBandeSections(barreRef.current, rangeeRef.current, lentilleRef.current);
    }).catch(() => { /* sans le geste, la bande reste une rangée de boutons */ });
    return () => { annule = true; debrancher?.(); };
  }, [verre, categories.length]);

  function jumpTo(id) {
    const el = document.getElementById(`menu-cat-${id}`);
    if (!el) return;
    // La section demandée s'allume tout de suite ; le suivi reprend une fois le saut fini (voir defilerVers).
    setActive(id);
    verrou.current = Date.now() + DUREE_SAUT_MS + 400;
    // Même point d'arrivée que scrollIntoView : le haut de la section, moins sa marge d'ancrage (sous les ronds et la bande).
    const marge = parseFloat(getComputedStyle(el).scrollMarginTop) || 0;
    const cible = Math.max(0, Math.min(el.getBoundingClientRect().top + window.scrollY - marge, document.documentElement.scrollHeight - window.innerHeight));
    defilerVers(cible, () => { verrou.current = 0; });
  }

  if (categories.length < 2) return null;

  return (
    <nav className={`category-quicknav${verre ? ' category-quicknav--verre' : ''}${pouce ? ' category-quicknav--pouce' : ''}`} ref={barreRef} aria-label={t('ecranFiche.sections')}>
      <div className="category-quicknav-sections" ref={rangeeRef}>
        {avecLentille && <span className="quicknav-lentille" ref={lentilleRef} aria-hidden="true" />}
        {categories.map((c) => (
          <button
            key={c.id}
            type="button"
            ref={(el) => { if (el) buttonRefs.current.set(c.id, el); else buttonRefs.current.delete(c.id); }}
            className={active === c.id ? 'active' : ''}
            aria-current={active === c.id ? 'true' : undefined}
            onClick={() => jumpTo(c.id)}
          >
            {sectionLabel(c, language, t)}
          </button>
        ))}
      </div>
    </nav>
  );
}
