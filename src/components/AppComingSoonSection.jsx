import BrandMark from './BrandMark';
import { useLanguage } from '../context/LanguageContext';

// Section "l'appli arrive bientôt" sur la page d'accueil — inspirée des bannières de téléchargement des
// grandes plateformes (badges de store + mockup téléphone), mais honnête sur ce qui existe vraiment :
// Fairide n'a pas encore d'appli mobile (lancement prévu le 15 octobre), donc les badges ne sont pas
// cliquables — aucune fausse redirection vers un store qui n'a rien à proposer. Les badges eux-mêmes
// restent génériques (texte + icône maison, pas de logo Apple/Google reproduit) plutôt qu'une copie du
// design des vraies plateformes.
const STORE_BADGES = [
  { icon: '🍎', line1: 'Bientôt sur', line2: "l'App Store" },
  { icon: '▶️', line1: 'Bientôt sur', line2: 'Google Play' },
  { icon: '📱', line1: 'Bientôt sur', line2: 'AppGallery' }
];

function PhoneMockup() {
  const { t } = useLanguage();
  return (
    <div className="app-soon-phone">
      <div className="app-soon-phone-notch" />
      <div className="app-soon-phone-screen">
        <div className="app-soon-phone-brand">
          <BrandMark size={22} />
          <span>Fairide</span>
        </div>
        <div className="app-soon-phone-search">{t('landing.mockSearchPlaceholder')}</div>
        <div className="app-soon-phone-chips">
          {['🍕', '🍔', '🍣', '🥗', '🧋'].map((e, i) => <span key={i}>{e}</span>)}
        </div>
        <div className="app-soon-phone-cards">
          <div className="app-soon-phone-card">
            <div className="app-soon-phone-card-img" style={{ background: 'var(--gold)' }} />
            <div className="app-soon-phone-card-lines"><span /><span style={{ width: '60%' }} /></div>
          </div>
          <div className="app-soon-phone-card">
            <div className="app-soon-phone-card-img" style={{ background: 'var(--teal)' }} />
            <div className="app-soon-phone-card-lines"><span /><span style={{ width: '45%' }} /></div>
          </div>
        </div>
      </div>
    </div>
  );
}

export default function AppComingSoonSection() {
  const { t } = useLanguage();
  return (
    <div className="app-soon">
      <div className="app-soon-text">
        <span className="pill hero app-soon-badge">🚀 {t('landing.appSoonBadge')}</span>
        <h2 className="app-soon-title">{t('landing.appSoonTitle')}</h2>
        <p className="app-soon-sub">{t('landing.appSoonSub')}</p>
        <div className="app-soon-badges">
          {STORE_BADGES.map((b) => (
            <div key={b.line2} className="app-soon-store-badge" title={t('landing.appSoonNotYet')}>
              <span className="app-soon-store-icon">{b.icon}</span>
              <span className="app-soon-store-text"><small>{b.line1}</small>{b.line2}</span>
            </div>
          ))}
        </div>
        <p className="app-soon-note">{t('landing.appSoonNote')}</p>
      </div>
      <PhoneMockup />
    </div>
  );
}
