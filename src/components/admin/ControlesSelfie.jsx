import { useCallback, useEffect, useState } from 'react';
import { api } from '../../api';
import { useLanguage, getLocale } from '../../context/LanguageContext';
import DecisionDialog from './DecisionDialog';

/* Admin › Livreurs › Contrôles (CODE-14, DEC-23 ; serveur : controleSelfie.js).
 *
 * Les selfies pris au hasard à la prise de service, à comparer À L'ŒIL aux photos du dossier (pièce d'identité si elle a été
 * déposée, sinon le selfie et la photo de profil de l'inscription). Deux boutons : « Conforme » ou « Pas la même personne ».
 * Les deux effacent le selfie. « Pas la même personne » ouvre ensuite la suspension pour fraude, par la décision motivée
 * (DecisionDialog, DSA) — la même que pour toute suspension : faits, base contractuelle, recours. Les images arrivent par des
 * adresses signées de cinq minutes : on recharge la liste plutôt que de garder une page ouverte des heures. */
export default function ControlesSelfie({ token, toast }) {
  const { t } = useLanguage();
  const [liste, setListe] = useState(null);
  const [enCours, setEnCours] = useState(null);
  const [suspendre, setSuspendre] = useState(null);
  const charger = useCallback(() => {
    api('/admin/couriers/selfie-checks', { token }).then(setListe).catch((e) => { toast(e.message, 'erreur'); setListe([]); });
  }, [token, toast]);
  useEffect(() => { charger(); }, [charger]);

  async function decider(c, decision) {
    setEnCours(c.id);
    try {
      const r = await api(`/admin/couriers/selfie-checks/${c.id}`, { method: 'PATCH', token, body: { decision } });
      toast(t(decision === 'match' ? 'controlesSelfie.toastMatch' : 'controlesSelfie.toastMismatch'));
      if (decision === 'mismatch' && r.courierUserId) setSuspendre({ id: r.courierUserId, name: c.name });
      charger();
    } catch (e) { toast(e.message, 'erreur'); } finally { setEnCours(null); }
  }
  async function confirmerSuspension(payload) {
    setEnCours('suspension');
    try {
      await api(`/admin/drivers/${suspendre.id}/status`, { method: 'PATCH', token, body: { status: 'blocked', ...payload } });
      toast(t('controlesSelfie.toastSuspended'));
      setSuspendre(null);
    } catch (e) { toast(e.message, 'erreur'); } finally { setEnCours(null); }
  }

  if (!liste) return <p className="small">…</p>;
  const date = (ms) => new Date(ms).toLocaleString(getLocale(), { dateStyle: 'short', timeStyle: 'short' });
  return (
    <div className="card">
      <div className="row" style={{ justifyContent: 'space-between', alignItems: 'center', gap: 8 }}>
        <h3 style={{ margin: 0, fontSize: 15 }}>📸 {t('controlesSelfie.title')}</h3>
        <button type="button" className="btn-ghost" onClick={charger}>{t('controlesSelfie.reload')}</button>
      </div>
      <p className="small" style={{ margin: '6px 0 12px' }}>{t('controlesSelfie.help')}</p>
      {liste.length === 0 && <p className="small">{t('controlesSelfie.none')}</p>}
      {liste.map((c) => (
        <div key={c.id} style={{ borderTop: '1px solid var(--line)', padding: '12px 0' }}>
          <b>{c.name}</b> <span className="small">{c.email} · {t('controlesSelfie.submitted', { date: date(c.submittedAt) })}</span>
          <div className="row" style={{ gap: 12, flexWrap: 'wrap', margin: '8px 0' }}>
            <figure style={{ margin: 0 }}>
              {c.selfieUrl ? <img src={c.selfieUrl} alt={t('controlesSelfie.selfieAlt', { name: c.name })} style={{ width: 180, height: 180, objectFit: 'cover', borderRadius: 'var(--radius-chip)', border: '1px solid var(--line)' }} /> : <span className="small">—</span>}
              <figcaption className="small">{t('controlesSelfie.selfie')}</figcaption>
            </figure>
            {c.references.map((r, k) => (
              <figure key={k} style={{ margin: 0 }}>
                <img src={r.url} alt={t(`controlesSelfie.ref_${r.docType}`)} style={{ width: 180, height: 180, objectFit: 'cover', borderRadius: 'var(--radius-chip)', border: '1px solid var(--line)' }} />
                <figcaption className="small">{t(`controlesSelfie.ref_${r.docType}`)}</figcaption>
              </figure>
            ))}
            {c.references.length === 0 && <p className="small" style={{ color: 'var(--red)' }}>{t('controlesSelfie.noReference')}</p>}
          </div>
          <div className="row" style={{ gap: 8, flexWrap: 'wrap' }}>
            <button type="button" className="btn-teal" disabled={enCours === c.id} onClick={() => decider(c, 'match')}>{t('controlesSelfie.match')}</button>
            <button type="button" className="btn-danger-ghost" disabled={enCours === c.id} onClick={() => decider(c, 'mismatch')}>{t('controlesSelfie.mismatch')}</button>
          </div>
        </div>
      ))}
      <DecisionDialog open={!!suspendre} cible={suspendre?.name} targetType="user" livreur loading={enCours === 'suspension'}
        onCancel={() => setSuspendre(null)} onConfirm={confirmerSuspension} />
    </div>
  );
}
