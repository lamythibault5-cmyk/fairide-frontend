/* LE FAUX TÉLÉPHONE SE FAIT GLISSER À LA SOURIS, COMME AU DOIGT (Owen, 2026-11-12 : « l'appli n'est pas aussi fluide que la
 * vraie », capture des barres de défilement Windows sous les rangées). Dans l'appli, on fait glisser les rangées et la page du
 * doigt ; sur un ordinateur, dans le cadre de l'accueil (apercuSite.js), il n'y avait que la molette et une barre de défilement
 * grise sous chaque rangée. Ici, seulement dans l'aperçu et seulement pour la souris (le doigt garde le défilement du
 * navigateur) :
 *   - on appuie et on tire : la rangée (ou la page) suit, dans le sens dominant du geste ; l'accroche des rangées
 *     (scroll-snap) est suspendue pendant le geste et reprend au lâcher, qui finit sur une carte entière ;
 *   - au lâcher, l'élan continue en douceur, comme un doigt qu'on lève ;
 *   - un vrai glissé (plus de 6 px) n'ouvre pas la carte sur laquelle il a commencé.
 * La carte Leaflet, les champs et les boutons de la barre d'onglets gardent leur propre geste. Les barres de défilement sont
 * cachées par la CSS (styles.css, html.apercu). */
import { defilement } from './gestes';

const SEUIL = 6;
const EXCLUS = '.leaflet-container, input, textarea, select, [contenteditable], .dashboard-sidebar';

function defilable(el, axe) {
  for (let n = el; n && n !== document.documentElement; n = n.parentElement) {
    const s = getComputedStyle(n);
    if (axe === 'x' && /(auto|scroll)/.test(s.overflowX) && n.scrollWidth > n.clientWidth + 1) return n;
    if (axe === 'y' && /(auto|scroll)/.test(s.overflowY) && n.scrollHeight > n.clientHeight + 1) return n;
  }
  return axe === 'y' ? document.scrollingElement : null;
}

export function brancherGlisserSouris() {
  let depart = null; // { x, y, cible }
  let geste = null; // { el, axe, debut, accroche, vitesse, t, pos }
  let empecherClic = false;

  const position = (g) => (g.axe === 'x' ? g.el.scrollLeft : g.el.scrollTop);
  const placer = (g, v) => { if (g.axe === 'x') g.el.scrollLeft = v; else g.el.scrollTop = v; };

  const bas = (e) => {
    if (e.pointerType !== 'mouse' || e.button !== 0 || e.target.closest?.(EXCLUS)) return;
    depart = { x: e.clientX, y: e.clientY, cible: e.target };
    geste = null;
  };
  const bouge = (e) => {
    if (!depart) return;
    const dx = e.clientX - depart.x, dy = e.clientY - depart.y;
    if (!geste) {
      if (Math.hypot(dx, dy) < SEUIL) return;
      const axe = Math.abs(dx) > Math.abs(dy) ? 'x' : 'y';
      const el = defilable(depart.cible, axe);
      if (!el) { depart = null; return; }
      geste = { el, axe, debut: 0, accroche: el.style.scrollSnapType, vitesse: 0, t: performance.now(), pos: 0 };
      geste.debut = position(geste);
      el.style.scrollSnapType = 'none';
      document.documentElement.classList.add('apercu-glisse');
    }
    const d = geste.axe === 'x' ? dx : dy;
    const t = performance.now();
    const v = geste.debut - d;
    geste.vitesse = 0.8 * ((v - geste.pos) / Math.max(1, t - geste.t)) + 0.2 * geste.vitesse;
    geste.pos = v; geste.t = t;
    placer(geste, v);
    e.preventDefault();
  };
  const haut = () => {
    if (!depart) return;
    depart = null;
    if (!geste) return;
    const g = geste;
    geste = null;
    empecherClic = true;
    setTimeout(() => { empecherClic = false; }, 0);
    document.documentElement.classList.remove('apercu-glisse');
    // L'élan : la vitesse du lâcher (px/ms) projetée sur 250 ms, une largeur d'écran au plus, puis le défilement doux du
    // navigateur, accroche des rangées remise : la rangée finit sur une carte entière, comme sous le doigt.
    const max = g.axe === 'x' ? g.el.clientWidth : window.innerHeight;
    const elanPx = Math.max(-max, Math.min(max, g.vitesse * 250));
    g.el.style.scrollSnapType = g.accroche;
    if (Math.abs(elanPx) > 4) g.el.scrollBy({ [g.axe === 'x' ? 'left' : 'top']: elanPx, behavior: defilement() });
  };
  // Le clic qui termine un glissé ne doit rien ouvrir. En capture sur window, AVANT la garde de l'aperçu (GardeApercu.jsx).
  const clic = (e) => { if (empecherClic) { e.preventDefault(); e.stopPropagation(); } };
  // Un lien ou une photo tirés à la souris partaient en glisser-déposer du navigateur (et le geste s'arrêtait net).
  const deposer = (e) => { if (!e.target.closest?.(EXCLUS)) e.preventDefault(); };

  window.addEventListener('pointerdown', bas, true);
  window.addEventListener('pointermove', bouge, { capture: true, passive: false });
  window.addEventListener('pointerup', haut, true);
  window.addEventListener('pointercancel', haut, true);
  window.addEventListener('click', clic, true);
  window.addEventListener('dragstart', deposer, true);
  return () => {
    window.removeEventListener('dragstart', deposer, true);
    window.removeEventListener('pointerdown', bas, true);
    window.removeEventListener('pointermove', bouge, { capture: true });
    window.removeEventListener('pointerup', haut, true);
    window.removeEventListener('pointercancel', haut, true);
    window.removeEventListener('click', clic, true);
  };
}
