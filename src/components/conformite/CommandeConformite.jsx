import { useLanguage } from '../../context/LanguageContext';
import Modale from '../Modale';

/* Contrôle d'âge à la remise (B6) : trois issues, toutes dans la même fenêtre — pièce vérifiée
 * (remettre), âge non prouvé (refuser la remise), ou revenir. Utilisé par le commerce (à emporter) et
 * par le livreur (livraison). */
export function VerificationAge({ order, onVerifie, onRefuse, onFermer, occupe = false }) {
  const { t } = useLanguage();
  if (!order) return null;
  const age = order.minAge || 18;
  return (
    <Modale titre={t('conformite.ageCheckTitle', { age })} largeur={440} onFermer={onFermer}>
      <p className="small" style={{ margin: '0 0 14px' }}>{t('conformite.ageCheckText', { age })}</p>
      <div className="row" style={{ gap: 8, flexWrap: 'wrap', justifyContent: 'flex-end' }}>
        <button type="button" className="btn-ghost" disabled={occupe} onClick={onFermer}>{t('common.cancel')}</button>
        <button type="button" className="btn-outline" style={{ borderColor: 'var(--red)', color: 'var(--red)' }} disabled={occupe} onClick={onRefuse}>{t('conformite.ageCheckRefuse')}</button>
        <button type="button" className="btn-teal" disabled={occupe} onClick={onVerifie}>{t('conformite.ageCheckVerified')}</button>
      </div>
    </Modale>
  );
}

/* Ce que le commerce doit voir sur une commande avant d'agir (backlog de conformité du 23/09/2026).
 *
 *   A1 — une demande liée à une allergie, en rouge, tant qu'il ne l'a pas confirmée : accepter la
 *        commande vaut « je peux la respecter » (routes/orders.js exige allergyAck à l'acceptation) ;
 *        s'il ne peut pas, il refuse et le client est remboursé intégralement.
 *   B6 — une commande avec alcool : pièce d'identité à contrôler à la remise, âge exigé. */
export function BandeauAllergie({ order }) {
  const { t } = useLanguage();
  if (!order?.allergyRequest) return null;
  const confirme = order.allergyAck === 'accepted';
  return (
    <div className={`bandeau-allergie${confirme ? ' est-confirme' : ''}`} role={confirme ? undefined : 'alert'}>
      <b>{t('conformite.allergyBannerTitle')}</b> « {order.allergyRequest} »
      <div className="small">{confirme ? t('conformite.allergyBannerConfirmed') : t('conformite.allergyBannerPending')}</div>
    </div>
  );
}

export function BadgeAlcool({ order }) {
  const { t } = useLanguage();
  if (!order?.containsAlcohol) return null;
  return <div className="small badge-alcool">{t('conformite.alcoholOrderBadge', { age: order.minAge || 18 })}</div>;
}
