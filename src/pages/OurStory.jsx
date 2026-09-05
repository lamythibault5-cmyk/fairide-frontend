import usePageMeta from '../hooks/usePageMeta';
import RetourCompte from '../components/RetourCompte';
import Rich from '../components/Rich';
import { useLanguage } from '../context/LanguageContext';

// Notre histoire — sortie de la page Compte, où elle occupait une carte de cinquante lignes que
// personne n'avait demandé à lire. Elle s'intercalait entre les coordonnées de connexion et les
// raccourcis, obligeant à la faire défiler à chaque visite pour atteindre le reste.
//
// Elle a sa page parce qu'elle se lit d'un bout à l'autre ou pas du tout : c'est un texte, pas un
// réglage. Publique à dessein — c'est un argument, et un argument que seuls les inscrits peuvent
// lire ne convainc personne. Le texte est dans translations.js (espace `story`), en trois langues.

const TITRE = { margin: '0 0 6px', fontSize: 13, textTransform: 'uppercase', letterSpacing: 0.4, opacity: 0.6 };
const BLOCS = [
  ['constat', 'p'], ['mission', 'p'], ['demarche', 'ul', 4], ['identite', 'p'], ['valeurs', 'ul', 4], ['objectifs', 'ul', 4]
];

export default function OurStory() {
  const { t } = useLanguage();
  usePageMeta({ title: t('story.pageTitle'), path: '/notre-histoire' });
  return (
    <div>
      <RetourCompte />
      <h2 className="section-title" style={{ marginTop: 0 }}>{t('story.title')}</h2>
      <div className="card">
        <p className="small" style={{ margin: '0 0 14px', opacity: 0.75 }}>{t('story.intro')}</p>
        {BLOCS.map(([cle, type, n], i) => {
          const dernier = i === BLOCS.length - 1;
          return (
            <div key={cle}>
              <h4 style={TITRE}>{t(`story.${cle}Title`)}</h4>
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
    </div>
  );
}
