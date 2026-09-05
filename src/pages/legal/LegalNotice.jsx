import usePageMeta from '../../hooks/usePageMeta';
import Rich from '../../components/Rich';
import { useLanguage } from '../../context/LanguageContext';

// Texte dans translations.js (espace `legalNotice`), en trois langues. Un paragraphe peut contenir des
// sauts de ligne (\n) : l'éditeur du site se lit ligne par ligne.
const SECTIONS = ['publisher', 'hosting', 'ip', 'liability'];

export default function LegalNotice() {
  const { t } = useLanguage();
  usePageMeta({ title: t('legalNotice.pageTitle'), path: '/mentions-legales' });
  return (
    <div className="card">
      <div style={{ background: 'var(--cream-dim)', borderRadius: 10, padding: '10px 14px', marginBottom: 16, fontSize: 13 }}>
        {t('legalNotice.draftWarning')}
      </div>
      <h2 style={{ marginTop: 0 }}>{t('legalNotice.title')}</h2>
      {SECTIONS.map((s) => (
        <div key={s}>
          <h3>{t(`legalNotice.${s}Title`)}</h3>
          <p className="small" style={{ whiteSpace: 'pre-line' }}><Rich text={t(`legalNotice.${s}`)} /></p>
        </div>
      ))}
    </div>
  );
}
