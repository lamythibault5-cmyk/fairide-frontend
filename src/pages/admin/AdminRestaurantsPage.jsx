import { useEffect, useState } from 'react';
import { createPortal } from 'react-dom';
import { Link, useLocation } from 'react-router-dom';
import { api } from '../../api';
import { useAuth } from '../../context/AuthContext';
import { useToast } from '../../context/ToastContext';
import { SkeletonCards } from '../../components/Skeleton';
import ConfirmDialog from '../../components/admin/ConfirmDialog';
import AdminNotesPanel from '../../components/admin/AdminNotesPanel';
import AdminActionHistory from '../../components/admin/AdminActionHistory';
import { isTestAccount, TestBadge, filterBySearch, money, fmtDate, pct, downloadCsv, BUSINESS_STATUS_LABELS, INVOICE_STATUS_LABELS } from './adminUtils';

export default function AdminRestaurantsPage() {
  const { token } = useAuth();
  const toast = useToast();
  const location = useLocation();
  const [restaurants, setRestaurants] = useState(null);
  const [search, setSearch] = useState(location.state?.presetSearch || '');
  const [selected, setSelected] = useState(null);
  const [detail, setDetail] = useState(null);
  const [orders, setOrders] = useState(null);
  const [confirmAction, setConfirmAction] = useState(null);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    api('/admin/restaurants', { token }).then(setRestaurants).catch((e) => toast(e.message));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  function openRestaurant(r) {
    setSelected(r);
    setDetail(null);
    setOrders(null);
    api(`/admin/restaurants/${r.id}`, { token }).then(setDetail).catch((e) => toast(e.message));
    api(`/admin/orders?restaurantId=${r.id}&limit=20`, { token }).then((res) => setOrders(res.rows)).catch((e) => toast(e.message));
  }

  async function setStatus(id, status) {
    try {
      await api(`/admin/restaurants/${id}/status`, { method: 'PATCH', token, body: { status } });
      setRestaurants((prev) => prev.map((r) => (r.id === id ? { ...r, adminStatus: status } : r)));
      if (selected?.id === id) setSelected((prev) => ({ ...prev, adminStatus: status }));
      if (detail?.id === id) setDetail((prev) => ({ ...prev, adminStatus: status }));
      toast(status === 'approved' ? 'Restaurant approuvé.' : status === 'blocked' ? 'Restaurant suspendu.' : 'Statut mis à jour.');
    } catch (e) {
      toast(e.message);
    }
  }

  function askSuspend(r) {
    setConfirmAction({ title: `Suspendre ${r.name} ?`, message: 'Le restaurant ne sera plus visible ni ne pourra recevoir de commandes.', danger: true, run: () => setStatus(r.id, 'blocked') });
  }
  function askReactivate(r) {
    setConfirmAction({ title: `Réactiver ${r.name} ?`, run: () => setStatus(r.id, 'approved') });
  }

  async function runConfirmed() {
    if (!confirmAction) return;
    setBusy(true);
    try { await confirmAction.run(); } finally { setBusy(false); setConfirmAction(null); }
  }

  function refreshDetail() {
    if (selected) api(`/admin/restaurants/${selected.id}`, { token }).then(setDetail).catch((e) => toast(e.message));
  }

  function exportCsv() {
    if (!restaurants || !restaurants.length) { toast('Rien à exporter.'); return; }
    downloadCsv(`restaurants-${Date.now()}.csv`, restaurants, [
      { label: 'Nom', get: (r) => r.name },
      { label: 'Commune', get: (r) => r.commune },
      { label: 'Cuisine', get: (r) => r.cuisine },
      { label: 'Statut', get: (r) => r.businessStatus },
      { label: 'Responsable', get: (r) => r.responsibleName },
      { label: 'Email', get: (r) => r.ownerEmail },
      { label: 'Téléphone', get: (r) => r.ownerPhone },
      { label: 'N° entreprise', get: (r) => r.companyNumber },
      { label: 'TVA', get: (r) => r.vatNumber },
      { label: 'Commandes', get: (r) => r.orderCount },
      { label: 'CA', get: (r) => r.revenue },
      { label: 'Commission générée', get: (r) => r.commissionGenerated },
      { label: 'Panier moyen', get: (r) => r.avgBasket },
      { label: "Taux d'annulation", get: (r) => r.cancellationRate },
      { label: "Taux d'acceptation", get: (r) => r.acceptanceRate },
      { label: 'Temps moyen prépa (min)', get: (r) => r.avgPrepMinutes }
    ]);
  }

  const filtered = filterBySearch(restaurants, search, (r) => [r.name, r.commune, r.cuisine, r.ownerEmail]);

  return (
    <div>
      <h2 className="section-title" style={{ marginTop: 0 }}>Restaurants</h2>
      <div className="row" style={{ marginBottom: 14, gap: 8 }}>
        <input placeholder="Chercher un restaurant..." value={search} onChange={(e) => setSearch(e.target.value)} style={{ flex: 1 }} />
        <button className="btn-outline" onClick={exportCsv}>⬇️ CSV</button>
      </div>
      {!restaurants && <SkeletonCards count={3} />}
      {restaurants && filtered.length === 0 && <div className="empty">Aucun résultat.</div>}
      {filtered && filtered.map((r) => {
        const biz = BUSINESS_STATUS_LABELS[r.businessStatus];
        return (
          <div className={`card order-card-clickable${isTestAccount(r.ownerEmail) ? ' card-test-account' : ''}`} key={r.id} onClick={() => openRestaurant(r)}>
            <div className="row" style={{ justifyContent: 'space-between' }}>
              <b>{r.name}</b>
              <div className="row" style={{ gap: 6 }}>
                {isTestAccount(r.ownerEmail) && <TestBadge />}
                <span className="pill" style={{ color: biz?.color }}>{biz?.label}</span>
              </div>
            </div>
            <div className="small">{r.commune} · {r.cuisine} · {r.rating.toFixed(1)}★</div>
            <div className="small">Responsable : {r.responsibleName || r.ownerEmail}{r.phone ? ` · ${r.phone}` : ''}</div>
            {(r.companyNumber || r.vatNumber) && <div className="small">N° entreprise {r.companyNumber || '—'} · TVA {r.vatNumber || '—'}</div>}
            <div className="small">
              {r.orderCount} commande(s) · {money(r.revenue)} CA · {money(r.commissionGenerated)} commission · panier moyen {money(r.avgBasket)}
            </div>
            <div className="small">
              {pct(r.cancellationRate)} annulation · {pct(r.acceptanceRate)} acceptation · {r.avgPrepMinutes !== null ? `${r.avgPrepMinutes} min prépa` : 'prépa non mesurée'}
            </div>
            <div className="row" style={{ gap: 8, marginTop: 8 }} onClick={(e) => e.stopPropagation()}>
              {r.adminStatus !== 'approved' && <button className="btn-teal" style={{ padding: '6px 14px', fontSize: 13 }} onClick={() => setStatus(r.id, 'approved')}>Approuver</button>}
              {r.adminStatus !== 'blocked' && <button className="btn-danger-ghost" style={{ padding: '6px 14px', fontSize: 13 }} onClick={() => askSuspend(r)}>Suspendre</button>}
              {r.adminStatus === 'blocked' && <button className="btn-teal" style={{ padding: '6px 14px', fontSize: 13 }} onClick={() => askReactivate(r)}>Réactiver</button>}
            </div>
          </div>
        );
      })}

      {selected && (
        <RestaurantDetailModal
          selected={selected} detail={detail} orders={orders}
          onClose={() => setSelected(null)}
          onSuspend={() => askSuspend(detail)}
          onReactivate={() => askReactivate(detail)}
          onChanged={refreshDetail}
        />
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

function RestaurantDetailModal({ selected, detail, orders, onClose, onSuspend, onReactivate, onChanged }) {
  const { token } = useAuth();
  const toast = useToast();
  const [editing, setEditing] = useState(false);
  const [form, setForm] = useState(null);
  const [saving, setSaving] = useState(false);
  const [invoices, setInvoices] = useState(null);
  const [crmProspect, setCrmProspect] = useState(null);

  useEffect(() => {
    setInvoices(null);
    api(`/admin/invoices?restaurantId=${selected.id}&limit=5`, { token }).then((r) => setInvoices(r.rows)).catch(() => setInvoices([]));
    setCrmProspect(null);
    api(`/admin/crm/prospects?restaurantId=${selected.id}&limit=1`, { token }).then((r) => setCrmProspect(r.rows[0] || null)).catch(() => {});
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selected.id]);

  function startEdit() {
    setForm({
      name: detail.name, commune: detail.commune, responsibleName: detail.responsibleName,
      companyNumber: detail.companyNumber, vatNumber: detail.vatNumber, legalName: detail.legalName
    });
    setEditing(true);
  }

  async function saveEdit() {
    setSaving(true);
    try {
      await api(`/admin/restaurants/${selected.id}`, { method: 'PATCH', token, body: form });
      toast('Informations mises à jour.');
      setEditing(false);
      onChanged();
    } catch (e) {
      toast(e.message);
    } finally {
      setSaving(false);
    }
  }

  return createPortal(
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal-box" onClick={(e) => e.stopPropagation()} style={{ maxWidth: 560 }}>
        <div className="row" style={{ justifyContent: 'space-between', alignItems: 'flex-start' }}>
          <h3 style={{ margin: '0 0 8px' }}>{selected.name}</h3>
          <a href={`/restaurants/${selected.id}`} target="_blank" rel="noreferrer" className="small">Voir la page ↗</a>
        </div>
        {!detail && <div className="small">Chargement...</div>}
        {detail && !editing && (
          <>
            <p className="small" style={{ margin: '2px 0' }}>{detail.commune}{detail.neighborhood ? ` (${detail.neighborhood})` : ''} · {detail.cuisine} · {detail.rating.toFixed(1)}★</p>
            <p className="small" style={{ margin: '2px 0' }}>📍 {[detail.addressStreet, detail.addressNumber].filter(Boolean).join(' ')}{detail.addressCity ? `, ${detail.addressPostalCode} ${detail.addressCity}` : ''}</p>
            <p className="small" style={{ margin: '2px 0' }}>Responsable : {detail.responsibleName || '—'} · {detail.email}{detail.phone ? ` · ${detail.phone}` : ''}</p>
            <p className="small" style={{ margin: '2px 0' }}>Raison sociale : {detail.legalName || '—'} · N° entreprise {detail.companyNumber || '—'} · TVA {detail.vatNumber || '—'}</p>
            <p className="small" style={{ margin: '2px 0' }}>Abonnement : {detail.subscriptionStatus} · Mode de livraison : {detail.deliveryMode}</p>
            <p className="small" style={{ margin: '2px 0' }}>Inscrit le {fmtDate(detail.createdAt)}</p>
            <button className="btn-outline" style={{ marginTop: 6 }} onClick={startEdit}>✏️ Modifier les informations</button>
            <div className="divider" />
            <div className="row" style={{ justifyContent: 'space-between' }}><span className="small">Commandes payées</span><b className="small">{detail.orderCount}</b></div>
            <div className="row" style={{ justifyContent: 'space-between' }}><span className="small">CA plats</span><b className="small">{money(detail.revenue)}</b></div>
            <div className="row" style={{ justifyContent: 'space-between' }}><span className="small">Commission générée</span><b className="small">{money(detail.commissionGenerated)}</b></div>
            <div className="row" style={{ justifyContent: 'space-between' }}><span className="small">Montant net dû</span><b className="small">{money(detail.netAmountDue)}</b></div>
            <div className="row" style={{ justifyContent: 'space-between' }}><span className="small">Remboursements à sa charge</span><b className="small">{money(detail.refundsTotal)}</b></div>
            <div className="row" style={{ justifyContent: 'space-between' }}><span className="small">Panier moyen</span><b className="small">{money(detail.avgBasket)}</b></div>
            <div className="row" style={{ justifyContent: 'space-between' }}><span className="small">Taux d'annulation</span><b className="small">{pct(detail.cancellationRate)}</b></div>
            <div className="row" style={{ justifyContent: 'space-between' }}><span className="small">Taux d'acceptation</span><b className="small">{pct(detail.acceptanceRate)}</b></div>
            <div className="row" style={{ justifyContent: 'space-between' }}><span className="small">Temps moyen de préparation</span><b className="small">{detail.avgPrepMinutes !== null ? `${detail.avgPrepMinutes} min` : 'non mesuré'}</b></div>
            <div className="row" style={{ gap: 8, marginTop: 10 }}>
              {detail.adminStatus !== 'blocked' && <button className="btn-danger-ghost" onClick={onSuspend}>Suspendre</button>}
              {detail.adminStatus === 'blocked' && <button className="btn-teal" onClick={onReactivate}>Réactiver</button>}
            </div>
            <div className="divider" />
            <h4 style={{ margin: '0 0 6px' }}>Commandes récentes</h4>
            {!orders && <div className="small">Chargement...</div>}
            {orders && orders.length === 0 && <div className="small">Aucune commande pour l'instant.</div>}
            {orders && orders.map((o) => (
              <div key={o.id} className="row" style={{ justifyContent: 'space-between', padding: '4px 0' }}>
                <span className="small">{o.clientName}{o.driverName ? ` · livré par ${o.driverName}` : ''}</span>
                <span className={`status-badge status-${o.status}`}>{o.status}</span>
              </div>
            ))}
            {crmProspect && (
              <>
                <div className="divider" />
                <div className="row" style={{ justifyContent: 'space-between', alignItems: 'center' }}>
                  <h4 style={{ margin: '0 0 6px' }}>Origine commerciale</h4>
                  <Link to="/admin/crm" state={{ presetSearch: crmProspect.name }} className="small">Voir dans le CRM ↗</Link>
                </div>
                <div className="small">Responsable : {crmProspect.ownerEmail || '—'} · Source : {crmProspect.source || '—'}</div>
                <div className="small">Converti le {fmtDate(crmProspect.convertedAt)}</div>
              </>
            )}
            <div className="divider" />
            <div className="row" style={{ justifyContent: 'space-between', alignItems: 'center' }}>
              <h4 style={{ margin: '0 0 6px' }}>Factures</h4>
              <Link to="/admin/invoices" state={{ restaurantId: selected.id }} className="small">Tout voir ↗</Link>
            </div>
            {!invoices && <div className="small">Chargement...</div>}
            {invoices && invoices.length === 0 && <div className="small">Aucune facture pour l'instant.</div>}
            {invoices && invoices.map((inv) => (
              <div key={inv.id} className="row" style={{ justifyContent: 'space-between', padding: '2px 0' }}>
                <span className="small" style={{ fontFamily: 'monospace' }}>{inv.invoiceNumber}</span>
                <span className="small">{money(inv.totalTtc)} · <span style={{ color: INVOICE_STATUS_LABELS[inv.status]?.color }}>{INVOICE_STATUS_LABELS[inv.status]?.label}</span></span>
              </div>
            ))}
            <div className="divider" />
            <AdminNotesPanel targetType="restaurant" targetId={selected.id} notes={detail.notes} onAdded={onChanged} />
            <div className="divider" />
            <AdminActionHistory actions={detail.actions} />
          </>
        )}
        {detail && editing && form && (
          <div>
            <div className="field"><label>Nom</label><input value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} /></div>
            <div className="field"><label>Commune</label><input value={form.commune} onChange={(e) => setForm({ ...form, commune: e.target.value })} /></div>
            <div className="field"><label>Responsable</label><input value={form.responsibleName} onChange={(e) => setForm({ ...form, responsibleName: e.target.value })} /></div>
            <div className="field"><label>Raison sociale</label><input value={form.legalName} onChange={(e) => setForm({ ...form, legalName: e.target.value })} /></div>
            <div className="row" style={{ gap: 8 }}>
              <div className="field" style={{ flex: 1 }}><label>N° entreprise</label><input value={form.companyNumber} onChange={(e) => setForm({ ...form, companyNumber: e.target.value })} /></div>
              <div className="field" style={{ flex: 1 }}><label>TVA</label><input value={form.vatNumber} onChange={(e) => setForm({ ...form, vatNumber: e.target.value })} /></div>
            </div>
            <div className="row" style={{ gap: 8 }}>
              <button className="btn-teal" disabled={saving} onClick={saveEdit}>{saving ? '...' : 'Enregistrer'}</button>
              <button className="btn-ghost" onClick={() => setEditing(false)}>Annuler</button>
            </div>
          </div>
        )}
        <button className="btn-ghost" style={{ marginTop: 12 }} onClick={onClose}>Fermer</button>
      </div>
    </div>,
    document.body
  );
}
