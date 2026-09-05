import { useEffect, useState } from 'react';
import { createPortal } from 'react-dom';
import { useLocation } from 'react-router-dom';
import { api } from '../../api';
import { useAuth } from '../../context/AuthContext';
import { useToast } from '../../context/ToastContext';
import { SkeletonCards } from '../../components/Skeleton';
import ConfirmDialog from '../../components/ConfirmDialog';
import AdminNotesPanel from '../../components/admin/AdminNotesPanel';
import AdminActionHistory from '../../components/admin/AdminActionHistory';
import CreateTicketButton from '../../components/admin/CreateTicketButton';
import CreateTaskButton from '../../components/admin/CreateTaskButton';
import { isTestAccount, TestBadge, filterBySearch, money, fmtDate, downloadCsv } from './adminUtils';
import { useLanguage } from '../../context/LanguageContext';

export default function AdminClientsPage() {
  const { t: tr } = useLanguage();
  const { token } = useAuth();
  const toast = useToast();
  const location = useLocation();
  const [clients, setClients] = useState(null);
  const [search, setSearch] = useState(location.state?.presetSearch || '');
  const [selected, setSelected] = useState(null);
  const [detail, setDetail] = useState(null);
  const [confirmAction, setConfirmAction] = useState(null);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    api('/admin/clients', { token }).then(setClients).catch((e) => toast(e.message));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  function openClient(c) {
    setSelected(c);
    setDetail(null);
    api(`/admin/clients/${c.id}`, { token }).then(setDetail).catch((e) => toast(e.message));
  }

  async function setStatus(id, status) {
    try {
      await api(`/admin/clients/${id}/status`, { method: 'PATCH', token, body: { status } });
      setClients((prev) => prev.map((c) => (c.id === id ? { ...c, adminStatus: status } : c)));
      if (selected?.id === id) setSelected((prev) => ({ ...prev, adminStatus: status }));
      if (detail?.id === id) setDetail((prev) => ({ ...prev, adminStatus: status }));
      toast(status === 'blocked' ? 'Client suspendu.' : tr('adminClients.toastReactivated'));
    } catch (e) {
      toast(e.message);
    }
  }

  function askSuspend(c) {
    setConfirmAction({ title: `Suspendre ${c.name} ?`, message: tr('adminClients.suspendBody'), danger: true, run: () => setStatus(c.id, 'blocked') });
  }
  async function deleteClient(c) {
    const r = await api(`/admin/clients/${c.id}`, { method: 'DELETE', token });
    setClients((prev) => prev.filter((x) => x.id !== c.id));
    if (selected?.id === c.id) { setSelected(null); setDetail(null); }
    toast(tr('adminClients.toastDeleted', { n: r.deletedOrders || 0 }));
  }
  function askDelete(c) {
    setConfirmAction({ title: tr('adminClients.confirmDelete', { name: c.name }), message: tr('adminClients.deleteBody', { email: c.email }), danger: true, run: () => deleteClient(c).catch((e) => toast(e.message)) });
  }
  function askReactivate(c) {
    setConfirmAction({ title: tr('adminClients.confirmReactivate', { name: c.name }), run: () => setStatus(c.id, 'approved') });
  }
  async function runConfirmed() {
    if (!confirmAction) return;
    setBusy(true);
    try { await confirmAction.run(); } finally { setBusy(false); setConfirmAction(null); }
  }

  function refreshDetail() {
    if (selected) api(`/admin/clients/${selected.id}`, { token }).then(setDetail).catch((e) => toast(e.message));
  }

  function exportCsv() {
    if (!clients || !clients.length) { toast(tr('adminCommon.nothingToExport')); return; }
    downloadCsv(`clients-${Date.now()}.csv`, clients, [
      { label: 'Nom', get: (c) => c.name },
      { label: 'Email', get: (c) => c.email },
      { label: tr('adminCommon.phone'), get: (c) => c.phone },
      { label: tr('adminCommon.registeredOn'), get: (c) => fmtDate(c.createdAt) },
      { label: 'Commandes', get: (c) => c.orderCount },
      { label: 'Annulations', get: (c) => c.cancelledCount },
      { label: tr('adminCommon.totalSpent'), get: (c) => c.totalSpent },
      { label: 'Panier moyen', get: (c) => c.avgBasket },
      { label: tr('adminClients.colFrequency'), get: (c) => c.purchaseFrequency },
      { label: tr('adminCommon.lastOrder'), get: (c) => c.lastOrderAt ? fmtDate(c.lastOrderAt) : '' },
      { label: 'Solde', get: (c) => c.balance },
      { label: 'Statut', get: (c) => c.adminStatus }
    ]);
  }

  const filtered = filterBySearch(clients, search, (c) => [c.name, c.email, c.phone]);

  return (
    <div>
      <h2 className="section-title" style={{ marginTop: 0 }}>{tr('adminClients.title')}</h2>
      <div className="row" style={{ marginBottom: 14, gap: 8 }}>
        <input placeholder={tr('adminClients.phSearch')} value={search} onChange={(e) => setSearch(e.target.value)} style={{ flex: 1 }} />
        <button className="btn-outline" onClick={exportCsv}>{tr('adminCommon.csv')}</button>
      </div>
      {!clients && <SkeletonCards count={3} />}
      {clients && filtered.length === 0 && <div className="empty">{tr('adminCommon.noResults')}</div>}
      {filtered && filtered.map((c) => (
        <div className={`card order-card-clickable${isTestAccount(c.email) ? ' card-test-account' : ''}`} key={c.id} onClick={() => openClient(c)}>
          <div className="row" style={{ justifyContent: 'space-between' }}>
            <b>{c.name}</b>
            <div className="row" style={{ gap: 6 }}>
              {isTestAccount(c.email) && <TestBadge />}
              {c.adminStatus === 'blocked' && <span className="pill" style={{ color: 'var(--red)' }}>{tr('adminClients.suspended')}</span>}
              {c.refundCount > 0 && <span className="pill" style={{ color: 'var(--red)' }}>{tr('adminClients.refundsCount', { n: c.refundCount })}</span>}
            </div>
          </div>
          <div className="small">{c.email}{c.phone ? ` · ${c.phone}` : ''}{tr('adminClients.registeredSuffix', { date: fmtDate(c.createdAt) })}</div>
          <div className="small">
            {tr('adminFinance.ordersCount', { n: c.orderCount })}{c.cancelledCount > 0 ? tr('adminClients.cancelledSuffix', { n: c.cancelledCount }) : ''}{tr('adminClients.spentLine', { spent: money(c.totalSpent), basket: money(c.avgBasket) })}
          </div>
          <div className="small">
            {tr('adminClients.ordersPerMonth', { n: c.purchaseFrequency })} · {c.lastOrderAt ? tr('adminClients.lastOrderOn', { date: fmtDate(c.lastOrderAt) }) : tr('adminClients.noOrder')}
          </div>
          <div className="row" style={{ gap: 8, marginTop: 8 }} onClick={(e) => e.stopPropagation()}>
            {c.adminStatus !== 'blocked' && <button className="btn-danger-ghost" style={{ padding: '6px 14px', fontSize: 13 }} onClick={() => askSuspend(c)}>{tr('adminCommon.suspend')}</button>}
            {c.adminStatus === 'blocked' && <button className="btn-teal" style={{ padding: '6px 14px', fontSize: 13 }} onClick={() => askReactivate(c)}>{tr('adminCommon.reactivate')}</button>}
            <button className="btn-danger-ghost" style={{ padding: '6px 14px', fontSize: 13, marginLeft: 'auto' }} onClick={() => askDelete(c)}>{tr('adminClients.deleteAccount')}</button>
          </div>
        </div>
      ))}

      {selected && createPortal(
        <div className="modal-overlay" onClick={() => setSelected(null)}>
          <div className="modal-box" onClick={(e) => e.stopPropagation()} style={{ maxWidth: 520 }}>
            <h3 style={{ margin: '0 0 8px' }}>{selected.name}</h3>
            {!detail && <div className="small">{tr('adminCommon.loading')}</div>}
            {detail && (
              <>
                <p className="small" style={{ margin: '2px 0' }}>{detail.email}{detail.phone ? ` · ${detail.phone}` : ''}</p>
                {detail.address && <p className="small" style={{ margin: '2px 0' }}>📍 {detail.address}</p>}
                <p className="small" style={{ margin: '2px 0' }}>{tr('adminClients.registeredBalance', { date: fmtDate(detail.createdAt) })} <b>{money(detail.balance)}</b></p>
                <div className="row" style={{ gap: 8, marginTop: 6 }}>
                  {detail.adminStatus !== 'blocked' && <button className="btn-danger-ghost" onClick={() => askSuspend(detail)}>{tr('adminCommon.suspend')}</button>}
                  {detail.adminStatus === 'blocked' && <button className="btn-teal" onClick={() => askReactivate(detail)}>{tr('adminCommon.reactivate')}</button>}
                  <button className="btn-danger-ghost" style={{ marginLeft: 'auto' }} onClick={() => askDelete(detail)}>{tr('adminClients.deleteAccount')}</button>
                </div>
                <div className="divider" />
                <div className="row" style={{ justifyContent: 'space-between' }}><span className="small">{tr('adminCommon.orders')}</span><b className="small">{detail.orderCount}</b></div>
                <div className="row" style={{ justifyContent: 'space-between' }}><span className="small">{tr('adminClients.cancellations')}</span><b className="small">{detail.cancelledCount}</b></div>
                <div className="row" style={{ justifyContent: 'space-between' }}><span className="small">{tr('adminCommon.totalSpent')}</span><b className="small">{money(detail.totalSpent)}</b></div>
                <div className="row" style={{ justifyContent: 'space-between' }}><span className="small">{tr('adminCommon.avgBasket')}</span><b className="small">{money(detail.avgBasket)}</b></div>
                <div className="row" style={{ justifyContent: 'space-between' }}><span className="small">{tr('adminClients.purchaseFrequency')}</span><b className="small">{tr('adminClients.ordersPerMonth', { n: detail.purchaseFrequency })}</b></div>
                <div className="row" style={{ justifyContent: 'space-between' }}><span className="small">{tr('adminCommon.lastOrder')}</span><b className="small">{fmtDate(detail.lastOrderAt)}</b></div>
                {(detail.refunds || []).length > 0 && (
                  <>
                    <div className="divider" />
                    <h4 style={{ margin: '0 0 6px', color: 'var(--red)' }}>{tr('adminCommon.refunds')}</h4>
                    {detail.refunds.map((r) => (
                      <div key={r.id} className="row" style={{ justifyContent: 'space-between', padding: '2px 0' }}>
                        <span className="small">{r.restaurantName} — {r.reason || r.responsibility}</span>
                        <span className="small">{money(r.amount)}</span>
                      </div>
                    ))}
                  </>
                )}
                <div className="divider" />
                <h4 style={{ margin: '0 0 6px' }}>{tr('adminCommon.recentOrders')}</h4>
                {(detail.orders || []).length === 0 && <div className="small">{tr('adminCommon.noOrdersYet')}</div>}
                {(detail.orders || []).map((o) => (
                  <div key={o.id} className="row" style={{ justifyContent: 'space-between', padding: '4px 0' }}>
                    <span className="small">{o.restaurantName}</span>
                    <span className="small">{money(o.total)}</span>
                  </div>
                ))}
                <div className="divider" />
                <div className="row" style={{ gap: 8 }}>
                  <CreateTicketButton linkType="linkedClientId" linkId={selected.id} label={detail.name} />
                  <CreateTaskButton targetType="client" targetId={selected.id} label={detail.name} />
                </div>
                <div className="divider" />
                <AdminNotesPanel targetType="client" targetId={selected.id} notes={detail.notes} onAdded={refreshDetail} />
                <div className="divider" />
                <AdminActionHistory actions={detail.actions} />
              </>
            )}
            <button className="btn-ghost" style={{ marginTop: 12 }} onClick={() => setSelected(null)}>{tr('adminCommon.close')}</button>
          </div>
        </div>,
        document.body
      )}
      <ConfirmDialog
        open={!!confirmAction}
        title={confirmAction?.title}
        message={confirmAction?.message}
        danger={confirmAction?.danger}
        loading={busy}
        onConfirm={runConfirmed}
        onCancel={() => setConfirmAction(null)}
      />
    </div>
  );
}
