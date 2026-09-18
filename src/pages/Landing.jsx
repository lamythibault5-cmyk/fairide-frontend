import { Link } from 'react-router-dom';
import { COMMUNES } from '../menuCategories';
import { useLanguage } from '../context/LanguageContext';
import ContactSection from '../components/ContactSection';
import PartnersMarquee from '../components/PartnersMarquee';
import AppComingSoonSection from '../components/AppComingSoonSection';
import Reveal from '../components/Reveal';
import BelgianMark from '../components/BelgianMark';
import usePageMeta from '../hooks/usePageMeta';
import useJsonLd from '../seo/useJsonLd';
import { organizationJsonLd } from '../seo/jsonLd';
import HeroPreview, { useCommercesPublics } from '../components/landing/HeroPreview';
import DiscoverSection from '../components/landing/DiscoverSection';
import { IconLocal, IconBike, IconFair } from '../components/landing/FeatureIcons';

/* Les trois portes d'entrée. Le parcours client passe en premier et en iris : c'est le seul des
   trois qu'on veut voir avant les autres, et la spec ne tolère qu'un bloc coloré par rangée. */
function joinCards(t) {
  return [
    {
      key: 'client', icon: '🛍️',
      eyebrow: t('landing.joinClientRole'),
      title: t('landing.joinClientTitle'),
      points: [t('landing.joinClientP1'), t('landing.joinClientP2')],
      link: t('landing.joinClientLink'),
      to: '/login?audience=client',
      iris: true
    },
    {
      key: 'restaurant', icon: '🏪',
      eyebrow: t('landing.joinRestaurantRole'),
      title: t('landing.joinRestaurantTitle'),
      points: [t('landing.joinRestaurantP1'), t('landing.joinRestaurantP2')],
      link: t('landing.joinRestaurantLink'),
      to: '/login?audience=partner&role=restaurant'
    },
    {
      key: 'driver', icon: '🛵',
      eyebrow: t('landing.joinDriverRole'),
      title: t('landing.joinDriverTitle'),
      points: [t('landing.joinDriverP1'), t('landing.joinDriverP2')],
      link: t('landing.joinDriverLink'),
      to: '/login?audience=partner&role=driver'
    }
  ];
}

