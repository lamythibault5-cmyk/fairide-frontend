import { useEffect, useState } from 'react';
import { useLanguage } from '../context/LanguageContext';
import { getConsent, setConsent } from '../consent';

// Bannière de consentement. Refuser doit être aussi simple qu'accepter (RGPD + directive ePrivacy) :
// les deux boutons sont donc côte à côte, de même taille et de même poids visuel — pas un bouton doré
// bien visible face à un lien discret, schéma que l'APD/GBA sanctionne précisément.
// Le choix réel ('accepted' | 'refused') est stocké par consent.js, seule source lue par le reste de
// l'app (aujourd'hui Sentry, voir main.jsx).
export default function CookieBanner() {
  const { t } = useLanguage();
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    if (!getConsent()) setVisible(true);
  }, []);

  function choose(value) {
    setConsent(value);
    setVisible(false);
  }

  if (!visible) return null;

  return (
    <div
      role="dialog"
      aria-live="polite"
      aria-label={t('cookies.text')}
      style={{
        position: 'fixed', bottom: 0, left: 0, right: 0, background: 'var(--ink)', color: 'var(--cream)',
        padding: '14px 18px', zIndex: 200, display: 'flex', gap: 16, alignItems: 'center', flexWrap: 'wrap', justifyContent: 'center'
      }}
    >
      <span className="small" style={{ color: 'var(--cream)', maxWidth: 620 }}>
        {t('cookies.text')}
      </span>
      <div className="row" style={{ gap: 10 }}>
        <button className="btn-gold" style={{ padding: '8px 18px', fontSize: 13 }} onClick={() => choose('accepted')}>
          {t('cookies.accept')}
        </button>
        <button
          className="btn-outline"
          style={{ padding: '8px 18px', fontSize: 13, borderColor: 'var(--cream)', color: 'var(--cream)' }}
          onClick={() => choose('refused')}
        >
          {t('cookies.refuse')}
        </button>
      </div>
    </div>
  );
}
