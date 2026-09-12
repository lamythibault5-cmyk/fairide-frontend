import { useEffect, useState } from 'react';
import { createPortal } from 'react-dom';
import { api } from '../../../api';
import { useAuth } from '../../../context/AuthContext';
import { useToast } from '../../../context/ToastContext';
import { useLanguage } from '../../../context/LanguageContext';
import RecordDrawer, { DrawerRow } from '../../../components/admin/RecordDrawer';
import ConfirmDialog from '../../../components/ConfirmDialog';
import ReasonDialog from '../../../components/admin/ReasonDialog';
import AssigneeSelect from '../../../components/admin/AssigneeSelect';
import { ErrorCard, RecordLink } from '../../../components/admin/AdminListTools';
import { SkeletonCards } from '../../../components/Skeleton';
import { money, fmtDateTime, ORDER_STATUS_LABELS } from '../adminUtils';
import { RESPONSIBILITIES, REFUND_RESPONSIBILITIES, STATUSES, PRIORITIES, typeLabel, respLabel, statusLabel, priorityLabel, sourceLabel, estOuvert } from './labels';

// Fiche d'un incident (panneau latéral) : Aperçu (dossier + commande + liens), Traitement (statut,
// responsabilité, priorité, assignation, résolution), Remboursement (Stripe, via l'incident) et Ticket
// (création / liaison d'un ticket support). `onChanged` prévient la liste pour se rafraîchir.
export function IncPill({ kind, value, label }) {
  return <span className={`inc-pill ${kind}-${value}`}>{label}</span>;
}

function Section({ title, children }) {
  return <div className="inc-drawer-section">{title && <h4>{title}</h4>}{children}</div>;
}

export default function IncidentDrawer({ id, onClose, onChanged, onDeleted }) {
  const { t: tr } = useLanguage();
  const { token } = useAuth();
  const toast = useToast();
  const [tab, setTab] = useState('overview');
  const [detail, setDetail] = useState(null);
  const [erreur, setErreur] = useState(null);

  async function charger() {
    setErreur(null);
    try { setDetail(await api(`/admin/incidents/${id}`, { token })); } catch (e) { setErreur(e.message); }
  }
  useEffect(() => { setDetail(null); charger(); }, [id]); // eslint-disable-line react-hooks/exhaustive-deps

  function apresChangement(next) {
    if (next) setDetail((d) => ({ ...d, ...next })); else charger();
    onChanged?.();
  }

  const tabs = [
    { key: 'overview', label: tr('adminIncidents.tabOverview') },
    { key: 'handling', label: tr('adminIncidents.tabHandling') },
    { key: 'refund', label: tr('adminIncidents.tabRefund'), count: detail?.refunds?.length || undefined },
    { key: 'ticket', label: tr('adminIncidents.tabTicket'), count: detail?.ticket ? 1 : undefined }
  ];

  return createPortal(
    <RecordDrawer
      title={detail ? `${typeLabel(tr, detail.type)} · #${detail.orderShort}` : tr('adminIncidents.drawerTitle')}
      subtitle={detail ? `${detail.restaurantName || '-'} · ${detail.clientName || '-'} · ${fmtDateTime(detail.createdAt)}` : ''}
      badge={detail && (
        <>
          <IncPill kind="st" value={detail.status} label={statusLabel(tr, detail.status)} />
          {detail.overdue && <span className="inc-overdue">{tr('adminIncidents.overdue')}</span>}
        </>
      )}
      tabs={tabs} tab={tab} onTab={setTab} onClose={onClose} width={680}
    >
      {erreur && <ErrorCard message={erreur} onRetry={charger} />}
      {!erreur && !detail && <SkeletonCards count={3} />}
      {detail && tab === 'overview' && <OverviewTab detail={detail} tr={tr} onDeleted={onDeleted} onClose={onClose} token={token} toast={toast} />}
      {detail && tab === 'handling' && <HandlingTab detail={detail} tr={tr} token={token} toast={toast} onSaved={apresChangement} />}
      {detail && tab === 'refund' && <RefundTab detail={detail} tr={tr} token={token} toast={toast} onDone={() => apresChangement(null)} />}
      {detail && tab === 'ticket' && <TicketTab detail={detail} tr={tr} token={token} toast={toast} onDone={() => apresChangement(null)} />}
    </RecordDrawer>,
    document.body
  );
}

