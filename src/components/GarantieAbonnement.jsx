import { useEffect, useState } from 'react';
import { api } from '../api';
import { eurosCourt } from '../prixPlat';
import { useLanguage, getLocale } from '../context/LanguageContext';
import Icone from './Icone';

// GARANTIE « PETIT MOIS = PAS D'ABONNEMENT » (fondateur, 2026-10-11 ; « zéro commande » avant, 2026-10-02). Un mois dont
// les commandes ne dépassent pas 50 € de produits n'est pas dû : offert s'il suit le mois d'essai, remboursé sinon
// (garantieAbonnement.js côté API, appliqué par Stripe à chaque fin de période ; le seuil vient de l'API,
// guaranteeThreshold). Ici : la règle, le montant du mois en cours face au seuil, et ce qui a déjà été offert ou remboursé.
// `restoId` absent (inscription, page d'offre) : la règle seule.
export default function GarantieAbonnement({ restoId, token, abonne = false }) {
  const { t } = useLanguage();
  const [etat, setEtat] = useState(null);
  useEffect(() => {
    if (!restoId || !token || !abonne) return undefined;
    let annule = false;
    api(`/restaurants/${restoId}/subscription/guarantee`, { token }).then((r) => { if (!annule) setEtat(r); }).catch(() => {});
    return () => { annule = true; };
  }, [restoId, token, abonne]);

  const jour = (d) => new Date(d).toLocaleDateString(getLocale(), { day: 'numeric', month: 'long' });
  // Montants dans la langue affichée (audit du 19/10, shop-119), plus « 12,50 € » en anglais.
  const euros = (v) => eurosCourt(v);
  return (
    <div className="garantie-abonnement">
      <b><Icone nom="bouclier" taille={16} className="icone-texte" />{' '}{t('accountUi.guaranteeTitle')}</b>
      <p className="small" style={{ margin: '4px 0 0' }}>{t('accountUi.guaranteeText')}</p>
      {etat?.salesThisPeriod != null && (
        <p className="small garantie-etat">
          {etat.salesThisPeriod > (etat.guaranteeThreshold ?? 50)
            ? t('accountUi.guaranteeOver', { amount: euros(etat.salesThisPeriod), threshold: euros(etat.guaranteeThreshold ?? 50) })
            : t('accountUi.guaranteeUnder', { amount: euros(etat.salesThisPeriod), threshold: euros(etat.guaranteeThreshold ?? 50), n: etat.ordersThisPeriod, date: jour(etat.periodEnd) })}
        </p>
      )}
      {(etat?.history || []).length > 0 && (
        <ul className="small garantie-historique">
          {etat.history.map((h) => (
            <li key={h.periodStart}>
              {t(`accountUi.guaranteeHistory_${h.kind === 'mois_offert' ? 'free' : 'refund'}`, { amount: euros(h.amount), from: jour(h.periodStart), to: jour(h.periodEnd) })}
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
