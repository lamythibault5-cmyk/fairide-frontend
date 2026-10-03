import { useEffect, useState } from 'react';
import { useLanguage } from '../context/LanguageContext';

// Bandeau « hors ligne » (plan de test DEV-11, 2 octobre 2026) : en mode avion au milieu d'un checkout ou d'un suivi
// de commande, rien ne le disait — le suivi restait figé sans explication, et un clic sur « Payer » ne donnait qu'un
// toast de 3 secondes. Le navigateur signale lui-même la perte et le retour du réseau ; le suivi se resynchronise
// seul au retour (sondage), ce bandeau dit seulement ce qui se passe entre-temps.
export default function BandeauHorsLigne() {
  const { t } = useLanguage();
  const [horsLigne, setHorsLigne] = useState(() => typeof navigator !== 'undefined' && navigator.onLine === false);
  useEffect(() => {
    const maj = () => setHorsLigne(navigator.onLine === false);
    window.addEventListener('online', maj);
    window.addEventListener('offline', maj);
    return () => { window.removeEventListener('online', maj); window.removeEventListener('offline', maj); };
  }, []);
  if (!horsLigne) return null;
  return (
    <div className="bandeau-hors-ligne" role="status" aria-live="polite">
      {t('common.offlineBanner')}
    </div>
  );
}
