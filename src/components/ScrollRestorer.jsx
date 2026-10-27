import { useEffect, useLayoutEffect, useRef } from 'react';
import { useLocation, useNavigationType } from 'react-router-dom';
import { repeterTantQueLibre, rejoindre, enHaut, noterRepere, positionDuRepere } from '../defilementAuto';

// Rendu une seule fois, en dehors de <Routes> (voir App.jsx), pour ne se remonter qu'à un vrai
// rechargement de page (F5) — pas à chaque navigation interne, qui remonte les pages elles-mêmes mais
// pas leurs ancêtres. Ça permet de distinguer les deux cas avec un simple ref : la toute première
// exécution de l'effet correspond au chargement de page en cours, les suivantes à des navigations.
//
// Le scroll natif du navigateur (history.scrollRestoration = 'auto') échoue régulièrement ici car le
// contenu de la page (fetch async, skeletons) n'a souvent pas encore sa hauteur finale au moment où le
// navigateur tente sa propre restauration — il ne réessaie pas après coup. On mémorise donc la position
// nous-mêmes par URL (sessionStorage, propre à l'onglet) et on la réapplique avec plusieurs tentatives
// échelonnées le temps que le contenu charge, comme déjà fait pour l'ancrage de catégorie dans
// RestaurantMenu.jsx.
//
// QUAND RESTAURE-T-ON, ET QUAND REMONTE-T-ON EN HAUT ? Trois cas :
//   - rechargement de page : on restaure (c'est l'usage d'origine) ;
//   - retour arrière du navigateur (POP) ou lien qui le demande (state.restaurerDefilement, posé par
//     les liens « ← Mon compte » et par les onglets, DashboardSidebar.jsx) : on restaure. Revenir sur une page, c'est revenir à l'endroit où
//     on l'a quittée — quelqu'un qui a ouvert la dernière rubrique de Mon compte et clique « retour »
//     veut retrouver cette rubrique sous le doigt, pas le haut de la page et tout à refaire défiler ;
//   - toute autre navigation (clic sur un onglet, sur une carte) : on part du haut, c'est une
//     nouvelle page qu'on commence.
const RESTAURATION_DELAIS = [0, 100, 300, 600, 1000, 1500];
// REMONTER EN HAUT, PLUSIEURS FOIS. Un seul scrollTo(0, 0) au changement de page ne suffisait pas au téléphone : la
// nouvelle page arrive en squelettes, puis sa hauteur change (données, images, barre d'adresse de Safari qui se
// redéploie) et on se retrouvait quelques dizaines de pixels plus bas, le titre coupé. On remonte donc tout de
// suite (avant l'affichage), puis encore pendant ~0,8 s — sauf si la personne touche l'écran ou fait défiler
// entre-temps : on ne lui reprend jamais la main.
const REMONTEE_DELAIS = [0, 50, 150, 300, 500, 800];
// Un écran quitté depuis plus d'un quart d'heure s'ouvre en haut : on ne se souvient plus de ce qu'on y lisait, et revenir
// au milieu d'une page qu'on ne reconnaît pas, c'est le « milieu d'un texte » que la règle 5 de design.md écarte.
const MEMOIRE_MAX_MS = 15 * 60 * 1000;

// { y, at, repere } ; une position gardée par une version précédente (un simple nombre) se relit sans repère.
function lireGarde(chemin) {
  let brut = null;
  try { brut = sessionStorage.getItem(`fairide_scroll:${chemin}`); } catch { /* stockage indisponible */ }
  if (!brut) return { y: 0, at: 0, repere: null };
  try {
    const g = JSON.parse(brut);
    if (typeof g === 'number') return { y: g, at: Date.now(), repere: null };
    return { y: Number(g?.y) || 0, at: Number(g?.at) || 0, repere: g?.repere || null };
  } catch { return { y: 0, at: 0, repere: null }; }
}

// UNE SEULE MAIN SUR LE DÉFILEMENT : la restauration native du navigateur est coupée pour tout le site, dès le démarrage.
// Elle replaçait la page au retour arrière à SON moment — souvent quand la page n'était encore qu'un squelette, donc en
// haut — pendant que ce composant restaurait la vraie position : deux mains, et la page sautait (2026-10-17).
if (typeof window !== 'undefined' && 'scrollRestoration' in window.history) window.history.scrollRestoration = 'manual';

