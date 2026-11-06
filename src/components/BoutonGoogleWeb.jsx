import { useEffect, useRef, useState } from 'react';
import { useLanguage } from '../context/LanguageContext';
import { chargerGoogleSignIn } from '../googleSignIn';
import { LogoGoogle } from './BoutonsConnexionNative';

const GOOGLE_CLIENT_ID = import.meta.env.VITE_GOOGLE_CLIENT_ID || '';

/* « Continuer avec Google » HORS DE L'APPLICATION, sur les écrans de l'application (site ajouté à l'écran d'accueil,
 * 2026-11-06). Ces écrans ne montraient Google que dans la vraie application (feuille native) : un compte Google, sans mot
 * de passe, ne pouvait pas s'y connecter. Même déroulé que la page de connexion du site (Auth.jsx) : notre bouton ne charge
 * le script de Google qu'au clic (politique des cookies), le bouton officiel de Google prend sa place et le choix du compte
 * s'ouvre tout de suite (prompt) ; `onJeton` reçoit { fournisseur: 'google', jeton }. */
export default function BoutonGoogleWeb({ onJeton, disabled = false }) {
  const { t, language } = useLanguage();
  const [demande, setDemande] = useState(false);
  const zone = useRef(null);
  const rappel = useRef(onJeton);
  useEffect(() => { rappel.current = onJeton; });

  useEffect(() => {
    if (!demande) return undefined;
    let annule = false;
    chargerGoogleSignIn().then((gsi) => {
      if (annule || !zone.current) return;
      zone.current.innerHTML = '';
      gsi.initialize({ client_id: GOOGLE_CLIENT_ID, callback: (r) => r?.credential && rappel.current({ fournisseur: 'google', jeton: r.credential }), use_fedcm_for_prompt: true });
      gsi.renderButton(zone.current, { theme: 'outline', size: 'large', width: Math.min(360, zone.current.offsetWidth || 320), text: 'continue_with', locale: language });
      try { gsi.prompt(); } catch { /* le bouton officiel suffit */ }
    }).catch(() => { if (!annule) setDemande(false); });
    return () => { annule = true; };
  }, [demande, language]);

  if (!GOOGLE_CLIENT_ID) return null;
  if (demande) return <div ref={zone} className="bouton-google-web" />;
  return (
    <button type="button" className="btn-connexion btn-connexion-google" disabled={disabled} onClick={() => setDemande(true)}>
      <LogoGoogle /> {t('appli.continueGoogle')}
    </button>
  );
}
