import usePageMeta from '../../hooks/usePageMeta';
import Rich from '../../components/Rich';
import { useLanguage } from '../../context/LanguageContext';

// Texte dans translations.js (espace `terms`), en trois langues : neuf articles numérotés.
const ARTICLES = ['object', 'account', 'orders', 'balance', 'fees', 'cancellation', 'reviews', 'liability', 'law'];

export default function Terms() {
  const { t } = useLanguage();
  usePageMeta({ title: t('terms.pageTitle'), path: '/cgv' });
  return (
    <div className="card">
      <div style={{ background: 'var(--cream-dim)', borderRadius: 10, padding: '10px 14px', marginBottom: 16, fontSize: 13 }}>
        {t('terms.draftWarning')}
      </div>
      <h2 style={{ marginTop: 0 }}>{t('terms.title')}</h2>
      {ARTICLES.map((a, i) => (
        <div key={a}>
          <h3>{i + 1}. {t(`terms.${a}Title`)}</h3>
          <p className="small"><Rich text={t(`terms.${a}`)} /></p>
        </div>
      ))}
    </div>
  );
}
