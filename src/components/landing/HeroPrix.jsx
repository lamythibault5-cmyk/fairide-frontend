import { useLanguage } from '../../context/LanguageContext';

// L'EXEMPLE DES 40 € DANS LA BANNIÈRE — maquette du fondateur (2026-09-27) : deux blocs côte à côte,
// ce que prend la plateforme sur une même commande, et l'écart dans une pastille blanche.
//
// Il remplace un premier « ticket » qui comparait le prix d'un plat pour le client (13,90 € contre
// 11 €). Ce ticket-là reposait sur une hausse de 39 % mesurée sur UN seul commerce ; celui-ci repose
// sur des taux publics, et c'est l'argument que la page porte déjà plus bas (bloc « Où va chaque
// euro », landing.euro*) : même lecture, 0,10 € contre 0,22 à 0,32 € par euro.
//
// D'OÙ VIENNENT LES CHIFFRES — à relire avant d'en changer un.
// - 30 % : haut de la fourchette 22-32 % déjà citée partout sur le site, hors TVA.
// - 10 % : la part de Fairide, TVA COMPRISE — commission + commission_vat (CLAUDE.md, « Pricing
//   model »). La maquette titrait « Commission hors TVA » : faux pour notre colonne, d'où l'étiquette
//   par bloc plutôt qu'un sur-titre commun. Comparer du TVAC à du HTVA nous désavantage, jamais
//   l'inverse : la comparaison reste honnête.
// - Comme dans le bloc euro, la base est le prix du commerce : 40 € de commande, Fairide en prend 4,
//   que le client paie en plus (carte à +10 %). Ne pas écrire « le resto ne paie rien » ni
//   « 100 % au restaurant » (CLAUDE.md).
const COMMANDE = 40;
const TAUX_EUX = 0.30;
const TAUX_NOUS = 0.10;

export default function HeroPrix() {
  const { t, locale } = useLanguage();
  // Montants ronds : « 12 € » se lit d'un coup d'œil, « 12,00 € » non.
  const euros = (n) => new Intl.NumberFormat(locale, {
    style: 'currency', currency: 'EUR', maximumFractionDigits: Number.isInteger(n) ? 0 : 2
  }).format(n);
  const eux = Math.round(COMMANDE * TAUX_EUX * 100) / 100;
  const nous = Math.round(COMMANDE * TAUX_NOUS * 100) / 100;
  const pct = (x) => `${Math.round(x * 100)} %`;

  return (
    <section className="hero-prix" aria-label={t('landing.priceAria')}>
      <h2 className="hero-prix-titre">{t('landing.priceTitle', { montant: euros(COMMANDE) })}</h2>

      <div className="hero-prix-blocs">
        <div className="hero-prix-bloc hero-prix-eux">
          <span className="hero-prix-nom">{t('landing.priceThem')}</span>
          <b className="hero-prix-montant">{euros(eux)}</b>
          <span className="hero-prix-taux">{pct(TAUX_EUX)} · {t('landing.priceExVat')}</span>
          <div className="hero-prix-piste"><div className="hero-prix-barre" style={{ '--w': pct(TAUX_EUX).replace(' ', '') }} /></div>
        </div>
        <div className="hero-prix-bloc hero-prix-nous">
          <span className="hero-prix-nom wordmark">fairide</span>
          <b className="hero-prix-montant">{euros(nous)}</b>
          <span className="hero-prix-taux">{pct(TAUX_NOUS)} · {t('landing.priceInclVat')}</span>
          <div className="hero-prix-piste"><div className="hero-prix-barre" style={{ '--w': pct(TAUX_NOUS).replace(' ', '') }} /></div>
        </div>
      </div>

      <p className="hero-prix-gain">
        <b>{t('landing.priceGainStrong', { montant: euros(eux - nous) })}</b> {t('landing.priceGainRest')}
      </p>
      <p className="hero-prix-note">{t('landing.priceNote')}</p>
    </section>
  );
}
