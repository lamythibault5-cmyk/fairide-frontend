import { useCallback, useEffect, useId, useState } from 'react';
import { api } from '../../api';
import { useLanguage, getLocale } from '../../context/LanguageContext';
import ConfirmDialog from '../ConfirmDialog';

/* Admin › Commerces › « Changer un taux de TVA pour tous les commerces » (CODE-2, DEC-25, 8 octobre 2026).
 *
 * Pour la réforme « plats à emporter 6 % → 12 % », annoncée puis reportée : la veille, l'équipe vérifie le taux sur le
 * site du SPF Finances et l'applique d'ici, au lieu d'un déploiement. Le serveur (tvaPlats.annoncerChangement) écrit à
 * chaque commerce concerné, lui laisse au moins 7 jours pour refuser, puis applique le taux à la date d'effet chez ceux
 * qui n'ont pas refusé — et re-signe leur carte au nom du mandat, sinon elles deviendraient toutes « à signer ».
 * L'aperçu (combien de plats, combien de commerces) passe AVANT la confirmation : on ne prévient pas cinquante commerces
 * par erreur. */
const PORTEES = ['food', 'soft_drinks', 'alcohol'];
const TAUX = [6, 12, 21, 0];

export default function ChangementTvaGlobal({ token, toast }) {
  const { t } = useLanguage();
  const id = useId();
  const [donnees, setDonnees] = useState(null);
  const [scope, setScope] = useState('food');
  const [from, setFrom] = useState(6);
  const [to, setTo] = useState(12);
  const [effectiveAt, setEffectiveAt] = useState('');
  const [reason, setReason] = useState('');
  const [apercu, setApercu] = useState(null);
  const [confirmer, setConfirmer] = useState(false);
  const [enCours, setEnCours] = useState(false);

  const charger = useCallback(() => {
    api('/admin/vat-rate-changes', { token }).then(setDonnees).catch(() => setDonnees(null));
  }, [token]);
  useEffect(() => { charger(); }, [charger]);
  useEffect(() => { setApercu(null); }, [scope, from]);

  async function previsualiser() {
    try { setApercu(await api('/admin/vat-rate-changes/preview', { method: 'POST', token, body: { scope, from } })); } catch (e) { toast(e.message, 'erreur'); }
  }
  async function annoncer() {
    setEnCours(true);
    try {
      const r = await api('/admin/vat-rate-changes', { method: 'POST', token, body: { scope, from, to, reason, effectiveAt: effectiveAt || undefined } });
      toast(t('adminTva.announcedToast', { n: r.notified, date: new Date(r.effectiveAt).toLocaleDateString(getLocale()) }));
      setConfirmer(false); setReason(''); setApercu(null); charger();
    } catch (e) { toast(e.message, 'erreur'); } finally { setEnCours(false); }
  }
  async function annuler(changeId) {
    try { await api(`/admin/vat-rate-changes/${changeId}/cancel`, { method: 'POST', token }); charger(); } catch (e) { toast(e.message, 'erreur'); }
  }

  const date = (ms) => new Date(ms).toLocaleDateString(getLocale(), { day: 'numeric', month: 'short', year: 'numeric' });
  return (
    <details className="card" style={{ marginBottom: 16 }}>
      <summary><b>{t('adminTva.title')}</b></summary>
      <p className="small" style={{ margin: '6px 0 10px' }}>{t('adminTva.help')}</p>
      {donnees && (
        <p className="small" style={{ margin: '0 0 10px' }}>
          {t('adminTva.defaults', { food: donnees.defaults.food, soft: donnees.defaults.soft_drinks, alcohol: donnees.defaults.alcohol })}
        </p>
      )}
      <div className="row" style={{ gap: 12, flexWrap: 'wrap', alignItems: 'flex-end' }}>
        <div className="field">
          <label htmlFor={`${id}-scope`} className="small">{t('adminTva.scope')}</label>
          <select id={`${id}-scope`} value={scope} onChange={(e) => setScope(e.target.value)}>
            {PORTEES.map((p) => <option key={p} value={p}>{t(`adminTva.scope_${p}`)}</option>)}
          </select>
        </div>
        <div className="field">
          <label htmlFor={`${id}-from`} className="small">{t('adminTva.from')}</label>
          <select id={`${id}-from`} value={from} onChange={(e) => setFrom(Number(e.target.value))}>{TAUX.map((r) => <option key={r} value={r}>{r} %</option>)}</select>
        </div>
        <div className="field">
          <label htmlFor={`${id}-to`} className="small">{t('adminTva.to')}</label>
          <select id={`${id}-to`} value={to} onChange={(e) => setTo(Number(e.target.value))}>{TAUX.map((r) => <option key={r} value={r}>{r} %</option>)}</select>
        </div>
        <div className="field">
          <label htmlFor={`${id}-date`} className="small">{t('adminTva.effectiveAt')}</label>
          <input id={`${id}-date`} type="date" value={effectiveAt} onChange={(e) => setEffectiveAt(e.target.value)} />
        </div>
      </div>
      <div className="field">
        <label htmlFor={`${id}-reason`} className="small">{t('adminTva.reason')}</label>
        <textarea id={`${id}-reason`} rows={2} value={reason} onChange={(e) => setReason(e.target.value)} placeholder={t('adminTva.reasonPlaceholder')} />
      </div>
      <div className="row" style={{ gap: 8, flexWrap: 'wrap', alignItems: 'center' }}>
        <button type="button" className="btn-outline" onClick={previsualiser} disabled={from === to}>{t('adminTva.preview')}</button>
        {apercu && <span className="small">{t('adminTva.previewResult', { items: apercu.items, restaurants: apercu.restaurants })}</span>}
        <button type="button" className="btn-teal" disabled={!apercu || !apercu.items || from === to || reason.trim().length < 10} onClick={() => setConfirmer(true)}>{t('adminTva.announce')}</button>
      </div>
      <p className="small" style={{ margin: '6px 0 0', color: 'var(--ink-soft)' }}>{t('adminTva.noticeRule')}</p>

      {donnees?.changes?.length > 0 && (
        <ul style={{ listStyle: 'none', padding: 0, margin: '14px 0 0' }}>
          {donnees.changes.map((c) => (
            <li key={c.id} className="small" style={{ borderTop: '1px solid var(--line)', padding: '8px 0' }}>
              <b>{t(`adminTva.scope_${c.scope}`)} : {c.from} % → {c.to} %</b> · {t('adminTva.on', { date: date(c.effectiveAt) })}
              {' · '}{c.cancelledAt ? t('adminTva.cancelled') : c.appliedAt ? t('adminTva.applied', { n: c.appliedItems }) : t('adminTva.pending', { notified: c.notified, objections: c.objections })}
              {!c.appliedAt && !c.cancelledAt && <button type="button" className="btn-ghost" style={{ marginLeft: 8 }} onClick={() => annuler(c.id)}>{t('adminTva.cancel')}</button>}
              <div style={{ color: 'var(--ink-soft)' }}>{c.reason}</div>
            </li>
          ))}
        </ul>
      )}
      <ConfirmDialog
        open={confirmer} loading={enCours} onCancel={() => setConfirmer(false)} onConfirm={annoncer}
        title={t('adminTva.confirmTitle')}
        message={t('adminTva.confirmText', { scope: t(`adminTva.scope_${scope}`), from, to, restaurants: apercu?.restaurants || 0, items: apercu?.items || 0 })}
        confirmLabel={t('adminTva.announce')}
      />
    </details>
  );
}
