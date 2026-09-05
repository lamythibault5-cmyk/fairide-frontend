import { useNavigate, Link } from 'react-router-dom';
import { COMMUNES } from '../menuCategories';
import { useLanguage } from '../context/LanguageContext';
import ContactSection from '../components/ContactSection';
import PartnersMarquee from '../components/PartnersMarquee';
import AppComingSoonSection from '../components/AppComingSoonSection';
import Reveal from '../components/Reveal';
import usePageMeta from '../hooks/usePageMeta';

/* Le cadre à l'échelle affiche, posé dans la bannière. Géométrie STRICTEMENT celle de la spec
   §4 (roues r=12,5 aux centres x=15 et x=61, tube supérieur x=16 y=8 de 44×5, tube de selle
   x=13 y=20 de 28×5 pivoté de 42° autour de (27; 22,5)), simplement sans tuile : sur un fond
   déjà iris, la tuile ferait un carré dans un carré.

   L'épaisseur de 5 n'est PAS un réglage esthétique, c'est ce qui fait tenir le dessin. Une
   première version l'avait ramenée à 2,4 pour affiner le trait en grand format, sans toucher
   aux coordonnées : le tube supérieur, dont le bord bas passait de y=13 à y=10,4, décollait du
   sommet des roues (y=14) au lieu de l'effleurer, et l'extrémité haute du tube de selle ne
   rejoignait plus le tube supérieur. Le vélo se lisait alors comme trois morceaux disjoints
   avec une diagonale qui traversait la roue arrière. Ne pas amincir sans recalculer le tableau.

   viewBox : le dessin occupe x[0;76] et y[8;44] une fois le trait compris — d'où "-3 5 82 42",
   qui laisse exactement 3 unités de marge sur les quatre côtés. Rien n'est rogné, et la marque
   est centrée dans son cadre plutôt que collée en bas. */
function HeroFrame() {
  return (
    <svg className="landing-frame" viewBox="-3 5 82 42" aria-hidden="true">
      <g fill="none" stroke="#C8F03C" strokeWidth="5">
        <circle cx="15" cy="29" r="12.5" />
        <circle cx="61" cy="29" r="12.5" />
      </g>
      <g fill="#C8F03C">
        <rect x="16" y="8" width="44" height="5" rx="2.5" />
        <rect x="13" y="20" width="28" height="5" rx="2.5" transform="rotate(42 27 22.5)" />
      </g>
    </svg>
  );
}

/* Les trois portes d'entrée. Le parcours client passe en premier et en iris : c'est le seul des
   trois qu'on veut voir avant les autres, et la spec ne tolère qu'un bloc coloré par rangée. */
function joinCards(t) {
  return [
    {
      key: 'client',
      eyebrow: t('landing.joinClientRole'),
      title: t('landing.joinClientTitle'),
      link: t('landing.joinClientLink'),
      to: '/login?audience=client',
      iris: true
    },
    {
      key: 'restaurant',
      eyebrow: t('landing.joinRestaurantRole'),
      title: t('landing.joinRestaurantTitle'),
      link: t('landing.joinRestaurantLink'),
      to: '/login?audience=partner&role=restaurant'
    },
    {
      key: 'driver',
      eyebrow: t('landing.joinDriverRole'),
      title: t('landing.joinDriverTitle'),
      link: t('landing.joinDriverLink'),
      to: '/login?audience=partner&role=driver'
    }
  ];
}

function features(t) {
  return [
    { icon: '🏪', title: t('landing.featureLocalTitle'), text: t('landing.featureLocalText') },
    { icon: '🚲', title: t('landing.featureBikeTitle'), text: t('landing.featureBikeText') },
    { icon: '🤝', title: t('landing.featureFairTitle'), text: t('landing.featureFairText') }
  ];
}

function steps(t) {
  return [
    { num: '1', title: t('landing.step1Title'), text: t('landing.step1Text') },
    { num: '2', title: t('landing.step2Title'), text: t('landing.step2Text') },
    { num: '3', title: t('landing.step3Title'), text: t('landing.step3Text') }
  ];
}

