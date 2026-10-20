import { useMemo } from 'react';
import { Link } from 'react-router-dom';
import { useLanguage } from '../context/LanguageContext';
import AppComingSoonSection from '../components/AppComingSoonSection';
import Reveal from '../components/Reveal';
import BelgianMark from '../components/BelgianMark';
import usePageMeta from '../hooks/usePageMeta';
import useJsonLd from '../seo/useJsonLd';
import { organizationJsonLd, websiteJsonLd } from '../seo/jsonLd';
import HeroPreview, { useCommercesReels, vitrineAccueil } from '../components/landing/HeroPreview';
import HeroAdresse from '../components/landing/HeroAdresse';
import HeroPrix from '../components/landing/HeroPrix';
import DiscoverSection from '../components/landing/DiscoverSection';
import Icone from '../components/Icone';
import '../site-accueil.css';

/* L'ACCUEIL DU SITE, VERSION « BANDEAU ET FEUILLE » (fondateur, 2026-10-16, version B de mockups/accueil-site.html).
 * Le même cadre que l'app et que les autres écrans du site : un bandeau iris plein (plus de vidéo ni de photo derrière),
 * le slogan en blanc, la barre d'adresse et le vélo sur sa route ; « Pourquoi Fairide ? » en deux barres calmes ; tout le
 * reste monte dans une feuille blanche aux coins ronds. Le lime ne reste que sur ce qui fait avancer (la flèche de
 * l'adresse, « Inscription » dans l'en-tête).
 *
 * LE VÉLO BELGE RESTE (demande du fondateur : « les gens doivent voir que c'est une startup bruxelloise »). Il ouvre le
 * bandeau, au-dessus du titre, sur une pastille blanche : sur l'iris nu, sa roue noire disparaît (BelgianMark.jsx, « si la
 * roue noire doit ressortir, c'est la version sur tuile qu'il faut »), et la pastille dit en toutes lettres d'où vient
 * Fairide.
 *
 * Mise en page : site-accueil.css. L'application n'affiche jamais cette page (Home.jsx). */

/* Les trois portes d'entrée. `icon` est un nom du jeu maison (Icone.jsx). Livreurs : indépendant ou étudiant-indépendant
   (CODE-12 : plus d'économie collaborative). Les puces (`points`) ne sont plus affichées depuis la version courte du
   2026-10-09 : rôle, titre et lien. */
function joinCards(t) {
  return [
    { key: 'client', icon: 'sac', eyebrow: t('landing.joinClientRole'), title: t('landing.joinClientTitle'), link: t('landing.joinClientLink'), to: '/login?audience=client' },
    { key: 'restaurant', icon: 'commerce', eyebrow: t('landing.joinRestaurantRole'), title: t('landing.joinRestaurantTitle'), link: t('landing.joinRestaurantLink'), to: '/login?audience=partner&role=restaurant' },
    { key: 'driver', icon: 'velo', eyebrow: t('landing.joinDriverRole'), title: t('landing.joinDriverTitle'), link: t('landing.joinDriverLink'), to: '/login?audience=partner&role=driver' }
  ];
}

// Deux arguments (demande du fondateur, 2026-09-21 : les chiffres « 10 % · 19 · 100 % » disaient la même chose, en moins clair).
// Les prix pas gonflés EN PREMIER (fondateur, 2026-10-19 : c'est la première raison de choisir Fairide), le local ensuite.
function features(t) {
  return [
    { icon: 'euro', title: t('landing.featureFairTitle'), text: t('landing.featureFairText') },
    { icon: 'commerce', title: t('landing.featureLocalTitle'), text: t('landing.featureLocalText') }
  ];
}

