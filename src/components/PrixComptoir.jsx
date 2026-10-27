import { useEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { useLanguage } from '../context/LanguageContext';
import Icone from './Icone';
import Modale from './Modale';

// BADGE « PRIX DU COMPTOIR » (fondateur, 2026-10-19 : « faire fortement envie aux commerces de garder leurs prix magasin »).
// Sur la liste, la recherche et la fiche d'un commerce dont la carte affiche AUJOURD'HUI les prix de son comptoir : prix
// relevés en magasin par l'équipe ET aucune hausse (restaurant.prixComptoir, prixMagasin.prixDuComptoir côté serveur). Un
// commerce qui monte ses prix, ou dont l'équipe retire la coche, le perd tout seul.
//
// Il ne parle jamais de commission (fondateur, 2026-10-19 : dans l'app, le client ne voit pas que Fairide prend une part) :
// il dit seulement un fait vérifié sur CE commerce.
//
// LE CLIENT DOIT LE COMPRENDRE (fondateur, 2026-10-27, version D de maquettes/badge-position/badge-position.html, app et site) :
//   - le toucher ouvre une petite fenêtre qui l'explique (avant, l'explication n'existait qu'au survol, invisible sur téléphone) ;
//     dans une carte de la liste, le toucher n'ouvre donc plus la fiche ;
//   - la première fois qu'un badge est bien visible à l'écran, une bulle le montre, une seule fois par appareil
//     (fairide_bulle_comptoir). Le premier écran de l'accueil de l'app le présente aussi (EcransBienvenue.jsx, BarresPlat).
const CLE_BULLE = 'fairide_bulle_comptoir';
// Une seule bulle à la fois pour toute la page : le premier badge visible la prend.
let bullePrise = false;

function bulleDejaVue() {
  try { return localStorage.getItem(CLE_BULLE) === 'vue'; } catch { return true; }
}

function marquerBulleVue() {
  try { localStorage.setItem(CLE_BULLE, 'vue'); } catch { /* stockage indisponible : elle reviendra, sans gravité */ }
}

const LARGEUR_BULLE = 264;

export default function PrixComptoir() {
  const { t } = useLanguage();
  const badge = useRef(null);
  const [ouvert, setOuvert] = useState(false);
  // { gauche, haut, fleche, dessous } en coordonnées de la page : la bulle défile avec elle.
  const [bulle, setBulle] = useState(null);

  // La bulle attend que le badge soit entièrement visible, loin des bords, sans fenêtre ouverte par-dessus (amorce des
  // notifications juste après l'inscription, panier…) : sinon elle passerait au-dessus d'elle ou montrerait un badge caché.
  useEffect(() => {
    const el = badge.current;
    if (!el || bullePrise || bulleDejaVue() || typeof IntersectionObserver !== 'function') return undefined;
    let fini = false;
    let minuteur;
    const essayer = () => {
      if (fini || bullePrise) return;
      if (document.querySelector('[aria-modal="true"]')) { minuteur = setTimeout(essayer, 1000); return; }
      const r = el.getBoundingClientRect();
      if (!r.width || r.top < 90 || r.bottom > window.innerHeight - 130 || r.left < 0 || r.right > window.innerWidth) return;
      bullePrise = true;
      marquerBulleVue();
      observateur.disconnect();
      const dessous = r.top < 200;
      const gauche = Math.min(Math.max(r.left - 14, 12), window.innerWidth - LARGEUR_BULLE - 12);
      setBulle({ gauche: gauche + window.scrollX, haut: (dessous ? r.bottom + 12 : r.top - 12) + window.scrollY, fleche: r.left + 22 - gauche, dessous });
    };
    const observateur = new IntersectionObserver(([e]) => {
      clearTimeout(minuteur);
      if (e.isIntersecting) minuteur = setTimeout(essayer, 900);
    }, { threshold: 1 });
    observateur.observe(el);
    return () => { fini = true; observateur.disconnect(); clearTimeout(minuteur); };
  }, []);

  // Une rangée qui glisse de côté emporte le badge sans la bulle : elle se ferme. Le défilement de la page, lui, l'emporte avec.
  useEffect(() => {
    if (!bulle) return undefined;
    const surDefilement = (e) => { if (e.target !== document && e.target !== document.documentElement) setBulle(null); };
    window.addEventListener('scroll', surDefilement, { capture: true, passive: true });
    return () => window.removeEventListener('scroll', surDefilement, { capture: true });
  }, [bulle]);

  // Dans une carte de la liste (un lien), le badge explique au lieu d'ouvrir la fiche.
  function expliquer(e) {
    e.preventDefault();
    e.stopPropagation();
    setBulle(null);
    setOuvert(true);
  }

  return (
    <>
      <span ref={badge} className="prix-comptoir" role="button" tabIndex={0} title={t('common.prixComptoirTitre')}
        aria-haspopup="dialog" onClick={expliquer}
        onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') expliquer(e); }}>
        <Icone nom="etiquette" taille={13} />
        {t('common.prixComptoir')}
        <span className="sr-only">. {t('common.prixComptoirTitre')}</span>
      </span>
      {bulle && createPortal(
        <div className={`bulle-comptoir${bulle.dessous ? ' dessous' : ''}`} role="status"
          style={{ left: bulle.gauche, top: bulle.haut, width: LARGEUR_BULLE, '--fleche': `${bulle.fleche}px` }}>
          <b>{t('common.prixComptoir')}</b> : {t('common.prixComptoirBulle')}
          <button type="button" onClick={() => setBulle(null)}>{t('common.prixComptoirCompris')}</button>
        </div>,
        document.body
      )}
      {ouvert && (
        <Modale ariaLabel={t('common.prixComptoir')} onFermer={() => setOuvert(false)} classeBoite="feuille-comptoir">
          <span className="prix-comptoir prix-comptoir-grand"><Icone nom="etiquette" taille={15} />{t('common.prixComptoir')}</span>
          <p className="feuille-comptoir-titre">{t('common.prixComptoirFeuilleTitre')}</p>
          <p className="feuille-comptoir-texte">{t('common.prixComptoirFeuilleTexte')}</p>
          <button type="button" className="btn-gold feuille-comptoir-btn" onClick={() => setOuvert(false)}>{t('common.prixComptoirCompris')}</button>
        </Modale>
      )}
    </>
  );
}
