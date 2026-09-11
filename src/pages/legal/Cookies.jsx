import { Link } from 'react-router-dom';
import usePageMeta from '../../hooks/usePageMeta';
import Rich from '../../components/Rich';
import { useLanguage } from '../../context/LanguageContext';

// Politique des cookies (espace `cookiesPolicy` de translations.js, trois langues). Fairide n'utilise que des
// cookies et stockages techniques : session, panier, préférences. Aucun traceur publicitaire ni statistique tiers.
const SECTIONS = ['what', 'technical', 'preferences', 'thirdParty', 'noTracking', 'manage', 'duration', 'contact'];

export default function Cookies() {
  const { t } = useLanguage();
  usePageMeta({ title: t('cookiesPolicy.pageTitle'), path: '/cookies' });
  return (
    <div className="card">
      <h2 style={{ marginTop: 0 }}>{t('cookiesPolicy.title')}</h2>
      <p className="small" style={{ opacity: 0.8 }}>{t('cookiesPolicy.updated')}</p>
      {SECTIONS.map((s) => (
        <div key={s}>
          <h3>{t(`cookiesPolicy.${s}Title`)}</h3>
          <p className="small"><Rich text={t(`cookiesPolicy.${s}`)} /></p>
        </div>
      ))}
      <p className="small" style={{ marginTop: 16 }}>
        <Link to="/confidentialite">{t('cookiesPolicy.seePrivacy')}</Link> · <Link to="/mentions-legales">{t('cookiesPolicy.seeLegal')}</Link>
      </p>
    </div>
  );
}
