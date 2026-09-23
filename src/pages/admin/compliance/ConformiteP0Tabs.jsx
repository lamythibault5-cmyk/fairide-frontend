import { useEffect, useId, useState } from 'react';
import { api } from '../../../api';
import { useAuth } from '../../../context/AuthContext';
import { useToast } from '../../../context/ToastContext';
import { useLanguage } from '../../../context/LanguageContext';
import { SkeletonCards } from '../../../components/Skeleton';
import { ErrorCard } from '../../../components/admin/AdminListTools';
import DecisionDialog from '../../../components/admin/DecisionDialog';
import Modale from '../../../components/Modale';
import ConfirmDialog from '../../../components/ConfirmDialog';
import { fmtDate, fmtDateTime, downloadPdf } from '../adminUtils';

/* Onglets de conformité du backlog du 23/09/2026, dans l'application « Conformité & RGPD ».
 * Backend : fairide-backend/routes/conformite.js. Un onglet = un registre ou une file de travail :
 *   decisions  — dossiers de décision motivée (D6) : à décider, recours à réexaminer sous 14 jours ;
 *   dsa        — signalements DSA (C6), échéance interne de 72 h ;
 *   breaches   — registre des violations de données (D3), exportable ;
 *   processors — sous-traitants et DPA (D2) ;
 *   forbidden  — produits interdits trouvés au catalogue, exceptions (A3) ;
 *   parameters — âge minimum de l'alcool, date des allergènes par plat (A1, A4) ;
 *   dispatch   — réglages de la livraison et export anonymisé des offres (./DispatchTab.jsx). */
export const ONGLETS_CONFORMITE = ['decisions', 'dsa', 'breaches', 'processors', 'forbidden', 'parameters', 'dispatch'];

function useCharge(chemin, deps = []) {
  const { token } = useAuth();
  const [data, setData] = useState(null);
  const [erreur, setErreur] = useState(null);
  const charger = () => { setErreur(null); return api(chemin, { token }).then(setData).catch((e) => setErreur(e.message)); };
  useEffect(() => { charger(); }, deps); // eslint-disable-line react-hooks/exhaustive-deps
  return { data, erreur, charger };
}

function enRetard(date) { return date && new Date(date) < new Date(); }

