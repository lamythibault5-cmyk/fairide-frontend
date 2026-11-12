import { GourmandSite, GourmandTitre } from '../components/Gourmandises';
import { Link } from 'react-router-dom';
import { useLanguage } from '../context/LanguageContext';
import Reveal from '../components/Reveal';
import BelgianMark from '../components/BelgianMark';
import usePageMeta from '../hooks/usePageMeta';
import useJsonLd from '../seo/useJsonLd';
import { organizationJsonLd, websiteJsonLd } from '../seo/jsonLd';
import HeroAdresse from '../components/landing/HeroAdresse';
import HeroPrix from '../components/landing/HeroPrix';
import EssaiAppli from '../components/landing/EssaiAppli';
import AvecMarque from '../components/AvecMarque';
import Icone from '../components/Icone';
import { useLancement } from '../launch';
import '../site-accueil.css';

/* L'ACCUEIL DU SITE, VERSION « BANDEAU ET FEUILLE » (fondateur, 2026-10-16, version B de maquettes/accueil-site/accueil-site.html).
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

/* « REJOINDRE FAIRRIDE » EN DEUX PORTES (Owen, 2026-11-12, réponse 7 de maquettes/site-appli-essai) : Commerce et Livreur. La
   porte Client est partie : le faux téléphone juste au-dessus l'est déjà (EssaiAppli.jsx). La bande « Déjà 30 restaurants
   pré-inscrits » est partie avec la vitrine (son chiffre ne collait plus). Le commerce sur l'iris avec le seul lime de la
   section, le livreur en blanc à filet. Textes de voix.md : « 10 %, pas 30 », « personne ne te note » (le 90 % du livreur
   n'est dit qu'aux livreurs, ici sur leur porte). Livreurs : indépendant ou étudiant-indépendant (CODE-12). */
function portes(t) {
  return [
    { key: 'restaurant', icon: 'commerce', role: t('landing.joinRestaurantRole'), title: t('landing.joinRestaurantTitle'), ligne: t('landing.joinRestaurantLigne'), link: t('landing.joinRestaurantLink'), to: '/login?audience=partner&role=restaurant' },
    { key: 'driver', icon: 'velo', role: t('landing.joinDriverRole'), title: t('landing.joinDriverTitle'), ligne: t('landing.joinDriverLigne'), link: t('landing.joinDriverLink'), to: '/login?audience=partner&role=driver' }
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
  const { go, emporter } = useLancement();
  usePageMeta({ description: t('seo.homeDescription'), path: '/' });
  useJsonLd(organizationJsonLd(), 'ld-organization');
  useJsonLd(websiteJsonLd(), 'ld-website');

  return (
    <div className="sa-accueil">
      {/* Les dessins gourmands : grappe en haut à droite du bandeau sur téléphone, marges sur l'ordinateur (Gourmandises.jsx). */}
      <GourmandSite />
      <section className="sa-bandeau">
        <div className="sa-bandeau-texte">
          <span className="sa-belge">
            <BelgianMark width={58} title={t('landing.proudlyBelgian')} />
            <span>{t('landing.beBadge')}</span>
          </span>
          {/* « Arrête de payer des prix gonflés. » (fondateur, 2026-10-26, version E de maquettes/croissance/prix-gonfles.html).
              Le slogan « Paie ton repas, pas la plateforme. » (landing.title1/2) reste sous le logo et à l'accueil de l'app. */}
          <h1 className="sa-titre">{t('landing.titreAccueil1')}<br />{t('landing.titreAccueil2')}</h1>
          <p className="sa-sous">{t('landing.subAdresse')}</p>
          {/* Le seul appel à l'action de la page : « livrez-vous chez moi ? » se demande sans compte (HeroAdresse.jsx). */}
          <HeroAdresse />
          {/* Où en est l'ouverture, sans aucune date (fondateur, 2026-10-31) : « bientôt » avant « Ouvrir l'à emporter », l'à
              emporter ouvert ensuite, plus rien après le GO. La phrase longue ne tient pas sur un téléphone : la courte y prend le relais. */}
          {!go && <>
            <p className="sa-ouverture sa-ouverture-long"><Icone nom="reservations" taille={16} /> {t(emporter ? 'landing.ordersOpenNotePickup' : 'landing.ordersOpenNote')}</p>
            <p className="sa-ouverture sa-ouverture-court"><Icone nom="reservations" taille={16} /> {t(emporter ? 'landing.ordersOpenCourtPickup' : 'landing.ordersOpenCourt')}</p>
          </>}
          <SceneRoute />
        </div>
        <HeroPrix />
      </section>

      <div className="sa-feuille">
        {/* L'appli sur l'accueil (Owen, 2026-11-12, maquettes/site-appli-essai) : « l'alternative », deux lignes, et le faux
            téléphone qui montre la vraie page des commerces de l'appli (EssaiAppli.jsx). Remplace « Déjà sur Fairride »,
            « L'alternative » et ses deux arguments, la vitrine « Les commerces partenaires » et la bande « L'appli fairride ». */}
        <EssaiAppli />

        <Reveal as="h2" className="sa-section-titre sa-avec-gourmand"><AvecMarque>{t('landing.joinTitle')}</AvecMarque><GourmandTitre ou="rejoindre" /></Reveal>
        <div className="sa-portes sa-portes-deux">
          {portes(t).map((c, i) => (
            <Reveal as={Link} to={c.to} key={c.key} delay={i * 90} className={`sa-porte${c.key === 'restaurant' ? ' sa-porte-iris' : ''}`}>
              <span className="sa-porte-role"><Icone nom={c.icon} taille={15} /> {c.role}</span>
              <h3>{c.title}</h3>
              <p className="sa-porte-ligne">{c.ligne}</p>
              <span className="sa-porte-bouton">{c.link}</span>
            </Reveal>
          ))}
        </div>
      </div>
      {/* PAGE D'ACCUEIL RACCOURCIE (fondateur, 2026-10-09) : « Où va chaque euro », « Communes desservies », « Contact »,
          « Ils nous font confiance » et « Envie de soutenir le quartier ? » restent retirés. La ligne « Commerce ou
          livreur ? Rejoindre Fairide » de la bannière part avec la version B : la rangée « Rejoindre Fairide » mène aux
          mêmes inscriptions. */}
    </div>
  );
}
