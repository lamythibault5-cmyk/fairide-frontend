import { Link } from 'react-router-dom';
import { useLanguage, getLocale } from '../context/LanguageContext';

// Sous-section « Paiement » de Mon compte (livreur) : comment il est payé (frais de livraison à 100 % et
// pourboires, sans commission), l'autofacturation mensuelle liée à son statut d'indépendant, ce qu'est
// Stripe, l'activation des paiements (fermée jusqu'à fin septembre 2026) et le reçu de chaque course
// livrée. Même promesse que côté restaurateur : Fairide ne collecte aucune donnée bancaire.
const OUVERTURE_PAIEMENTS = new Date('2026-09-30T00:00:00+02:00');

const euro = (n) => `${Number(n || 0).toFixed(2).replace('.', ',')} €`;

export default function PaiementLivreur({ user, deliveries }) {
  const { t } = useLanguage();
  const locale = getLocale();
  const livrees = (deliveries || []).filter((o) => o.status === 'livre').sort((a, b) => b.createdAt - a.createdAt);
  const pourboire = (o) => (o.tipPaid && o.tipAmount > 0 ? Number(o.tipAmount) : 0);
  const totaux = livrees.reduce((a, o) => ({ courses: a.courses + Number(o.deliveryFee || 0), pourboires: a.pourboires + pourboire(o) }), { courses: 0, pourboires: 0 });
  const ouvert = Date.now() >= OUVERTURE_PAIEMENTS.getTime();
  const stripeActif = user?.stripeConnectStatus === 'active';

  return (
    <div className="paiement-resto">
      <h4 className="paiement-titre">{t('paiementLivreur.howTitle')}</h4>
      <ol className="paiement-etapes">
        <li>{t('paiementLivreur.step1')}</li>
        <li>{t('paiementLivreur.step2')}</li>
        <li>{t('paiementLivreur.step3')}</li>
      </ol>

      <div className="paiement-encart">
        <b>{t('paiementLivreur.selfBillingTitle')}</b>
        <p className="small" style={{ margin: '4px 0 0' }}>{t('paiementLivreur.selfBillingText')} <Link to="/driver/invoices">{t('paiementLivreur.selfBillingLink')}</Link></p>
      </div>

      <h4 className="paiement-titre">{t('paiementResto.stripeTitle')}</h4>
      <p className="small" style={{ margin: '0 0 8px' }}>{t('paiementResto.stripeWhat')}</p>
      <p className="small" style={{ margin: '0 0 12px' }}><b>{t('paiementResto.noBankTitle')}</b> {t('paiementLivreur.noBankText')}</p>

      <div className={`paiement-activation${ouvert ? '' : ' fermee'}`}>
        <div>
          <b>{stripeActif ? t('paiementResto.activationDone') : ouvert ? t('paiementResto.activationOpen') : t('paiementResto.activationClosedTitle')}</b>
          <p className="small" style={{ margin: '4px 0 0' }}>{stripeActif ? t('paiementLivreur.activationDoneText') : ouvert ? t('paiementLivreur.activationOpenText') : t('paiementLivreur.activationClosedText')}</p>
        </div>
        {!stripeActif && (
          <button type="button" className="btn-gold" disabled title={ouvert ? undefined : t('paiementResto.activationClosedTitle')}>
            {ouvert ? t('paiementResto.activateBtn') : t('paiementResto.activateSoonBtn')}
          </button>
        )}
      </div>

      <h4 className="paiement-titre">{t('paiementLivreur.receiptsTitle')}</h4>
      <p className="small" style={{ margin: '0 0 8px' }}>{t('paiementLivreur.receiptsIntro')}</p>
      {livrees.length === 0 ? (
        <div className="empty" style={{ padding: 14 }}>{t('paiementLivreur.receiptsEmpty')}</div>
      ) : (
        <div className="service-table-wrap">
          <table className="service-table paiement-table">
            <thead>
              <tr>
                <th>{t('paiementResto.colDate')}</th>
                <th>{t('paiementLivreur.colRide')}</th>
                <th>{t('paiementLivreur.colFee')}</th>
                <th>{t('paiementLivreur.colTip')}</th>
                <th>{t('paiementResto.colNet')}</th>
              </tr>
            </thead>
            <tbody>
              {livrees.map((o) => (
                <tr key={o.id}>
                  <td>{new Date(o.createdAt).toLocaleDateString(locale, { day: 'numeric', month: 'short' })}</td>
                  <td>{o.restaurantName} → {o.commune || o.address}</td>
                  <td>{euro(o.deliveryFee)}</td>
                  <td>{pourboire(o) > 0 ? euro(pourboire(o)) : '-'}</td>
                  <td><b>{euro(Number(o.deliveryFee || 0) + pourboire(o))}</b></td>
                </tr>
              ))}
            </tbody>
            <tfoot>
              <tr>
                <td colSpan={2}><b>{t('paiementResto.total')}</b></td>
                <td>{euro(totaux.courses)}</td>
                <td>{euro(totaux.pourboires)}</td>
                <td><b>{euro(totaux.courses + totaux.pourboires)}</b></td>
              </tr>
            </tfoot>
          </table>
        </div>
      )}
      <p className="small" style={{ margin: '8px 0 0', opacity: 0.75 }}>{t('paiementLivreur.receiptsNote')}</p>
    </div>
  );
}