// --- D6 : décisions motivées ------------------------------------------------------------------------
export function DecisionsTab() {
  const { t } = useLanguage();
  const { token } = useAuth();
  const toast = useToast();
  const id = useId();
  const [filtre, setFiltre] = useState('pending');
  const { data, erreur, charger } = useCharge(`/admin/decisions?filter=${filtre}`, [filtre]);
  const [aDecider, setADecider] = useState(null);
  const [recours, setRecours] = useState(null);
  const [issue, setIssue] = useState('upheld');
  const [motif, setMotif] = useState('');
  const [busy, setBusy] = useState(false);
  async function agir(fn, ok) {
    setBusy(true);
    try { await fn(); toast(ok); await charger(); } catch (e) { toast(e.message, 'erreur'); } finally { setBusy(false); }
  }
  return (
    <div className="card" style={{ marginTop: 0 }}>
      <div className="role-pick" role="tablist" style={{ marginBottom: 10 }}>
        {['pending', 'appeals', 'all'].map((f) => <div key={f} role="tab" aria-selected={filtre === f} className={`chip${filtre === f ? ' active' : ''}`} onClick={() => setFiltre(f)}>{t(`conformite.decFilter_${f}`)}</div>)}
      </div>
      <p className="small" style={{ marginTop: 0 }}>{t('conformite.decIntro')}</p>
      {erreur && <ErrorCard message={erreur} onRetry={charger} />}
      {!data && !erreur && <SkeletonCards count={2} />}
      {data && data.cases.length === 0 && <p className="small">{t('conformite.decEmpty')}</p>}
      {data && data.cases.map((c) => (
        <div key={c.id} className="conformite-ligne">
          <div>
            <b>{c.targetName || c.targetId}</b> <span className="small">· {t(`conformite.target_${c.targetType}`)} · {t(`conformite.openedBy_${c.openedBy}`)} · {fmtDate(c.openedAt)}</span>
            {c.facts && <p className="small" style={{ margin: '4px 0 0' }}>{c.facts}</p>}
            {c.decidedAt && <p className="small" style={{ margin: '4px 0 0' }}>{t('conformite.decDecided', { measure: t(`conformite.measure_${c.measure}`), by: c.decidedBy, date: fmtDateTime(c.decidedAt) })}{c.appliedAt ? '' : c.effectiveAt ? ` — ${t('conformite.decEffective', { date: fmtDate(c.effectiveAt) })}` : ''}</p>}
            {c.appealReceivedAt && !c.appealDecidedAt && (
              <p className="small" style={{ margin: '4px 0 0', color: enRetard(c.appealDueAt) ? 'var(--red)' : 'inherit' }}>
                {t('conformite.decAppeal', { date: fmtDate(c.appealReceivedAt), due: fmtDate(c.appealDueAt) })} « {c.appealText} »
              </p>
            )}
            {c.appealDecidedAt && <p className="small" style={{ margin: '4px 0 0' }}>{t('conformite.decAppealDone', { outcome: t(`conformite.outcome_${c.appealOutcome}`), by: c.appealDecidedBy })}</p>}
          </div>
          <div className="row" style={{ gap: 6, flexWrap: 'wrap' }}>
            {!c.decidedAt && <button type="button" className="btn-outline" disabled={busy} onClick={() => setADecider(c)}>{t('conformite.decDecide')}</button>}
            {c.appealReceivedAt && !c.appealDecidedAt && <button type="button" className="btn-teal" disabled={busy} onClick={() => { setRecours(c); setIssue('upheld'); setMotif(''); }}>{t('conformite.decReview')}</button>}
            {c.appliedAt && !c.reinstatedAt && <button type="button" className="btn-ghost" disabled={busy} onClick={() => agir(() => api(`/admin/decisions/${c.id}/reinstate`, { method: 'POST', token, body: { reason: 'Rétablissement manuel' } }), t('conformite.decReinstated'))}>{t('conformite.decReinstate')}</button>}
          </div>
        </div>
      ))}
      <DecisionDialog open={!!aDecider} cible={aDecider?.targetName} targetType={aDecider?.targetType} loading={busy} onCancel={() => setADecider(null)}
        onConfirm={(payload) => { const c = aDecider; setADecider(null); agir(() => api(`/admin/decisions/${c.id}/decide`, { method: 'POST', token, body: payload }), t('conformite.decDone')); }} />
      {recours && (
        <Modale titre={t('conformite.decReviewTitle')} largeur={480} onFermer={() => setRecours(null)}>
          <p className="small">« {recours.appealText} »</p>
          <div className="field">
            <label htmlFor={`${id}-issue`}>{t('conformite.decOutcome')}</label>
            <select id={`${id}-issue`} value={issue} onChange={(e) => setIssue(e.target.value)}>
              {['upheld', 'reversed', 'modified'].map((o) => <option key={o} value={o}>{t(`conformite.outcome_${o}`)}</option>)}
            </select>
          </div>
          <div className="field">
            <label htmlFor={`${id}-motif`}>{t('conformite.decOutcomeReason')}</label>
            <textarea id={`${id}-motif`} rows={3} value={motif} onChange={(e) => setMotif(e.target.value)} />
          </div>
          <p className="small" style={{ color: 'var(--ink-soft)' }}>{t('conformite.decReviewOther')}</p>
          <div className="row" style={{ gap: 8, justifyContent: 'flex-end' }}>
            <button type="button" className="btn-ghost" onClick={() => setRecours(null)}>{t('common.cancel')}</button>
            <button type="button" className="btn-teal" disabled={busy || motif.trim().length < 10} onClick={() => { const c = recours; setRecours(null); agir(() => api(`/admin/decisions/${c.id}/appeal-decision`, { method: 'POST', token, body: { outcome: issue, reason: motif.trim() } }), t('conformite.decDone')); }}>{t('conformite.decReviewSend')}</button>
          </div>
        </Modale>
      )}
    </div>
  );
}