// ---- Aperçu ------------------------------------------------------------------------------------------
function OverviewTab({ detail, tr, onDeleted, onClose, token, toast }) {
  const [confirmDelete, setConfirmDelete] = useState(false);
  const [busy, setBusy] = useState(false);
  const o = detail.order;

  async function supprimer() {
    setBusy(true);
    try {
      await api(`/admin/incidents/${detail.id}`, { method: 'DELETE', token });
      toast(tr('adminIncidents.toastDeleted'));
      setConfirmDelete(false); onDeleted?.(); onClose?.();
    } catch (e) { toast(e.message); } finally { setBusy(false); }
  }

  return (
    <>
      <Section title={tr('adminIncidents.sectionIncident')}>
        <DrawerRow label={tr('adminCommon.type')} value={<IncPill kind="type" value={detail.type} label={typeLabel(tr, detail.type)} />} />
        <DrawerRow label={tr('adminIncidents.responsibility')} value={<IncPill kind="resp" value={detail.responsibility} label={respLabel(tr, detail.responsibility)} />} />
        <DrawerRow label={tr('adminCommon.status')} value={<IncPill kind="st" value={detail.status} label={statusLabel(tr, detail.status)} />} />
        <DrawerRow label={tr('adminCommon.priority')} value={<IncPill kind="prio" value={detail.priority} label={priorityLabel(tr, detail.priority)} />} />
        <DrawerRow label={tr('adminCommon.amount')} value={detail.amount !== null && detail.amount !== undefined ? money(detail.amount) : '-'} strong />
        <DrawerRow label={tr('adminIncidents.createdAt')} value={`${fmtDateTime(detail.createdAt)}${detail.createdBy ? ` · ${detail.createdBy}` : ''}`} />
        <DrawerRow label={tr('adminIncidents.dueAt')} value={<>{fmtDateTime(detail.dueAt)}{detail.overdue && <span className="inc-overdue">{tr('adminIncidents.overdue')}</span>}</>} />
        {detail.resolvedAt && <DrawerRow label={tr('adminIncidents.resolvedAt')} value={fmtDateTime(detail.resolvedAt)} />}
        <DrawerRow label={tr('adminIncidents.assignedTo')} value={detail.assignedTo || tr('adminCommon.unassigned')} />
        <DrawerRow label={tr('adminIncidents.source')} value={sourceLabel(tr, detail.source)} />
      </Section>
      <Section title={tr('adminIncidents.description')}>
        <p className={`inc-drawer-text${detail.description ? '' : ' empty'}`}>{detail.description || tr('adminIncidents.noDescription')}</p>
      </Section>
      <Section title={tr('adminIncidents.resolution')}>
        <p className={`inc-drawer-text${detail.resolution ? '' : ' empty'}`}>{detail.resolution || tr('adminIncidents.noResolution')}</p>
      </Section>
      <Section title={tr('adminIncidents.sectionOrder')}>
        {o ? (
          <>
            <DrawerRow label={tr('adminIncidents.orderId')} value={<code>{o.id}</code>} />
            <DrawerRow label={tr('adminCommon.status')} value={ORDER_STATUS_LABELS[o.status] || o.status} />
            <DrawerRow label={tr('adminCommon.total')} value={money(o.total)} strong />
            <DrawerRow label={tr('adminCommon.date')} value={fmtDateTime(o.createdAt)} />
            <DrawerRow label={tr('adminIncidents.payment')} value={`${o.paid ? tr('adminCommon.paidBadge') : tr('adminCommon.unpaidBadge')}${o.paymentMode ? ` · ${o.paymentMode}` : ''}`} />
            <DrawerRow label={tr('adminCommon.restaurant')} value={o.restaurantName || '-'} />
            <DrawerRow label={tr('adminCommon.client')} value={o.clientName || '-'} />
            <DrawerRow label={tr('adminCommon.driver')} value={o.driverName || tr('adminCommon.noDriver')} />
            <div className="admin-record-links">
              <RecordLink type="order" id={o.id} label={tr('adminIncidents.openOrder')} />
              {o.restaurantId && <RecordLink type="restaurant" id={o.restaurantId} name={o.restaurantName} label={tr('adminIncidents.openRestaurant')} />}
              {o.clientId && <RecordLink type="client" id={o.clientId} name={o.clientName} label={tr('adminIncidents.openClient')} />}
              {o.driverId && <RecordLink type="driver" id={o.driverId} name={o.driverName} label={tr('adminIncidents.openDriver')} />}
              {detail.ticket && <RecordLink type="ticket" id={detail.ticket.id} label={tr('adminIncidents.openTicket', { n: detail.ticket.ticketNumber })} />}
            </div>
          </>
        ) : <p className="inc-notice warn">{tr('adminIncidents.orderMissing')}</p>}
      </Section>
      {detail.status === 'open' && !detail.refundId && (
        <div className="inc-form-actions">
          <span className="spacer" />
          <button type="button" className="btn-ghost" style={{ color: 'var(--red)' }} onClick={() => setConfirmDelete(true)}>{tr('adminIncidents.deleteIncident')}</button>
        </div>
      )}
      <ConfirmDialog open={confirmDelete} title={tr('adminIncidents.deleteIncident')} message={tr('adminIncidents.deleteConfirm')} confirmLabel={tr('adminCommon.delete')} danger loading={busy} onConfirm={supprimer} onCancel={() => setConfirmDelete(false)} />
    </>
  );
}

