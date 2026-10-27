import { useEffect, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { mouvementReduit } from '../gestes';
import { plateforme } from '../natif';
import { cheminPrecedent } from '../i18n/historiqueLangue';
import { cheminSansPrefixe } from '../i18n/routing';
import { prendreEcranFige, rendreEcranFige, replacerDefilements } from '../ecranFige';
import { prochaineSansTransition } from '../transitionPhoto';

/* TIRER LA FICHE VERS LE BAS : ELLE RENTRE DANS SA CARTE (fondateur, 2026-10-27, réponses à
 * maquettes/fiche-tirer/fiche-tirer.html : version A « la carte », zones neutres, liste assombrie, distance moyenne, on
 * peut remonter puis tirer d'un seul geste). App native seulement (monté par RestaurantMenu.jsx).
 *
 * L'ESSAI DU 23/10 (FermerFicheParGlissement, retiré le 27/10, « clunky ») avait trois défauts, et c'est ce qui change :
 *  - derrière la fiche, un fond iris vide : la liste n'existe plus quand la fiche est ouverte. On voit maintenant la liste
 *    telle qu'on l'a quittée, copiée au toucher de la carte (ecranFige.js), assombrie puis éclaircie à mesure qu'on tire ;
 *  - au lâcher, il « touchait » la croix, qui lançait une deuxième animation (la transition de vue). Maintenant c'est un
 *    seul mouvement : la fiche part à la vitesse du doigt et rentre dans sa carte (même ressort que les feuilles), puis on
 *    recule pour de vrai sans transition, sous la copie, qui s'efface quand la vraie liste est revenue à sa place ;
 *  - on ne tirait que la photo. Maintenant tout ce qui n'est pas un bouton, un lien, un plat, la bascule ou une bande qui
 *    défile de côté, tant que la page est tout en haut ; plus bas, le même geste fait défiler. Le doigt qui fait remonter
 *    la page tire la fiche une fois arrivé en haut, sans se lever (le rebond du haut est coupé dans l'app : rien ne se bat).
 *
 * Aucune poignée ni indice : tant que le doigt ne bouge pas, la fiche est celle d'avant. Pas de vibration (les feuilles
 * d'iOS n'en font pas). Ouverte autrement que depuis une carte (lien partagé, panier, notification), ou si l'écran d'avant
 * n'est plus celui de la copie, il n'y a rien derrière : pas de geste, la croix et le retour du système restent.
 *
 * Comment la fiche « devient » la carte sans rien remettre en page : un transform (déplacement + échelle, depuis son coin
 * haut gauche) et un clip-path qui ne garde que le rectangle visible, aux coins arrondis. À la fin, le cadrage recentre la
 * photo de la fiche sur celle de la carte et la fiche se fond dans la carte de la copie, qui est dessous, au même endroit. */
const SENS = 8;
const BORD_IOS = 24; // le balayage retour de WebKit part du bord gauche
const SEUIL = 140;
const VOILE = 0.34;
// Ce qu'on ne tire pas : ce qui se touche, et ce qui défile de côté.
const INTERACTIF = 'a, button, input, select, textarea, label, summary, [role="button"], [role="tab"], [role="switch"], .plat-cliquable, .fiche-modes, .quicknav, .discover-track';

const borne = (x) => Math.max(0, Math.min(1, x));
const lerp = (a, b, p) => a + (b - a) * p;

export default function TirerFicheVersCarte({ pageRef }) {
  // Dans une référence : la fiche change d'adresse en s'ouvrant (identifiant → slug, FicheCommerce.jsx), et le geste ne
  // doit pas être réinstallé pour autant.
  const naviguer = useRef(null);
  naviguer.current = useNavigate();
  useEffect(() => {
    const page = pageRef.current;
    const fige = prendreEcranFige();
    if (!page || !fige) return undefined;
    if (mouvementReduit()) { rendreEcranFige(fige); return undefined; }
    const html = document.documentElement;
    let m = null;
    import('../ressort').then((mod) => { m = mod; }).catch(() => {});

    // Le calque de la copie, posé dans la page au toucher seulement (sa mise en page se fait pendant les 8 premiers pixels,
    // avant que rien ne bouge), et retiré si le toucher n'était pas un tirage. Laissé en place tout le temps que la fiche
    // est ouverte, il déclenchait les règles `body:has(…)` de l'écran copié (la bulle du panier venue de la Carte).
    const calque = document.createElement('div');
    calque.className = 'fiche-fond-fige';
    calque.setAttribute('aria-hidden', 'true');
    calque.inert = true;
    calque.style.background = fige.fond;
    fige.noeud.classList.add('fiche-fond-copie');
    fige.noeud.style.top = `${-fige.defilement}px`;
    const voile = document.createElement('div');
    voile.className = 'fiche-fond-voile';
    calque.append(fige.noeud, voile);
    let pose = false;
    const poser = () => { if (!pose) { document.body.appendChild(calque); replacerDefilements(fige); pose = true; } };
    const retirer = () => { if (pose) { calque.remove(); pose = false; } };

    let g = null;       // le toucher en cours
    let vol = null;     // le ressort en cours
    let etat = 'repos'; // repos | geste | retour | part | parti
    let d = 0; let dx = 0;
    let F = null;       // la fiche plein écran au début du geste (repère écran)
    let haut = 0;       // hauteur de la page (repère page)
    let centrePhoto = null; // le milieu de la photo de la fiche (repère page)
    let cur = { R: null, r: 0, T: 0 };

    // R : le rectangle visible à l'écran. r : son arrondi. T : ce qu'on coupe en haut de la page (repère page).
    function appliquer(R, r, T) {
      const s = R.w / F.w;
      const L = R.h / s;
      page.style.transform = `translate3d(${R.x - F.x}px, ${R.y - F.y - T * s}px, 0) scale(${s})`;
      page.style.clipPath = `inset(${T}px 0px ${Math.max(0, haut - T - L)}px 0px round ${r / s}px)`;
      cur = { R, r, T };
    }
    function fondu(x) { html.style.setProperty('--fiche-tiree-fondu', String(x)); }

    function commencer() {
      poser();
      const p = page.getBoundingClientRect();
      F = { x: p.left, y: p.top, w: p.width, h: window.innerHeight - p.top };
      haut = page.offsetHeight;
      const media = page.querySelector('.fiche-media')?.getBoundingClientRect();
      centrePhoto = media ? media.top - p.top + media.height / 2 : null;
      html.classList.add('fiche-tiree');
      calque.classList.add('vu');
      page.style.background = fige.fond;
      page.style.transformOrigin = '0 0';
      page.style.willChange = 'transform, clip-path';
    }
    function nettoyer() {
      html.classList.remove('fiche-tiree');
      html.style.removeProperty('--fiche-tiree-fondu');
      calque.classList.remove('vu');
      retirer();
      for (const p of ['transform', 'clipPath', 'background', 'transformOrigin', 'willChange', 'opacity']) page.style[p] = '';
    }

    // Pendant le geste : elle rétrécit (vite au début, jusqu'à 18 %), descend moins vite que le doigt, le suit un peu de côté.
    function poserGeste() {
      const s = 1 - 0.18 * (1 - Math.exp(-d / 260));
      const w = F.w * s; const h = F.h * s;
      appliquer({ x: F.x + (F.w - w) / 2 + dx * 0.22, y: F.y + d * 0.6, w, h }, Math.min(32, d / 2.5), 0);
      voile.style.opacity = String(VOILE * (1 - borne(d / (F.h * 0.55))));
      fondu(borne(d / 120));
    }

    // L'écran d'avant est-il toujours celui de la copie ? (panier ouvert depuis la fiche puis ‹ : oui ; lien partagé : non)
    const copieValable = () => cheminPrecedent() === fige.chemin;

    function debut(e) {
      if (e.touches.length !== 1) { g = null; return; }
      const t = e.touches[0];
      if (etat === 'retour' && vol) {
        // Rattrapée pendant qu'elle revient : on repart de là où elle est.
        vol.arreter(); vol = null; etat = 'geste';
        g = { y0: t.clientY - d, x0: t.clientX - dx, actif: true, suivi: m.suiviVitesse() };
        g.suivi.ajouter(t.clientY);
        return;
      }
      g = null;
      if (etat !== 'repos' || !m || window.innerWidth > 900 || !copieValable()) return;
      if (plateforme() === 'ios' && t.clientX <= BORD_IOS) return;
      if (e.target.closest?.(INTERACTIF)) return;
      if (document.querySelector('.modal-overlay, .plat-feuille')) return;
      poser();
      g = { ancre: t.clientY, ancreX: t.clientX, actif: false, suivi: m.suiviVitesse() };
      g.suivi.ajouter(t.clientY);
    }
    function suite(e) {
      if (!g) return;
      const t = e.touches[0];
      g.suivi.ajouter(t.clientY);
      if (!g.actif) {
        // La page défile encore : on attend qu'elle arrive en haut, et l'on tire à partir de là.
        if (window.scrollY > 0) { g.ancre = t.clientY; g.ancreX = t.clientX; return; }
        const dY = t.clientY - g.ancre; const dX = t.clientX - g.ancreX;
        if (Math.abs(dX) > SENS && Math.abs(dX) > Math.abs(dY)) { g = null; retirer(); return; }
        if (dY < -SENS) { g.ancre = t.clientY; return; }
        if (dY < SENS) return;
        g.actif = true; g.y0 = t.clientY; g.x0 = t.clientX; d = 0; dx = 0;
        etat = 'geste';
        commencer();
      }
      if (e.cancelable) e.preventDefault();
      d = Math.max(0, t.clientY - g.y0); dx = t.clientX - g.x0;
      poserGeste();
    }
    function fin() {
      if (!g) return;
      const { actif, suivi } = g; g = null;
      if (!actif) { retirer(); return; }
      const v = suivi.vitesse();
      // Fermer si l'élan l'emmène au-delà du seuil — ou si on la lance franchement vers le bas (ressort.js, projeter).
      if (d + m.projeter(v) > SEUIL || v > 1100) { rentrer(v); return; }
      etat = 'retour';
      const d0 = d || 1; const dx0 = dx;
      vol = m.ressort({
        de: d, vers: 0, vitesse: v, amortissement: 1, reponse: 0.32,
        surImage: (y) => { d = Math.max(0, y); dx = dx0 * (d / d0); poserGeste(); },
        fin: () => { vol = null; d = 0; dx = 0; etat = 'repos'; nettoyer(); }
      });
    }

    // Du rectangle où le doigt l'a laissée jusqu'à sa carte, en partant à la vitesse du doigt.
    function rentrer(vy) {
      etat = 'part';
      const carte = fige.carte;
      const c = carte.getBoundingClientRect();
      const C = { x: c.left, y: c.top, w: c.width, h: c.height };
      const rayon = parseFloat(getComputedStyle(carte).borderTopLeftRadius) || 16;
      // Le cadrage final : le centre de la photo de la fiche sur le centre de la photo de la carte.
      const sFin = C.w / F.w;
      const photoCarte = carte.querySelector('img')?.getBoundingClientRect();
      let Tfin = 0;
      if (photoCarte && centrePhoto != null) {
        const centreFiche = centrePhoto;
        const centreCarte = (photoCarte.top - C.y + photoCarte.height / 2) / sFin;
        Tfin = Math.max(0, centreFiche - centreCarte);
      }
      const R0 = cur.R; const r0 = cur.r; const v0 = Number(voile.style.opacity) || 0;
      const distance = C.y - R0.y;
      const vp = distance > 40 ? Math.min(6, Math.max(0, vy / distance)) : 0;
      // Le ressort compte en pixels (il s'arrête à moins d'un demi-pixel) : la progression va de 0 à 1 000.
      vol = m.ressort({
        de: 0, vers: 1000, vitesse: vp * 1000, amortissement: 0.86, reponse: 0.44,
        surImage: (x) => {
          const p = x / 1000;
          appliquer({ x: lerp(R0.x, C.x, p), y: lerp(R0.y, C.y, p), w: lerp(R0.w, C.w, p), h: lerp(R0.h, C.h, p) },
            Math.max(0, lerp(r0, rayon, p)), Tfin * p);
          page.style.opacity = String(1 - borne((p - 0.55) / 0.45));
          voile.style.opacity = String(v0 * (1 - borne(p)));
          fondu(1);
          // La fin du ressort se joue sous un pixel, la fiche déjà fondue dans sa carte : on n'attend pas ce quart de seconde.
          if (p > 0.985 && vol) { vol.arreter(); quitter(); }
        },
        fin: () => { if (etat === 'part') quitter(); }
      });
    }

    // La fiche est dans sa carte : la copie passe devant tout, on recule pour de vrai dessous, sans transition. Quand la vraie
    // liste est revenue à sa position (ScrollRestorer) — ou au bout de 900 ms —, la copie se fond en 180 ms : les photos que
    // la liste remontée fait apparaître en fondu ne clignotent pas.
    function quitter() {
      vol = null; etat = 'parti';
      calque.classList.add('devant');
      const chemin = fige.chemin; const y = fige.defilement; const depuis = performance.now();
      const regarder = () => {
        const revenu = cheminSansPrefixe(window.location.pathname) === chemin && Math.abs(window.scrollY - y) < 2;
        if ((revenu && !document.querySelector('.fiche-page')) || performance.now() - depuis > 900) {
          html.classList.remove('fiche-tiree'); html.style.removeProperty('--fiche-tiree-fondu');
          calque.classList.add('efface');
          setTimeout(() => calque.remove(), 200);
          return;
        }
        requestAnimationFrame(regarder);
      };
      prochaineSansTransition();
      naviguer.current(-1);
      requestAnimationFrame(regarder);
    }

    page.addEventListener('touchstart', debut, { passive: true });
    page.addEventListener('touchmove', suite, { passive: false });
    page.addEventListener('touchend', fin, { passive: true });
    page.addEventListener('touchcancel', fin, { passive: true });
    return () => {
      page.removeEventListener('touchstart', debut);
      page.removeEventListener('touchmove', suite);
      page.removeEventListener('touchend', fin);
      page.removeEventListener('touchcancel', fin);
      // Partie dans sa carte : c'est quitter() qui retire la copie, une fois la liste revenue.
      if (etat === 'parti') return;
      vol?.arreter();
      calque.remove();
      nettoyer();
      fige.noeud.classList.remove('fiche-fond-copie');
      rendreEcranFige(fige);
    };
  }, [pageRef]);
  return null;
}
