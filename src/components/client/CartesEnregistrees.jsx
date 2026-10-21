import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { api } from '../../api';
import { useAuth } from '../../context/AuthContext';
import { useToast } from '../../context/ToastContext';
import { useLanguage } from '../../context/LanguageContext';
import ConfirmDialog from '../ConfirmDialog';

/* CARTES ENREGISTRÉES (comparaison avec Uber Eats, 15 oct. 2026 ; backend cartesEnregistrees.js).
 * La carte vit chez Stripe : le client l'y enregistre lui-même en cochant la case de la page de paiement. Ici il voit
 * seulement la marque, les 4 derniers chiffres et l'échéance, et la retire (confirmation d'abord : un toucher par erreur
 * le forcerait à la retaper). Chargé à l'ouverture de la rangée, pas avant. */
export default function CartesEnregistrees() {
  const { token } = useAuth();
  const toast = useToast();
  const { t } = useLanguage();
  const [cartes, setCartes] = useState(null);
  const [aRetirer, setARetirer] = useState(null);
  // Liste pas lue : « aucune carte enregistrée » serait faux (audit du 19/10, CROSS-34). On le dit, avec « Réessayer ».
  const [echec, setEchec] = useState(false);

  const charger = () => {
    setEchec(false);
    setCartes(null);
    api('/payments/saved-cards', { token }).then((c) => setCartes(Array.isArray(c) ? c : [])).catch(() => { setCartes([]); setEchec(true); });
  };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  useEffect(charger, [token]);

  async function retirer(carte) {
    try {
      await api(`/payments/saved-cards/${carte.id}`, { method: 'DELETE', token });
      setCartes((prev) => prev.filter((c) => c.id !== carte.id));
      toast(t('savedCards.removed'), 'succes');
    } catch (e) { toast(e.message, 'erreur'); }
  }

  const marque = (b) => ({ visa: 'Visa', mastercard: 'Mastercard', amex: 'American Express', bancontact: 'Bancontact', maestro: 'Maestro' }[b] || b);
  return (
    <div>
      <p className="small" style={{ margin: '0 0 10px' }}>{t('savedCards.intro')}</p>
      {echec ? (
        <p className="small" style={{ margin: 0 }}>{t('common.loadFailedTitle')}. <button type="button" className="suivi-lien" onClick={charger}>{t('common.retry')}</button></p>
      ) : cartes === null ? <p className="small">…</p> : cartes.length === 0 ? (
        <p className="small" style={{ margin: 0 }}>{t('savedCards.none')}</p>
      ) : cartes.map((c) => (
        <div key={c.id} className="row" style={{ justifyContent: 'space-between', alignItems: 'center', padding: '8px 0', borderBottom: '1px solid var(--line)' }}>
          <span className="small"><b>{marque(c.brand)}</b> •••• {c.last4}{c.expMonth ? ` · ${String(c.expMonth).padStart(2, '0')}/${String(c.expYear).slice(-2)}` : ''}</span>
          <button type="button" className="btn-danger-ghost" onClick={() => setARetirer(c)}>{t('savedCards.remove')}</button>
        </div>
      ))}
      <p className="small" style={{ margin: '10px 0 0' }}><Link to="/aide?sujet=paiement">{t('savedCards.howItWorks')}</Link></p>
      <ConfirmDialog
        open={!!aRetirer}
        title={t('savedCards.removeTitle')}
        message={aRetirer ? t('savedCards.removeText', { card: `${marque(aRetirer.brand)} •••• ${aRetirer.last4}` }) : ''}
        confirmLabel={t('savedCards.remove')}
        danger
        onCancel={() => setARetirer(null)}
        onConfirm={() => { const c = aRetirer; setARetirer(null); retirer(c); }}
      />
    </div>
  );
}
