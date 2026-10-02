import { useEffect, useState } from 'react';
import { api } from '../api';
import { useLanguage, getLocale } from '../context/LanguageContext';

// GARANTIE « ZÉRO COMMANDE = ZÉRO ABONNEMENT » (fondateur, 2026-10-02). Un mois sans aucune commande n'est pas dû :
// offert s'il suit le mois d'essai, remboursé sinon (garantieAbonnement.js côté API, appliqué par Stripe à chaque fin
// de période). Ici : la règle, où en est le mois en cours, et ce qui a déjà été offert ou remboursé.
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
  const euros = (v) => `${Number(v).toFixed(2).replace('.', ',').replace(/,00$/, '')} €`;
  return (
    <div className="garantie-abonnement">
      <b>🛡️ {t('accountUi.guaranteeTitle')}</b>
      <p className="small" style={{ margin: '4px 0 0' }}>{t('accountUi.guaranteeText')}</p>
      {etat?.ordersThisPeriod != null && (
        <p className="small garantie-etat">
          {etat.ordersThisPeriod === 0
            ? t('accountUi.guaranteeNoOrder', { date: jour(etat.periodEnd) })
            : t('accountUi.guaranteeOrders', { n: etat.ordersThisPeriod })}
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
