import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { api } from '../api';
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
import Icone from '../components/Icone';

/* Les trois portes d'entrée. Le parcours client passe en premier et en iris : c'est le seul des
   trois qu'on veut voir avant les autres, et la spec ne tolère qu'un bloc coloré par rangée.
   `icon` est un NOM du jeu maison (Icone.jsx), plus un emoji : voir l'en-tête de ce fichier-là,
   qui explique pourquoi l'application les a tous remplacés. L'accueil était le dernier endroit
   qui y avait échappé. */
// `p2pOuvert` (backlog B9) : l'accueil ne propose le statut de particulier (économie collaborative) que si
// la plateforme l'a ouvert (drapeau p2p_enabled, fermé tant que l'agrément du SPF manque). Inconnu = fermé.
function joinCards(t, p2pOuvert = false) {
  return [
    {
      key: 'client', icon: 'sac',
      eyebrow: t('landing.joinClientRole'),
      title: t('landing.joinClientTitle'),
      points: [t('landing.joinClientP1'), t('landing.joinClientP2')],
      link: t('landing.joinClientLink'),
      to: '/login?audience=client',
      iris: true
    },
    {
      key: 'restaurant', icon: 'commerce',
      eyebrow: t('landing.joinRestaurantRole'),
      title: t('landing.joinRestaurantTitle'),
      points: [t('landing.joinRestaurantP1'), t('landing.joinRestaurantP2')],
      link: t('landing.joinRestaurantLink'),
      to: '/login?audience=partner&role=restaurant'
    },
    {
      key: 'driver', icon: 'scooter',
      eyebrow: t('landing.joinDriverRole'),
      title: t('landing.joinDriverTitle'),
      points: [t('landing.joinDriverP1'), p2pOuvert ? t('landing.joinDriverP2') : t('conformite.joinDriverP2NoP2p')],
      link: t('landing.joinDriverLink'),
      to: '/login?audience=partner&role=driver'
    }
  ];
}

// DEUX arguments, plus trois. Ils occupent désormais la place que se partageaient les chiffres
// (« 10 % · 19 · 100 % ») et trois cartes étroites : les chiffres disaient la même chose que les
// cartes, en moins clair — « 19 » ne veut rien dire sans la phrase qui suit, et « 10 % » est déjà
// l'argument de la carte « Juste pour tout le monde ». La livraison en deux-roues part avec eux :
// c'est un moyen, pas une raison de commander ici (demande du fondateur, 2026-09-21).
function features(t) {
  return [
    { icon: 'commerce', title: t('landing.featureLocalTitle'), text: t('landing.featureLocalText') },
    { icon: 'balance', title: t('landing.featureFairTitle'), text: t('landing.featureFairText') }
  ];
}

