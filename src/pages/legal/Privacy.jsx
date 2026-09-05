import usePageMeta from '../../hooks/usePageMeta';
import Rich from '../../components/Rich';
import { useLanguage } from '../../context/LanguageContext';

// Texte dans translations.js (espace `privacy`), en trois langues.
const SECTIONS = ['collected', 'purpose', 'sharing', 'retention', 'rights', 'cookies'];

export default function Privacy() {
  const { t } = useLanguage();
  usePageMeta({ title: t('privacy.pageTitle'), path: '/confidentialite' });
  return (
    <div className="card">
      <div style={{ background: 'var(--cream-dim)', borderRadius: 10, padding: '10px 14px', marginBottom: 16, fontSize: 13 }}>
        {t('privacy.draftWarning')}
      </div>
      <h2 style={{ marginTop: 0 }}>{t('privacy.title')}</h2>
      {SECTIONS.map((s) => (
        <div key={s}>
          <h3>{t(`privacy.${s}Title`)}</h3>
          <p className="small"><Rich text={t(`privacy.${s}`)} /></p>
        </div>
      ))}
    </div>
  );
}
