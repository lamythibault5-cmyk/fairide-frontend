import { useLanguage } from '../../context/LanguageContext';
import Icone from '../Icone';

// LE TICKET DE COMPARAISON DE LA BANNIÈRE — « wow, c'est moins cher » en un coup d'œil (fondateur,
// 2026-09-27). Il prend la place de l'aperçu des commerces (HeroPreview), que la vitrine
// « Découvre » montre de toute façon juste en dessous.
//
// D'OÙ VIENNENT LES CHIFFRES — à relire avant d'en changer un.
// - Fairide : prix en salle + 10 %, c'est la règle de construction des cartes (CLAUDE.md, « Pricing
//   model », et ../fairide-backend/scripts/prix.js). 10 € en salle = 11 € ici. Pas une estimation.
// - Grandes plateformes : +39 %, la hausse MOYENNE mesurée entre la carte Uber Eats de Snack Bodrum
//   et ses prix au comptoir (CLAUDE.md, « Known gaps » n° 5). C'est UNE mesure, sur UN commerce.
//   Une publicité comparative doit être exacte et vérifiable (CDE VI.17) : avant la mise en ligne,
//   élargir la mesure à plusieurs commerces, ou garder le « environ » et la note de bas de ticket
//   qui disent d'où vient le chiffre. Ne pas l'arrondir à la hausse.
// - Le ticket compare le PRIX DU PLAT, pas le total de la commande : les frais de livraison et de
//   service varient d'une plateforme à l'autre, et on n'a rien mesuré là-dessus. La note le dit.
const PRIX_SALLE = 10;
const MAJORATION_FAIRIDE = 0.10;
const MAJORATION_PLATEFORMES = 0.39;

export default function HeroPrix() {
  const { t, locale } = useLanguage();
  const euros = (n) => new Intl.NumberFormat(locale, { style: 'currency', currency: 'EUR' }).format(n);
  const eux = PRIX_SALLE * (1 + MAJORATION_PLATEFORMES);
  const nous = PRIX_SALLE * (1 + MAJORATION_FAIRIDE);
  // Les barres se lisent sans les chiffres : la plus longue vaut 100 %, la nôtre sa proportion.
  const largeurNous = `${Math.round((nous / eux) * 100)}%`;

  return (
    <div className="hero-prix" aria-label={t('landing.priceAria')}>
      <p className="hero-prix-titre">{t('landing.priceTitle')}</p>

      <div className="hero-prix-ligne hero-prix-eux">
        <div className="hero-prix-haut">
          <span>{t('landing.priceThem')}</span>
          <s>{t('landing.priceAbout')} {euros(eux)}</s>
        </div>
        <div className="hero-prix-piste"><div className="hero-prix-barre" style={{ '--w': '100%' }} /></div>
      </div>

      <div className="hero-prix-ligne hero-prix-nous">
        <div className="hero-prix-haut">
          <span className="wordmark">fairide</span>
          <b>{euros(nous)}</b>
        </div>
        <div className="hero-prix-piste"><div className="hero-prix-barre" style={{ '--w': largeurNous }} /></div>
      </div>

      <div className="hero-prix-gain">
        <b>−{euros(eux - nous)}</b>
        <span>{t('landing.priceSaving')}</span>
      </div>

      <ul className="hero-prix-atouts">
        <li><Icone nom="maison" taille={18} /> {t('landing.priceLocal')}</li>
        <li><Icone nom="scooter" taille={18} /> {t('landing.priceCourier')}</li>
      </ul>

      <p className="hero-prix-note">{t('landing.priceNote', { prix: euros(PRIX_SALLE) })}</p>
    </div>
  );
}
