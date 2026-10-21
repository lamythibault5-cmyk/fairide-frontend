import { useEffect, useState } from 'react';
import { useLanguage, getLocale } from '../context/LanguageContext';
import { api } from '../api';
import { euros } from '../prixPlat';
import { allerAuPaiement } from '../natif';
import { useAuth } from '../context/AuthContext';
import { useToast } from '../context/ToastContext';
import { paiementsOuverts, dateOuverturePaiements } from '../launch';

// Sous-section « Paiement » de Mon compte (restaurateur) : comment l'argent circule, ce qu'est Stripe,
// l'activation des paiements et les reçus de toutes les commandes payées avec, pour chacune, ce qui
// revient au restaurant. Fairide ne collecte aucune donnée bancaire : c'est dit ici noir sur blanc,
// parce que c'est la question que tout restaurateur se pose.
//
// La date d'ouverture vient de launch.js, comme toutes les autres. Elle était écrite en dur ici ET
// dans PaiementLivreur.jsx : deux copies d'un même calendrier, qu'aucune des trente phrases annonçant
// « fin septembre » ne pouvait suivre quand il bougeait.

// Dans la langue affichée (audit du 19/10, shop-119) : prixPlat.euros, la règle du dépôt.
const euro = (n) => euros(n);

// Numéro d'entreprise et de TVA : plus demandés à l'inscription (décision du fondateur, 2026-09-10), mais
// indispensables à Stripe et à la facturation. Ils se renseignent ici, une fois, avec vérification au registre
// (VIES) qui complète l'autre numéro et la raison sociale.
// `enchainer` : les paiements sont ouverts et pas encore activés — le bouton enregistre PUIS ouvre Stripe, d'un geste.
function CoordonneesLegales({ restaurant, onSaved, enchainer = false }) {
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
    const chiffresBce = companyNumber.replace(/\D/g, '');
    if (!chiffresBce) { toast(t('paiementResto.legalMissing'), 'erreur'); return; }
    // En Belgique, le numéro de TVA est TOUJOURS « BE » + le numéro d'entreprise (même en franchise) : laissé vide, on
    // le déduit au lieu de le faire retaper (12 oct. 2026 — un champ de moins avant Stripe).
    const tva = vatNumber.trim() || `BE${chiffresBce}`;
    setSaving(true);
    try {
      await api(`/restaurants/${restaurant.id}`, { method: 'PATCH', token, body: { legalName: legalName.trim(), companyNumber: companyNumber.trim(), vatNumber: tva } });
      if (!enchainer) toast(t('paiementResto.legalSaved'), 'succes');
      setEdition(false); onSaved?.({ enchainer });
    } catch (e) { toast(e.message, 'erreur'); } finally { setSaving(false); }
  }
  return (
    <div className="paiement-encart" style={{ marginBottom: 12 }}>
      <b>{t('paiementResto.legalTitle')}</b>
      {!edition ? (
        <p className="small" style={{ margin: '4px 0 0' }}>
          {t('paiementResto.legalDone', { legal: restaurant.legalName || '-', n: restaurant.companyNumber || '-', vat: restaurant.vatNumber || '-' })}
          {' '}<button type="button" className="btn-ghost btn-sm" onClick={() => setEdition(true)}>{t('paiementResto.legalEdit')}</button>
        </p>
      ) : (
        <>
          <p className="small" style={{ margin: '4px 0 10px' }}>{t('paiementResto.legalIntro')}</p>
          <div className="field"><label htmlFor="legal-nom">{t('paiementResto.legalNameLabel')}</label><input id="legal-nom" value={legalName} onChange={(e) => setLegalName(e.target.value)} /></div>
          <div className="row" style={{ gap: 8 }}>
            <div className="field" style={{ flex: 1 }}><label htmlFor="legal-bce" className="etiquette-dessus">{t('paiementResto.companyNumberLabel')}</label><input id="legal-bce" inputMode="numeric" value={companyNumber} onChange={(e) => setCompanyNumber(e.target.value)} placeholder="0123.456.789" /></div>
            <div className="field" style={{ flex: 1 }}><label htmlFor="legal-tva" className="etiquette-dessus">{t('paiementResto.vatNumberLabel')}</label><input id="legal-tva" value={vatNumber} onChange={(e) => setVatNumber(e.target.value)} placeholder="BE0123.456.789" /></div>
          </div>
          {verif && verif.valid === true && <p className="small" style={{ margin: '-4px 0 8px' }}>{t('paiementResto.companyVerified', { name: verif.legalName || '' })}</p>}
          {verif && verif.valid === false && <p className="small" style={{ margin: '-4px 0 8px' }}>{t('paiementResto.companyNotFound')}</p>}
          <button type="button" className={enchainer ? 'btn-gold' : 'btn-teal'} disabled={saving} onClick={enregistrer}>{saving ? '…' : enchainer ? t('paiementResto.legalSaveAndActivate') : t('paiementResto.legalSave')}</button>
        </>
      )}
    </div>
  );
}