// --- C6 : signalements DSA --------------------------------------------------------------------------
export function DsaTab() {
  const { t } = useLanguage();
  const { token } = useAuth();
  const toast = useToast();
  const id = useId();
  const [tous, setTous] = useState(false);
  const { data, erreur, charger } = useCharge(`/admin/dsa-reports?status=${tous ? 'all' : 'open'}`, [tous]);
  const [enCours, setEnCours] = useState(null);
  const [decision, setDecision] = useState('no_action');
  const [motif, setMotif] = useState('');
  async function decider() {
    const r = enCours; setEnCours(null);
    try { await api(`/admin/dsa-reports/${r.id}`, { method: 'PATCH', token, body: { decision, reason: motif.trim() } }); toast(t('conformite.dsaDecided')); charger(); } catch (e) { toast(e.message, 'erreur'); }
  }
  return (
    <div className="card" style={{ marginTop: 0 }}>
      <label className="row small" style={{ gap: 6, marginBottom: 8, cursor: 'pointer' }}>
        <input type="checkbox" style={{ width: 'auto' }} checked={tous} onChange={(e) => setTous(e.target.checked)} /> {t('conformite.dsaShowAll')}
      </label>
      {erreur && <ErrorCard message={erreur} onRetry={charger} />}
      {!data && !erreur && <SkeletonCards count={2} />}
      {data && data.reports.length === 0 && <p className="small">{t('conformite.dsaEmpty')}</p>}
      {data && data.reports.map((r) => (
        <div key={r.id} className="conformite-ligne">
          <div>
            <b>{t(`conformite.reportCat_${r.category}`)}</b> <span className="small">· {t(`conformite.target_${r.targetType}`)} {r.targetId.slice(0, 8)} · {r.reporterEmail} · {fmtDateTime(r.createdAt)}</span>
            <p className="small" style={{ margin: '4px 0 0' }}>{r.explanation}</p>
            {r.status !== 'decided'
              ? <p className="small" style={{ margin: '4px 0 0', color: enRetard(r.dueAt) ? 'var(--red)' : 'inherit' }}>{t('conformite.dsaDue', { date: fmtDateTime(r.dueAt) })}</p>
              : <p className="small" style={{ margin: '4px 0 0' }}>{t('conformite.dsaDecisionLine', { decision: t(`conformite.dsaDecision_${r.decision}`), by: r.decidedBy })} — {r.decisionReason}</p>}
          </div>
          {r.status !== 'decided' && <button type="button" className="btn-outline" onClick={() => { setEnCours(r); setDecision('no_action'); setMotif(''); }}>{t('conformite.decDecide')}</button>}
        </div>
      ))}
      {enCours && (
        <Modale titre={t('conformite.dsaDecideTitle')} largeur={480} onFermer={() => setEnCours(null)}>
          <div className="field">
            <label htmlFor={`${id}-d`}>{t('conformite.dsaDecisionLabel')}</label>
            <select id={`${id}-d`} value={decision} onChange={(e) => setDecision(e.target.value)}>
              {['no_action', 'content_removed', 'account_case_opened'].map((d) => <option key={d} value={d}>{t(`conformite.dsaDecision_${d}`)}</option>)}
            </select>
          </div>
          <div className="field">
            <label htmlFor={`${id}-m`}>{t('conformite.dsaReasonLabel')}</label>
            <textarea id={`${id}-m`} rows={3} value={motif} onChange={(e) => setMotif(e.target.value)} />
          </div>
          <p className="small" style={{ color: 'var(--ink-soft)' }}>{t('conformite.dsaReasonNote')}</p>
          <div className="row" style={{ gap: 8, justifyContent: 'flex-end' }}>
            <button type="button" className="btn-ghost" onClick={() => setEnCours(null)}>{t('common.cancel')}</button>
            <button type="button" className="btn-teal" disabled={motif.trim().length < 10} onClick={decider}>{t('conformite.dsaSend')}</button>
          </div>
        </Modale>
      )}
    </div>
  );
}

