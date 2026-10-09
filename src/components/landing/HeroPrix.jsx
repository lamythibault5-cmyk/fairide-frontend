import { useLanguage } from '../../context/LanguageContext';

// « POURQUOI FAIRIDE ? » DANS LA BANNIÈRE — maquette du fondateur (2026-10-09), qui remplace l'exemple
// des 40 € du 2026-09-27 : deux cases côte à côte, ce que garde le resto chez les grandes plateformes
// et chez Fairide. Un pourcentage se lit plus vite qu'un montant sur une commande inventée, et il vaut
// pour toutes les commandes.
//
// D'OÙ VIENNENT LES CHIFFRES — à relire avant d'en changer un.
// - 30 % : haut de la fourchette 22-32 % citée partout sur le site, hors TVA.
// - 10 % : le taux de Fairide, hors TVA lui aussi depuis le 2026-10-01 (CLAUDE.md, « Pricing model ») :
//   les deux taux sont donc sur la même base. Rapporté au prix affiché, TVA de la commission comprise,
//   Fairide garde 10,8 % ; « le resto garde 90 % » arrondit d'à peine un point, alors que le resto
//   touche en réalité 100 % de son prix en salle — l'arrondi reste dans le sens qui nous dessert.
//
// TEXTES DE LA MAQUETTE VOLONTAIREMENT CORRIGÉS (à ne pas remettre) :
// - « Commission prise au restaurant » : faux chez nous, la commission est dans le prix affiché, payée
//   par le client (CLAUDE.md, « Pricing model ») ;
// - « Le livreur garde 100 % des frais de livraison » : il touche 90 % de sa grille, les 10 % restants
//   sont les frais de système de Fairide (modèle du 08/10) ;
// - « Pas de frais de service » : ces frais de système existent, DANS la livraison. On écrit donc que
//   rien n'est ajouté au paiement à part la livraison (CGU-2026-10-09) ;
// - « +10 % » côté client : la carte est à +12,1 % TVA comprise. On ne donne pas de chiffre, on dit
//   que la commission est déjà dans le prix affiché.
const TAUX_EUX = 0.30;
const TAUX_NOUS = 0.10;

// La flèche dessinée à la main, du titre vers la case Fairide (maquette) : un trait gris, un peu
// tremblé, qui finit en boucle et en pointe. Décorative, donc cachée aux lecteurs d'écran.
function FlecheDessinee() {
  return (
    <svg className="hero-prix-fleche" viewBox="0 0 120 70" aria-hidden="true" focusable="false">
      <path
        d="M4 14 C 30 6, 62 4, 92 10 C 104 13, 110 22, 102 30 C 94 37, 84 30, 90 24 C 96 18, 104 26, 100 38 C 97 46, 92 52, 92 62"
        fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round"
      />
      {/* La pointe est symétrique autour de x = 92, où le trait arrive à la verticale : le trait tombe
          pile au milieu du chevron. Si l'on retouche la fin du tracé, garder les deux alignés. */}
      <path d="M85 55 L 92 63 L 99 55" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

function Case({ nom, taux, classe, wordmark, t }) {
  // Espace insécable : « 90 » et « % » se retrouvaient sur deux lignes dans la case étroite du téléphone.
  const pct = (x) => `${Math.round(x * 100)} %`;
  const resto = 1 - taux;
  return (
    <div className={`hero-prix-bloc ${classe}`}>
      <span className={wordmark ? 'hero-prix-nom wordmark' : 'hero-prix-nom'}>{nom}</span>
      <b className="hero-prix-montant">{pct(taux)}</b>
      <div className="hero-prix-piste" aria-hidden="true">
        <div className="hero-prix-resto" style={{ '--w': `${Math.round(resto * 100)}%` }} />
        <div className="hero-prix-part" />
      </div>
      <span className="hero-prix-legende">{t('landing.priceKeeps', { pct: pct(resto) })}</span>
    </div>
  );
}

export default function HeroPrix() {
  const { t } = useLanguage();

  return (
    <section className="hero-prix" aria-label={t('landing.priceWhyAria')}>
      <h2 className="hero-prix-titre">
        {/* Le <span> porte la flèche : elle part du BOUT du texte, quelle que soit la langue. */}
        <span className="hero-prix-titre-texte">{t('landing.priceWhy')}<FlecheDessinee /></span>
      </h2>

      <div className="hero-prix-blocs">
        <Case nom={t('landing.priceThem')} taux={TAUX_EUX} classe="hero-prix-eux" t={t} />
        <Case nom="fairide" taux={TAUX_NOUS} classe="hero-prix-nous" wordmark t={t} />
      </div>

      <p className="hero-prix-toi">
        <b>{t('landing.priceYouTitle')}</b> {t('landing.priceYouText')}
      </p>
    </section>
  );
}