export default function ScrollRestorer() {
  const location = useLocation();
  const navigationType = useNavigationType();
  const isFirstRun = useRef(true);
  // L'adresse affichée, posée au rendu (effet de mise en page) — avant tout événement de défilement de la page suivante.
  const cheminAffiche = useRef(location.pathname);
  const restaurationEnCours = useRef(false);

  // La position est notée au fil du défilement et écrite au plus toutes les 150 ms, puis une dernière fois en quittant la
  // page (2026-10-23, app iPhone lente) : elle était écrite dans sessionStorage à CHAQUE image, une écriture synchrone sur le
  // fil qui fait défiler.
  //
  // NE NOTER QUE LES DÉFILEMENTS DE CETTE PAGE (fondateur, 2026-10-27 : « je reviens à Mon compte et parfois je ne suis plus
  // où j'étais »). L'écouteur d'une page ne part qu'avec les effets différés, APRÈS que la page suivante s'est placée (en
  // haut, ou à sa position gardée) : l'événement de défilement de ce placement — ou du navigateur qui rabote une page plus
  // courte — arrivait encore chez l'ancienne, qui l'écrivait sous SON adresse en partant. Mon compte gardait alors 0, ou la
  // position de l'accueil. Et pendant une restauration, la page encore courte est rabotée : ce n'est pas la personne qui
  // a défilé, on ne l'écrit pas (sinon, repartie avant la fin, la position gardée était perdue).
  //
  // Ce qui est gardé : { y, at, repere } — le repère (defilementAuto.js) dit CE qu'on avait sous les yeux, `at` quand on l'a
  // quitté. Il se lit dans la page affichée : jamais au nettoyage de l'effet, qui passe quand la page suivante a déjà pris
  // sa place. Un défilement pas encore écrit l'est donc au premier toucher (l'onglet qu'on touche pour partir) ou au retour
  // arrière, la page encore là ; au nettoyage, il n'est plus que perdu (150 ms de défilement au plus).
  useEffect(() => {
    const chemin = location.pathname;
    const cleDefilement = `fairide_scroll:${chemin}`;
    let enAttente = false;
    let minuteur = 0;
    const ecrire = () => {
      clearTimeout(minuteur);
      minuteur = 0;
      if (!enAttente || cheminAffiche.current !== chemin) return;
      enAttente = false;
      const garde = { y: window.scrollY, at: Date.now(), repere: window.scrollY > 0 ? noterRepere() : null };
      try { sessionStorage.setItem(cleDefilement, JSON.stringify(garde)); } catch { /* stockage indisponible */ }
    };
    function onScroll() {
      if (cheminAffiche.current !== chemin || restaurationEnCours.current) return;
      enAttente = true;
      if (!minuteur) minuteur = setTimeout(ecrire, 150);
    }
    window.addEventListener('scroll', onScroll, { passive: true });
    window.addEventListener('pointerdown', ecrire, { capture: true, passive: true });
    window.addEventListener('popstate', ecrire);
    return () => {
      window.removeEventListener('scroll', onScroll);
      window.removeEventListener('pointerdown', ecrire, { capture: true });
      window.removeEventListener('popstate', ecrire);
      clearTimeout(minuteur);
    };
  }, [location.pathname]);

  useLayoutEffect(() => {
    const premierChargement = isFirstRun.current;
    isFirstRun.current = false;
    cheminAffiche.current = location.pathname;
    // Une page qui s'ouvre en feuille (feuilles.js) défile dans sa feuille : la page de fond ne bouge pas.
    if (location.state?.fond) return undefined;
    const retour = navigationType === 'POP' || location.state?.restaurerDefilement === true;

    if (!premierChargement && !retour) {
      // Les ancres (#section) gardent leur cible.
      if (location.hash) return undefined;
      // ?ouvrir=… (Mon compte › Paiement depuis « Configurer mes paiements ») : la page défile elle-même jusqu'à la
      // section demandée, une fois ses données chargées. Les remontées ci-dessous la ramenaient en haut pendant ~0,8 s,
      // et le restaurateur atterrissait sur « Mes infos » (test au téléphone, 12 oct. 2026).
      if (new URLSearchParams(location.search).has('ouvrir')) return undefined;
      // En haut tout de suite (avant l'affichage), puis encore le temps que la page se construise — jusqu'au premier geste.
      return repeterTantQueLibre(enHaut, REMONTEE_DELAIS, { immediat: true });
    }
    const garde = lireGarde(location.pathname);
    // Rien de gardé (onglet jamais défilé), ou quitté il y a trop longtemps : en haut, comme une page neuve. Avant le
    // 2026-10-27, rien n'était fait, et la page s'ouvrait à la hauteur où l'on avait laissé l'onglet PRÉCÉDENT — au milieu
    // d'un texte (« en cliquant sur Restaurant j'arrive au milieu de l'écran », test du commerce, 2026-10-27).
    const perime = !premierChargement && Date.now() - garde.at > MEMOIRE_MAX_MS;
    if (garde.y <= 0 || perime) return premierChargement ? undefined : repeterTantQueLibre(enHaut, REMONTEE_DELAIS, { immediat: true });
    // Retour arrière, onglet ou rechargement : ce qu'on avait sous les yeux, réappliqué pendant le chargement — et plus rien
    // dès que la personne fait défiler (avant le 2026-10-17, ces reprises-ci n'avaient aucun arrêt : le saut « en revenant
    // du panier »). rejoindre() (defilementAuto.js) attend que la page l'ait, jusqu'à 10 s, en haut en attendant.
    // UNE PROCHAINE ÉTAPE PASSE AVANT (design.md, règle 5) : un écran qui en montre une (data-prochaine-etape, la liste
    // « avant d'être en ligne » de Commerce et de Commandes) s'ouvre en haut, où elle est — la place d'avant était peut-être
    // dans ce qui vient d'être fait.
    const cible = () => {
      if (document.querySelector('[data-prochaine-etape]')) return 0;
      return garde.repere ? positionDuRepere(garde.repere) : garde.y;
    };
    restaurationEnCours.current = true;
    return rejoindre(cible, { delais: RESTAURATION_DELAIS, auBout: () => { restaurationEnCours.current = false; } });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [location.pathname]);

  return null;
}
