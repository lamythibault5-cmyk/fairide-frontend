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
import { UploadDocumentModal } from './AdminDocumentsPage';
import { isTestAccount, TestBadge, filterBySearch, money, fmtDate, pct, downloadCsv, DOCUMENT_TYPE_LABELS, DOCUMENT_EXPIRY_LABELS } from './adminUtils';

const ACTIVITY_LABELS = {
  disponible: { label: '🟢 Disponible', color: 'var(--teal-deep)' },
  en_livraison: { label: '🟡 En livraison', color: 'var(--gold-deep)' },
  offline: { label: '⚫ Hors ligne', color: 'inherit' }
};

export default function AdminDriversPage() {
  const { token } = useAuth();
  const toast = useToast();
  const location = useLocation();
  const [drivers, setDrivers] = useState(null);
  const [search, setSearch] = useState(location.state?.presetSearch || '');
  const [selected, setSelected] = useState(null);
  const [detail, setDetail] = useState(null);
  const [confirmAction, setConfirmAction] = useState(null);
  const [busy, setBusy] = useState(false);
  const [documents, setDocuments] = useState(null);
  const [showUploadDoc, setShowUploadDoc] = useState(false);

  useEffect(() => {
    api('/admin/drivers', { token }).then(setDrivers).catch((e) => toast(e.message));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  function loadDocuments(driverId) {
    setDocuments(null);
    api(`/admin/documents?targetType=driver&targetId=${driverId}&limit=10`, { token }).then((r) => setDocuments(r.rows)).catch(() => setDocuments([]));
  }

  function openDriver(d) {
    setSelected(d);
    setDetail(null);
    api(`/admin/drivers/${d.id}`, { token }).then(setDetail).catch((e) => toast(e.message));
    loadDocuments(d.id);
  }

  async function setStatus(id, status) {
    try {
      await api(`/admin/drivers/${id}/status`, { method: 'PATCH', token, body: { status } });
      setDrivers((prev) => prev.map((d) => (d.id === id ? { ...d, adminStatus: status } : d)));
      if (selected?.id === id) setSelected((prev) => ({ ...prev, adminStatus: status }));
      if (detail?.id === id) setDetail((prev) => ({ ...prev, adminStatus: status }));
      toast(status === 'approved' ? 'Livreur approuvé.' : status === 'blocked' ? 'Livreur suspendu.' : 'Statut mis à jour.');
    } catch (e) {
      toast(e.message);
    }
  }

  function askSuspend(d) {
    setConfirmAction({ title: `Suspendre ${d.name} ?`, message: 'Le livreur ne pourra plus prendre de courses.', danger: true, run: () => setStatus(d.id, 'blocked') });
  }
  function askReactivate(d) {
    setConfirmAction({ title: `Réactiver ${d.name} ?`, run: () => setStatus(d.id, 'approved') });
  }
  async function runConfirmed() {
    if (!confirmAction) return;
    setBusy(true);
    try { await confirmAction.run(); } finally { setBusy(false); setConfirmAction(null); }
  }

  function refreshDetail() {
    if (selected) api(`/admin/drivers/${selected.id}`, { token }).then(setDetail).catch((e) => toast(e.message));
  }

  function exportCsv() {
    if (!drivers || !drivers.length) { toast('Rien à exporter.'); return; }
    downloadCsv(`livreurs-${Date.now()}.csv`, drivers, [
      { label: 'Nom', get: (d) => d.name },
      { label: 'Email', get: (d) => d.email },
      { label: 'Téléphone', get: (d) => d.phone },
      { label: 'Statut', get: (d) => d.adminStatus },
      { label: 'Activité', get: (d) => d.activityStatus },
      { label: 'Livraisons', get: (d) => d.deliveriesCount },
      { label: 'Revenus', get: (d) => d.revenue },
      { label: "Taux d'annulation", get: (d) => d.cancellationRate },
      { label: 'Temps moyen livraison (min)', get: (d) => d.avgDeliveryMinutes }
    ]);
  }

  const filtered = filterBySearch(drivers, search, (d) => [d.name, d.email, d.phone]);

  return (
    <div>
      <h2 className="section-title" style={{ marginTop: 0 }}>Livreurs</h2>
      <div className="row" style={{ marginBottom: 14, gap: 8 }}>
        <input placeholder="Chercher un(e) livreur..." value={search} onChange={(e) => setSearch(e.target.value)} style={{ flex: 1 }} />
        <button className="btn-outline" onClick={exportCsv}>⬇️ CSV</button>
      </div>
      {!drivers && <SkeletonCards count={3} />}
      {drivers && filtered.length === 0 && <div className="empty">Aucun résultat.</div>}
      {filtered && filtered.map((d) => {
        const act = ACTIVITY_LABELS[d.activityStatus];
        return (
          <div className={`card order-card-clickable${isTestAccount(d.email) ? ' card-test-account' : ''}`} key={d.id} onClick={() => openDriver(d)}>
            <div className="row" style={{ justifyContent: 'space-between' }}>
              <b>{d.name}</b>
              <div className="row" style={{ gap: 6 }}>
                {isTestAccount(d.email) && <TestBadge />}
                <span className="pill" style={{ color: act?.color }}>{act?.label}</span>
                <span className="pill" style={{ color: d.adminStatus === 'approved' ? 'var(--teal-deep)' : d.adminStatus === 'blocked' ? 'var(--red)' : 'inherit' }}>
                  {d.adminStatus === 'approved' ? '✅ Approuvé' : d.adminStatus === 'blocked' ? '🚫 Suspendu' : '🕐 En attente'}
                </span>
              </div>
            </div>
            <div className="small">{d.email}{d.phone ? ` · ${d.phone}` : ''}{d.linkedRestaurantName ? ` · lié à ${d.linkedRestaurantName}` : ''}</div>
            <div className="small">
              {d.deliveriesCount} livraison(s) · {money(d.revenue)} de revenus · {pct(d.cancellationRate)} annulation
              {d.reviewCount > 0 ? ` · ${d.avgRating.toFixed(1)}★ (${d.reviewCount} avis)` : ' · pas encore d\'avis'}
            </div>
            <div className="small" style={{ opacity: 0.6 }}>
              {d.avgDeliveryMinutes !== null ? `${d.avgDeliveryMinutes} min de livraison en moyenne` : 'Temps de livraison pas encore mesuré'} · taux d'acceptation non mesurable
            </div>
            <div className="row" style={{ gap: 8, marginTop: 8 }} onClick={(e) => e.stopPropagation()}>
              {d.adminStatus !== 'approved' && <button className="btn-teal" style={{ padding: '6px 14px', fontSize: 13 }} onClick={() => setStatus(d.id, 'approved')}>Approuver</button>}
              {d.adminStatus !== 'blocked' && <button className="btn-danger-ghost" style={{ padding: '6px 14px', fontSize: 13 }} onClick={() => askSuspend(d)}>Suspendre</button>}
              {d.adminStatus === 'blocked' && <button className="btn-teal" style={{ padding: '6px 14px', fontSize: 13 }} onClick={() => askReactivate(d)}>Réactiver</button>}
            </div>
          </div>
        );
      })}

      {selected && createPortal(
        <div className="modal-overlay" onClick={() => setSelected(null)}>
          <div className="modal-box" onClick={(e) => e.stopPropagation()} style={{ maxWidth: 520 }}>
            <h3 style={{ margin: '0 0 8px' }}>{selected.name}</h3>
            {!detail && <div className="small">Chargement...</div>}
            {detail && (
              <>
                <p className="small" style={{ margin: '2px 0' }}>{detail.email}{detail.phone ? ` · ${detail.phone}` : ''}</p>
                <p className="small" style={{ margin: '2px 0' }}>Inscrit le {fmtDate(detail.createdAt)} · Stripe Connect : {detail.stripeConnectStatus || '—'}</p>
                {(detail.payoutIban || detail.payoutAccountHolder) && (
                  <p className="small" style={{ margin: '2px 0' }}>💳 {detail.payoutAccountHolder || '(titulaire non renseigné)'} — {detail.payoutIban || '(IBAN non renseigné)'}</p>
                )}
                <div className="row" style={{ gap: 8, marginTop: 6 }}>
                  {detail.adminStatus !== 'blocked' && <button className="btn-danger-ghost" onClick={() => askSuspend(detail)}>Suspendre</button>}
                  {detail.adminStatus === 'blocked' && <button className="btn-teal" onClick={() => askReactivate(detail)}>Réactiver</button>}
                </div>
                <div className="divider" />
                <div className="row" style={{ justifyContent: 'space-between' }}><span className="small">Livraisons terminées</span><b className="small">{detail.deliveriesCount}</b></div>
                <div className="row" style={{ justifyContent: 'space-between' }}><span className="small">Taux d'annulation</span><b className="small">{pct(detail.cancellationRate)}</b></div>
                <div className="row" style={{ justifyContent: 'space-between' }}><span className="small">Temps moyen de livraison</span><b className="small">{detail.avgDeliveryMinutes !== null ? `${detail.avgDeliveryMinutes} min` : 'non mesuré'}</b></div>
                <div className="divider" />
                <h4 style={{ margin: '0 0 6px' }}>💶 Finance livreur</h4>
                <div className="row" style={{ justifyContent: 'space-between' }}><span className="small">Total frais de livraison (ses courses)</span><span className="small">{money(detail.deliveryFeesTotal)}</span></div>
                <div className="row" style={{ justifyContent: 'space-between' }}><span className="small">Part Fairide (10%, référence — non déduite)</span><span className="small">{money(detail.fairideShareOnThose)}</span></div>
                <div className="row" style={{ justifyContent: 'space-between' }}><b className="small">Part livreur (100% du tarif livraison)</b><b className="small">{money(detail.deliveryFeesTotal)}</b></div>
                <div className="row" style={{ justifyContent: 'space-between' }}><span className="small">Ajustements (remboursements à sa charge)</span><span className="small">-{money(detail.adjustments)}</span></div>
                <div className="row" style={{ justifyContent: 'space-between' }}><b className="small">Montant dû / payé</b><b className="small">{money(detail.revenue)}</b></div>
                <div className="divider" />
                <h4 style={{ margin: '0 0 6px' }}>Commandes récentes</h4>
                {(detail.orders || []).length === 0 && <div className="small">Aucune commande pour l'instant.</div>}
                {(detail.orders || []).map((o) => (
                  <div key={o.id} className="row" style={{ justifyContent: 'space-between', padding: '4px 0' }}>
                    <span className="small">{o.restaurantName} → {o.clientName}</span>
                    <span className={`status-badge status-${o.status}`}>{o.status}</span>
                  </div>
                ))}
                <div className="divider" />
                <div className="row" style={{ justifyContent: 'space-between', alignItems: 'center' }}>
                  <h4 style={{ margin: '0 0 6px' }}>Documents</h4>
                  <button className="btn-ghost" style={{ padding: '2px 8px', fontSize: 12 }} onClick={() => setShowUploadDoc(true)}>+ Ajouter</button>
                </div>
                {!documents && <div className="small">Chargement...</div>}
                {documents && documents.length === 0 && <div className="small">Aucun document.</div>}
                {documents && documents.map((doc) => (
                  <div key={doc.id} className="row" style={{ justifyContent: 'space-between', padding: '3px 0' }}>
                    <a href={doc.fileUrl} target="_blank" rel="noreferrer" className="small">📎 {doc.title}</a>
                    <span className="small">
                      {doc.expiryState && <span style={{ color: DOCUMENT_EXPIRY_LABELS[doc.expiryState].color, marginRight: 6 }}>{DOCUMENT_EXPIRY_LABELS[doc.expiryState].label}</span>}
                      {DOCUMENT_TYPE_LABELS[doc.documentType]}
                    </span>
                  </div>
                ))}
                {showUploadDoc && (
                  <UploadDocumentModal
                    presetTargetType="driver" presetTargetId={selected.id} presetTargetLabel={detail.name}
                    onClose={() => setShowUploadDoc(false)} onUploaded={() => { setShowUploadDoc(false); loadDocuments(selected.id); }}
                  />
                )}
                <div className="divider" />
                <CreateTicketButton linkType="linkedDriverId" linkId={selected.id} label={detail.name} />
                <div className="divider" />
                <AdminNotesPanel targetType="driver" targetId={selected.id} notes={detail.notes} onAdded={refreshDetail} />
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
