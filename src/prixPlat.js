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

// Remise d'une ligne du panier (`qty` fois ce plat), la règle du serveur : « −X % » et « −X € » sur le prix de base du plat
// (pas sur les suppléments), « −X € » plafonné au prix du plat, « N achetés = 1 offert » par paquet de N + 1. Partagée par
// CartContext.totals (panier, paiement) et la commande groupée, pour que chaque écran montre le même prix payé.
export function remiseLigne(item, qty) {
  const p = item?.activePromo;
  if (!p || !(qty > 0)) return 0;
  const prix = Number(item.price) || 0;
  if (p.type === 'percent') return prix * qty * (Number(p.value) / 100);
  if (p.type === 'amount') return Math.min(Number(p.value) || 0, prix) * qty;
  if (p.type === 'bogo') return Math.floor(qty / ((Number(p.value) || 1) + 1)) * prix;
  return 0;
}

// L'offre en deux ou trois signes, pour « −5 % inclus » sous une ligne du panier et « Offre Maestro −5 % » sur le ticket
// du paiement : « −5 % » (espace insécable : « −5 » ne se sépare jamais de « % »), « −1 € », sinon le libellé complet.
export function remiseCourte(p, t) {
  if (!p) return null;
  const v = Number(p.value);
  if (p.type === 'percent' && Number.isFinite(v)) return getLocale().startsWith('en') ? `−${v}%` : `−${String(v).replace('.', ',')} %`;
  if (p.type === 'amount' && Number.isFinite(v)) return `−${eurosCourt(v)}`;
  return libellePromo(p, t);
}

// Montant en euros dans la langue affichée : 15,11 € (fr-BE), €15.11 (en-GB), € 15,11 (nl-BE).
export function euros(v) {
  return new Intl.NumberFormat(getLocale(), { style: 'currency', currency: 'EUR' }).format(Number(v) || 0);
}

// Une distance dans le format de la langue : « 0,3 km » en français et en néerlandais, « 0.3 km » en anglais (audit du 19/10,
// LIVE-14 : la virgule était écrite en dur, la liste anglaise disait « 0,3 km »). Une décimale sous 10 km, aucune au-delà.
export function kmLisible(v) {
  const n = Number(v) || 0;
  const dec = n < 10 ? 1 : 0;
  return `${new Intl.NumberFormat(getLocale(), { minimumFractionDigits: dec, maximumFractionDigits: dec }).format(n)} km`;
}

// Même chose sans « ,00 » pour un montant rond : un badge « -4 € dès 25 € » se lit mieux que « -4,00 € dès 25,00 € ».
// Exportée pour la page Promotions du commerce (audit du 19/10, shop-119 : elle avait son propre format, français partout).
export function eurosCourt(v) {
  const n = Number(v) || 0;
  return new Intl.NumberFormat(getLocale(), { style: 'currency', currency: 'EUR', minimumFractionDigits: Number.isInteger(n) ? 0 : 2 }).format(n);
}

/* LIBELLÉ D'UNE PROMO DANS LA LANGUE AFFICHÉE.
 *
 * Le serveur enregistre un libellé en français à la création (routes/promotions.js : « -4€ dès 25€ de commande »,
 * « 1 acheté = 1 offert »), et c'est lui qui s'affichait tel quel sur le site en anglais et en néerlandais (test du
 * 5 oct. 2026). La promo porte pourtant tout ce qu'il faut pour le recomposer : type, valeur, seuil. Le libellé
 * enregistré ne sert plus que de repli pour un type que ce code ne connaîtrait pas.
 * `court` : sur la photo d'un commerce dans la liste, l'Avantage Fairride se dit « -5 % sur tout » (fondateur, 2026-10-26,
 * maquettes/sections-pleines) ; « -5 % Avantage Fairride » y était coupé. Le texte entier reste sur la fiche du commerce. */
export function libellePromo(p, t, { court = false } = {}) {
  if (!p) return null;
  const v = Number(p.value);
  const fairride = (cle) => (court ? `restoListUi.promoFairide${cle}Court` : `restoListUi.promoFairide${cle}`);
  if (p.type === 'cart_threshold' && p.minCartTotal != null) return t('restoListUi.promoCartThreshold', { value: eurosCourt(v), min: eurosCourt(p.minCartTotal) });
  if (p.type === 'percent' && Number.isFinite(v)) return t(p.fairide ? fairride('Percent') : 'restoListUi.promoPercent', { value: v });
  if (p.type === 'amount' && Number.isFinite(v)) return t(p.fairide ? fairride('Amount') : 'restoListUi.promoAmount', { value: eurosCourt(v) });
  if (p.type === 'bogo') return v > 1 ? t('restoListUi.promoBogoN', { n: v }) : t('restoListUi.promoBogo1');
  return p.label || null;
}
