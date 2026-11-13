import { useEffect, useRef } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { cheminPermisEnApercu, signalerAuSite } from '../apercuSite';
import { cheminSansPrefixe } from '../i18n/routing';
import { brancherGlisserSouris } from '../glisserSouris';

/* LE FAUX TÉLÉPHONE NE QUITTE PAS RESTAURANTS ET CARTE (apercuSite.js ; Owen, 2026-11-12 : « quand on clique, ça nous demande
 * de l'installer ou de créer un compte »). Deux filets :
 *   1. un lien vers une autre page (un commerce, la connexion, une demande de restaurant…) est arrêté AVANT React (écouteur
 *      en phase de capture sur window : les gestionnaires de React sont posés sur la racine, plus bas) et passé au site,
 *      qui ouvre sa fenêtre — la carte d'un commerce mène à sa fiche dans l'aperçu (murCompte.js), le site sait donc lequel ;
 *   2. une navigation qui passerait quand même (un bouton qui appelle navigate, pas un lien) est annulée : retour sur la page
 *      d'avant, et la même fenêtre côté site.
 * Le html reçoit `apercu` pour la CSS (défilement qui ne fuit pas vers la page du site, styles.css). */
export default function GardeApercu() {
  const { pathname, search } = useLocation();
  const navigate = useNavigate();
  const dernierPermis = useRef('/restaurants');

  useEffect(() => {
    document.documentElement.classList.add('apercu');
    // Glisser à la souris comme au doigt (glisserSouris.js). Branché AVANT la garde ci-dessous : le clic qui termine un glissé
    // est arrêté avant qu'elle ne le prenne pour un toucher sur un restaurant.
    const debrancherGlisser = brancherGlisserSouris();
    const arreter = (e) => {
      if (e.defaultPrevented || e.button !== 0) return;
      const a = e.target?.closest?.('a[href]');
      if (!a) return;
      let url;
      try { url = new URL(a.getAttribute('href'), window.location.href); } catch { return; }
      // Le href d'un lien porte le préfixe de langue (/en/map, /nl/restaurants/…, i18n/routing.js) : on compare et on passe au
      // site le chemin SANS préfixe, comme le lit le routeur. Sinon, en anglais ou en néerlandais, l'onglet Carte était pris
      // pour une sortie du téléphone (fenêtre « Crée ton compte » sans commerce, Owen, 2026-11-12).
      const chemin = cheminSansPrefixe(url.pathname);
      if (url.origin !== window.location.origin || cheminPermisEnApercu(chemin)) return;
      e.preventDefault();
      e.stopPropagation();
      signalerAuSite({ type: 'ouvrir', chemin });
    };
    // Sur window, en capture : il entend le clic avant tout écouteur du document (NavigationFeedback y lance sa barre de chargement).
    window.addEventListener('click', arreter, true);
    // On fait défiler le téléphone : le site met ses animations en pause (EssaiAppli.jsx). Le cadre partage le fil principal de
    // la page (même origine) ; les vélos animés de l'accueil (SVG, redessinés à chaque image) lui volaient des images : 36 images
    // en retard sur 279 dans le faux téléphone contre 4 sur 306 pour le même cadre seul (Chrome, site construit, 2026-11-12).
    // Un message au plus tous les 250 ms, capturé pour entendre aussi le défilement des rangées et de la carte.
    let dernier = 0;
    const actif = () => { const n = Date.now(); if (n - dernier > 250) { dernier = n; signalerAuSite({ type: 'actif' }); } };
    window.addEventListener('scroll', actif, { capture: true, passive: true });
    window.addEventListener('pointerdown', actif, { capture: true, passive: true });
    return () => {
      debrancherGlisser();
      window.removeEventListener('click', arreter, true);
      window.removeEventListener('scroll', actif, { capture: true });
      window.removeEventListener('pointerdown', actif, { capture: true });
    };
  }, []);

  useEffect(() => {
    if (cheminPermisEnApercu(pathname)) { dernierPermis.current = `${pathname}${search}`; return; }
    signalerAuSite({ type: 'ouvrir', chemin: pathname });
    navigate(dernierPermis.current, { replace: true });
  }, [pathname, search, navigate]);

  return null;
}
