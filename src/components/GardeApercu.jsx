import { useEffect, useRef } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { cheminPermisEnApercu, signalerAuSite } from '../apercuSite';

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
    const arreter = (e) => {
      if (e.defaultPrevented || e.button !== 0) return;
      const a = e.target?.closest?.('a[href]');
      if (!a) return;
      let url;
      try { url = new URL(a.getAttribute('href'), window.location.href); } catch { return; }
      if (url.origin !== window.location.origin || cheminPermisEnApercu(url.pathname)) return;
      e.preventDefault();
      e.stopPropagation();
      signalerAuSite({ type: 'ouvrir', chemin: url.pathname });
    };
    // Sur window, en capture : il entend le clic avant tout écouteur du document (NavigationFeedback y lance sa barre de chargement).
    window.addEventListener('click', arreter, true);
    return () => window.removeEventListener('click', arreter, true);
  }, []);

  useEffect(() => {
    if (cheminPermisEnApercu(pathname)) { dernierPermis.current = `${pathname}${search}`; return; }
    signalerAuSite({ type: 'ouvrir', chemin: pathname });
    navigate(dernierPermis.current, { replace: true });
  }, [pathname, search, navigate]);

  return null;
}
