import usePageMeta from '../hooks/usePageMeta';
import useJsonLd from '../seo/useJsonLd';
import { faqJsonLd, breadcrumbJsonLd } from '../seo/jsonLd';
import RetourCompte from '../components/RetourCompte';
import Rich from '../components/Rich';
import { useLanguage } from '../context/LanguageContext';

// Notre histoire, sortie de la page Compte, où elle occupait une carte de cinquante lignes que
// personne n'avait demandé à lire. Elle s'intercalait entre les coordonnées de connexion et les
// raccourcis, obligeant à la faire défiler à chaque visite pour atteindre le reste.
//
// Elle a sa page parce qu'elle se lit d'un bout à l'autre ou pas du tout : c'est un texte, pas un
// réglage. Publique à dessein : c'est un argument, et un argument que seuls les inscrits peuvent
// lire ne convainc personne. Le texte est dans translations.js (espace `story`), en trois langues.
//
// C'EST AUSSI LA PAGE DE RÉFÉRENCEMENT DE LA MARQUE, et c'est ce qui a dicté sa forme actuelle.
// Quelqu'un qui cherche « alternative Uber Eats Bruxelles » ne connaît pas encore Fairide : il ne
// cherchera jamais « notre histoire ». La page porte donc un h1 qui nomme ce qu'elle est, un
// paragraphe qui cite les plateformes auxquelles Fairide se compare, et une FAQ dont les questions
// reprennent mot pour mot des recherches réelles.
//
// La FAQ est balisée en FAQPage (voir faqJsonLd). Google exige que chaque question et chaque
// réponse soient VISIBLES : d'où le fait qu'elle soit rendue ici, et pas seulement déclarée dans
// le <head>. Les deux lisent les mêmes clés, il ne peut donc pas y avoir de divergence.

const TITRE = { margin: '0 0 6px', fontSize: 13, textTransform: 'uppercase', letterSpacing: 0.4, opacity: 0.6 };
const BLOCS = [
  ['alternative', 'p'], ['constat', 'p'], ['mission', 'p'], ['demarche', 'ul', 4], ['identite', 'p'], ['valeurs', 'ul', 4], ['objectifs', 'ul', 4]
];
const QUESTIONS = [1, 2, 3, 4];

export default function OurStory() {
  const { t } = useLanguage();
  usePageMeta({
    title: t('story.pageTitle'),
    description: t('story.metaDescription'),
    path: '/notre-histoire'
  });
  useJsonLd(faqJsonLd(QUESTIONS.map((n) => ({
    question: t(`story.faqQ${n}`),
    answer: t(`story.faqA${n}`)
  }))), 'ld-faq');
  useJsonLd(breadcrumbJsonLd([
    { name: 'Fairide', path: '/' },
    { name: t('story.title').replace(/^\W+\s*/, ''), path: '/notre-histoire' }
  ]), 'ld-breadcrumb');
  return (
    <div>
      <RetourCompte />
      {/* h1 et non h2 : c'est le titre de la page, et la page n'en avait aucun. Le rendu ne change
          pas, .section-title porte déjà sa taille. */}
      <h1 className="section-title" style={{ marginTop: 0 }}>{t('story.h1')}</h1>
      <div className="card">
        <p className="small" style={{ margin: '0 0 14px', opacity: 0.75 }}>{t('story.intro')}</p>
        {BLOCS.map(([cle, type, n], i) => {
          const dernier = i === BLOCS.length - 1;
          return (
            <div key={cle}>
              <h2 style={TITRE}>{t(`story.${cle}Title`)}</h2>
              {type === 'p' ? (
                <p className="small" style={{ margin: dernier ? 0 : '0 0 14px' }}><Rich text={t(`story.${cle}`)} /></p>
              ) : (
                <ul className="small" style={{ margin: dernier ? 0 : '0 0 14px', paddingLeft: 18 }}>
                  {Array.from({ length: n }, (_, k) => <li key={k}><Rich text={t(`story.${cle}${k + 1}`)} /></li>)}
                </ul>
              )}
            </div>
          );
        })}
      </div>

      <h2 className="section-title">{t('story.faqTitle')}</h2>
      <div className="card">
        {QUESTIONS.map((n, i) => (
          <div key={n} style={{ marginBottom: i === QUESTIONS.length - 1 ? 0 : 14 }}>
            <h3 style={{ fontSize: 15, margin: '0 0 4px' }}>{t(`story.faqQ${n}`)}</h3>
            <p className="small" style={{ margin: 0 }}><Rich text={t(`story.faqA${n}`)} /></p>
          </div>
        ))}
      </div>
    </div>
  );
}