export default function Landing() {
  const navigate = useNavigate();
  const { t } = useLanguage();
  usePageMeta({ path: '/' });

  return (
    <div className="decor-page">

      <div className="landing-hero">
        <HeroFrame />
        <div className="be-flag" title={t('landing.proudlyBelgian')}>
          <span className="be-flag-stripe" style={{ background: '#000' }} />
          <span className="be-flag-stripe" style={{ background: '#FAE042' }} />
          <span className="be-flag-stripe" style={{ background: '#ED2939' }} />
        </div>

        <div className="landing-hero-text">
          <span className="pill hero">{t('landing.pill')}</span>
          <h1 className="landing-title">
            {t('landing.title1')}<br /><em>{t('landing.title2')}</em>
          </h1>
          <p className="landing-sub">{t('landing.sub')}</p>
          <div className="row" style={{ gap: 10 }}>
            <button className="btn-gold" onClick={() => navigate('/login?audience=client')}>{t('landing.orderNow')}</button>
            <button className="btn-hero-ghost" onClick={() => navigate('/login?audience=partner')}>{t('landing.becomePartner')}</button>
          </div>
        </div>

        <div className="stats-bar">
          <div className="stats-bar-item"><b>10 %</b><span>{t('landing.statCommission')}</span></div>
          <div className="stats-bar-item"><b>19</b><span>{t('landing.statCommunes')}</span></div>
          <div className="stats-bar-item"><b>100 %</b><span>{t('landing.statLocal')}</span></div>
        </div>
      </div>

      <div className="feature-grid">
        {features(t).map((f, i) => (
          <Reveal className="card feature-card" key={f.title} delay={i * 90}>
            <span className="feature-icon">{f.icon}</span>
            <h3 style={{ fontSize: 19, margin: '0 0 8px' }}>{f.title}</h3>
            <p className="small" style={{ lineHeight: 1.5 }}>{f.text}</p>
          </Reveal>
        ))}
      </div>

      {/* L'argument central de Fairide — la commission plafonnée — n'existait jusqu'ici que sous
          forme de phrase noyée dans le paragraphe d'accroche. Il devient ici une comparaison
          visuelle : la piste vaut 1 € de commande, le segment plein vaut ce que la plateforme
          prélève. On peut la lire sans lire un seul chiffre. */}
      <Reveal className="euro-block">
        <span className="pill hero">{t('landing.euroEyebrow')}</span>
        <h2>{t('landing.euroTitle')}</h2>
        <div className="euro-rows">
          <div>
            <div className="euro-row-top">
              <span className="euro-name">fairide</span>
              <span className="euro-cut">{t('landing.euroUsCut')}</span>
            </div>
            <div className="euro-track"><div className="euro-fill euro-fill-us" /></div>
            <p className="euro-legend">{t('landing.euroUsLegend')}</p>
          </div>
          <div>
            <div className="euro-row-top">
              <span className="euro-name">{t('landing.euroThemName')}</span>
              <span className="euro-cut">{t('landing.euroThemCut')}</span>
            </div>
            <div className="euro-track"><div className="euro-fill euro-fill-them" /></div>
            <p className="euro-legend">{t('landing.euroThemLegend')}</p>
          </div>
        </div>
        <p className="euro-note"><b>{t('landing.euroNoteFigure')}</b> {t('landing.euroNoteText')}</p>
      </Reveal>

      <Reveal as="h2" className="section-title">{t('landing.howItWorks')}</Reveal>
      <div className="steps-grid">
        {steps(t).map((s, i) => (
          <Reveal as="div" className="step-card" key={s.num} delay={i * 90}>
            <div className="step-num">{s.num}</div>
            <h3 style={{ fontSize: 17, margin: '0 0 6px' }}>{s.title}</h3>
            <p className="small">{s.text}</p>
          </Reveal>
        ))}
      </div>

      <Reveal as="h2" className="section-title">{t('landing.joinTitle')}</Reveal>
      <div className="join-grid">
        {joinCards(t).map((c, i) => (
          <Reveal
            as={Link}
            to={c.to}
            key={c.key}
            delay={i * 90}
            className={c.iris ? 'join-card join-card-iris' : 'join-card'}
          >
            <div>
              <span className="join-eyebrow">{c.eyebrow}</span>
              <h3>{c.title}</h3>
            </div>
            <span className="join-link">{c.link}</span>
          </Reveal>
        ))}
      </div>

      <Reveal><AppComingSoonSection /></Reveal>

      <Reveal as="h2" className="section-title">{t('landing.communesTitle')}</Reveal>
      <Reveal className="commune-pills">
        {COMMUNES.map((c) => <span key={c} className="pill">{c}</span>)}
      </Reveal>

      <Reveal as="h2" className="section-title">{t('landing.contactTitle')}</Reveal>
      <Reveal><ContactSection /></Reveal>

      <Reveal><PartnersMarquee /></Reveal>

      <Reveal className="landing-cta">
        <h2>{t('landing.ctaTitle')}</h2>
        <p>{t('landing.ctaText')}</p>
        <button className="btn-gold" onClick={() => navigate('/login')}>{t('landing.ctaButton')}</button>
      </Reveal>
    </div>
  );
}