// ---- Traitement --------------------------------------------------------------------------------------
function HandlingTab({ detail, tr, token, toast, onSaved }) {
  const { t } = useLanguage();
  const [form, setForm] = useState(() => ({
    status: detail.status, responsibility: detail.responsibility, priority: detail.priority,
    amount: detail.amount ?? '', assignedTo: detail.assignedTo || '', resolution: detail.resolution || '', description: detail.description || '',
    type: detail.type
  }));
  const [busy, setBusy] = useState(false);
  const [dialog, setDialog] = useState(null); // 'resolved' | 'rejected'
  useEffect(() => {
    setForm({ status: detail.status, responsibility: detail.responsibility, priority: detail.priority, amount: detail.amount ?? '', assignedTo: detail.assignedTo || '', resolution: detail.resolution || '', description: detail.description || '', type: detail.type });
  }, [detail]);
  const set = (k) => (e) => setForm((f) => ({ ...f, [k]: e && e.target ? e.target.value : e }));

  async function patch(body, message) {
    setBusy(true);
    try {
      const next = await api(`/admin/incidents/${detail.id}`, { method: 'PATCH', token, body });
      toast(message || tr('adminIncidents.toastSaved'));
      onSaved(next);
      return true;
    } catch (e) { toast(e.message); return false; } finally { setBusy(false); }
  }

  function enregistrer() {
    if (!form.description.trim()) { toast(tr('adminIncidents.descriptionRequired')); return; }
    const body = {
      status: form.status, responsibility: form.responsibility, priority: form.priority,
      amount: form.amount === '' ? null : Number(form.amount), assignedTo: form.assignedTo || null,
      resolution: form.resolution.trim() || null, description: form.description.trim()
    };
    patch(body);
  }

  async function cloturer(motif) {
    const ok = await patch({ status: dialog, resolution: motif, responsibility: form.responsibility }, tr(dialog === 'resolved' ? 'adminIncidents.toastResolved' : 'adminIncidents.toastRejected'));
    if (ok) setDialog(null);
  }

  const ouvert = estOuvert(detail);
  return (
    <>
      <div className="inc-form-grid">
        <div className="field">
          <label>{tr('adminCommon.status')}</label>
          <select value={form.status} onChange={set('status')}>{STATUSES.map((s) => <option key={s} value={s}>{statusLabel(tr, s)}</option>)}</select>
        </div>
        <div className="field">
          <label>{tr('adminIncidents.responsibility')}</label>
          <select value={form.responsibility} onChange={set('responsibility')}>{RESPONSIBILITIES.map((r) => <option key={r} value={r}>{respLabel(tr, r)}</option>)}</select>
        </div>
        <div className="field">
          <label>{tr('adminCommon.priority')}</label>
          <select value={form.priority} onChange={set('priority')}>{PRIORITIES.map((p) => <option key={p} value={p}>{priorityLabel(tr, p)}</option>)}</select>
        </div>
        <div className="field">
          <label>{tr('adminIncidents.amountEur')}</label>
          <input type="number" min="0" step="0.01" value={form.amount} onChange={set('amount')} placeholder="0.00" />
        </div>
        <div className="field full">
          <label>{tr('adminIncidents.assignedTo')}</label>
          <AssigneeSelect value={form.assignedTo} onChange={(v) => setForm((f) => ({ ...f, assignedTo: v }))} />
        </div>
        <div className="field full">
          <label>{tr('adminIncidents.description')}</label>
          <textarea rows={3} value={form.description} onChange={set('description')} />
        </div>
        <div className="field full">
          <label>{tr('adminIncidents.resolution')}</label>
          <textarea rows={4} value={form.resolution} onChange={set('resolution')} placeholder={tr('adminIncidents.resolutionPlaceholder')} />
        </div>
      </div>
      <div className="inc-form-actions">
        <button type="button" className="btn-gold" disabled={busy} onClick={enregistrer}>{busy ? '...' : tr('adminCommon.save')}</button>
        <span className="spacer" />
        {ouvert ? (
          <>
            <button type="button" className="btn-outline" disabled={busy} onClick={() => setDialog('resolved')}>{tr('adminIncidents.markResolved')}</button>
            <button type="button" className="btn-ghost" style={{ color: 'var(--red)' }} disabled={busy} onClick={() => setDialog('rejected')}>{tr('adminIncidents.markRejected')}</button>
          </>
        ) : (
          <button type="button" className="btn-outline" disabled={busy} onClick={() => patch({ status: 'investigating' }, tr('adminIncidents.toastReopened'))}>{tr('adminIncidents.reopen')}</button>
        )}
      </div>
      <p className="small" style={{ marginTop: 10, opacity: 0.7 }}>{tr('adminIncidents.typeHint', { type: typeLabel(tr, form.type) })}</p>
      <ReasonDialog
        open={!!dialog}
        title={dialog === 'resolved' ? tr('adminIncidents.markResolved') : tr('adminIncidents.markRejected')}
        message={dialog === 'resolved' ? tr('adminIncidents.resolveMessage') : tr('adminIncidents.rejectMessage')}
        label={tr('adminIncidents.resolution')}
        placeholder={tr('adminIncidents.resolutionPlaceholder')}
        multiline required
        initialValue={form.resolution}
        confirmLabel={dialog === 'resolved' ? tr('adminIncidents.markResolved') : tr('adminIncidents.markRejected')}
        danger={dialog === 'rejected'}
        loading={busy}
        onConfirm={cloturer}
        onCancel={() => setDialog(null)}
      />
    </>
  );
}

