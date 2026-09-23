import { Link } from 'react-router-dom';
import { useLanguage } from '../../context/LanguageContext';

/* Qui vend, et à qui demander pour les allergènes — visible sur la fiche SANS clic, avant l'ajout au
 * panier (backlog de conformité du 23/09/2026).
 *
 *   A8 — CDE VI.45 §1 et VI.45/1 : identité du professionnel avant la commande, et le fait que la vente
 *        est conclue avec le commerce, pas avec la plateforme. Les champs viennent de la charge utile
 *        publique (legalName, companyNumber, vatNumber…), qui les portait déjà.
 *   A1 — AR 17/07/2014 : mention visible du moyen d'obtenir l'information allergènes AVANT de commander.
 *   C6 — DSA art. 16 : un moyen de signaler le commerce.
 *
 * Les commerces de démonstration n'ont pas de vendeur réel : le bloc ne s'affiche pas pour eux. */
export default function FicheVendeur({ restaurant }) {
  const { t } = useLanguage();
  if (!restaurant || restaurant.isDemo) return null;
  const r = restaurant;
  const identite = [
    r.legalName || r.name,
    r.address,
    r.companyNumber ? `${t('conformite.bce')} ${r.companyNumber}` : '',
    r.vatNumber ? `${t('conformite.vat')} ${r.vatNumber}` : '',
    r.email,
    r.phone
  ].filter(Boolean).join(' · ');
  const tel = r.allergenContactPhone;
  return (
    <section className="fiche-vendeur card" aria-label={t('conformite.sellerTitle')}>
      <p className="small" style={{ margin: 0 }}>
        <b>{t('conformite.sellerTitle')}</b> : {identite} — {t('conformite.sellerProfessional')}
      </p>
      <p className="small" style={{ margin: '4px 0 0', color: 'var(--ink-soft)' }}>{t('conformite.sellerContract')}</p>
      {tel && (
        <p className="small" style={{ margin: '6px 0 0' }}>
          <b>{t('conformite.allergensTitle')}</b> : {t('conformite.allergensAskBefore')}{' '}
          <a href={`tel:${tel.replace(/[^+\d]/g, '')}`}>{tel}</a>
        </p>
      )}
      <p className="small" style={{ margin: '6px 0 0' }}>
        <Link to={`/signaler?type=restaurant&id=${encodeURIComponent(r.id)}&nom=${encodeURIComponent(r.name || '')}`}>{t('conformite.reportRestaurant')}</Link>
        {' · '}
        <Link to="/classement">{t('conformite.rankingLink')}</Link>
      </p>
    </section>
  );
}
