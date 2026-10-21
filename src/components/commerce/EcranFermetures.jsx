import { useId, useState } from 'react';
import { api } from '../../api';
import { useAuth } from '../../context/AuthContext';
import { useToast } from '../../context/ToastContext';
import { useLanguage } from '../../context/LanguageContext';
import { formatDateFr } from '../../openingHours';
import SousEcran from '../SousEcran';

// Mon commerce › Fermetures exceptionnelles (congés, travaux). Chaque ajout et chaque suppression part
// tout de suite — pas de pied « Enregistrer » : il n'y a rien à valider en bloc. La liste se lit sur
// `restaurant.closures`, que loadDashboard rafraîchit après chaque geste.
export default function EcranFermetures({ restaurant, restoId, loadDashboard, onFermer }) {
  const { t } = useLanguage();
  const { token } = useAuth();
  const toast = useToast();
  const ids = useId();
  const [debut, setDebut] = useState('');
  const [fin, setFin] = useState('');
  const [motif, setMotif] = useState('');
  // UN JOUR PAR DÉFAUT, « SANS FIN » SEULEMENT SI ON LE COCHE (audit du 19/10, shop-303). « Au (optionnel) » laissé vide
  // envoyait endDate null, que le serveur lit « sans date de fin » (openingHours.js) : fermé le 25/12 « pour la journée »,
  // le commerce restait fermé indéfiniment, et les clients lisaient « réouverture indéterminée ». Vide = le jour du début.
  const [sansFin, setSansFin] = useState(false);
  const [ajout, setAjout] = useState(false);
  const [suppressionId, setSuppressionId] = useState(null);

  async function ajouter() {
    if (!debut) { toast(t('editResto.toastStartDate')); return; }
    if (!sansFin && fin && fin < debut) { toast(t('editResto.toastEndAfterStart')); return; }
    setAjout(true);
    try {
      await api(`/restaurants/${restoId}/closures`, { method: 'POST', token, body: { startDate: debut, endDate: sansFin ? null : (fin || debut), reason: motif.trim() } });
      await loadDashboard(restoId);
      setDebut(''); setFin(''); setMotif(''); setSansFin(false);
      toast(t('editResto.toastClosureAdded'), 'succes');
    } catch (e) {
      toast(e.message, 'erreur');
    } finally {
      setAjout(false);
    }
  }

  async function supprimer(id) {
    setSuppressionId(id);
    try {
      await api(`/restaurants/${restoId}/closures/${id}`, { method: 'DELETE', token });
      await loadDashboard(restoId);
    } catch (e) {
      toast(e.message, 'erreur');
    } finally {
      setSuppressionId(null);
    }
  }

  const fermetures = restaurant.closures || [];
  return (
    <SousEcran titre={t('editResto.rowClosures')} onFermer={onFermer}>
      {fermetures.map((c) => (
        <div key={c.id} className="row" style={{ justifyContent: 'space-between', alignItems: 'center', padding: '8px 0', borderBottom: '1px solid var(--line)' }}>
          <div>
            <div className="small" style={{ fontWeight: 600 }}>{formatDateFr(c.startDate)}{c.endDate ? (c.endDate !== c.startDate ? ` → ${formatDateFr(c.endDate)}` : '') : t('editResto.reopenUnknown')}</div>
            {c.reason && <div className="small">{c.reason}</div>}
          </div>
          <button type="button" className="btn-danger-ghost" disabled={suppressionId === c.id} onClick={() => supprimer(c.id)}>
            {suppressionId === c.id ? '…' : t('editResto.remove')}
          </button>
        </div>
      ))}
      <div className="row" style={{ gap: 8, marginTop: fermetures.length ? 16 : 0 }}>
        <div className="field" style={{ flex: 1 }}>
          <label htmlFor={ids + '-du'}>{t('editResto.from')}</label>
          <input id={ids + '-du'} type="date" value={debut} onChange={(e) => setDebut(e.target.value)} />
        </div>
        <div className="field" style={{ flex: 1 }}>
          <label htmlFor={ids + '-au'}>{t('editResto.toOptional')}</label>
          <input id={ids + '-au'} type="date" value={sansFin ? '' : fin} disabled={sansFin} onChange={(e) => setFin(e.target.value)} />
        </div>
      </div>
      <label className="small" htmlFor={ids + '-sansfin'} style={{ display: 'flex', alignItems: 'center', gap: 8, margin: '0 0 12px' }}>
        <input id={ids + '-sansfin'} type="checkbox" checked={sansFin} onChange={(e) => setSansFin(e.target.checked)} />
        {t('editResto.untilFurtherNotice')}
      </label>
      <div className="field">
        <label htmlFor={ids + '-motif'}>{t('editResto.reasonVisible')}</label>
        <input id={ids + '-motif'} value={motif} onChange={(e) => setMotif(e.target.value)} placeholder={t('editResto.phClosureReason')} />
      </div>
      <button type="button" className="btn-teal" disabled={ajout} onClick={ajouter}>{ajout ? '…' : t('editResto.addClosure')}</button>
    </SousEcran>
  );
}
