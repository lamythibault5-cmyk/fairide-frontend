import { useEffect } from 'react';
import { mouvementReduit, vibrer } from '../gestes';

/* TIRER LA PHOTO VERS LE BAS POUR QUITTER LA FICHE (fondateur, 2026-10-23 : « comme les feuilles de Mon compte, qu'on
 * tire pour en sortir »). Application seulement (monté par RestaurantMenu.jsx quand estNatif()).
 *
 * Le doigt posé sur la photo, page tout en haut, on tire vers le bas : toute la fiche suit le doigt et rétrécit un peu,
 * comme une carte qu'on repose. Au lâcher, si l'élan l'emporte au-delà de SEUIL, on « touche » la croix de la fiche : c'est
 * elle qui ramène à la liste, avec la photo qui rentre dans sa carte (transitionPhoto.js), partie de là où le doigt l'a
 * laissée ; la fiche démontée emporte son déplacement. Sinon la fiche remonte, au ressort, à la vitesse du doigt.
 *
 * Écouteurs posés sur le HAUT DE LA FICHE (la photo et la feuille blanche dessous, fondateur : « même l'espace blanc du haut
 * où il n'y a rien ») : un toucher plus bas ne passe jamais par ici, et le défilement de la page n'attend pas JavaScript
 * (voir RetourParGlissement.jsx). Un toucher sur un bouton, un lien ou un champ reste à eux ; un mouvement de côté n'est pas
 * un retour. */
const SEUIL = 150;
const SENS = 10;

export default function FermerFicheParGlissement({ pageRef }) {
  useEffect(() => {
    const page = pageRef.current;
    const photo = page?.querySelector('.fiche-entete');
    if (!page || !photo || mouvementReduit()) return undefined;
    let m = null;
    import('../ressort').then((mod) => { m = mod; }).catch(() => {});
    let g = null;
    let vol = null;

    const poser = (y) => {
      page.style.transform = y ? `translateY(${y}px) scale(${1 - Math.min(0.08, y / 2400)})` : '';
      page.style.borderRadius = y ? `${Math.min(28, y / 3)}px` : '';
    };
    const finir = () => {
      page.style.willChange = ''; page.style.transformOrigin = ''; page.style.overflow = ''; page.style.boxShadow = ''; page.style.background = '';
      document.documentElement.classList.remove('fiche-glisse');
    };

    function debut(e) {
      if (!m || e.touches.length !== 1 || window.scrollY > 0) return;
      if (e.target.closest?.('a, button, input, select, textarea, label, [role="button"], .fiche-modes')) return;
      vol?.arreter();
      const t = e.touches[0];
      g = { x0: t.clientX, y0: t.clientY, y: 0, actif: false, suivi: m.suiviVitesse() };
      g.suivi.ajouter(t.clientY);
    }
    function suite(e) {
      if (!g) return;
      const t = e.touches[0];
      const dx = t.clientX - g.x0; const dy = t.clientY - g.y0;
      if (!g.actif) {
        if (Math.abs(dx) > SENS && Math.abs(dx) >= Math.abs(dy)) { g = null; return; }
        if (dy < SENS) { if (dy < -SENS) g = null; return; }
        g.actif = true;
        page.style.willChange = 'transform'; page.style.transformOrigin = '50% 0'; page.style.overflow = 'hidden';
        page.style.boxShadow = '0 -10px 40px rgba(20, 18, 31, .25)'; page.style.background = '#fff';
        document.documentElement.classList.add('fiche-glisse');
      }
      if (e.cancelable) e.preventDefault();
      const y = dy - SENS;
      if ((g.y < SEUIL) !== (y < SEUIL) && y >= SEUIL) vibrer(8);
      g.y = Math.max(0, y);
      g.suivi.ajouter(t.clientY);
      poser(g.y);
    }
    function fin() {
      if (!g) return;
      const { y, actif, suivi } = g; g = null;
      if (!actif) return;
      const v = suivi.vitesse();
      if (y + m.projeter(v) > SEUIL) {
        const croix = page.querySelector('.flux-entete .flux-bouton--fermer');
        if (croix) { croix.click(); return; }
      }
      vol = m.ressort({ de: y, vers: 0, vitesse: v, amortissement: 1, reponse: 0.3, surImage: poser, fin: finir });
    }

    photo.addEventListener('touchstart', debut, { passive: true });
    photo.addEventListener('touchmove', suite, { passive: false });
    photo.addEventListener('touchend', fin, { passive: true });
    photo.addEventListener('touchcancel', fin, { passive: true });
    return () => {
      vol?.arreter();
      photo.removeEventListener('touchstart', debut);
      photo.removeEventListener('touchmove', suite);
      photo.removeEventListener('touchend', fin);
      photo.removeEventListener('touchcancel', fin);
      poser(0); finir();
    };
  }, [pageRef]);

  return null;
}
