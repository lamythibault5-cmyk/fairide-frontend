import { useMemo } from 'react';
import { Link } from 'react-router-dom';
import { useLanguage } from '../context/LanguageContext';
import AppComingSoonSection from '../components/AppComingSoonSection';
import Reveal from '../components/Reveal';
import BelgianMark from '../components/BelgianMark';
import usePageMeta from '../hooks/usePageMeta';
import useJsonLd from '../seo/useJsonLd';
import { organizationJsonLd } from '../seo/jsonLd';
import HeroPreview, { useCommercesPublics, useCommercesReels, vitrineAccueil } from '../components/landing/HeroPreview';
import HeroAdresse from '../components/landing/HeroAdresse';
import HeroPrix from '../components/landing/HeroPrix';
import DiscoverSection from '../components/landing/DiscoverSection';
import Icone from '../components/Icone';

/* Les trois portes d'entrée. Le parcours client passe en premier et en iris : c'est le seul des
   trois qu'on veut voir avant les autres, et la spec ne tolère qu'un bloc coloré par rangée.
   `icon` est un NOM du jeu maison (Icone.jsx), plus un emoji : voir l'en-tête de ce fichier-là,
   qui explique pourquoi l'application les a tous remplacés. L'accueil était le dernier endroit
   qui y avait échappé. */
// Livreurs : deux statuts, indépendant ou étudiant-indépendant (CODE-12 : plus d'économie collaborative, régime fermé aux
// livreurs de plateformes — l'accueil n'interroge donc plus le serveur pour savoir s'il était ouvert).
function joinCards(t) {
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
      points: [t('landing.joinRestaurantP1'), t('landing.joinRestaurantP3'), t('landing.joinRestaurantP2')],
      link: t('landing.joinRestaurantLink'),
      to: '/login?audience=partner&role=restaurant'
    },
    {
      key: 'driver', icon: 'scooter',
      eyebrow: t('landing.joinDriverRole'),
      title: t('landing.joinDriverTitle'),
      points: [t('landing.joinDriverP1'), t('conformite.joinDriverP2NoP2p')],
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
  const publics = useCommercesPublics();
  const reels = useCommercesReels();
  // Vrais commerces d'abord (fondateur, 22/09) ; les démos ne complètent que s'ils sont trop peu nombreux.
  const restaurants = useMemo(() => vitrineAccueil(reels, publics, 3), [reels, publics]);

  return (
    <div className="decor-page">

      <div className="landing-hero landing-hero-adresse">
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
          {/* Le vélo aux couleurs du drapeau, en grand et sans tuile, AU-DESSUS du titre (fondateur,
              2026-09-27) — il était auparavant un cachet de 84px dans le coin haut-droit de la
              bannière. La taille est fixée en CSS (.be-mark), qui l'emporte sur la valeur ci-dessous. */}
          <BelgianMark width={150} title={t('landing.proudlyBelgian')} />
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
          <p className="landing-sub">{t('landing.subAdresse')}</p>
          {/* UN SEUL appel à l'action principal par page et par public (revue de lancement, 2026-09-18) : c'est
              désormais la barre d'adresse, et non plus le bouton « Commander maintenant » qui menait à
              l'inscription. La liste des commerces est publique (App.jsx) : on peut répondre à « livrez-vous
              chez moi ? » sans demander de compte ; c'est l'ouverture d'un commerce qui en demande un (voir
              RestaurantCard dans RestaurantList.jsx). Voir l'en-tête de HeroAdresse.jsx.
              Le sur-titre « Pas une multinationale » et le lien « Ou parcourir tous les commerces » qui
              encadraient la barre ont été retirés à la demande du fondateur (2026-09-27). */}
          <HeroAdresse />
          </div>
        </div>
        {/* La colonne de droite est à « Pourquoi Fairide ? » (2026-10-09, après l'exemple des 40 € du
            2026-09-27). L'aperçu des commerces, qui l'occupait, est descendu en bas de la bannière. */}
        <HeroPrix />
        {/* LA SUITE DE LA BANNIÈRE, sortie de l'affiche : sur téléphone, l'exemple des 40 € doit
            arriver juste sous la barre d'adresse, dans le premier écran (fondateur, 2026-09-27). La
            ligne partenaires et les dates d'ouverture passent donc après lui ; sur écran large, elles
            restent sous la barre, dans la colonne de gauche (grid-template-areas, styles.css). */}
        <div className="landing-hero-suite">
          {/* `audience=partner` sans `role` : la page d'inscription propose alors les trois types de
              compte (voir Auth.jsx, la lecture de `audience` et `role`). Une ligne qui dit
              « commerce OU livreur » ne peut pas pointer vers l'un des deux. */}
          <p className="landing-partner-line">
            {t('landing.partnerQuestion')} <Link to="/login?audience=partner">{t('landing.partnerLink')}</Link>
          </p>
          <p className="small landing-ouverture landing-ouverture-long"><Icone nom="reservations" taille={16} /> {t('landing.ordersOpenNote')}</p>
          <p className="small landing-ouverture landing-ouverture-court"><Icone nom="reservations" taille={16} /> {t('landing.ordersOpenCourt')}</p>
        </div>
        {/* « Déjà sur Fairide » revient dans la bannière (fondateur, 2026-09-27), en troisième rangée sur
            toute la largeur, les trois commerces côte à côte : le bas de la bannière était un aplat vide
            avant le fondu vers la vidéo. Voir `rangee` dans HeroPreview.jsx. */}
        <div className="hero-vitrine"><HeroPreview restaurants={restaurants} rangee /></div>
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

      {/* « Rejoindre Fairide » en version COURTE (fondateur, 2026-10-09 : « ça prend beaucoup de place ») :
          rôle, titre et lien, sans les puces. Les puces (`points`) restent dans joinCards() et dans les
          traductions, pour un retour en arrière en ne retouchant que ce bloc. */}
      <Reveal as="h2" className="section-title">{t('landing.joinTitle')}</Reveal>
      <div className="join-grid join-grid-compact">
        {joinCards(t).map((c, i) => (
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
            </div>
            <span className="join-link"><Icone nom={c.icon} taille={16} /> {c.link}</span>
          </Reveal>
        ))}
      </div>

      <Reveal><AppComingSoonSection /></Reveal>

      {/* PAGE D'ACCUEIL RACCOURCIE (fondateur, 2026-10-09). Retirés d'ici, dans l'ordre où ils venaient :
          - « Où va chaque euro » (.euro-block) : la carte « Pourquoi Fairide ? » de la bannière dit déjà
            30 % contre 10 % ;
          - « Communes desservies à Bruxelles » : la barre d'adresse répond déjà à « livrez-vous chez moi ? » ;
          - « Contact » : le formulaire vit sur /aide, joint par le lien « Contact » de l'en-tête (Layout.jsx) ;
          - « Ils nous font confiance » (PartnersMarquee) : « Déjà sur Fairide », dans la bannière, montre
            les mêmes commerces ;
          - « Envie de soutenir le quartier ? » : doublon du bouton d'inscription de l'en-tête.
          Les composants, leur CSS et leurs clés de traduction restent en place : rien d'autre ne les
          affiche, mais un retour en arrière ne demande que de les réimporter ici. */}
    </div>
  );
}
