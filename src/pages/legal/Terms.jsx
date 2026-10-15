import usePageMeta from '../../hooks/usePageMeta';
import Rich from '../../components/Rich';
import { useLanguage } from '../../context/LanguageContext';

// Texte dans translations.js (espace `terms`), en trois langues : neuf articles numérotés.
const ARTICLES = ['identity', 'object', 'services', 'account', 'orders', 'prices', 'cancellation', 'withdrawal', 'balance', 'fees', 'reviews', 'partners', 'liability', 'data', 'changes', 'law'];

export default function Terms() {
  const { t } = useLanguage();
  usePageMeta({ title: t('terms.pageTitle'), description: t('seo.termsDescription'), path: '/cgv' });
  return <div className="card"><TexteCgv /></div>;
}

// Le texte seul : la page /cgv, et la feuille qui l'ouvre dans l'application sans quitter l'écran en cours (CgvEnFeuille.jsx).
// L'ordre des articles reste la liste ARTICLES ci-dessus, relue par le backend pour l'empreinte des CGU : n'y toucher qu'avec lui.
export function TexteCgv() {
  const { t } = useLanguage();
  return (
    <>
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
    </>
  );
}
