import { useState } from 'react';
import { api } from '../../api';
import { useAuth } from '../../context/AuthContext';
import { useToast } from '../../context/ToastContext';
import { useLanguage } from '../../context/LanguageContext';
import SousEcran from '../SousEcran';

// Mon commerce › Livraison : qui livre les commandes — les livreurs Fairide (par défaut) ou les livreurs
// du commerce. Chaque geste part tout de suite, sans pied « Enregistrer ».
// INVITATION, PLUS DE LIEN IMPOSÉ (audit du 19/10, shop-301) : le commerce invite un livreur par son e-mail ; le livreur
// accepte ou refuse dans son appli, et ne devient livreur dédié (nom et téléphone visibles ici) qu'après avoir accepté.
// Une invitation en attente s'affiche « Invitation envoyée » avec l'adresse tapée, et peut être retirée.
export default function EcranLivreurs({ restaurant, drivers, restoId, loadDashboard, onFermer }) {
  const { t } = useLanguage();
  const { token } = useAuth();
  const toast = useToast();
  const [email, setEmail] = useState('');
  const [liaison, setLiaison] = useState(false);
  const [retraitId, setRetraitId] = useState(null);
  const [bascule, setBascule] = useState(false);

  async function geste(appel, message, apres) {
    try {
      const r = await appel();
      await loadDashboard(restoId);
      if (apres) apres();
      toast(typeof message === 'function' ? message(r) : message);
    } catch (e) {
      toast(e.message, 'erreur');
    }
  }

  async function lier() {
    if (!email.trim()) { toast(t('editResto.toastDriverEmail')); return; }
    setLiaison(true);
    await geste(() => api(`/restaurants/${restoId}/drivers`, { method: 'POST', token, body: { email: email.trim() } }),
      (d) => t('editResto.toastDriverInvited', { email: d.email }), () => setEmail(''));
    setLiaison(false);
  }

  async function retirer(id) {
    setRetraitId(id);
    await geste(() => api(`/restaurants/${restoId}/drivers/${id}`, { method: 'DELETE', token }), t('editResto.toastDriverRemoved'));
    setRetraitId(null);
  }

  async function changerMode(mode) {
    setBascule(true);
    await geste(() => api(`/restaurants/${restoId}/delivery-mode`, { method: 'PATCH', token, body: { mode } }),
      mode === 'own' ? t('editResto.toastInternalOn') : t('editResto.toastBackToPool'));
    setBascule(false);
  }

  const interne = restaurant.deliveryMode === 'own';
  const actifs = drivers.filter((d) => d.status !== 'invited');
  return (
    <SousEcran titre={t('editResto.delivery')} onFermer={onFermer}>
      <p className="small" style={{ margin: '0 0 12px' }}>{interne ? t('editResto.internalOnInfo') : t('editResto.poolInfo')}</p>
      {drivers.map((d) => (
        <div key={d.id} className="row" style={{ justifyContent: 'space-between', padding: '8px 0', borderBottom: '1px solid var(--line)' }}>
          <span>
            {d.status === 'invited' ? <span className="small">{d.email}</span> : <>{d.name} <span className="small">· {d.email}</span></>}
            {d.status === 'invited'
              ? <span className="pill" style={{ marginLeft: 6 }}>{t('editResto.driverInvited')}</span>
              : d.adminStatus !== 'approved' && <span className="pill" style={{ marginLeft: 6 }}>{d.adminStatus === 'blocked' ? t('editResto.blocked') : t('editResto.pendingValidation')}</span>}
          </span>
          <button type="button" className="btn-danger-ghost btn-sm" disabled={retraitId === d.id} onClick={() => retirer(d.id)}>
            {retraitId === d.id ? '…' : t('editResto.remove')}
          </button>
        </div>
      ))}
      <div className="row" style={{ gap: 8, margin: '12px 0', flexWrap: 'wrap' }}>
        <input aria-label={t('editResto.phDriverEmail')} type="email" inputMode="email" style={{ flex: 1, minWidth: 200 }} value={email} onChange={(e) => setEmail(e.target.value)} placeholder={t('editResto.phDriverEmail')} />
        <button type="button" className="btn-ghost" disabled={liaison} onClick={lier}>{liaison ? '…' : t('editResto.linkDriver')}</button>
      </div>
      <p className="small" style={{ margin: '0 0 12px' }}>{t('editResto.inviteInfo')}</p>
      {interne ? (
        <button type="button" className="btn-ghost" disabled={bascule} onClick={() => changerMode('fairide')}>{bascule ? '…' : t('editResto.switchPool')}</button>
      ) : (
        <button type="button" className="btn-teal" disabled={bascule || actifs.length === 0} onClick={() => changerMode('own')} title={actifs.length === 0 ? t('editResto.linkOneDriver') : ''}>
          {bascule ? '…' : t('editResto.switchInternal')}
        </button>
      )}
    </SousEcran>
  );
}
