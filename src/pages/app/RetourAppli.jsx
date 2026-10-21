import { useEffect, useMemo } from 'react';
import { Navigate, useSearchParams } from 'react-router-dom';
import { useLanguage } from '../../context/LanguageContext';
import { estNatif } from '../../natif';
import BrandMark from '../../components/BrandMark';
import { Feuille } from './EcransBienvenue';

/* RETOUR DANS L'APPLICATION APRÈS STRIPE (2026-10-21, vérification Stripe site / app).
 *
 * Dans l'app, Stripe s'ouvre dans le navigateur intégré (Custom Tab sur Android, allerAuPaiement dans natif.js). Après le
 * paiement, Stripe renvoie à une adresse https://fairide.be/… : rien ne garantit qu'Android la rende à l'application. Le
 * lien d'application (assetlinks.json) doit être vérifié, et Chrome refuse souvent de passer la main sur une redirection
 * automatique, sans geste de la personne. Elle restait alors sur le SITE, déconnecté, dans le navigateur intégré.
 *
 * Quand la commande vient de l'app (en-tête X-Fairide-Appli, api.js), le serveur fait revenir Stripe ICI, avec la page à
 * ouvrir dans `vers` :
 *   - dans l'application (le lien est passé) : on va tout de suite à `vers` ;
 *   - dans le navigateur, sur Android : un essai automatique, puis un grand bouton. Le bouton est un lien `intent://` qui
 *     nomme le paquet de l'app (be.fairide.app) : touché du doigt, Android ouvre l'application à coup sûr, vérification du
 *     lien ou pas. L'app reçoit l'adresse (appUrlOpen, natif.js), ferme le navigateur intégré et ouvre la page.
 *   - ailleurs (pas d'app Android) : un lien simple vers la page du site.
 * Fermer le navigateur intégré par sa croix reste possible : l'app rejoint alors la page de retour gardée (browserFinished). */
const PAQUET_ANDROID = 'be.fairide.app';

// Seulement une page de Fairide : un chemin qui commence par « / », jamais « // » (autre site) ni un schéma.
function cheminSur(brut) {
  const v = String(brut || '');
  return v.startsWith('/') && !v.startsWith('//') && !v.includes('\\') ? v : '/orders';
}

export default function RetourAppli() {
  const { t } = useLanguage();
  const [params] = useSearchParams();
  const vers = cheminSur(params.get('vers'));
  const android = typeof navigator !== 'undefined' && /android/i.test(navigator.userAgent);
  const lienApp = useMemo(
    () => (android ? `intent://${window.location.host}${vers}#Intent;scheme=https;package=${PAQUET_ANDROID};end` : vers),
    [android, vers]
  );

  // Essai sans geste : Chrome le laisse souvent passer juste après le « Payer » de Stripe ; sinon il ne se passe rien et
  // le bouton est là.
  useEffect(() => {
    if (estNatif() || !android) return;
    window.location.href = lienApp;
  }, [android, lienApp]);

  if (estNatif()) return <Navigate to={vers} replace />;

  return (
    <div className="bv bv-bandeau">
      <main className="bv-ecran">
        <div className="bv-haut"><BrandMark size={36} /></div>
        <h1 className="bv-titre">{t('retourAppli.titre')}</h1>
        <Feuille>
          <p style={{ margin: '4px 0 0' }}>{t('retourAppli.texte')}</p>
          <div className="bv-grandit" />
          <a className="bv-btn btn-gold" href={lienApp}>{t('retourAppli.bouton')}</a>
          <a className="bv-lien" href={vers}>{t('retourAppli.site')}</a>
        </Feuille>
      </main>
    </div>
  );
}
