import { useMemo, useState } from 'react';
import { useLanguage } from '../context/LanguageContext';

/* L'addition de la bannière d'accueil.

   L'argument central de Fairide (la commission plafonnée à 10 %) était jusqu'ici énoncé : une
   phrase dans le paragraphe d'accroche, puis trois chiffres dans la barre de statistiques, puis
   une comparaison en barres plus bas dans la page (le bloc « Où va ton euro »). Ici il est
   MONTRÉ, dans le seul document que tout le monde dans ce métier sait déjà lire : un ticket.

   Un seul article, à prix rond, et c'est le point : sur un burger à 10 €, « 10 % de commission »
   cesse d'être un taux à appliquer et devient 1 € qu'on voit. Des versions intermédiaires de la
   maquette alignaient trois plats et un sous-total à 25 €. Plus réalistes, mais elles
   demandaient un calcul avant qu'on comprenne l'argument, et le ticket était trop haut pour
   laisser voir la suite de la page.

   La bascule est la seule animation de la bannière, et elle répond à un geste. Le surligneur
   lime reste toujours sur la même ligne, « le commerce garde », et c'est le montant qui chute
   dessous quand on passe à 30 %, pas le surligneur qui se déplace. */

/* Tout est calculé en CENTIMES, jamais en euros flottants : 10 × 0,30 vaut 3,0000000000000004 en
   IEEE 754, et un ticket dont les lignes ne retombent pas sur le total est exactement le genre de
   détail qui ruine l'argument qu'il est censé porter. Les montants ne sont donc pas non plus
   écrits en dur dans les traductions : changer le prix du burger ici recalcule tout le ticket,
   dans les trois langues. */
const BURGER_CENTS = 1000;
const DELIVERY_CENTS = 350;
const RATE_US = 10;
const RATE_THEM = 30;

export default function HeroAddition() {
  const { t, language } = useLanguage();
  const [mode, setMode] = useState('us');
  const isUs = mode === 'us';

  /* Le séparateur décimal suit la langue active : « 9,00 » en français et en néerlandais,
     « 9.00 » en anglais. Écrire « 9,00 » en dur dans les trois tables aurait donné un ticket
     faux pour un lecteur anglophone. */
  const money = useMemo(
    () => new Intl.NumberFormat(language, { minimumFractionDigits: 2, maximumFractionDigits: 2 }),
    [language]
  );
  const euro = useMemo(
    () => new Intl.NumberFormat(language, { style: 'currency', currency: 'EUR' }),
    [language]
  );
  const fmt = (cents) => money.format(cents / 100);

  const rate = isUs ? RATE_US : RATE_THEM;
  const cut = (BURGER_CENTS * rate) / 100;
  const keep = BURGER_CENTS - cut;
  const total = BURGER_CENTS + DELIVERY_CENTS;
  const delta = (BURGER_CENTS * (RATE_THEM - RATE_US)) / 100;

  return (
    <div className="addition">
      <div className="addition-head">
        <h2>{t('landing.billTitle')}</h2>
        <span>{t('landing.billExample')}</span>
      </div>

      {/* Les lignes sont en display:contents, ce sont donc les CELLULES qui sont les éléments de la
          grille. Sinon chaque ligne formerait sa propre grille et les montants ne s'aligneraient
          plus d'une ligne à l'autre : la ligne surlignée, dont la colonne « quantité » est vide,
          décalait son montant de quelques pixels par rapport aux lignes du dessus. */}
      <div className="bill" data-mode={mode}>
        <div className="bill-row">
          <span className="bill-lbl">{t('landing.billItem')}</span>
          <span className="bill-qty">×1</span>
          <span className="bill-amt">{fmt(BURGER_CENTS)}</span>
        </div>
        <div className="bill-row bill-muted">
          <span className="bill-lbl">{t('landing.billDelivery')}</span>
          <span className="bill-qty" />
          <span className="bill-amt">{fmt(DELIVERY_CENTS)}</span>
        </div>

        <div className="bill-rule" />

        <div className="bill-row bill-sum">
          <span className="bill-lbl">{t('landing.billTotal')}</span>
          <span className="bill-qty" />
          <span className="bill-amt">{fmt(total)}</span>
        </div>

        <div className="bill-rule" />

        <div className="bill-keep">
          <span className="bill-lbl">{t('landing.billKeepShop')}</span>
          <span className="bill-qty" />
          <span className="bill-amt">{fmt(keep)}</span>
        </div>
        <div className="bill-row bill-muted">
          <span className="bill-lbl">{t('landing.billKeepDriver')}</span>
          <span className="bill-qty" />
          <span className="bill-amt">{fmt(DELIVERY_CENTS)}</span>
        </div>
        <div className="bill-row bill-muted">
          <span className="bill-lbl">
            {isUs ? t('landing.billCutUs', { rate: RATE_US }) : t('landing.billCutThem', { rate: RATE_THEM })}
          </span>
          <span className="bill-qty" />
          <span className="bill-amt">{fmt(cut)}</span>
        </div>
      </div>

      {/* aria-live : la bascule ne déplace pas le focus, donc sans cela un lecteur d'écran
          n'annoncerait jamais la phrase qui apparaît, le seul endroit où l'écart est dit en
          toutes lettres plutôt que lu dans une colonne. */}
      <p className="bill-delta" aria-live="polite">
        {!isUs && (
          <>
            <b>{t('landing.billDeltaFigure', { amount: euro.format(delta / 100) })}</b>{' '}
            {t('landing.billDeltaText')}
          </>
        )}
      </p>

      <div className="bill-toggle" role="group" aria-label={t('landing.billToggleLabel')}>
        <button type="button" aria-pressed={isUs} onClick={() => setMode('us')}>
          {t('landing.billToggleUs', { rate: RATE_US })}
        </button>
        <button type="button" aria-pressed={!isUs} onClick={() => setMode('them')}>
          {t('landing.billToggleThem', { rate: RATE_THEM })}
        </button>
      </div>

      <p className="bill-foot">{t('landing.billFoot')}</p>
    </div>
  );
}
