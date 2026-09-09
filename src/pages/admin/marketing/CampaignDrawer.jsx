import { useCallback, useEffect, useState } from 'react';
import { createPortal } from 'react-dom';
import { api } from '../../../api';
import { useAuth } from '../../../context/AuthContext';
import { useToast } from '../../../context/ToastContext';
import { useLanguage } from '../../../context/LanguageContext';
import ConfirmDialog from '../../../components/ConfirmDialog';
import RecordDrawer, { DrawerRow } from '../../../components/admin/RecordDrawer';
import { ErrorCard } from '../../../components/admin/AdminListTools';
import { fmtDateTime, downloadCsv } from '../adminUtils';
import { StatusPill, SendStatePill } from './MarketingPills';
import { resumeAudience, personnaliser, paragraphes, dansUneHeure, PEUT_ENVOYER, PEUT_MODIFIER, PEUT_ANNULER, PEUT_SUPPRIMER } from './marketingUtils';

// Fiche d'une campagne dans le tiroir commun : Aperçu (audience, compteurs, rendu du message),
// Destinataires (journal des envois) et Actions (test, envoi immédiat, programmation, annulation,
// duplication, suppression). Se rafraîchit toute seule pendant un envoi.
export default function CampaignDrawer({ id, onClose, onChanged, onEdit }) {
  const { t: tr } = useLanguage();
  const { token } = useAuth();
  const toast = useToast();
  const [c, setC] = useState(null);
  const [erreur, setErreur] = useState(null);
  const [onglet, setOnglet] = useState('apercu');
  const [confirm, setConfirm] = useState(null); // { title, message, danger, run }
  const [busy, setBusy] = useState(false);
  const [quand, setQuand] = useState(dansUneHeure);

  const charger = useCallback(() => api(`/admin/marketing/campaigns/${id}`, { token }).then((r) => { setC(r); setErreur(null); }).catch((e) => setErreur(e.message)), [id, token]);
  useEffect(() => { charger(); }, [charger]);
  useEffect(() => {
    if (c?.status !== 'sending') return undefined;
    const t = setInterval(charger, 4000);
    return () => clearInterval(t);
  }, [c?.status, charger]);

  async function action(chemin, body, message) {
    setBusy(true);
    try {
      const r = await api(`/admin/marketing/campaigns/${id}/${chemin}`, { method: 'POST', token, body });
      if (message) toast(message);
      await charger();
      onChanged?.(r);
      return r;
    } catch (e) { toast(e.message); return null; } finally { setBusy(false); }
  }

  async function runConfirmed() {
    if (!confirm) return;
    setBusy(true);
    try { await confirm.run(); } catch (e) { toast(e.message); } finally { setBusy(false); setConfirm(null); }
  }

  function demanderEnvoi() {
    setConfirm({
      title: tr('adminMarketing.confirmSendTitle', { name: c.name }),
      message: tr('adminMarketing.confirmSendBody', { n: c.stats?.recipients || c.recipientsCount || '?' }),
      run: async () => { await action('send', {}, tr('adminMarketing.toastSending')); }
    });
  }
  function programmer() {
    const d = new Date(quand);
    if (!quand || Number.isNaN(d.getTime()) || d.getTime() < Date.now() + 60 * 1000) { toast(tr('adminMarketing.errScheduleDate')); return; }
    action('send', { scheduledAt: d.toISOString() }, tr('adminMarketing.toastScheduled', { when: fmtDateTime(d) }));
  }
  function demanderAnnulation() {
    setConfirm({ title: tr('adminMarketing.confirmCancelTitle', { name: c.name }), message: tr('adminMarketing.cancelHint'), danger: true, run: async () => { await action('cancel', {}, tr('adminMarketing.toastCancelled')); } });
  }
  function demanderSuppression() {
    setConfirm({
      title: tr('adminMarketing.confirmDeleteTitle', { name: c.name }), message: tr('adminMarketing.confirmDeleteBody'), danger: true,
      run: async () => { await api(`/admin/marketing/campaigns/${id}`, { method: 'DELETE', token }); toast(tr('adminMarketing.toastDeleted')); onChanged?.(null); onClose(); }
    });
  }
  async function dupliquer() {
    const r = await action('duplicate', {}, tr('adminMarketing.toastDuplicated'));
    if (r?.id) onEdit?.(r);
  }
  async function testEnvoi() {
    const r = await action('test', {});
    if (r?.to) toast(tr('adminMarketing.toastTestSent', { to: r.to }));
  }

  function exporterEnvois() {
    if (!c?.sends?.length) { toast(tr('adminCommon.nothingToExport')); return; }
    downloadCsv(`campagne-${c.id.slice(0, 8)}-envois.csv`, c.sends, [
      { label: tr('adminCommon.email'), get: (s) => s.email }, { label: tr('adminCommon.name'), get: (s) => s.name || '' },
      { label: tr('adminCommon.status'), get: (s) => s.status }, { label: tr('adminMarketing.colError'), get: (s) => s.error || '' },
      { label: tr('adminCommon.date'), get: (s) => (s.sentAt ? fmtDateTime(s.sentAt) : '') }
    ]);
  }

  const stats = c?.stats || {};
  const total = stats.recipients || c?.recipientsCount || 0;
  const faits = (stats.sent || 0) + (stats.failed || 0) + (stats.skipped || 0);
  const pourcent = total ? Math.min(100, Math.round((faits / total) * 100)) : 0;
  const sends = c?.sends || [];

  const ligneAction = (titre, aide, controle) => (
    <div className="mk-action">
      <div className="mk-action-text"><h5>{titre}</h5><p className="small mk-muted">{aide}</p></div>
      <div className="mk-action-controls">{controle}</div>
    </div>
  );

  return createPortal(
    <RecordDrawer
      title={c?.name || tr('adminCommon.loading')} subtitle={c ? resumeAudience(c.audience, tr) : ''}
      badge={c ? <StatusPill status={c.status} tr={tr} /> : null}
      tabs={[{ key: 'apercu', label: tr('adminCommon.tabOverview') }, { key: 'destinataires', label: tr('adminMarketing.tabRecipients'), count: c ? faits : null }, { key: 'actions', label: tr('adminCommon.tabActions') }]}
      tab={onglet} onTab={setOnglet} onClose={onClose} width={640}
      actions={c && PEUT_MODIFIER(c.status) ? <button type="button" className="btn-outline" style={{ padding: '6px 10px', fontSize: 12 }} onClick={() => onEdit?.(c)}>{tr('adminCommon.edit')}</button> : null}
    >
      {erreur && <ErrorCard message={erreur} onRetry={charger} />}
      {!c && !erreur && <div className="small">{tr('adminCommon.loading')}</div>}

      {c && onglet === 'apercu' && (
        <>
          <DrawerRow label={tr('adminMarketing.recipientsLabel')} value={total} strong />
          <DrawerRow label={tr('adminMarketing.sentLabel')} value={stats.sent ?? c.sentCount ?? 0} />
          <DrawerRow label={tr('adminMarketing.failedLabel')} value={<span style={(stats.failed || 0) > 0 ? { color: 'var(--red)' } : undefined}>{stats.failed ?? c.failedCount ?? 0}</span>} />
          {(stats.skipped || 0) > 0 && <DrawerRow label={tr('adminMarketing.skippedLabel')} value={stats.skipped} />}
          {(c.status === 'sending' || c.status === 'sent') && (
            <>
              <div className="small mk-muted" style={{ marginTop: 8 }}>{tr('adminMarketing.progress')} · {pourcent}%</div>
              <div className="mk-progress"><span style={{ width: `${pourcent}%` }} /></div>
            </>
          )}
          {c.scheduledAt && c.status === 'scheduled' && <DrawerRow label={tr('adminMarketing.scheduledAt')} value={fmtDateTime(c.scheduledAt)} strong />}
          {c.sentAt && <DrawerRow label={tr('adminMarketing.sentAt')} value={fmtDateTime(c.sentAt)} />}
          <DrawerRow label={tr('adminMarketing.createdBy')} value={c.createdBy || '—'} />
          <DrawerRow label={tr('adminMarketing.colCreated')} value={fmtDateTime(c.createdAt)} />
          <div className="divider" />
          <h4 className="drawer-section-title">{tr('adminMarketing.bodyPreview')}</h4>
          <div className="mk-email">
            <div className="mk-email-subject"><span className="small mk-muted">{tr('adminCommon.subject')}</span><b>{personnaliser(c.subject)}</b></div>
            <div className="mk-email-body">
              <h1>{personnaliser(c.subject)}</h1>
              {paragraphes(personnaliser(c.body)).map((p, i) => <p key={i}>{p}</p>)}
              {c.ctaLabel && c.ctaUrl && <span className="mk-email-btn">{c.ctaLabel}</span>}
              <p className="mk-email-footer">{tr('adminMarketing.previewFooter')}</p>
            </div>
          </div>
          {c.ctaUrl && <p className="small mk-muted" style={{ margin: '6px 0 0', wordBreak: 'break-all' }}>{tr('adminMarketing.cta')} → {c.ctaUrl}</p>}
        </>
      )}

      {c && onglet === 'destinataires' && (
        <>
          <div className="row" style={{ justifyContent: 'space-between', alignItems: 'center', gap: 8, marginBottom: 8, flexWrap: 'wrap' }}>
            <span className="small mk-muted">{sends.length >= 100 ? tr('adminMarketing.sendsLimit') : `${sends.length} / ${total}`}</span>
            <button type="button" className="btn-outline" style={{ padding: '6px 10px', fontSize: 12 }} onClick={exporterEnvois}>{tr('adminMarketing.exportSends')}</button>
          </div>
          {sends.length === 0 && <div className="empty">{tr('adminMarketing.noSends')}</div>}
          {sends.length > 0 && (
            <div className="table-scroll">
              <table className="admin-table">
                <thead><tr><th>{tr('adminMarketing.colEmail')}</th><th>{tr('adminCommon.status')}</th><th>{tr('adminCommon.date')}</th></tr></thead>
                <tbody>
                  {sends.map((s) => (
                    <tr key={s.id}>
                      <td><b>{s.name || '—'}</b><div className="small mk-muted">{s.email}</div>{s.error && <div className="small" style={{ color: 'var(--red)' }}>{s.error}</div>}</td>
                      <td><SendStatePill status={s.status} tr={tr} /></td>
                      <td className="small">{fmtDateTime(s.sentAt)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </>
      )}

      {c && onglet === 'actions' && (
        <>
          {ligneAction(tr('adminMarketing.sendTest'), tr('adminMarketing.sendTestHint'), <button type="button" className="btn-outline" disabled={busy} onClick={testEnvoi}>{tr('adminMarketing.sendTest')}</button>)}
          {PEUT_ENVOYER(c.status) && ligneAction(tr('adminMarketing.sendNow'), tr('adminMarketing.sendNowHint'), <button type="button" className="btn-gold" disabled={busy} onClick={demanderEnvoi}>{tr('adminMarketing.sendNow')}</button>)}
          {PEUT_ENVOYER(c.status) && ligneAction(tr('adminMarketing.schedule'), tr('adminMarketing.scheduleHint'), (
            <>
              <input type="datetime-local" value={quand} onChange={(e) => setQuand(e.target.value)} aria-label={tr('adminMarketing.schedule')} />
              <button type="button" className="btn-teal" disabled={busy} onClick={programmer}>{tr('adminMarketing.scheduleBtn')}</button>
            </>
          ))}
          {PEUT_ANNULER(c.status) && ligneAction(tr('adminMarketing.cancelSend'), tr('adminMarketing.cancelHint'), <button type="button" className="btn-danger-ghost" disabled={busy} onClick={demanderAnnulation}>{tr('adminMarketing.cancelSend')}</button>)}
          {PEUT_MODIFIER(c.status) && ligneAction(tr('adminMarketing.edit'), tr('adminMarketing.editHint'), <button type="button" className="btn-outline" disabled={busy} onClick={() => onEdit?.(c)}>{tr('adminMarketing.edit')}</button>)}
          {!PEUT_MODIFIER(c.status) && c.status !== 'sending' && <p className="small mk-muted" style={{ margin: '8px 0' }}>{tr('adminMarketing.lockedNote')}</p>}
          {ligneAction(tr('adminMarketing.duplicate'), tr('adminMarketing.duplicateHint'), <button type="button" className="btn-outline" disabled={busy} onClick={dupliquer}>{tr('adminMarketing.duplicate')}</button>)}
          {PEUT_SUPPRIMER(c.status) && ligneAction(tr('adminCommon.delete'), tr('adminMarketing.deleteHint'), <button type="button" className="btn-danger-ghost" disabled={busy} onClick={demanderSuppression}>{tr('adminCommon.delete')}</button>)}
        </>
      )}

      <ConfirmDialog open={!!confirm} title={confirm?.title} message={confirm?.message} danger={confirm?.danger} loading={busy} onConfirm={runConfirmed} onCancel={() => setConfirm(null)} />
    </RecordDrawer>,
    document.body
  );
}
