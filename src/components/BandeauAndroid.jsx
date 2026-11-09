import { useState } from 'react';
import { useLanguage } from '../context/LanguageContext';
import { lienStore } from '../storesAppli';
import BrandMark from './BrandMark';
import Icone from './Icone';

/* « L'APPLI FAIRRIDE », UNE BANDE EN HAUT DU SITE, SUR ANDROID SEULEMENT (Owen, 2026-11-09). Quelqu'un qui scanne le QR d'un
 * flyer ou d'un autocollant sans avoir l'appli tombe sur le site : sur iPhone, Safari montre sa propre bannière (index.html,
 * apple-itunes-app) ; Android n'a rien d'équivalent (Chrome a retiré la sienne), d'où cette bande, faite pareil : la
 * marque, une ligne, « Installer », une croix.
 *
 * - Dans le flux, AU-DESSUS de l'en-tête collant : elle part en défilant, ne recouvre ni la barre du panier, ni la carte des
 *   cookies, ni les onglets du bas. Montée par la branche publique de Layout.jsx seulement (le visiteur sans compte, celui
 *   qui scanne) ; jamais dans l'app, qui n'a pas le cadre du site.
 * - « Installer » en contour iris, pas en lime : le lime de la page reste son action (commander), voir design.md.
 * - La croix la range 30 jours sur cet appareil ; sans stockage (navigation privée), elle se range pour la visite. */
const CLE = 'fairride_bandeau_android_ferme';
const DUREE = 30 * 24 * 3600 * 1000;

function estAndroid() {
  try { return /Android/i.test(navigator.userAgent || ''); } catch { return false; }
}
function dejaFerme() {
  try { return Date.now() - Number(localStorage.getItem(CLE) || 0) < DUREE; } catch { return false; }
}

export default function BandeauAndroid() {
  const { t } = useLanguage();
  const [ferme, setFerme] = useState(() => !estAndroid() || dejaFerme());
  if (ferme) return null;

  const fermer = () => {
    try { localStorage.setItem(CLE, String(Date.now())); } catch { /* navigation privée : rangée pour cette visite */ }
    setFerme(true);
  };
  return (
    <div className="bandeau-android" role="region" aria-label={t('landing.appBarTitle')}>
      <button type="button" className="bandeau-android-croix" onClick={fermer} aria-label={t('landing.appBarClose')}>
        <Icone nom="croix" taille={16} />
      </button>
      <BrandMark size={40} animer={false} />
      <span className="bandeau-android-texte">
        <strong>{t('landing.appBarTitle')}</strong>
        <small>{t('landing.appBarSub')}</small>
      </span>
      {/* Même onglet : Android remet l'adresse play.google.com à l'appli Play Store, un nouvel onglet resterait vide derrière. */}
      <a className="bandeau-android-bouton" href={lienStore('android', 'bandeau')} rel="noopener">
        {t('landing.appBarInstall')}
      </a>
    </div>
  );
}
