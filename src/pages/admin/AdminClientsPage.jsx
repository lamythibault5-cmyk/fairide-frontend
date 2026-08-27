import { useEffect, useState } from 'react';
import { createPortal } from 'react-dom';
import { useLocation } from 'react-router-dom';
import { api } from '../../api';
import { useAuth } from '../../context/AuthContext';
import { useToast } from '../../context/ToastContext';
import { SkeletonCards } from '../../components/Skeleton';
import ConfirmDialog from '../../components/admin/ConfirmDialog';
import AdminNotesPanel from '../../components/admin/AdminNotesPanel';
import AdminActionHistory from '../../components/admin/AdminActionHistory';
import CreateTicketButton from '../../components/admin/CreateTicketButton';
import { isTestAccount, TestBadge, filterBySearch, money, fmtDate, downloadCsv } from './adminUtils';

export default function AdminClientsPage() {
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
      toast(status === 'blocked' ? 'Client suspendu.' : 'Client réactivé.');
    } catch (e) {
      toast(e.message);
    }
  }

  function askSuspend(c) {
    setConfirmAction({ title: `Suspendre ${c.name} ?`, message: 'Le client ne pourra plus passer de commande.', danger: true, run: () => setStatus(c.id, 'blocked') });
  }
  function askReactivate(c) {
    setConfirmAction({ title: `Réactiver ${c.name} ?`, run: () => setStatus(c.id, 'approved') });
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
    if (!clients || !clients.length) { toast('Rien à exporter.'); return; }
    downloadCsv(`clients-${Date.now()}.csv`, clients, [
      { label: 'Nom', get: (c) => c.name },
      { label: 'Email', get: (c) => c.email },
      { label: 'Téléphone', get: (c) => c.phone },
      { label: 'Inscrit le', get: (c) => fmtDate(c.createdAt) },
      { label: 'Commandes', get: (c) => c.orderCount },
      { label: 'Annulations', get: (c) => c.cancelledCount },
      { label: 'Total dépensé', get: (c) => c.totalSpent },
      { label: 'Panier moyen', get: (c) => c.avgBasket },
      { label: 'Fréquence (cmd/mois)', get: (c) => c.purchaseFrequency },
      { label: 'Dernière commande', get: (c) => c.lastOrderAt ? fmtDate(c.lastOrderAt) : '' },
      { label: 'Solde', get: (c) => c.balance },
      { label: 'Statut', get: (c) => c.adminStatus }
    ]);
  }

  const filtered = filterBySearch(clients, search, (c) => [c.name, c.email, c.phone]);

  return (
    <div>
      <h2 className="section-title" style={{ marginTop: 0 }}>Clients</h2>
      <div className="row" style={{ marginBottom: 14, gap: 8 }}>
        <input placeholder="Chercher un(e) client(e)..." value={search} onChange={(e) => setSearch(e.target.value)} style={{ flex: 1 }} />
        <button className="btn-outline" onClick={exportCsv}>⬇️ CSV</button>
      </div>
      {!clients && <SkeletonCards count={3} />}
      {clients && filtered.length === 0 && <div className="empty">Aucun résultat.</div>}
      {filtered && filtered.map((c) => (
        <div className={`card order-card-clickable${isTestAccount(c.email) ? ' card-test-account' : ''}`} key={c.id} onClick={() => openClient(c)}>
          <div className="row" style={{ justifyContent: 'space-between' }}>
            <b>{c.name}</b>
            <div className="row" style={{ gap: 6 }}>
              {isTestAccount(c.email) && <TestBadge />}
              {c.adminStatus === 'blocked' && <span className="pill" style={{ color: 'var(--red)' }}>🚫 Suspendu</span>}
              {c.refundCount > 0 && <span className="pill" style={{ color: 'var(--red)' }}>{c.refundCount} remboursement(s)</span>}
            </div>
          </div>
          <div className="small">{c.email}{c.phone ? ` · ${c.phone}` : ''} · inscrit le {fmtDate(c.createdAt)}</div>
          <div className="small">
            {c.orderCount} commande(s){c.cancelledCount > 0 ? ` (${c.cancelledCount} annulée(s))` : ''} · {money(c.totalSpent)} dépensés · panier moyen {money(c.avgBasket)}
          </div>
          <div className="small">
            {c.purchaseFrequency} commande(s)/mois · {c.lastOrderAt ? `dernière commande le ${fmtDate(c.lastOrderAt)}` : 'aucune commande'}
          </div>
          <div className="row" style={{ gap: 8, marginTop: 8 }} onClick={(e) => e.stopPropagation()}>
            {c.adminStatus !== 'blocked' && <button className="btn-danger-ghost" style={{ padding: '6px 14px', fontSize: 13 }} onClick={() => askSuspend(c)}>Suspendre</button>}
            {c.adminStatus === 'blocked' && <button className="btn-teal" style={{ padding: '6px 14px', fontSize: 13 }} onClick={() => askReactivate(c)}>Réactiver</button>}
          </div>
        </div>
      ))}

      {selected && createPortal(
        <div className="modal-overlay" onClick={() => setSelected(null)}>
          <div className="modal-box" onClick={(e) => e.stopPropagation()} style={{ maxWidth: 520 }}>
            <h3 style={{ margin: '0 0 8px' }}>{selected.name}</h3>
            {!detail && <div className="small">Chargement...</div>}
            {detail && (
              <>
                <p className="small" style={{ margin: '2px 0' }}>{detail.email}{detail.phone ? ` · ${detail.phone}` : ''}</p>
                {detail.address && <p className="small" style={{ margin: '2px 0' }}>📍 {detail.address}</p>}
                <p className="small" style={{ margin: '2px 0' }}>Inscrit le {fmtDate(detail.createdAt)} · Solde Fairide : <b>{money(detail.balance)}</b></p>
                <div className="row" style={{ gap: 8, marginTop: 6 }}>
                  {detail.adminStatus !== 'blocked' && <button className="btn-danger-ghost" onClick={() => askSuspend(detail)}>Suspendre</button>}
                  {detail.adminStatus === 'blocked' && <button className="btn-teal" onClick={() => askReactivate(detail)}>Réactiver</button>}
                </div>
                <div className="divider" />
                <div className="row" style={{ justifyContent: 'space-between' }}><span className="small">Commandes</span><b className="small">{detail.orderCount}</b></div>
                <div className="row" style={{ justifyContent: 'space-between' }}><span className="small">Annulations</span><b className="small">{detail.cancelledCount}</b></div>
                <div className="row" style={{ justifyContent: 'space-between' }}><span className="small">Total dépensé</span><b className="small">{money(detail.totalSpent)}</b></div>
                <div className="row" style={{ justifyContent: 'space-between' }}><span className="small">Panier moyen</span><b className="small">{money(detail.avgBasket)}</b></div>
                <div className="row" style={{ justifyContent: 'space-between' }}><span className="small">Fréquence d'achat</span><b className="small">{detail.purchaseFrequency} commande(s)/mois</b></div>
                <div className="row" style={{ justifyContent: 'space-between' }}><span className="small">Dernière commande</span><b className="small">{fmtDate(detail.lastOrderAt)}</b></div>
                {(detail.refunds || []).length > 0 && (
                  <>
                    <div className="divider" />
                    <h4 style={{ margin: '0 0 6px', color: 'var(--red)' }}>Remboursements</h4>
                    {detail.refunds.map((r) => (
                      <div key={r.id} className="row" style={{ justifyContent: 'space-between', padding: '2px 0' }}>
                        <span className="small">{r.restaurantName} — {r.reason || r.responsibility}</span>
                        <span className="small">{money(r.amount)}</span>
                      </div>
                    ))}
                  </>
                )}
                <div className="divider" />
                <h4 style={{ margin: '0 0 6px' }}>Commandes récentes</h4>
                {(detail.orders || []).length === 0 && <div className="small">Aucune commande pour l'instant.</div>}
                {(detail.orders || []).map((o) => (
                  <div key={o.id} className="row" style={{ justifyContent: 'space-between', padding: '4px 0' }}>
                    <span className="small">{o.restaurantName}</span>
                    <span className="small">{money(o.total)}</span>
                  </div>
                ))}
                <div className="divider" />
                <CreateTicketButton linkType="linkedClientId" linkId={selected.id} label={detail.name} />
                <div className="divider" />
                <AdminNotesPanel targetType="client" targetId={selected.id} notes={detail.notes} onAdded={refreshDetail} />
                <div className="divider" />
                <AdminActionHistory actions={detail.actions} />
              </>
            )}
            <button className="btn-ghost" style={{ marginTop: 12 }} onClick={() => setSelected(null)}>Fermer</button>
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
