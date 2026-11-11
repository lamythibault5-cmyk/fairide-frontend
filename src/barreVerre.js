// LA BARRE D'ONGLETS EN VERRE (fondateur, 2026-10-16, version 2 de maquettes/barre-onglets-verre/barre-onglets-verre.html), dans l'app seulement.
// Chargé avec import() par useCurseurOnglets.js : le site ne télécharge rien de tout ceci.
//
// Ce que le CSS seul ne sait pas faire :
//
// 1. LA LENTILLE SUIT LE DOIGT. Appuyer sur la barre fait grossir la pastille (classe --appui, styles.css) ; glisser la
//    promène d'un onglet à l'autre, et au lâcher on ouvre l'onglet le plus proche. Un simple toucher reste un clic
//    normal sur le lien : on ne capture le pointeur qu'une fois le glissé commencé (6 px), et alors le clic du
//    navigateur tombe sur la barre (ancêtre commun), pas sur l'onglet de départ — c'est nous qui cliquons le bon.
//
// 2. Plus de RÉFRACTION depuis le 2026-11-11 (barre d'iOS 26, maquettes/barre-ios26) : le filtre SVG qui courbait le fond sous les
//    bords ne marchait que sur Chromium d'ordinateur (ni Safari, ni Android depuis le 2026-10-20). La barre est la même partout :
//    un flou, un filet de lumière en dégradé, la lentille en pastille (styles.css).
import { vibrer } from './gestes';

const SEUIL_GLISSE = 6;

