import { useRef, useState } from 'react';
import { api } from '../../api';
import { allerAuPaiement } from '../../natif';
import { useAuth } from '../../context/AuthContext';
import { useToast } from '../../context/ToastContext';
import { useLanguage, getLocale } from '../../context/LanguageContext';
import { euros } from '../../prixPlat';
import ChoixAdresse from '../ChoixAdresse';
import SousEcran from '../SousEcran';
import Icone from '../Icone';

/* CHANGER L'ADRESSE D'UNE COMMANDE PAYÉE (fondateur, 2026-10-27 ; règles au serveur, changementAdresse.js).
 *
 * Un client qui recommande ailleurs oublie de changer l'adresse retenue de sa dernière commande. Depuis le suivi, il la
 * change tant que le livreur n'a pas retiré la commande, comme chez Uber Eats :
 *   1. le carnet d'adresses, le même écran qu'au paiement (ChoixAdresse) — l'adresse choisie devient aussi celle du compte,
 *      ce qui règle la commande suivante ;
 *   2. le devis du serveur (POST /orders/:id/address/quote) : même prix ou moins cher, « rien à payer en plus » ; plus loin,
 *      la différence, dite avant le bouton ;
 *   3. un seul bouton lime : « Livrer ici », ou « Payer 2,90 € et livrer ici » (page Stripe, comme le pourboire). Le montant
 *      lu part avec la demande (expectedSupplement) : s'il a bougé entre-temps, le serveur renvoie le nouveau devis, affiché
 *      à la place, et rien n'est payé.
 * La note pour le livreur (interphone, étage) est celle de l'adresse du carnet si elle en a une : l'interphone de l'ancienne
 * adresse ne sert à rien à la nouvelle. */
export default function ChangerAdresse({ order, onFermer, onChangee }) {
  const { t } = useLanguage();
  const { token } = useAuth();
  const toast = useToast();
  const [adresse, setAdresse] = useState(null);
  const [devis, setDevis] = useState(null);
  const [note, setNote] = useState('');
  const [erreur, setErreur] = useState('');
  const [occupe, setOccupe] = useState(false);
  // ChoixAdresse appelle onChoisie PUIS onFermer : ce second appel ne doit pas tout fermer quand on passe au devis.
  const suite = useRef(false);

  const corps = (a, n) => ({
    addressStreet: a.street, addressNumber: a.number, addressPostalCode: a.postalCode, addressCity: a.city, addressId: a.id || undefined,
    deliveryInstructions: a.deliveryInstructions || order.deliveryInstructions || undefined,
    deliveryNote: n.trim() || undefined
  });

  async function demanderDevis(a) {
    setAdresse(a); setDevis(null); setErreur('');
    const n = a.deliveryNote || '';
    setNote(n);
    try {
      setDevis(await api(`/orders/${order.id}/address/quote`, { method: 'POST', token, body: corps(a, n) }));
    } catch (e) {
      setErreur(e.message);
    }
  }

  async function confirmer() {
    if (!devis || occupe) return;
    setOccupe(true); setErreur('');
    try {
      const r = await api(`/orders/${order.id}/address`, { method: 'POST', token, body: { ...corps(adresse, note), expectedSupplement: devis.supplement } });
      if (r.applied) {
        toast(t(order.driverName ? 'orders.addrDoneDriver' : 'orders.addrDone'), 'succes');
        onChangee?.(r.order);
        onFermer();
        return;
      }
      await allerAuPaiement(r.checkoutUrl, { retour: '/orders' });
      // Dans l'app, la page reste dessous pendant le paiement : le bouton ne reste pas sur « … » si on revient sans payer.
      setOccupe(false);
    } catch (e) {
      if (e.code === 'ADDRESS_PRICE_CHANGED' && e.data?.quote) setDevis(e.data.quote);
      setErreur(e.message);
      setOccupe(false);
    }
  }

  if (!adresse) {
    return (
      <ChoixAdresse
        onChoisie={(a) => { suite.current = true; demanderDevis(a); }}
        onFermer={() => { if (suite.current) { suite.current = false; return; } onFermer(); }}
      />
    );
  }

  const heure = devis?.estimatedDeliveryAt
    ? new Date(devis.estimatedDeliveryAt).toLocaleTimeString(getLocale(), { hour: '2-digit', minute: '2-digit' }) : null;
  const libelle = !devis ? t('orders.addrChecking')
    : devis.supplement > 0 ? t('orders.addrConfirmPay', { amount: euros(devis.supplement) }) : t('orders.addrConfirm');
  return (
    <SousEcran titre={t('orders.addrTitle')} onFermer={() => setAdresse(null)} pied={
      <button type="button" className="btn-gold" style={{ width: '100%', minHeight: 48 }} disabled={!devis || occupe} onClick={confirmer}>
        {occupe ? '…' : libelle}
      </button>
    }>
      <div className="changer-adresse">
        <p className="changer-adresse-nouvelle">
          <Icone nom="position" taille={20} />
          <span>
            <b>{`${adresse.street} ${adresse.number}`.trim()}</b>
            <span className="small">{`${adresse.postalCode} ${adresse.city}`.trim()}</span>
          </span>
        </p>
        <p className="small changer-adresse-avant">{t('orders.addrBefore', { address: order.address })}</p>
        {devis && (
          <p className={`changer-adresse-prix${devis.supplement > 0 ? ' est-plus' : ''}`}>
            {devis.supplement > 0 ? t('orders.addrSupplement', { amount: euros(devis.supplement) }) : t('orders.addrSamePrice')}
            {heure && <span className="small">{t('orders.addrArrival', { time: heure })}</span>}
          </p>
        )}
        {erreur && <p className="champ-erreur" role="alert">{erreur}</p>}
        <div className="field">
          <label htmlFor="changer-adresse-note">{t('orders.addrNoteLabel')}</label>
          <input id="changer-adresse-note" value={note} maxLength={500} onChange={(e) => setNote(e.target.value)} placeholder={t('orders.addrNotePlaceholder')} />
        </div>
        <p className="small changer-adresse-regle">{t('orders.addrRule')}</p>
      </div>
    </SousEcran>
  );
}
