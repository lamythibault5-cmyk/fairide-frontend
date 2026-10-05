import { getLocale } from './context/LanguageContext';

// Prix d'un plat après sa remise (même calcul que le panier, CartContext.totals) : « −X % » et « −X € » (Avantage
// Fairide compris). « 1 acheté = 1 offert » ne change pas le prix unitaire : null.
export function prixRemise(item) {
  const p = item?.activePromo;
  if (!p) return null;
  if (p.type === 'percent') return +(item.price * (1 - p.value / 100)).toFixed(2);
  if (p.type === 'amount') return +Math.max(0, item.price - p.value).toFixed(2);
  return null;
}

// Montant en euros dans la langue affichée : 15,11 € (fr-BE), €15.11 (en-GB), € 15,11 (nl-BE).
export function euros(v) {
  return new Intl.NumberFormat(getLocale(), { style: 'currency', currency: 'EUR' }).format(Number(v) || 0);
}

// Même chose sans « ,00 » pour un montant rond : un badge « -4 € dès 25 € » se lit mieux que « -4,00 € dès 25,00 € ».
function eurosCourt(v) {
  const n = Number(v) || 0;
  return new Intl.NumberFormat(getLocale(), { style: 'currency', currency: 'EUR', minimumFractionDigits: Number.isInteger(n) ? 0 : 2 }).format(n);
}

/* LIBELLÉ D'UNE PROMO DANS LA LANGUE AFFICHÉE.
 *
 * Le serveur enregistre un libellé en français à la création (routes/promotions.js : « -4€ dès 25€ de commande »,
 * « 1 acheté = 1 offert »), et c'est lui qui s'affichait tel quel sur le site en anglais et en néerlandais (test du
 * 5 oct. 2026). La promo porte pourtant tout ce qu'il faut pour le recomposer : type, valeur, seuil. Le libellé
 * enregistré ne sert plus que de repli pour un type que ce code ne connaîtrait pas. */
export function libellePromo(p, t) {
  if (!p) return null;
  const v = Number(p.value);
  if (p.type === 'cart_threshold' && p.minCartTotal != null) return t('restoListUi.promoCartThreshold', { value: eurosCourt(v), min: eurosCourt(p.minCartTotal) });
  if (p.type === 'percent' && Number.isFinite(v)) return t(p.fairide ? 'restoListUi.promoFairidePercent' : 'restoListUi.promoPercent', { value: v });
  if (p.type === 'amount' && Number.isFinite(v)) return t(p.fairide ? 'restoListUi.promoFairideAmount' : 'restoListUi.promoAmount', { value: eurosCourt(v) });
  if (p.type === 'bogo') return v > 1 ? t('restoListUi.promoBogoN', { n: v }) : t('restoListUi.promoBogo1');
  return p.label || null;
}
