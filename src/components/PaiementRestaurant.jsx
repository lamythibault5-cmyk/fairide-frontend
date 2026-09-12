import { useEffect, useState } from 'react';
import { useLanguage, getLocale } from '../context/LanguageContext';
import { api } from '../api';
import { useAuth } from '../context/AuthContext';
import { useToast } from '../context/ToastContext';

// Sous-section « Paiement » de Mon compte (restaurateur) : comment l'argent circule, ce qu'est Stripe,
// l'activation des paiements (fermée jusqu'à fin septembre 2026) et les reçus de toutes les commandes
// payées avec, pour chacune, ce qui revient au restaurant. Fairide ne collecte aucune donnée bancaire :
// c'est dit ici noir sur blanc, parce que c'est la question que tout restaurateur se pose.
const OUVERTURE_PAIEMENTS = new Date('2026-09-30T00:00:00+02:00');

const euro = (n) => `${Number(n || 0).toFixed(2).replace('.', ',')} €`;

// Numéro d'entreprise et de TVA : plus demandés à l'inscription (décision du fondateur, 2026-09-10), mais
// indispensables à Stripe et à la facturation. Ils se renseignent ici, une fois, avec vérification au registre
// (VIES) qui complète l'autre numéro et la raison sociale.
function CoordonneesLegales({ restaurant, onSaved }) {
  const { t } = useLanguage();
  const { token } = useAuth();
  const toast = useToast();
  const complet = !!String(restaurant?.companyNumber || '').replace(/\D/g, '') && !!String(restaurant?.vatNumber || '').trim();
  const [edition, setEdition] = useState(!complet);
  const [legalName, setLegalName] = useState(restaurant?.legalName || '');
  const [companyNumber, setCompanyNumber] = useState(restaurant?.companyNumber || '');
  const [vatNumber, setVatNumber] = useState(restaurant?.vatNumber || '');
  const [verif, setVerif] = useState(null);
  const [saving, setSaving] = useState(false);
  useEffect(() => { setLegalName(restaurant?.legalName || ''); setCompanyNumber(restaurant?.companyNumber || ''); setVatNumber(restaurant?.vatNumber || ''); setEdition(!complet); }, [restaurant?.id, restaurant?.companyNumber, restaurant?.vatNumber, restaurant?.legalName, complet]);
  useEffect(() => {
    const chiffres = (companyNumber || vatNumber).replace(/\D/g, '');
    if (chiffres.length !== 10) { setVerif(null); return undefined; }
    let annule = false;
    const id = setTimeout(async () => {
      try {
        const r = await api(`/restaurants/lookup/company?number=${chiffres}`);
        if (annule) return;
        setVerif(r);
        if (r.companyNumber && !companyNumber.trim()) setCompanyNumber(r.companyNumber);
        if (r.vatNumber && !vatNumber.trim()) setVatNumber(r.vatNumber);
        if (r.valid && r.legalName && !legalName.trim()) setLegalName(r.legalName);
      } catch { if (!annule) setVerif(null); }
    }, 500);
    return () => { annule = true; clearTimeout(id); };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [companyNumber, vatNumber]);
  async function enregistrer() {
    if (!companyNumber.replace(/\D/g, '') || !vatNumber.trim()) { toast(t('paiementResto.legalMissing')); return; }
    setSaving(true);
    try {
      await api(`/restaurants/${restaurant.id}`, { method: 'PATCH', token, body: { legalName: legalName.trim(), companyNumber: companyNumber.trim(), vatNumber: vatNumber.trim() } });
      toast(t('paiementResto.legalSaved')); setEdition(false); onSaved?.();
    } catch (e) { toast(e.message); } finally { setSaving(false); }
  }
  return (
    <div className="paiement-encart" style={{ marginBottom: 12 }}>
      <b>{t('paiementResto.legalTitle')}</b>
      {!edition ? (
        <p className="small" style={{ margin: '4px 0 0' }}>
          {t('paiementResto.legalDone', { legal: restaurant.legalName || '-', n: restaurant.companyNumber || '-', vat: restaurant.vatNumber || '-' })}
          {' '}<button type="button" className="btn-ghost" style={{ padding: '2px 8px', fontSize: 12 }} onClick={() => setEdition(true)}>{t('paiementResto.legalEdit')}</button>
        </p>
      ) : (
        <>
          <p className="small" style={{ margin: '4px 0 10px' }}>{t('paiementResto.legalIntro')}</p>
          <div className="field"><label htmlFor="legal-nom">{t('paiementResto.legalNameLabel')}</label><input id="legal-nom" value={legalName} onChange={(e) => setLegalName(e.target.value)} /></div>
          <div className="row" style={{ gap: 8 }}>
            <div className="field" style={{ flex: 1 }}><label htmlFor="legal-bce">{t('paiementResto.companyNumberLabel')}</label><input id="legal-bce" inputMode="numeric" value={companyNumber} onChange={(e) => setCompanyNumber(e.target.value)} placeholder="0123.456.789" /></div>
            <div className="field" style={{ flex: 1 }}><label htmlFor="legal-tva">{t('paiementResto.vatNumberLabel')}</label><input id="legal-tva" value={vatNumber} onChange={(e) => setVatNumber(e.target.value)} placeholder="BE0123.456.789" /></div>
          </div>
          {verif && verif.valid === true && <p className="small" style={{ margin: '-4px 0 8px' }}>{t('paiementResto.companyVerified', { name: verif.legalName || '' })}</p>}
          {verif && verif.valid === false && <p className="small" style={{ margin: '-4px 0 8px' }}>{t('paiementResto.companyNotFound')}</p>}
          <button type="button" className="btn-teal" disabled={saving} onClick={enregistrer}>{saving ? '…' : t('paiementResto.legalSave')}</button>
        </>
      )}
    </div>
  );
}

export default function PaiementRestaurant({ restaurant, orders, onRestaurantChange }) {
  const { t } = useLanguage();
  const locale = getLocale();
  const payees = (orders || []).filter((o) => o.paid).sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));
  const net = (o) => Number(o.subtotal || 0) - Number(o.commission || 0);
  const totaux = payees.reduce((a, o) => ({ total: a.total + Number(o.total || 0), produits: a.produits + Number(o.subtotal || 0), livraison: a.livraison + Number(o.deliveryFee || 0), commission: a.commission + Number(o.commission || 0), net: a.net + net(o) }), { total: 0, produits: 0, livraison: 0, commission: 0, net: 0 });
  const ouvert = Date.now() >= OUVERTURE_PAIEMENTS.getTime();
  const stripeActif = restaurant?.stripeConnectStatus === 'active';

  return (
    <div className="paiement-resto">
      <h4 className="paiement-titre">{t('paiementResto.howTitle')}</h4>
      <ol className="paiement-etapes">
        <li>{t('paiementResto.step1')}</li>
        <li>{t('paiementResto.step2')}</li>
        <li>{t('paiementResto.step3')}</li>
      </ol>

      <div className="paiement-encart">
        <b>{t('paiementResto.subscriptionTitle')}</b>
        <p className="small" style={{ margin: '4px 0 0' }}>{t('paiementResto.subscriptionText')}</p>
      </div>

      <h4 className="paiement-titre">{t('paiementResto.stripeTitle')}</h4>
      <p className="small" style={{ margin: '0 0 8px' }}>{t('paiementResto.stripeWhat')}</p>
      <p className="small" style={{ margin: '0 0 12px' }}><b>{t('paiementResto.noBankTitle')}</b> {t('paiementResto.noBankText')}</p>

      {restaurant?.id && !stripeActif && <CoordonneesLegales restaurant={restaurant} onSaved={onRestaurantChange} />}
      <div className={`paiement-activation${ouvert ? '' : ' fermee'}`}>
        <div>
          <b>{stripeActif ? t('paiementResto.activationDone') : ouvert ? t('paiementResto.activationOpen') : t('paiementResto.activationClosedTitle')}</b>
          <p className="small" style={{ margin: '4px 0 0' }}>{stripeActif ? t('paiementResto.activationDoneText') : ouvert ? t('paiementResto.activationOpenText') : t('paiementResto.activationClosedText')}</p>
        </div>
        {!stripeActif && (
          <button type="button" className="btn-gold" disabled title={ouvert ? undefined : t('paiementResto.activationClosedTitle')}>
            {ouvert ? t('paiementResto.activateBtn') : t('paiementResto.activateSoonBtn')}
          </button>
        )}
      </div>

      <h4 className="paiement-titre">{t('paiementResto.receiptsTitle')}</h4>
      <p className="small" style={{ margin: '0 0 8px' }}>{t('paiementResto.receiptsIntro')}</p>
      {payees.length === 0 ? (
        <div className="empty" style={{ padding: 14 }}>{t('paiementResto.receiptsEmpty')}</div>
      ) : (
        <div className="service-table-wrap">
          <table className="service-table paiement-table">
            <thead>
              <tr>
                <th>{t('paiementResto.colDate')}</th>
                <th>{t('paiementResto.colOrder')}</th>
                <th>{t('paiementResto.colPaid')}</th>
                <th>{t('paiementResto.colProducts')}</th>
                <th>{t('paiementResto.colDelivery')}</th>
                <th>{t('paiementResto.colCommission')}</th>
                <th>{t('paiementResto.colNet')}</th>
              </tr>
            </thead>
            <tbody>
              {payees.map((o) => (
                <tr key={o.id}>
                  <td>{new Date(o.createdAt).toLocaleDateString(locale, { day: 'numeric', month: 'short' })}</td>
                  <td>#{String(o.id).slice(0, 8)} · {o.clientName}</td>
                  <td>{euro(o.total)}</td>
                  <td>{euro(o.subtotal)}</td>
                  <td>{euro(o.deliveryFee)}</td>
                  <td>− {euro(o.commission)}</td>
                  <td><b>{euro(net(o))}</b></td>
                </tr>
              ))}
            </tbody>
            <tfoot>
              <tr>
                <td colSpan={2}><b>{t('paiementResto.total')}</b></td>
                <td>{euro(totaux.total)}</td>
                <td>{euro(totaux.produits)}</td>
                <td>{euro(totaux.livraison)}</td>
                <td>− {euro(totaux.commission)}</td>
                <td><b>{euro(totaux.net)}</b></td>
              </tr>
            </tfoot>
          </table>
        </div>
      )}
      <p className="small" style={{ margin: '8px 0 0', opacity: 0.75 }}>{t('paiementResto.receiptsNote')}</p>
    </div>
  );
}