function features(t) {
  return [
    { icon: <IconLocal />, title: t('landing.featureLocalTitle'), text: t('landing.featureLocalText') },
    { icon: <IconBike />, title: t('landing.featureBikeTitle'), text: t('landing.featureBikeText') },
    { icon: <IconFair />, title: t('landing.featureFairTitle'), text: t('landing.featureFairText') }
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
  const { t } = useLanguage();
  usePageMeta({ description: t('seo.homeDescription'), path: '/' });
  useJsonLd(organizationJsonLd(), 'ld-organization');
  // Lus une fois pour toute la page : aperçu de la bannière, vitrine « Découvre », et le nombre affiché.
  const restaurants = useCommercesPublics();

  return (
    <div className="decor-page">

      <div className="landing-hero">
        {/* Ton sombre : le coin de la bannière est un aplat iris. Voir BelgianMark.jsx. */}
        <BelgianMark size={34} ton="sombre" title={t('landing.proudlyBelgian')} />

        <div className="landing-hero-text">
          {/* L'AFFICHE : ce qu'on veut voir sans défiler, et rien d'autre. Ce groupe existe pour
              qu'une seule règle CSS puisse lui donner la hauteur du premier écran sur téléphone —
              ce qui repousse mécaniquement sous la ligne de flottaison ce qui le suit (l'aperçu
              des commerces, les chiffres). Sans lui, ces blocs remontaient dans l'écran d'accueil
              et le premier contact avec le site était un mur de texte. Sur écran large il ne fait
              rien : un <div> de plus dans une colonne qui empile déjà ses enfants.

              Il portait aussi, jusqu'ici, la signature de marque, les trois gages de confiance et
              la liste des quartiers déjà livrés — retirés à la demande du fondateur. */}
          <div className="landing-hero-affiche">
          <h1 className="landing-title">
            {t('landing.title1')}<br /><em>{t('landing.title2')}</em>
          </h1>
          {/* Deux accroches, une seule visible : la longue au-delà de 640px, la courte en deçà.
              C'est un choix en CSS et non en JS (matchMedia + état) parce qu'un choix en JS se fait
              APRÈS le premier rendu : sur téléphone, la phrase longue s'afficherait le temps d'une
              image avant d'être remplacée, et la bannière sauterait au chargement. Les deux textes
              sont donc dans le DOM, et `display: none` les départage — ce qui les retire aussi bien
              de l'écran que des lecteurs d'écran, jamais les deux à la fois. */}
          <p className="landing-sub landing-sub-long">{t('landing.sub')}</p>
          <p className="landing-sub landing-sub-court">{t('landing.subCourt')}</p>
          {/* Pas de sélecteur de commune ici : l'intérieur de l'app (liste, carte) est réservé aux comptes.
              Le visiteur voit la vitrine « Découvre » plus bas, puis crée son compte. */}
          {/* UN SEUL appel à l'action principal par page et par public (revue de lancement, 2026-09-18) : pour le
              visiteur de l'accueil, c'est « Commander ». Les entrées commerçant et livreur ne sont plus des boutons
              concurrents dans la bannière : la ligne juste en dessous, la rangée « Rejoindre » plus bas et le pied de
              page les portent. Un lien (pas un bouton) : explorable par les robots, ouvrable dans un nouvel onglet. */}
          <div className="row landing-hero-actions" style={{ gap: 10, flexWrap: 'wrap' }}>
            <Link to="/login?audience=client" className="btn-gold landing-cta-principal">{t('landing.orderNow')}</Link>
          </div>
          {/* `audience=partner` sans `role` : la page d'inscription propose alors les trois types de
              compte (voir Auth.jsx, la lecture de `audience` et `role`). Une ligne qui dit
              « commerce OU livreur » ne peut pas pointer vers l'un des deux. */}
          <p className="landing-partner-line">
            {t('landing.partnerQuestion')} <Link to="/login?audience=partner">{t('landing.partnerLink')}</Link>
          </p>
          <p className="small landing-ouverture landing-ouverture-long">🗓️ {t('landing.ordersOpenNote')}</p>
          <p className="small landing-ouverture landing-ouverture-court">{t('landing.ordersOpenCourt')}</p>
          </div>
        </div>
        <HeroPreview restaurants={restaurants} />

        <div className="stats-bar">
          <div className="stats-bar-item"><b>10 %</b><span>{t('landing.statCommission')}</span></div>
          <div className="stats-bar-item"><b>19</b><span>{t('landing.statCommunes')}</span></div>
          <div className="stats-bar-item"><b>100 %</b><span>{t('landing.statLocal')}</span></div>
        </div>
      </div>

      <div className="feature-grid">
        {features(t).map((f, i) => (
          <Reveal className="card feature-card" key={f.title} delay={i * 90}>
            <span className="feature-icon feature-icon-svg">{f.icon}</span>
            <h3 style={{ fontSize: 19, margin: '0 0 8px' }}>{f.title}</h3>
            <p className="small" style={{ lineHeight: 1.5 }}>{f.text}</p>
          </Reveal>
        ))}
      </div>

      <DiscoverSection restaurants={restaurants} />

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
              <span className="euro-name">{t('landing.euroThemName')}</span>
              <span className="euro-cut">{t('landing.euroThemCut')}</span>
            </div>
            <div className="euro-track"><div className="euro-fill euro-fill-them" /></div>
            <p className="euro-legend">{t('landing.euroThemLegend')}</p>
          </div>
          <div>
            <div className="euro-row-top">
              <span className="euro-name euro-name-us">fairide</span>
              <span className="euro-cut">{t('landing.euroUsCut')}</span>
            </div>
            <div className="euro-track"><div className="euro-fill euro-fill-us" /></div>
            <p className="euro-legend">{t('landing.euroUsLegend')}</p>
          </div>
        </div>
        {/* Exemple concret : un petit commerce, 5 commandes par jour à 20 €, 25 jours. Trois tuiles, une différence. */}
        <div className="euro-example" aria-label={t('landing.euroExTitle')}>
          <p className="euro-ex-title">{t('landing.euroExTitle')}</p>
          <div className="euro-ex-grid">
            <div className="euro-ex-card">
              <span className="euro-ex-label">{t('landing.euroExVolumeLabel')}</span>
              <b>2 500 €</b>
              <span className="euro-ex-sub">{t('landing.euroExVolumeSub')}</span>
            </div>
            <div className="euro-ex-card them">
              <span className="euro-ex-label">{t('landing.euroExThemLabel')}</span>
              <b>550 à 800 €</b>
              <span className="euro-ex-sub">{t('landing.euroExThemSub')}</span>
            </div>
            <div className="euro-ex-card us">
              <span className="euro-ex-label">{t('landing.euroExUsLabel')}</span>
              <b>250 €</b>
              <span className="euro-ex-sub">{t('landing.euroExUsSub')}</span>
            </div>
          </div>
          <p className="euro-ex-diff"><b>{t('landing.euroExDiffFigure')}</b> {t('landing.euroExDiffText')}</p>
        </div>
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
              <span className="join-eyebrow">{c.icon} {c.eyebrow}</span>
              <h3>{c.title}</h3>
              <ul className="join-points">{c.points.map((pt) => <li key={pt}>{pt}</li>)}</ul>
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
        {/* Second appel en bas de page : rétrogradé en contour, le lime reste réservé à « Commander » dans la bannière. */}
        <Link to="/login" className="btn-outline">{t('landing.ctaButton')}</Link>
      </Reveal>
    </div>
  );
}
