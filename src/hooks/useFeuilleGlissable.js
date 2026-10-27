import { useEffect, useRef } from 'react';
import { experienceApp, plateforme } from '../natif';
import { mouvementReduit } from '../gestes';

/* FEUILLE QU'ON TIRE VERS LE BAS POUR LA FERMER — la fiche d'un plat (FichePlat) et les sous-écrans du paiement
 * (SousEcran), sur téléphone.
 *
 * DEUX COMPORTEMENTS, SELON L'ENDROIT.
 *  - Sur le SITE : le geste d'avant, inchangé (il vivait dans FichePlat.jsx). La feuille suit le doigt ; au-delà de
 *    110 px, ou lancée vite, elle part ; sinon une transition CSS la remet en place. Aucun JavaScript de plus.
 *  - Dans l'APPLICATION (estNatif) : la même feuille, mais physique. On décide d'après l'endroit où l'élan la
 *    porterait (projection), pas d'après l'endroit où le doigt s'est levé ; elle repart à la vitesse du doigt
 *    (ressort, src/ressort.js, chargé seulement ici) ; au-dessus de sa position de repos elle résiste au lieu de
 *    buter ; et on peut la rattraper pendant qu'elle revient.
 *
 * Le geste ne démarre que si le contenu est tout en haut : sinon le doigt fait simplement défiler les options.
 *
 * LE RETOUR PAR LE BORD GAUCHE, SUR IPHONE (2026-10-27, fondateur : « dans Mon compte, les écrans n'ont pas le retour par
 * balayage parce qu'on les tire vers le bas ; le faire pour tout le monde »). Le doigt posé tout au bord gauche (BORD) et
 * tiré vers la droite : la feuille suit le doigt et découvre l'écran d'où elle a été ouverte, qui est vraiment derrière
 * (Mon compte, la fiche du commerce, le paiement) ; au lâcher, l'élan décide, comme le retour d'iOS. Les deux gestes
 * vivent ensemble : vers le bas d'où l'on veut, vers la droite depuis le bord. Le balayage de WebKit se tait pendant ce
 * temps (useDialogue → suspendreRetourIos), sinon il reculerait sous la feuille. Écouteurs natifs posés sur le panneau
 * (pas les props React) : le touchmove doit pouvoir empêcher le défilement, et une feuille ouverte par-dessus dans un
 * portail ne les déclenche pas. Android n'en a pas besoin : son geste Retour est celui du système (natif.js, backButton),
 * qui ferme la feuille du dessus. `bord: false` pour les petites fenêtres du bas (useTirerPourFermer) : comme une alerte
 * d'iOS, elles ne reculent pas.
 *
 * `fermerAnime` : fermeture du site (animation CSS de sortie). `fermerTout` : fermeture immédiate, utilisée quand le
 * ressort a déjà emmené la feuille hors de l'écran. */
const BORD = 24;
const SENS = 10;