export default function Landing() {
  const { t } = useLanguage();
  usePageMeta({ description: t('seo.homeDescription'), path: '/' });
  useJsonLd(organizationJsonLd(), 'ld-organization');
  // Lus une fois pour toute la page : aperçu de la bannière, vitrine « Découvre », et le nombre affiché.
  const restaurants = useCommercesPublics();
  const [p2pOuvert, setP2pOuvert] = useState(false);
  useEffect(() => { api('/couriers/options').then((o) => setP2pOuvert(!!o?.p2pEnabled)).catch(() => {}); }, []);

  return (
    <div className="decor-page">

      <div className="landing-hero">
        {/* Ton sombre : le coin de la bannière est un aplat iris. Voir BelgianMark.jsx. */}
        <BelgianMark size={84} ton="sombre" title={t('landing.proudlyBelgian')} />

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
          {/* UNE seule accroche, téléphone comme ordinateur (demande du fondateur, 2026-09-21).
              Il y en avait deux, départagées par `display: none` selon la largeur : une longue et
              une courte qui ne gardait que le chiffre de la commission. Le raccourci coûtait la
              moitié du propos là où il est le plus décisif — sur téléphone, où arrive la majorité
              du trafic. La phrase est assez courte pour tenir sans être coupée ; seule la taille
              descend sous 640px (voir .landing-sub dans styles.css).
              Le couple long/court subsiste pour la ligne d'ouverture juste dessous, qui, elle,
              énumère trois dates et ne peut pas tenir en entier sur un téléphone. */}
          <p className="landing-sub">{t('landing.sub')}</p>
          {/* Pas de sélecteur de commune ici : l'intérieur de l'app (liste, carte) est réservé aux comptes.
              Le visiteur voit la vitrine « Découvre » plus bas, puis crée son compte. */}
          {/* UN SEUL appel à l'action principal par page et par public (revue de lancement, 2026-09-18) : pour le
              visiteur de l'accueil, c'est « Commander ». Les entrées commerçant et livreur ne sont plus des boutons
              concurrents dans la bannière : la ligne juste en dessous, la rangée « Rejoindre » plus bas et le pied de
              page les portent. Un lien (pas un bouton) : explorable par les robots, ouvrable dans un nouvel onglet. */}
          <div className="row landing-hero-actions" style={{ gap: 10, flexWrap: 'wrap' }}>
            <Link to="/login?audience=client" className="btn-gold landing-cta-principal"><Icone nom="sac" taille={18} /> {t('landing.orderNow')}</Link>
          </div>
          {/* `audience=partner` sans `role` : la page d'inscription propose alors les trois types de
              compte (voir Auth.jsx, la lecture de `audience` et `role`). Une ligne qui dit
              « commerce OU livreur » ne peut pas pointer vers l'un des deux. */}
          <p className="landing-partner-line">
            {t('landing.partnerQuestion')} <Link to="/login?audience=partner">{t('landing.partnerLink')}</Link>
          </p>
          <p className="small landing-ouverture landing-ouverture-long"><Icone nom="reservations" taille={16} /> {t('landing.ordersOpenNote')}</p>
          <p className="small landing-ouverture landing-ouverture-court"><Icone nom="reservations" taille={16} /> {t('landing.ordersOpenCourt')}</p>
          </div>
        </div>
        <HeroPreview restaurants={restaurants} />
        {/* La bande de chiffres qui fermait la bannière — « 10 % · 19 · 100 % », sous un filet
            blanc — est partie avec sa ligne (demande du fondateur, 2026-09-21). Les deux cartes
            ci-dessous prennent sa place et disent la même chose en toutes lettres. La grille de la
            bannière n'a donc plus que deux zones : voir grid-template-areas dans styles.css. */}
      </div>

      <div className="feature-grid">
        {features(t).map((f, i) => (
          <Reveal className="card feature-card" key={f.title} delay={i * 90}>
            <span className="feature-icon feature-icon-svg"><Icone nom={f.icon} taille={30} /></span>
            <h3>{f.title}</h3>
            <p>{f.text}</p>
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
        {/* RETIRÉS D'ICI (demande du fondateur) : le bloc « Exemple concret : un petit commerce »
            — trois tuiles 2 500 € / 550 à 800 € / 250 € et la ligne « 300 à 550 € de plus dans la
            caisse du commerçant » — qui se trouvait juste ici, et la section « Comment ça marche »
            (les trois étapes) qui suivait le bloc euro. L'argument tient maintenant aux deux seules
            barres ci-dessus.

            Leur CSS (.euro-example, .euro-ex-*, .steps-grid, .step-card, .step-num) et leurs clés
            (landing.euroEx*, landing.howItWorks, landing.step*) sont TOUJOURS EN PLACE dans
            styles.css et translations.js : rien d'autre ne les utilise, mais les laisser rend le
            retour en arrière possible en ne retouchant que ce fichier. Les supprimer pour de bon
            est un nettoyage à part. */}
      </Reveal>

      <Reveal as="h2" className="section-title">{t('landing.joinTitle')}</Reveal>
      <div className="join-grid">
        {joinCards(t, p2pOuvert).map((c, i) => (
          <Reveal
            as={Link}
            to={c.to}
            key={c.key}
            delay={i * 90}
            className={c.iris ? 'join-card join-card-iris' : 'join-card'}
          >
            <div>
              <span className="join-eyebrow"><Icone nom={c.icon} taille={16} /> {c.eyebrow}</span>
              <h3>{c.title}</h3>
              <ul className="join-points">{c.points.map((pt) => <li key={pt}>{pt}</li>)}</ul>
            </div>
            <span className="join-link"><Icone nom={c.icon} taille={16} /> {c.link}</span>
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
