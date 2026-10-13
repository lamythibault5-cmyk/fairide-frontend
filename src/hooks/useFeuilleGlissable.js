import { useRef } from 'react';
import { estNatif } from '../natif';
import { mouvementReduit, vibrer } from '../gestes';

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
 * `fermerAnime` : fermeture du site (animation CSS de sortie). `fermerTout` : fermeture immédiate, utilisée quand le
 * ressort a déjà emmené la feuille hors de l'écran. */
export default function useFeuilleGlissable({ panneau, defile, fermerAnime, fermerTout = fermerAnime }) {
  const geste = useRef(null);
  const anim = useRef(null);
  const module = useRef(null);
  const natif = estNatif() && !mouvementReduit();
  if (natif && !module.current) import('../ressort').then((m) => { module.current = m; }).catch(() => {});

  const poser = (y) => { if (panneau.current) panneau.current.style.transform = y ? `translateY(${y}px)` : ''; };

  function onTouchStart(e) {
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
      if (g.dy > 110 || (g.dy > 40 && vitesse > 0.6)) { vibrer(8); fermerAnime(); } else poser(0);
      return;
    }
    const v = g.suivi ? g.suivi.vitesse() : 0;
    const hauteur = panneau.current.offsetHeight || 600;
    // Fermer si l'élan l'emmène au-delà du tiers de sa hauteur — ou si on la lance franchement vers le bas.
    const part = g.dy + m.projeter(v) > hauteur / 3 || v > 900;
    const panneauEl = panneau.current;
    if (part) vibrer(8);
    anim.current = m.ressort({
      de: g.dy, vers: part ? hauteur + 40 : 0, vitesse: v,
      amortissement: part ? 1 : 0.85, reponse: part ? 0.28 : 0.32,
      surImage: (y) => { panneauEl.style.transform = y ? `translateY(${y}px)` : ''; },
      fin: () => { anim.current = null; if (part) fermerTout(); else panneauEl.style.transition = ''; }
    });
  }

  return { onTouchStart, onTouchMove, onTouchEnd, onTouchCancel: onTouchEnd };
}
