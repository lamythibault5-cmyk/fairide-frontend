import { useState } from 'react';
import { useLocation } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { useLanguage } from '../context/LanguageContext';
import { experienceApp } from '../natif';
import EcranPlein from './EcranPlein';
import Icone from './Icone';

/* « REPÈRE CE BADGE. » — le badge « Prix du comptoir » expliqué UNE fois, avant la liste (fondateur, 2026-10-28, version A de
 * maquettes/badge-ecran/badge-ecran.html). Remplace la bulle et la fenêtre au toucher du badge (PrixComptoir.jsx) : la bulle
 * sortait au milieu du défilement et cachait la carte qu'elle expliquait.
 *
 * UN ÉCRAN FIXE. Les deux cartes sont des exemples dessinés (« Ta pizzeria », « Un autre restaurant »), jamais un vrai
 * commerce : l'écran ne change pas quand un restaurant gagne ou perd son badge, et ne dit pas combien l'ont (choix 5 de la
 * maquette). « Les autres restaurants : 10 % de plus au plus » parle d'un prix, comme « C'est réglé » : jamais de commission.
 *
 * QUI, QUAND. Dans l'app seulement (le site garde le titre au survol, choix 6), pour tout client connecté, une fois par
 * téléphone (`fairide_badge_explique`) : le nouveau compte comme celui qui se reconnecte, qui ne l'a jamais vu non plus. Sur la
 * liste et l'accueil, pas au milieu d'une commande. Juste après les notifications : l'amorce (AmorceNotifications.jsx,
 * .bv-par-dessus, z-index 200) passe au-dessus de cet écran plein (150), qui apparaît donc quand on l'a fermée. */
const CLE = 'fairide_badge_explique';
const PAGES = ['/', '/home', '/restaurants'];

function dejaVu() {
  try { return localStorage.getItem(CLE) === 'vu'; } catch { return true; }
}

export default function EcranBadge() {
  const { user, role } = useAuth();
  const { t } = useLanguage();
  const { pathname } = useLocation();
  const [ouvert, setOuvert] = useState(() => !dejaVu());

  if (!ouvert || !user || user.isAdmin || role !== 'client' || !experienceApp() || !PAGES.includes(pathname)) return null;

  const compris = () => {
    try { localStorage.setItem(CLE, 'vu'); } catch { /* stockage indisponible : il reviendra, sans gravité */ }
    setOuvert(false);
  };
  return (
    <EcranPlein etiquette={t('appli.badgeTitre')} classe="bv-bandeau bv-badge-plein">
      <main className="bv-ecran bv-badge">
        <h1 className="bv-titre">{t('appli.badgeTitre')}</h1>
        <div className="bv-feuille">
          <span className="bv-badge-exemple">{t('appli.badgeExemple')}</span>
          {/* Dessin seulement : les lecteurs d'écran lisent la phrase qui suit. */}
          <div aria-hidden="true">
            <div className="bv-badge-carte vedette">
              <div className="bv-badge-photo"><i /></div>
              <div className="bv-badge-corps">
                <b>{t('appli.badgeCarte1')}</b>
                <span>{t('appli.badgeCarte1S')}</span>
                <span className="prix-comptoir bv-badge-pastille"><Icone nom="etiquette" taille={14} />{t('common.prixComptoir')}</span>
              </div>
            </div>
            <div className="bv-badge-carte efface">
              <div className="bv-badge-photo"><i /></div>
              <div className="bv-badge-corps">
                <b>{t('appli.badgeCarte2')}</b>
                <span>{t('appli.badgeCarte2S')}</span>
              </div>
            </div>
          </div>
          <p className="bv-badge-phrase">{t('appli.badgePhrase')}</p>
          <p className="bv-sous">{t('appli.badgeSous')}</p>
          <div className="bv-grandit" />
          <button type="button" className="bv-btn btn-gold" onClick={compris}>{t('appli.badgeBtn')}</button>
        </div>
      </main>
    </EcranPlein>
  );
}