// ---- Remboursement -----------------------------------------------------------------------------------
function RefundTab({ detail, tr, token, toast, onDone }) {
  const o = detail.order;
  const dejaRembourse = (detail.refunds || []).reduce((s, r) => s + Number(r.amount || 0), 0);
  const restant = o ? Math.max(0, Number(o.total || 0) - dejaRembourse) : 0;
  const [amount, setAmount] = useState(() => {
    const base = detail.amount && detail.amount > 0 ? detail.amount : restant;
    return base > 0 ? String(Math.min(base, restant || base).toFixed(2)) : '';
  });
  const [responsibility, setResponsibility] = useState(REFUND_RESPONSIBILITIES.includes(detail.responsibility) ? detail.responsibility : 'fairide');
  const [reason, setReason] = useState(detail.description || '');
  const [confirm, setConfirm] = useState(false);
  const [busy, setBusy] = useState(false);
  const montant = Number(amount);
  const valide = Number.isFinite(montant) && montant > 0 && (!o || montant <= Number(o.total) + 0.005);

  async function rembourser() {
    setBusy(true);
    try {
      await api(`/admin/incidents/${detail.id}/refund`, { method: 'POST', token, body: { amount: montant, responsibility, reason: reason.trim() } });
      toast(tr('adminIncidents.toastRefunded', { amount: money(montant) }));
      setConfirm(false); onDone();
    } catch (e) { toast(e.message); } finally { setBusy(false); }
  }

  return (
    <>
      <Section title={tr('adminIncidents.existingRefunds')}>
        {(detail.refunds || []).length === 0 ? <p className="inc-notice">{tr('adminIncidents.noRefunds')}</p> : (
          <ul className="inc-refund-list">
            {detail.refunds.map((r) => (
              <li key={r.id}>
                <span className="small">{fmtDateTime(r.createdAt)} · <IncPill kind="resp" value={r.responsibility} label={respLabel(tr, r.responsibility)} />{r.reason ? ` · ${r.reason}` : ''}{detail.refundId === r.id ? ` · ${tr('adminIncidents.linkedToThisIncident')}` : ''}</span>
                <b>{money(r.amount)}</b>
              </li>
            ))}
          </ul>
        )}
        {o && <p className="small" style={{ marginTop: 8 }}>{tr('adminIncidents.refundSummary', { total: money(o.total), refunded: money(dejaRembourse), left: money(restant) })}</p>}
      </Section>
      <Section title={tr('adminIncidents.newRefund')}>
        {!o ? <p className="inc-notice warn">{tr('adminIncidents.orderMissing')}</p>
          : !o.refundable ? <p className="inc-notice warn">{tr('adminIncidents.notRefundable')}</p>
            : (
              <>
                <div className="inc-form-grid">
                  <div className="field">
                    <label>{tr('adminIncidents.amountEur')}</label>
                    <input type="number" min="0.01" step="0.01" max={o.total} value={amount} onChange={(e) => setAmount(e.target.value)} />
                  </div>
                  <div className="field">
                    <label>{tr('adminIncidents.responsibility')}</label>
                    <select value={responsibility} onChange={(e) => setResponsibility(e.target.value)}>{REFUND_RESPONSIBILITIES.map((r) => <option key={r} value={r}>{respLabel(tr, r)}</option>)}</select>
                  </div>
                  <div className="field full">
                    <label>{tr('adminCommon.reasonLabel')}</label>
                    <input value={reason} onChange={(e) => setReason(e.target.value)} placeholder={tr('adminIncidents.refundReasonPlaceholder')} />
                  </div>
                </div>
                <p className="small" style={{ opacity: 0.7 }}>{tr(`adminIncidents.refundHint_${responsibility}`)}</p>
                <div className="inc-form-actions">
                  <button type="button" className="btn-gold" disabled={!valide || busy} onClick={() => setConfirm(true)}>{tr('adminIncidents.refundButton', { amount: valide ? money(montant) : '-' })}</button>
                </div>
              </>
            )}
      </Section>
      <ConfirmDialog
        open={confirm}
        title={tr('adminIncidents.refundConfirmTitle')}
        message={tr('adminIncidents.refundConfirmBody', { amount: money(montant), resp: respLabel(tr, responsibility), order: detail.orderShort })}
        confirmLabel={tr('adminIncidents.refundConfirmButton')}
        danger loading={busy}
        onConfirm={rembourser}
        onCancel={() => setConfirm(false)}
      />
    </>
  );
}

