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