/* Branche la barre. Rend la fonction qui débranche. `nav` : .dashboard-nav ; `curseur` : sa .nav-curseur. */
export function brancherBarreVerre(nav, curseur) {
  // La console admin défile de côté dans sa barre : le glissé y garderait la main sur ce défilement.
  const glissable = !nav.classList.contains('admin');
  let geste = null;

  const liens = () => [...nav.querySelectorAll(':scope > .dashboard-nav-link')];
  const plusProche = (x) => {
    let meilleur = null; let d = Infinity;
    for (const lien of liens()) {
      const c = lien.offsetLeft + lien.offsetWidth / 2;
      if (Math.abs(c - x) < d) { d = Math.abs(c - x); meilleur = lien; }
    }
    return meilleur;
  };

  const allumer = (lien) => {
    geste.survol?.classList.remove('dashboard-nav-link--survol');
    lien?.classList.add('dashboard-nav-link--survol');
    geste.survol = lien;
  };
  // La lentille revient à la place que useCurseurOnglets lui a donnée (l'onglet de la page).
  const remettre = () => { curseur.style.transform = `translate(${curseur.dataset.x || 0}px, ${curseur.dataset.y || 6}px)`; };
  const appui = (e) => {
    if (e.button > 0) return;
    geste = { x0: e.clientX, id: e.pointerId, glisse: false, survol: null };
    nav.classList.add('dashboard-nav--appui');
    /* AU CONTACT, LA LENTILLE VIENT SOUS LE DOIGT (fondateur, 2026-10-25, maquettes/appui-iris/appui-iris.html) et l'icône
       qu'elle couvre se remplit (styles.css, dashboard-nav-link--survol) : avant, elle grossissait là où elle était et ne
       partait qu'au lâcher. Pas dans la barre de la console admin, qui défile. */
    const lien = glissable && e.target.closest?.('.dashboard-nav-link');
    if (lien && lien.parentElement === nav) {
      curseur.style.transform = `translate(${lien.offsetLeft}px, ${curseur.dataset.y || 6}px)`;
      allumer(lien);
    }
  };
  const bouge = (e) => {
    if (!geste || e.pointerId !== geste.id || !glissable) return;
    if (!geste.glisse) {
      if (Math.abs(e.clientX - geste.x0) < SEUIL_GLISSE) return;
      geste.glisse = true;
      nav.setPointerCapture(e.pointerId);
      nav.classList.add('dashboard-nav--glisse');
    }
    const x = e.clientX - nav.getBoundingClientRect().left;
    const largeur = curseur.offsetWidth;
    const min = 6; const max = nav.clientWidth - 6 - largeur;
    curseur.style.transform = `translate(${Math.max(min, Math.min(max, x - largeur / 2))}px, ${curseur.dataset.y || 6}px)`;
    const lien = plusProche(x);
    if (lien !== geste.survol) {
      allumer(lien);
      vibrer('choix');
    }
  };
  /* L'onglet lâché reste allumé (plein, sous la lentille) jusqu'à ce que sa page le rende actif : React Router change de page
     dans une transition, donc pas tout de suite — et pas avant que le code de la page soit chargé. Sans ça, l'icône se vidait
     entre le lâcher et la nouvelle page, puis se remplissait de nouveau. Au bout de 2 s sans changement, on rend la main. */
  const attendre = (lien) => {
    const debut = performance.now();
    const voir = () => {
      if (geste?.survol === lien) return; // un nouvel appui l'a repris
      if (lien.classList.contains('active') || geste || performance.now() - debut > 2000) {
        lien.classList.remove('dashboard-nav-link--survol');
        if (!geste && !lien.classList.contains('active')) remettre();
        return;
      }
      requestAnimationFrame(voir);
    };
    requestAnimationFrame(voir);
  };
  const lache = (e) => {
    if (!geste || e.pointerId !== geste.id) return;
    const { glisse, survol } = geste;
    nav.classList.remove('dashboard-nav--appui', 'dashboard-nav--glisse');
    geste = null;
    // Même onglet (ou à côté des onglets) : la lentille revient à la place que useCurseurOnglets lui avait donnée.
    if (!survol || survol.classList.contains('active')) { survol?.classList.remove('dashboard-nav-link--survol'); remettre(); return; }
    // Un simple toucher : le clic du lien, qui suit ce pointerup, fait le reste. Après un glissé, c'est nous qui cliquons.
    if (glisse) {
      curseur.style.transform = `translate(${survol.offsetLeft}px, ${curseur.dataset.y || 6}px)`;
      vibrer('seuil');
      survol.click();
    }
    attendre(survol);
  };
  const annule = () => {
    if (!geste) return;
    geste.survol?.classList.remove('dashboard-nav-link--survol');
    nav.classList.remove('dashboard-nav--appui', 'dashboard-nav--glisse');
    geste = null;
    remettre();
  };
  /* La capture perdue par un ENFANT n'est pas la fin du geste (fondateur, 2026-10-24 : « je touche Mon compte, je glisse vers
     Recherche, la pastille reste sur Compte »). Au doigt, le navigateur capture d'office le pointeur sur l'élément touché
     (l'icône) ; quand le glissé commence, setPointerCapture le reprend pour la barre, et l'icône reçoit un lostpointercapture
     qui remontait jusqu'ici et annulait le glissé après 6 px. Seule la perte de NOTRE capture compte. */
  const perdu = (e) => { if (e.target === nav) annule(); };

  // Un lien se « traîne » par défaut (glisser-déposer du navigateur) : ce glissé-là annulait le nôtre (pointercancel).
  const pasDeTraine = (e) => e.preventDefault();
  nav.addEventListener('dragstart', pasDeTraine);
  nav.addEventListener('pointerdown', appui);
  nav.addEventListener('pointermove', bouge);
  nav.addEventListener('pointerup', lache);
  nav.addEventListener('pointercancel', annule);
  nav.addEventListener('lostpointercapture', perdu);

  return () => {
    nav.removeEventListener('dragstart', pasDeTraine);
    nav.removeEventListener('pointerdown', appui);
    nav.removeEventListener('pointermove', bouge);
    nav.removeEventListener('pointerup', lache);
    nav.removeEventListener('pointercancel', annule);
    nav.removeEventListener('lostpointercapture', perdu);
  };
}