// --- D3 : violations de données ---------------------------------------------------------------------
export function BreachesTab() {
  const { t } = useLanguage();
  const { token } = useAuth();
  const toast = useToast();
  const id = useId();
  const { data, erreur, charger } = useCharge('/admin/compliance/breaches');
  const [nouvelle, setNouvelle] = useState(null);
  async function enregistrer() {
    try {
      await api('/admin/compliance/breaches', { method: 'POST', token, body: { ...nouvelle, personsCount: nouvelle.personsCount ? Number(nouvelle.personsCount) : undefined } });
      setNouvelle(null); toast(t('conformite.breachSaved')); charger();
    } catch (e) { toast(e.message, 'erreur'); }
  }
  const marquer = (b, champ) => api(`/admin/compliance/breaches/${b.id}`, { method: 'PATCH', token, body: { [champ]: new Date().toISOString() } }).then(charger).catch((e) => toast(e.message, 'erreur'));
  return (
    <div className="card" style={{ marginTop: 0 }}>
      <div className="row" style={{ gap: 8, marginBottom: 10, flexWrap: 'wrap' }}>
        <button type="button" className="btn-teal" onClick={() => setNouvelle({ detectedAt: new Date().toISOString().slice(0, 16), described: '', categories: '', personsCount: '', riskLevel: 'low', notifyApd: false, decisionReason: '' })}>{t('conformite.breachNew')}</button>
        <button type="button" className="btn-outline" onClick={() => downloadPdf('/admin/compliance/breaches.csv', token, 'registre-violations.csv').catch((e) => toast(e.message, 'erreur'))}>{t('conformite.breachExport')}</button>
      </div>
      <p className="small" style={{ marginTop: 0 }}>{t('conformite.breachIntro')}</p>
      {erreur && <ErrorCard message={erreur} onRetry={charger} />}
      {!data && !erreur && <SkeletonCards count={1} />}
      {data && data.length === 0 && <p className="small">{t('conformite.breachEmpty')}</p>}
      {data && data.map((b) => (
        <div key={b.id} className="conformite-ligne">
          <div>
            <b>{fmtDateTime(b.detectedAt)}</b> <span className="small">· {t(`conformite.risk_${b.riskLevel}`)} · {b.recordedBy}</span>
            <p className="small" style={{ margin: '4px 0 0' }}>{b.described}</p>
            {b.notifyApd && !b.notifiedAt && <p className="small" style={{ margin: '4px 0 0', color: 'var(--red)' }}>{t('conformite.breachApdDue', { date: fmtDateTime(b.apdDeadline) })}</p>}
            {!b.notifyApd && <p className="small" style={{ margin: '4px 0 0' }}>{t('conformite.breachNoApd')} {b.decisionReason}</p>}
          </div>
          <div className="row" style={{ gap: 6, flexWrap: 'wrap' }}>
            {b.notifyApd && !b.notifiedAt && <button type="button" className="btn-outline" onClick={() => marquer(b, 'notifiedAt')}>{t('conformite.breachMarkNotified')}</button>}
            {!b.closedAt && <button type="button" className="btn-ghost" onClick={() => marquer(b, 'closedAt')}>{t('conformite.breachClose')}</button>}
          </div>
        </div>
      ))}
      {nouvelle && (
        <Modale titre={t('conformite.breachNew')} largeur={520} onFermer={() => setNouvelle(null)}>
          <div className="field"><label htmlFor={`${id}-a`}>{t('conformite.breachDetected')}</label><input id={`${id}-a`} type="datetime-local" value={nouvelle.detectedAt} onChange={(e) => setNouvelle({ ...nouvelle, detectedAt: e.target.value })} /></div>
          <div className="field"><label htmlFor={`${id}-b`}>{t('conformite.breachDescribed')}</label><textarea id={`${id}-b`} rows={3} value={nouvelle.described} onChange={(e) => setNouvelle({ ...nouvelle, described: e.target.value })} /></div>
          <div className="field"><label htmlFor={`${id}-c`}>{t('conformite.breachCategories')}</label><input id={`${id}-c`} value={nouvelle.categories} onChange={(e) => setNouvelle({ ...nouvelle, categories: e.target.value })} /></div>
          <div className="field"><label htmlFor={`${id}-d`}>{t('conformite.breachPersons')}</label><input id={`${id}-d`} inputMode="numeric" value={nouvelle.personsCount} onChange={(e) => setNouvelle({ ...nouvelle, personsCount: e.target.value.replace(/\D/g, '') })} /></div>
          <div className="field"><label htmlFor={`${id}-e`}>{t('conformite.breachRisk')}</label>
            <select id={`${id}-e`} value={nouvelle.riskLevel} onChange={(e) => setNouvelle({ ...nouvelle, riskLevel: e.target.value })}>{['none', 'low', 'high'].map((r) => <option key={r} value={r}>{t(`conformite.risk_${r}`)}</option>)}</select>
          </div>
          <label className="row small" style={{ gap: 6, cursor: 'pointer' }}><input type="checkbox" style={{ width: 'auto' }} checked={nouvelle.notifyApd} onChange={(e) => setNouvelle({ ...nouvelle, notifyApd: e.target.checked })} /> {t('conformite.breachNotifyApd')}</label>
          {!nouvelle.notifyApd && <div className="field"><label htmlFor={`${id}-f`}>{t('conformite.breachWhyNot')}</label><textarea id={`${id}-f`} rows={2} value={nouvelle.decisionReason} onChange={(e) => setNouvelle({ ...nouvelle, decisionReason: e.target.value })} /></div>}
          <div className="row" style={{ gap: 8, justifyContent: 'flex-end' }}>
            <button type="button" className="btn-ghost" onClick={() => setNouvelle(null)}>{t('common.cancel')}</button>
            <button type="button" className="btn-teal" onClick={enregistrer}>{t('conformite.breachSave')}</button>
          </div>
        </Modale>
      )}
    </div>
  );
}