export default function useFeuilleGlissable({ panneau, defile, fermerAnime, fermerTout = fermerAnime, bord = true }) {
  const geste = useRef(null);
  const anim = useRef(null);
  const module = useRef(null);
  // Le toucher en cours est parti du bord gauche : il appartient au retour, pas au tirage vers le bas.
  const parLeBord = useRef(false);
  const fermer = useRef(fermerTout);
  fermer.current = fermerTout;
  const natif = experienceApp() && !mouvementReduit();
  if (natif && !module.current) import('../ressort').then((m) => { module.current = m; }).catch(() => {});

  const poser = (y) => { if (panneau.current) panneau.current.style.transform = y ? `translateY(${y}px)` : ''; };

  useEffect(() => {
    const el = panneau.current;
    if (!bord || !el || plateforme() !== 'ios') return undefined;
    let m = null;
    import('../ressort').then((mod) => { m = mod; }).catch(() => {});
    let g = null;
    let vol = null;
    // Une ombre à gauche de la feuille pendant qu'elle part : blanc sur blanc, on ne verrait pas où elle s'arrête.
    const poserX = (x) => {
      el.style.transform = x ? `translateX(${x}px)` : '';
      el.style.boxShadow = x ? '-12px 0 32px rgba(20, 18, 31, .18)' : '';
    };
    function debut(e) {
      parLeBord.current = false;
      if (e.touches.length !== 1 || window.innerWidth > 900 || e.touches[0].clientX > BORD) return;
      parLeBord.current = true;
      // Rattrapée pendant qu'elle revient : on repart de la position affichée.
      let depart = 0;
      if (vol) {
        vol.arreter(); vol = null;
        const x = /translateX(([-d.]+)px)/.exec(el.style.transform);
        depart = x ? Number(x[1]) : 0;
      }
      const t = e.touches[0];
      g = { x0: t.clientX - depart, y0: t.clientY, x: depart, actif: depart > 0, suivi: m?.suiviVitesse() };
      g.suivi?.ajouter(t.clientX);
    }
    function suite(e) {
      if (!g) return;
      const t = e.touches[0];
      const dx = t.clientX - g.x0; const dy = t.clientY - g.y0;
      if (!g.actif) {
        // Vers le haut ou le bas d'abord : c'est un défilement, on le laisse.
        if (Math.abs(dy) > SENS && Math.abs(dy) > Math.abs(dx)) { g = null; return; }
        if (dx < SENS) return;
        g.actif = true;
        el.style.transition = 'none';
      }
      if (e.cancelable) e.preventDefault();
      g.x = Math.max(0, dx);
      g.suivi?.ajouter(t.clientX);
      poserX(g.x);
    }
    function fin() {
      if (!g) return;
      const { x, actif, suivi } = g; g = null;
      if (!actif) return;
      const largeur = el.offsetWidth || window.innerWidth;
      const v = suivi ? suivi.vitesse() : 0;
      // Comme iOS : au-delà de la moitié de l'écran là où l'élan la porterait, ou lancée franchement vers la droite.
      const part = m ? x + m.projeter(v) > largeur / 2 || v > 600 : x > largeur / 3;
      // Pas de vibration : le retour d'iOS n'en fait pas (gestes.js).
      if (!m || mouvementReduit()) {
        if (part) fermer.current(); else { el.style.transition = ''; poserX(0); }
        return;
      }
      vol = m.ressort({
        de: x, vers: part ? largeur : 0, vitesse: v, amortissement: 1, reponse: part ? 0.3 : 0.35,
        surImage: poserX,
        fin: () => { vol = null; if (part) fermer.current(); else el.style.transition = ''; }
      });
    }
    el.addEventListener('touchstart', debut, { passive: true });
    el.addEventListener('touchmove', suite, { passive: false });
    el.addEventListener('touchend', fin, { passive: true });
    el.addEventListener('touchcancel', fin, { passive: true });
    return () => {
      vol?.arreter();
      el.removeEventListener('touchstart', debut);
      el.removeEventListener('touchmove', suite);
      el.removeEventListener('touchend', fin);
      el.removeEventListener('touchcancel', fin);
    };
  }, [bord, panneau]);

  function onTouchStart(e) {
    if (parLeBord.current) return;
    if (window.innerWidth > 900 || (defile.current && defile.current.scrollTop > 0)) return;
    // Rattrapée en plein vol : on repart de la position AFFICHÉE, pas de zéro.
    let depart = 0;
    if (anim.current) {
      anim.current.arreter(); anim.current = null;
      const m = /translateY\(([-\d.]+)px\)/.exec(panneau.current?.style.transform || '');
      depart = m ? Number(m[1]) : 0;
    }
    const y0 = e.touches[0].clientY - depart;
    geste.current = { y0, t0: Date.now(), dy: depart, suivi: module.current?.suiviVitesse() };
    geste.current.suivi?.ajouter(e.touches[0].clientY);
  }

  function onTouchMove(e) {
    const g = geste.current; if (!g || !panneau.current) return;
    const brut = e.touches[0].clientY - g.y0;
    g.suivi?.ajouter(e.touches[0].clientY);
    if (defile.current && defile.current.scrollTop > 0) return;
    panneau.current.style.transition = 'none';
    // Vers le haut : résistance élastique dans l'app, rien sur le site (comme avant).
    g.dy = brut >= 0 ? brut : (natif && module.current ? module.current.elastique(brut, panneau.current.offsetHeight || 600) : 0);
    poser(g.dy);
  }

  function onTouchEnd() {
    const g = geste.current; geste.current = null; if (!g || !panneau.current) return;
    const m = module.current;
    if (!natif || !m) {
      const vitesse = g.dy / Math.max(1, Date.now() - g.t0);
      panneau.current.style.transition = '';
      if (g.dy > 110 || (g.dy > 40 && vitesse > 0.6)) { fermerAnime(); } else poser(0);
      return;
    }
    const v = g.suivi ? g.suivi.vitesse() : 0;
    const hauteur = panneau.current.offsetHeight || 600;
    // Fermer si l'élan l'emmène au-delà du tiers de sa hauteur — ou si on la lance franchement vers le bas.
    const part = g.dy + m.projeter(v) > hauteur / 3 || v > 900;
    const panneauEl = panneau.current;
    // Pas de vibration quand la feuille part : les feuilles de l'iPhone n'en font pas (2026-10-23, gestes.js).
    anim.current = m.ressort({
      de: g.dy, vers: part ? hauteur + 40 : 0, vitesse: v,
      amortissement: part ? 1 : 0.85, reponse: part ? 0.28 : 0.32,
      surImage: (y) => { panneauEl.style.transform = y ? `translateY(${y}px)` : ''; },
      fin: () => { anim.current = null; if (part) fermerTout(); else panneauEl.style.transition = ''; }
    });
  }

  return { onTouchStart, onTouchMove, onTouchEnd, onTouchCancel: onTouchEnd };
}