export default function PaiementRestaurant({ restaurant, orders, onRestaurantChange }) {
  const { t } = useLanguage();
  const locale = getLocale();
  // Seulement ce que le commerce a vraiment reçu, comme les relevés (audit du 19/10, shop-108) : une commande refusée ou
  // annulée garde paid = true mais le client est remboursé et le virement repris ; une commande d'entraînement n'est pas de
  // l'argent.
  const payees = (orders || []).filter((o) => o.paid && o.paymentMode !== 'on_site' && !['annule', 'refuse'].includes(o.status) && !o.isTraining).sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));
  const net = (o) => Number(o.subtotal || 0) - Number(o.commission || 0);
  const totaux = payees.reduce((a, o) => ({ total: a.total + Number(o.total || 0), produits: a.produits + Number(o.subtotal || 0), livraison: a.livraison + Number(o.deliveryFee || 0), commission: a.commission + Number(o.commission || 0), net: a.net + net(o) }), { total: 0, produits: 0, livraison: 0, commission: 0, net: 0 });
  const ouvert = paiementsOuverts();
  const stripeActif = restaurant?.stripeConnectStatus === 'active';
  const stripeEnVerif = restaurant?.stripeConnectStatus === 'pending';
  const stripeRefuse = restaurant?.stripeConnectStatus === 'rejected';
  const legalComplet = !!String(restaurant?.companyNumber || '').replace(/\D/g, '') && !!String(restaurant?.vatNumber || '').trim();
  // Fondateur, 2026-10-09 : configurer ses paiements dès l'inscription — le bouton lance l'inscription Stripe (identité, IBAN) ;
  // numéros d'entreprise / TVA manquants : on le dit et on reste sur ce panneau, qui les demande juste au-dessus.
  const { token } = useAuth();
  const toast = useToast();
  const [connecting, setConnecting] = useState(false);
  async function activer() {
    if (!restaurant?.id) return;
    setConnecting(true);
    // Dans l'app, Stripe s'ouvre dans le navigateur intégré et l'on revient ici en le fermant (allerAuPaiement, natif.js) ;
    // sur le site, rien ne change : la page part vers Stripe.
    // Retour : la page d'où l'on part (Mon compte › Paiement, ou ailleurs si ce panneau y est monté).
    try { const r = await api(`/restaurants/${restaurant.id}/connect/onboard`, { method: 'POST', token }); await allerAuPaiement(r.url, { retour: `${window.location.pathname}${window.location.search}` }); setConnecting(false); }
    catch (e) { toast(e.code === 'LEGAL_INFO_REQUIRED' || e.code === 'LEGAL_INFO_INVALID' ? t('paiementResto.legalFirst') : e.message, 'erreur'); setConnecting(false); }
  }

  return (
    <div className="paiement-resto">
      {/* L'ACTION D'ABORD, LES EXPLICATIONS REPLIÉES (test au téléphone, 12 oct. 2026). Le formulaire arrivait après deux
          écrans de texte (comment tu es payé, abonnement, Stripe) : le restaurateur venu « configurer ses paiements »
          devait tout dérouler pour trouver où taper son numéro. Les textes restent, à un geste, sous « Comment tu es payé ? ». */}
      {/* UN GESTE JUSQU'À STRIPE : quand les paiements sont ouverts, « Enregistrer et activer » garde les numéros puis ouvre
          directement l'inscription Stripe. */}
      {restaurant?.id && !stripeActif && (
        <CoordonneesLegales restaurant={restaurant} enchainer={ouvert}
          onSaved={(o) => { onRestaurantChange?.(); if (o?.enchainer) activer(); }} />
      )}
      {/* Numéros pas encore enregistrés et paiements ouverts : le seul bouton est « Enregistrer et activer », juste au-dessus. */}
      {(stripeActif || legalComplet || !ouvert) && (
        <div className={`paiement-activation${ouvert ? '' : ' fermee'}`}>
          {/* Formulaire Stripe envoyé (« pending ») ou refusé (« rejected ») : dit tel quel, comme sur Mon commerce (audit du
              19/10, shop-5). En vérification, le bouton reste, discret, pour qui n'aurait pas fini le formulaire ; refusé, aucun. */}
          <div>
            <b>{stripeActif ? t('paiementResto.activationDone') : stripeEnVerif ? t('miseEnLigne.paymentsPending') : stripeRefuse ? t('miseEnLigne.paymentsRejected') : ouvert ? t('paiementResto.activationOpen') : t('paiementResto.activationClosedTitle', { date: dateOuverturePaiements(getLocale()) })}</b>
            <p className="small" style={{ margin: '4px 0 0' }}>{stripeActif ? t('paiementResto.activationDoneText') : stripeEnVerif ? t('miseEnLigne.paymentsPendingSub') : stripeRefuse ? t('miseEnLigne.paymentsRejectedSub') : ouvert ? t('paiementResto.activationOpenText') : t('paiementResto.activationClosedText', { date: dateOuverturePaiements(getLocale()) })}</p>
          </div>
          {!stripeActif && !stripeRefuse && (
            <button type="button" className={stripeEnVerif ? 'btn-outline' : 'btn-gold'} disabled={!ouvert || connecting} onClick={activer} title={ouvert ? undefined : t('paiementResto.activationClosedTitle', { date: dateOuverturePaiements(getLocale()) })}>
              {connecting ? '…' : ouvert ? t('paiementResto.activateBtn') : t('paiementResto.activateSoonBtn')}
            </button>
          )}
        </div>
      )}

      <details className="paiement-explications">
        <summary>{t('paiementResto.howTitle')}</summary>
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
        <p className="small" style={{ margin: 0 }}><b>{t('paiementResto.noBankTitle')}</b> {t('paiementResto.noBankText')}</p>
      </details>

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