// --- D2 : sous-traitants ----------------------------------------------------------------------------
export function ProcessorsTab() {
  const { t } = useLanguage();
  const { token } = useAuth();
  const toast = useToast();
  const { data, erreur, charger } = useCharge('/admin/compliance/processors');
  const [edition, setEdition] = useState({});
  const val = (p, k) => (edition[p.name]?.[k] ?? p[k] ?? '');
  const poser = (p, k, v) => setEdition((e) => ({ ...e, [p.name]: { ...(e[p.name] || {}), [k]: v } }));
  async function enregistrer(p) {
    try { await api(`/admin/compliance/processors/${encodeURIComponent(p.name)}`, { method: 'PATCH', token, body: edition[p.name] || {} }); setEdition((e) => ({ ...e, [p.name]: undefined })); toast(t('conformite.processorSaved')); charger(); }
    catch (e) { toast(e.message, 'erreur'); }
  }
  return (
    <div className="card" style={{ marginTop: 0 }}>
      <p className="small" style={{ marginTop: 0 }}>{t('conformite.processorsIntro')}</p>
      {erreur && <ErrorCard message={erreur} onRetry={charger} />}
      {!data && !erreur && <SkeletonCards count={2} />}
      {data && (
        <div className="table-scroll">
          <table className="admin-table">
            <thead><tr>
              <th scope="col">{t('conformite.procName')}</th><th scope="col">{t('conformite.procTransfer')}</th>
              <th scope="col">{t('conformite.procDpaVersion')}</th><th scope="col">{t('conformite.procDpaSigned')}</th>
              <th scope="col">{t('conformite.procTia')}</th><th scope="col" />
            </tr></thead>
            <tbody>
              {data.map((p) => (
                <tr key={p.name}>
                  <th scope="row">{p.name}<div className="small" style={{ fontWeight: 400 }}>{p.purpose}</div>
                    <span className="small" style={{ color: p.dpaOk ? '#2e7d32' : 'var(--red)' }}>{p.dpaOk ? t('conformite.procDpaOk') : t('conformite.procDpaMissing')}</span>
                  </th>
                  <td className="small">{t(`conformite.transfer_${p.transferMechanism}`)}<div>{p.zone}</div>{p.tiaNeeded && <div style={{ color: 'var(--red)' }}>{t('conformite.procTiaNeeded')}</div>}</td>
                  <td><input aria-label={t('conformite.procDpaVersion')} value={val(p, 'dpaVersion')} onChange={(e) => poser(p, 'dpaVersion', e.target.value)} style={{ maxWidth: 120 }} /></td>
                  <td><input aria-label={t('conformite.procDpaSigned')} type="date" value={String(val(p, 'dpaSignedAt')).slice(0, 10)} onChange={(e) => poser(p, 'dpaSignedAt', e.target.value)} /></td>
                  <td><input aria-label={t('conformite.procTia')} value={val(p, 'tiaRef')} onChange={(e) => poser(p, 'tiaRef', e.target.value)} style={{ maxWidth: 140 }} /></td>
                  <td>{edition[p.name] && <button type="button" className="btn-teal" style={{ padding: '4px 10px' }} onClick={() => enregistrer(p)}>{t('conformite.save')}</button>}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}

// --- A3 : produits interdits ------------------------------------------------------------------------
export function ForbiddenTab() {
  const { t } = useLanguage();
  const { token } = useAuth();
  const toast = useToast();
  const id = useId();
  const { data, erreur, charger } = useCharge('/admin/compliance/forbidden-products');
  const [label, setLabel] = useState('');
  const [motif, setMotif] = useState('');
  async function ajouter(e) {
    e.preventDefault();
    try { await api('/admin/compliance/forbidden-products/exceptions', { method: 'POST', token, body: { label, reason: motif } }); setLabel(''); setMotif(''); toast(t('conformite.forbiddenExceptionAdded')); charger(); }
    catch (err) { toast(err.message, 'erreur'); }
  }
  return (
    <div className="card" style={{ marginTop: 0 }}>
      <p className="small" style={{ marginTop: 0 }}>{t('conformite.forbiddenIntro')}</p>
      {erreur && <ErrorCard message={erreur} onRetry={charger} />}
      {!data && !erreur && <SkeletonCards count={1} />}
      {data && (
        <>
          <h4>{t('conformite.forbiddenFound', { n: data.found.length })}</h4>
          {data.found.map((f) => <p key={f.itemId} className="small" style={{ margin: '2px 0' }}>« {f.nom} » — {f.restaurantName} ({f.mot})</p>)}
          <h4>{t('conformite.forbiddenExceptions')}</h4>
          {data.exceptions.map((x) => (
            <p key={x.label} className="small" style={{ margin: '2px 0' }}>« {x.label} » — {x.reason} ({x.addedBy})
              {' '}<button type="button" className="btn-ghost" style={{ padding: '0 6px' }} onClick={() => api(`/admin/compliance/forbidden-products/exceptions/${encodeURIComponent(x.label)}`, { method: 'DELETE', token }).then(charger).catch((e) => toast(e.message, 'erreur'))}>✕</button>
            </p>
          ))}
          <form onSubmit={ajouter} className="row" style={{ gap: 8, flexWrap: 'wrap', marginTop: 8 }}>
            <input aria-label={t('conformite.forbiddenLabel')} placeholder={t('conformite.forbiddenLabel')} id={`${id}-l`} value={label} onChange={(e) => setLabel(e.target.value)} />
            <input aria-label={t('conformite.forbiddenReason')} placeholder={t('conformite.forbiddenReason')} value={motif} onChange={(e) => setMotif(e.target.value)} style={{ flex: 1, minWidth: 200 }} />
            <button type="submit" className="btn-outline" disabled={!label.trim() || motif.trim().length < 10}>{t('conformite.forbiddenAdd')}</button>
          </form>
        </>
      )}
    </div>
  );
}

// --- Paramètres juridiques (A1 palier 2, A4) -------------------------------------------------------
export function ParametersTab() {
  const { t } = useLanguage();
  const { token } = useAuth();
  const toast = useToast();
  const id = useId();
  const { data, erreur, charger } = useCharge('/admin/compliance/parameters');
  const [age, setAge] = useState('');
  const [date, setDate] = useState(null);
  const [bascule, setBascule] = useState(null);
  const lire = (cle) => data?.parameters.find((p) => p.key === cle)?.value ?? '';
  async function enregistrer() {
    try {
      await api('/admin/compliance/parameters', { method: 'PATCH', token, body: { ...(age ? { alcohol_min_age: Number(age) } : {}), ...(date !== null ? { allergens_per_item_required_from: date } : {}) } });
      toast(t('conformite.paramsSaved')); setAge(''); setDate(null); charger();
    } catch (e) { toast(e.message, 'erreur'); }
  }
  return (
    <div className="card" style={{ marginTop: 0 }}>
      {erreur && <ErrorCard message={erreur} onRetry={charger} />}
      {!data && !erreur && <SkeletonCards count={1} />}
      {data && (
        <>
          <div className="field">
            <label htmlFor={`${id}-age`}>{t('conformite.paramAlcoholAge')}</label>
            <select id={`${id}-age`} value={age || lire('alcohol_min_age')} onChange={(e) => setAge(e.target.value)}><option value="18">18</option><option value="16">16</option></select>
            <p className="small" style={{ margin: '4px 0 0' }}>{t('conformite.paramAlcoholAgeHelp')}</p>
          </div>
          <div className="field">
            <label htmlFor={`${id}-date`}>{t('conformite.paramAllergensDate')}</label>
            <input id={`${id}-date`} type="date" value={date ?? lire('allergens_per_item_required_from')} onChange={(e) => setDate(e.target.value)} />
            <p className="small" style={{ margin: '4px 0 0' }}>{t('conformite.paramAllergensDateHelp')}</p>
          </div>
          <button type="button" className="btn-teal" disabled={!age && date === null} onClick={enregistrer}>{t('conformite.save')}</button>
          <h4 style={{ marginTop: 16 }}>{t('conformite.paramFlags')}</h4>
          {/* p2p_enabled a son propre écran (Livreurs › Paramètres), avec ses explications : pas ici. */}
          {Object.entries(data.flags).filter(([k]) => k !== 'p2p_enabled').map(([k, v]) => (
            <p key={k} className="small" style={{ margin: '4px 0' }}>
              {k} : <b>{v ? t('conformite.on') : t('conformite.off')}</b>{' '}
              <button type="button" className="btn-ghost" style={{ padding: '0 8px', fontSize: 12 }} onClick={() => setBascule(k)}>{t('conformite.paramFlagToggle')}</button>
            </p>
          ))}
          <p className="small" style={{ color: 'var(--ink-soft)' }}>{t('conformite.paramFlagsHelp')}</p>
          <ConfirmDialog open={!!bascule} title={bascule || ''} message={t('conformite.paramFlagsHelp')} danger
            onCancel={() => setBascule(null)}
            onConfirm={async () => { const k = bascule; setBascule(null); try { await api('/admin/flags', { method: 'PATCH', token, body: { [k]: !data.flags[k] } }); charger(); } catch (e) { toast(e.message, 'erreur'); } }} />
        </>
      )}
    </div>
  );
}
