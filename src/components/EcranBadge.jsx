import { useState } from 'react';
import { useLocation } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { useLanguage } from '../context/LanguageContext';
import { experienceApp } from '../natif';
import EcranPlein from './EcranPlein';
import Icone from './Icone';

/* LE BADGE « PRIX DU COMPTOIR » EXPLIQUÉ UNE FOIS, AVANT LA LISTE. Remplace la bulle et la fenêtre au toucher du badge
 * (PrixComptoir.jsx) : la bulle sortait au milieu du défilement et cachait la carte qu'elle expliquait.
 *
 * LE BADGE EN GRAND (fondateur, 2026-10-28, version A de maquettes/badge-simple/badge-simple.html : « fais exactement ça »).
 * Tout l'écran en iris, comme le premier écran de l'accueil : au milieu le badge en très grand, qui brille en lime, « Le même
 * prix que sur place. », « Les autres : 10 % de plus au plus. », « Compris ». 17 mots. La première version du même jour
 * (deux fausses cartes, « Exemple », deux phrases, ≈ 37 mots) était « pas assez simple ». L'écran ne dit pas combien de
 * restaurants l'ont : il ne change jamais. « 10 % de plus au plus » parle d'un prix, comme « C'est réglé » : jamais de
 * commission.
 *
 * QUI, QUAND (maquettes/badge-ecran, choix 2, 3 et 6). Dans l'app seulement (le site garde le titre au survol), pour tout client
 * connecté, une fois par téléphone (`fairide_badge_explique`) : le nouveau compte comme celui qui se reconnecte. Sur la liste et
 * l'accueil, pas au milieu d'une commande. Juste après les notifications : l'amorce (AmorceNotifications.jsx, .bv-par-dessus,
 * z-index 200) passe au-dessus de cet écran plein (150), qui apparaît donc quand on l'a fermée. */
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
    <EcranPlein etiquette={t('common.prixComptoir')} classe="bv-iris bv-badge-plein">
      <main className="bv-ecran bv-badge">
        <div className="bv-grandit" />
        <div className="bv-centre">
          <span className="prix-comptoir bv-badge-geant"><Icone nom="etiquette" taille={28} />{t('common.prixComptoir')}</span>
          <h1 className="bv-titre bv-badge-titre">{t('appli.badgePhrase')}</h1>
          <p className="bv-sous">{t('appli.badgeSous')}</p>
        </div>
        <div className="bv-grandit" />
        <button type="button" className="bv-btn btn-gold" onClick={compris}>{t('appli.badgeBtn')}</button>
      </main>
    </EcranPlein>
  );
}