// Le vélo de la marque roule sur sa route pointillée, EN BOUCLE (fondateur, 2026-10-16 : « on peut le faire bouger ? ») :
// il arrive, s'arrête au commerce (qui sursaute : la commande est prise), repart jusqu'à l'adresse (l'épingle sursaute :
// livré), s'efface et recommence. Une boucle de 9 s, réglée dans site-accueil.css. Décoratif.
function SceneRoute() {
  return (
    <svg className="sa-scene" viewBox="0 0 520 110" aria-hidden="true">
      <line className="sa-scene-route" x1="4" y1="100" x2="516" y2="100" strokeWidth="3" strokeLinecap="round" strokeDasharray="8 8" />
      <g transform="translate(300 54)"><g className="sa-scene-repere sa-scene-boutique">
        <g transform="scale(1.6)" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round">
          <path d="M4 9h16v11a1 1 0 0 1-1 1H5a1 1 0 0 1-1-1V9Z" /><path d="M3 9 5 4h14l2 5" /><path d="M9 21v-6h6v6" />
        </g>
      </g></g>
      <g transform="translate(460 54)"><g className="sa-scene-repere sa-scene-epingle">
        <g transform="scale(1.6)" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round">
          <path d="M12 21s7-5.6 7-11a7 7 0 1 0-14 0c0 5.4 7 11 7 11Z" /><circle cx="12" cy="10" r="2.6" />
        </g>
      </g></g>
      <g transform="translate(4 45.6) scale(1.15)">
        <g className="sa-scene-velo"><g className="sa-scene-bob">
          <g fill="none" stroke="currentColor" strokeWidth="5" strokeLinecap="round"><circle cx="15" cy="29" r="12.5" /><circle cx="61" cy="29" r="12.5" /></g>
          <g fill="currentColor"><rect x="16" y="8" width="44" height="5" rx="2.5" /><g transform="rotate(42 27 22.5)"><rect x="13" y="20" width="28" height="5" rx="2.5" /></g></g>
        </g></g>
      </g>
    </svg>
  );
}

export default function Landing() {
  const { t } = useLanguage();
  usePageMeta({ description: t('seo.homeDescription'), path: '/' });
  useJsonLd(organizationJsonLd(), 'ld-organization');
  useJsonLd(websiteJsonLd(), 'ld-website');
  // Lus une fois pour toute la page : « Déjà sur Fairide » et la vitrine « Découvre ».
  const reels = useCommercesReels();
  // Vrais commerces seulement (fondateur, 22/09 puis 11/10 : jamais de démo, même s'ils sont peu nombreux).
  const restaurants = useMemo(() => vitrineAccueil(reels), [reels]);

  return (
    <div className="sa-accueil">
      <section className="sa-bandeau">
        <div className="sa-bandeau-texte">
          <span className="sa-belge">
            <BelgianMark width={58} title={t('landing.proudlyBelgian')} />
            <span>{t('landing.beBadge')}</span>
          </span>
          <h1 className="sa-titre">{t('landing.title1')}<br />{t('landing.title2')}</h1>
          <p className="sa-sous">{t('landing.subAdresse')}</p>
          {/* Le seul appel à l'action de la page : « livrez-vous chez moi ? » se demande sans compte (HeroAdresse.jsx). */}
          <HeroAdresse />
          {/* Les trois dates ne tiennent pas en entier sur un téléphone : la version courte y prend le relais. */}
          <p className="sa-ouverture sa-ouverture-long"><Icone nom="reservations" taille={16} /> {t('landing.ordersOpenNote')}</p>
          <p className="sa-ouverture sa-ouverture-court"><Icone nom="reservations" taille={16} /> {t('landing.ordersOpenCourt')}</p>
          <SceneRoute />
        </div>
        <HeroPrix />
      </section>

      <div className="sa-feuille">
        {/* « Déjà sur Fairide » : trois vrais commerces, tirés au sort (HeroPreview.jsx). */}
        <HeroPreview restaurants={restaurants} rangee />

        <div className="sa-arguments">
          {features(t).map((f, i) => (
            <Reveal className="sa-argument" key={f.title} delay={i * 90}>
              <span className="sa-tuile"><Icone nom={f.icon} taille={22} /></span>
              <div>
                <h3>{f.title}</h3>
                <p>{f.text}</p>
              </div>
            </Reveal>
          ))}
        </div>

        <DiscoverSection restaurants={restaurants} />

        {/* « Rejoindre Fairide » en version courte (fondateur, 2026-10-09) : rôle, titre et lien. */}
        <Reveal as="h2" className="sa-section-titre">{t('landing.joinTitle')}</Reveal>
        <div className="sa-portes">
          {joinCards(t).map((c, i) => (
            <Reveal as={Link} to={c.to} key={c.key} delay={i * 90} className="sa-porte">
              <span className="sa-porte-role"><Icone nom={c.icon} taille={15} /> {c.eyebrow}</span>
              <h3>{c.title}</h3>
              <span className="sa-porte-lien">{c.link} <span aria-hidden="true">→</span></span>
            </Reveal>
          ))}
        </div>

        <Reveal><AppComingSoonSection /></Reveal>
      </div>
      {/* PAGE D'ACCUEIL RACCOURCIE (fondateur, 2026-10-09) : « Où va chaque euro », « Communes desservies », « Contact »,
          « Ils nous font confiance » et « Envie de soutenir le quartier ? » restent retirés. La ligne « Commerce ou
          livreur ? Rejoindre Fairide » de la bannière part avec la version B : la rangée « Rejoindre Fairide » mène aux
          mêmes inscriptions. */}
    </div>
  );
}
