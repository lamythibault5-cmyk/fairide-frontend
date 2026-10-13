import { useEffect, useRef, useState } from 'react';
import { Link } from 'react-router-dom';
import { useLanguage } from '../context/LanguageContext';
import { getConsent, setConsent, onConsentChange } from '../consent';

// Bannière de consentement. Refuser doit être aussi simple qu'accepter (RGPD + directive ePrivacy) :
// les deux boutons sont donc côte à côte, de même taille et de même poids visuel — pas un bouton doré
// bien visible face à un lien discret, schéma que l'APD/GBA sanctionne précisément.
// Le choix réel ('accepted' | 'refused') est stocké par consent.js, seule source lue par le reste de
// l'app (aujourd'hui Sentry, voir main.jsx).
export default function CookieBanner() {
  const { t } = useLanguage();
  const [visible, setVisible] = useState(false);
  const boite = useRef(null);

  useEffect(() => {
    if (!getConsent()) setVisible(true);
    // « Gérer mes cookies » remet le choix à zéro : la bannière revient.
    return onConsentChange((v) => { if (!v) setVisible(true); });
  }, []);
  // Au clavier, le premier bouton est atteignable tout de suite, sans traverser toute la page.
  useEffect(() => { if (visible) boite.current?.querySelector('button')?.focus(); }, [visible]);

  function choose(value) {
    setConsent(value);
    setVisible(false);
  }

  if (!visible) return null;

  return (
    <div
      ref={boite}
      role="dialog"
      aria-live="polite"
      aria-label={t('cookies.text')}
      // Petite carte en bas à gauche plutôt qu'une bande sur toute la largeur (fondateur, 2026-10-11 : « trop large ») :
      // elle masquait le bas de l'écran, barre d'onglets comprise. Sur téléphone, elle garde 12 px de marge de chaque côté.
      style={{
        position: 'fixed', bottom: 'calc(12px + env(safe-area-inset-bottom))', left: 12, width: 'min(420px, calc(100vw - 24px))',
        background: 'var(--ink)', color: 'var(--cream)', borderRadius: 14,
        padding: '10px 12px', zIndex: 200, display: 'flex', gap: 10, alignItems: 'center', flexWrap: 'wrap'
      }}
    >
      <span style={{ color: 'var(--cream)', fontSize: 12, lineHeight: 1.35, flex: '1 1 180px' }}>
        {/* Une ligne (fondateur, 2026-10-11) ; le texte complet reste l'aria-label et la politique des cookies. */}
        {t('cookies.short')} <Link to="/cookies" style={{ color: 'var(--cream)', textDecoration: 'underline' }}>{t('cookies.more')}</Link>
      </span>
      {/* Mêmes dimensions pour les deux choix : refuser doit être aussi simple qu'accepter (voir plus haut). */}
      <div className="row" style={{ gap: 8 }}>
        <button className="btn-gold btn-sm" onClick={() => choose('accepted')}>
          {t('cookies.accept')}
        </button>
        <button
          className="btn-outline btn-sm"
          style={{ borderColor: 'var(--cream)', color: 'var(--cream)' }}
          onClick={() => choose('refused')}
        >
          {t('cookies.refuse')}
        </button>
      </div>
    </div>
  );
}