// ---- Ticket ------------------------------------------------------------------------------------------
function TicketTab({ detail, tr, token, toast, onDone }) {
  const [subject, setSubject] = useState(() => tr('adminIncidents.ticketDefaultSubject', { order: detail.orderShort, type: typeLabel(tr, detail.type) }));
  const [message, setMessage] = useState(detail.description || '');
  const [ticketId, setTicketId] = useState('');
  const [busy, setBusy] = useState(false);

  async function envoyer(body) {
    setBusy(true);
    try {
      const r = await api(`/admin/incidents/${detail.id}/ticket`, { method: 'POST', token, body });
      toast(tr('adminIncidents.toastTicketLinked', { n: r.ticketNumber || '' }));
      onDone();
    } catch (e) { toast(e.message); } finally { setBusy(false); }
  }

  if (detail.ticket) {
    const t = detail.ticket;
    return (
      <Section title={tr('adminIncidents.linkedTicket')}>
        <DrawerRow label="N°" value={t.ticketNumber} strong />
        <DrawerRow label={tr('adminCommon.subject')} value={t.subject} />
        <DrawerRow label={tr('adminCommon.status')} value={t.status} />
        <DrawerRow label={tr('adminCommon.priority')} value={t.priority} />
        <DrawerRow label={tr('adminCommon.date')} value={fmtDateTime(t.createdAt)} />
        <div className="admin-record-links"><RecordLink type="ticket" id={t.id} label={tr('adminIncidents.openTicket', { n: t.ticketNumber })} /></div>
      </Section>
    );
  }
  return (
    <>
      <Section title={tr('adminIncidents.createTicket')}>
        <p className="small" style={{ marginTop: 0 }}>{tr('adminIncidents.createTicketHelp')}</p>
        <div className="field"><label>{tr('adminCommon.subject')}</label><input value={subject} onChange={(e) => setSubject(e.target.value)} /></div>
        <div className="field"><label>{tr('adminCommon.message')}</label><textarea rows={4} value={message} onChange={(e) => setMessage(e.target.value)} /></div>
        <div className="inc-form-actions">
          <button type="button" className="btn-gold" disabled={busy || !subject.trim() || !message.trim()} onClick={() => envoyer({ subject: subject.trim(), message: message.trim() })}>{busy ? '...' : tr('adminCommon.newTicket')}</button>
        </div>
      </Section>
      <Section title={tr('adminIncidents.linkExistingTicket')}>
        <div className="row" style={{ gap: 8, flexWrap: 'wrap' }}>
          <input style={{ flex: 1, minWidth: 220 }} value={ticketId} onChange={(e) => setTicketId(e.target.value)} placeholder={tr('adminIncidents.ticketIdPlaceholder')} />
          <button type="button" className="btn-outline" disabled={busy || !ticketId.trim()} onClick={() => envoyer({ ticketId: ticketId.trim() })}>{tr('adminIncidents.linkTicket')}</button>
        </div>
      </Section>
    </>
  );
}
