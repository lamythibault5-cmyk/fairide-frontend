import { useId, useState } from 'react';
import { api } from '../../api';
import { useAuth } from '../../context/AuthContext';
import { useToast } from '../../context/ToastContext';
import { useLanguage } from '../../context/LanguageContext';
import SousEcran from '../SousEcran';

// Valeurs envoyées au backend (en français, stockées telles quelles) ; le libellé affiché est traduit.
const RAISONS = [
  'Je ferme mon commerce',
  'Je change de plateforme de livraison',
  'Trop peu de commandes',
  'Problème avec les commissions ou les livreurs',
  'Erreur de création, je recommence',
  'Autre raison'
];
const CLES_RAISONS = ['reasonClosing', 'reasonSwitching', 'reasonFewOrders', 'reasonCommissions', 'reasonMistake', 'reasonOther'];

// Mon commerce › Supprimer. Deux temps : (1) pourquoi, puis demande du code ; (2) le code envoyé par
// l'équipe, et la suppression définitive. Rangée rouge tout en bas de la liste, jamais en vue au service.
export default function EcranSuppression({ restoId, onFermer }) {
  const { t } = useLanguage();
  const { token } = useAuth();
  const toast = useToast();
  const ids = useId();
  const [raison, setRaison] = useState(RAISONS[0]);
  const [commentaire, setCommentaire] = useState('');
  const [etape, setEtape] = useState(1);
  const [code, setCode] = useState('');
  const [enCours, setEnCours] = useState(false);

  async function demanderCode() {
    setEnCours(true);
    try {
      await api(`/restaurants/${restoId}/request-deletion`, { method: 'POST', token });
      setEtape(2);
      toast(t('editResto.toastCodeSent'));
    } catch (e) {
      toast(e.message, 'erreur');
    } finally {
      setEnCours(false);
    }
  }

  async function supprimer() {
    if (!code) { toast(t('editResto.toastEnterCode')); return; }
    setEnCours(true);
    try {
      await api(`/restaurants/${restoId}`, { method: 'DELETE', token, body: { code, reason: raison, comment: commentaire.trim() } });
      toast(t('editResto.toastDeleted'));
      window.location.href = '/dashboard';
    } catch (e) {
      toast(e.message, 'erreur');
      setEnCours(false);
    }
  }

  const styleDanger = { width: '100%', minHeight: 48, borderColor: 'var(--red)', color: 'var(--red)' };
  return (
    <SousEcran titre={t('editResto.deleteTitle')} onFermer={onFermer} pied={etape === 1 ? (
      <button type="button" className="btn-outline" style={styleDanger} disabled={enCours} onClick={demanderCode}>{enCours ? '…' : t('editResto.getDeleteCode')}</button>
    ) : (
      <button type="button" className="btn-outline" style={styleDanger} disabled={enCours} onClick={supprimer}>{enCours ? '…' : t('editResto.yesDelete')}</button>
    )}>
      {etape === 1 ? (
        <>
          <p className="small" style={{ color: 'var(--red)', margin: '0 0 12px' }}>{t('editResto.deleteConfirm')}</p>
          <div className="field">
            <label htmlFor={ids + '-raison'}>{t('editResto.deleteWhy')}</label>
            <select id={ids + '-raison'} value={raison} onChange={(e) => setRaison(e.target.value)}>
              {RAISONS.map((r, i) => <option key={r} value={r}>{t(`editResto.${CLES_RAISONS[i]}`)}</option>)}
            </select>
          </div>
          <div className="field">
            <label htmlFor={ids + '-commentaire'}>{t('editResto.commentOptional')}</label>
            <input id={ids + '-commentaire'} value={commentaire} onChange={(e) => setCommentaire(e.target.value)} placeholder={t('editResto.phComment')} />
          </div>
        </>
      ) : (
        <>
          <p className="small" style={{ margin: '0 0 12px' }}>{t('editResto.deleteRequestSent')}</p>
          <div className="field">
            <label htmlFor={ids + '-code'}>{t('editResto.codeByEmail')}</label>
            <input id={ids + '-code'} inputMode="numeric" value={code} onChange={(e) => setCode(e.target.value)} placeholder="123456" maxLength={6} />
          </div>
          <button type="button" className="btn-ghost" disabled={enCours} onClick={demanderCode}>{t('editResto.resendCode')}</button>
        </>
      )}
    </SousEcran>
  );
}
