import { useEffect, useMemo } from 'react';
import { Navigate, useSearchParams } from 'react-router-dom';
import { useLanguage } from '../../context/LanguageContext';
import { estNatif } from '../../natif';
import BrandMark from '../../components/BrandMark';
import { Feuille } from './EcransBienvenue';

/* RETOUR DANS L'APPLICATION APRÈS STRIPE (2026-10-21, vérification Stripe site / app).
 *
 * Dans l'app, Stripe s'ouvre dans le navigateur intégré (Custom Tab sur Android, allerAuPaiement dans natif.js). Après le
 * paiement, Stripe renvoie à une adresse https://fairride.be/… : rien ne garantit qu'Android la rende à l'application. Le
 * lien d'application (assetlinks.json) doit être vérifié, et Chrome refuse souvent de passer la main sur une redirection
 * automatique, sans geste de la personne. Elle restait alors sur le SITE, déconnecté, dans le navigateur intégré.
 *
 * Quand la commande vient de l'app (en-tête X-Fairide-Appli, api.js), le serveur fait revenir Stripe ICI, avec la page à
 * ouvrir dans `vers` :
 *   - dans l'application (le lien est passé) : on va tout de suite à `vers` ;
 *   - dans le navigateur, sur Android : un essai automatique, puis un grand bouton. Le bouton est un lien `intent://` qui
 *     nomme le paquet de l'app (be.fairide.app) : touché du doigt, Android ouvre l'application à coup sûr, vérification du
 *     lien ou pas. L'app reçoit l'adresse (appUrlOpen, natif.js), ferme le navigateur intégré et ouvre la page.
 *   - sur iPhone / iPad (revue du 24/10) : /retour-appli est maintenant un lien universel (apple-app-site-association),
 *     donc la redirection de Stripe ouvre normalement l'app sans passer par cette page. Si iOS ne passe pas la main, le
 *     bouton ne peut PAS être un lien https://fairride.be/… : iOS n'ouvre jamais l'app pour un lien vers le domaine de la
 *     page affichée. Il prend le schéma de l'app, `fairide:///chemin` (déclaré dans ios/App/App/Info.plist,
 *     CFBundleURLTypes ; appUrlOpen de natif.js l'accepte déjà). Pas d'essai automatique : Safari refuse ou demande pour
 *     un schéma ouvert sans geste.
 *   - ailleurs (pas d'app) : un lien simple vers la page du site.
 * Fermer le navigateur intégré par sa croix reste possible : l'app rejoint alors la page de retour gardée (browserFinished). */
const PAQUET_ANDROID = 'be.fairide.app';
const PAR_DEFAUT = '/orders';

/* Seulement une page de Fairide (revue du 24/10 : `?vers=/%09/evil.com` passait l'ancien test, le navigateur retire la
 * tabulation et lisait « //evil.com », un autre site). On refuse tout caractère de contrôle, espace ou « \ » (que le
 * navigateur nettoie ou lit comme « / »), puis on fait lire l'adresse par le navigateur lui-même : elle doit rester sur
 * notre origine, et le chemin qu'il en tire ne doit pas commencer par « // » (« /a/..//evil.com » le donnerait). */
function cheminSur(brut) {
  const v = String(brut || '');
  if (!v.startsWith('/') || v.startsWith('//')) return PAR_DEFAUT;
  for (const c of v) {
    const code = c.charCodeAt(0);
    if (code <= 0x20 || code === 0x7f || c === '\\') return PAR_DEFAUT;
  }
  try {
    const u = new URL(v, window.location.origin);
    const chemin = `${u.pathname}${u.search}${u.hash}`;
    return u.origin === window.location.origin && !chemin.startsWith('//') ? chemin : PAR_DEFAUT;
  } catch {
    return PAR_DEFAUT;
  }
}

function surIos() {
  if (typeof navigator === 'undefined') return false;
  // L'iPad récent se présente comme un Mac : on le reconnaît à l'écran tactile.
  return /iPhone|iPad|iPod/i.test(navigator.userAgent) || (/Macintosh/.test(navigator.userAgent) && navigator.maxTouchPoints > 1);
}

export default function RetourAppli() {
  const { t } = useLanguage();
  const [params] = useSearchParams();
  const vers = cheminSur(params.get('vers'));
  const android = typeof navigator !== 'undefined' && /android/i.test(navigator.userAgent);
  const ios = !android && surIos();
  const lienApp = useMemo(() => {
    if (android) return `intent://${window.location.host}${vers}#Intent;scheme=https;package=${PAQUET_ANDROID};end`;
    // « fairide:///orders » : hôte vide, donc new URL(…).pathname vaut « /orders » dans appUrlOpen (natif.js).
    if (ios) return `fairide://${vers}`;
    return vers;
  }, [android, ios, vers]);

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
