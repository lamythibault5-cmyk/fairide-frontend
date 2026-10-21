import { useEffect, useRef, useState } from 'react';
import { api } from '../../api';
import { useLanguage } from '../../context/LanguageContext';
import { euros } from '../../prixPlat';
import Icone from '../Icone';

// Code promo de commande au checkout (plan de test MON-6, 2 octobre 2026). Aperçu par POST /promo-codes/check ; la
// commande recalcule tout côté serveur (codesPromo.js) et c'est ce montant-là qui est payé. Payé par Fairide : le
// commerce et le livreur reçoivent leur montant plein. Un seul code par commande, jamais sur un paiement sur place.
export default function CodePromoCheckout({ token, toast, subtotal, deliveryFee, payOnSite, applique, onChange }) {
  const { t } = useLanguage();
  const [code, setCode] = useState(applique?.code || '');
  const [enCours, setEnCours] = useState(false);
  // Le panier ou le mode a changé : le code est REVÉRIFIÉ sur le nouveau montant (audit du 19/10, checkout-11). Avant, il
  // était retiré sans un mot : le champ gardait le texte, la remise disparaissait, et le client payait plein tarif. Il ne
  // part que s'il ne s'applique vraiment plus, et on le dit. Paiement sur place : le code reste, gardé pour un paiement en
  // ligne (le paiement ne l'envoie pas et ne le déduit pas, voir Checkout.jsx).
  // Pas au montage : dans l'app, ce champ vit dans une feuille qu'on rouvre — le code déjà appliqué doit y rester.
  // On compare aux valeurs précédentes plutôt que de sauter « le premier passage » : en développement, React joue deux fois.
  const precedent = useRef(`${subtotal}|${deliveryFee}|${payOnSite}`);
  useEffect(() => {
    const cle = `${subtotal}|${deliveryFee}|${payOnSite}`;
    if (cle === precedent.current) return undefined;
    precedent.current = cle;
    if (!applique || payOnSite) return undefined;
    let actif = true;
    api('/promo-codes/check', { method: 'POST', token, body: { code: applique.code, subtotal, deliveryFee, payOnSite } })
      .then((r) => { if (actif && (r.discount !== applique.discount || r.label !== applique.label)) onChange({ code: r.code, discount: r.discount, label: r.label }); })
      .catch((e) => { if (!actif) return; onChange(null); toast(t('checkout.promoCodeDropped', { reason: e.message }), 'erreur'); });
    return () => { actif = false; };
    /* eslint-disable-next-line react-hooks/exhaustive-deps */
  }, [subtotal, deliveryFee, payOnSite]);

  async function appliquer() {
    setEnCours(true);
    try {
      const r = await api('/promo-codes/check', { method: 'POST', token, body: { code: code.trim(), subtotal, deliveryFee, payOnSite } });
      onChange({ code: r.code, discount: r.discount, label: r.label });
      toast(t('checkout.promoCodeApplied', { amount: euros(r.discount) }));
    } catch (e) {
      onChange(null);
      toast(e.message, 'erreur');
    } finally {
      setEnCours(false);
    }
  }

  return (
    <details style={{ marginTop: 10 }} open={!!applique || !!code}>
      <summary className="small" style={{ cursor: 'pointer' }}><Icone nom="cadeau" taille={14} /> {t('checkout.promoCodeSummary')}</summary>
      <div className="row" style={{ gap: 8, marginTop: 6, alignItems: 'center', flexWrap: 'wrap' }}>
        <input aria-label={t('checkout.promoCodePh')} value={code} placeholder={t('checkout.promoCodePh')} maxLength={24} style={{ flex: '1 1 160px', textTransform: 'uppercase' }}
          onChange={(e) => { setCode(e.target.value.toUpperCase()); if (applique) onChange(null); }} />
        {applique
          ? <button type="button" className="btn-outline" style={{ padding: '6px 12px' }} onClick={() => { onChange(null); setCode(''); }}>{t('checkout.promoCodeRemove')}</button>
          : <button type="button" className="btn-outline" style={{ padding: '6px 12px' }} disabled={code.trim().length < 3 || enCours} onClick={appliquer}>{enCours ? '…' : t('checkout.promoCodeApply')}</button>}
      </div>
      {applique && !payOnSite && <p className="small" style={{ margin: '6px 0 0', color: 'var(--teal-deep)' }}>{t('checkout.promoCodeLine', { label: applique.label, amount: euros(applique.discount) })}</p>}
      {applique && payOnSite && <p className="small" style={{ margin: '6px 0 0' }}>{t('checkout.promoCodeKeptOnline')}</p>}
    </details>
  );
}
