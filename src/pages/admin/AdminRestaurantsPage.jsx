import { useEffect, useState } from 'react';
import { createPortal } from 'react-dom';
import { Link, useLocation } from 'react-router-dom';
import { api } from '../../api';
import { useAuth } from '../../context/AuthContext';
import { useToast } from '../../context/ToastContext';
import { SkeletonCards } from '../../components/Skeleton';
import ConfirmDialog from '../../components/ConfirmDialog';
import AdminNotesPanel from '../../components/admin/AdminNotesPanel';
import AdminActionHistory from '../../components/admin/AdminActionHistory';
import CreateTicketButton from '../../components/admin/CreateTicketButton';
import CreateTaskButton from '../../components/admin/CreateTaskButton';
import { UploadDocumentModal } from './AdminDocumentsPage';
import { isTestAccount, TestBadge, filterBySearch, money, fmtDate, pct, downloadCsv, BUSINESS_STATUS_LABELS, INVOICE_STATUS_LABELS, DOCUMENT_TYPE_LABELS, DOCUMENT_EXPIRY_LABELS } from './adminUtils';
import { useLanguage } from '../../context/LanguageContext';

export default function AdminRestaurantsPage() {
  const { t: tr } = useLanguage();
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
      toast(status === 'approved' ? tr('adminRestos.toastApproved') : status === 'blocked' ? 'Restaurant suspendu.' : tr('adminCommon.toastStatusUpdated'));
    } catch (e) {
      toast(e.message);
    }
  }

  function askSuspend(r) {
    setConfirmAction({ title: `Suspendre ${r.name} ?`, message: tr('adminRestos.suspendBody'), danger: true, run: () => setStatus(r.id, 'blocked') });
  }
  function askReactivate(r) {
    setConfirmAction({ title: tr('adminRestos.confirmReactivate', { name: r.name }), run: () => setStatus(r.id, 'approved') });
  }
  async function deleteRestaurant(r) {
    const res = await api(`/admin/restaurants/${r.id}`, { method: 'DELETE', token, body: { deleteOwner: true } });
    setRestaurants((prev) => prev.filter((x) => x.id !== r.id));
    if (selected?.id === r.id) { setSelected(null); setDetail(null); }
    toast(res.ownerDeleted ? tr('adminRestos.toastDeletedWithOwner', { n: res.deletedOrders, email: res.ownerEmail || '' }) : tr('adminRestos.toastDeleted', { n: res.deletedOrders }));
  }
  function askDelete(r) {
    setConfirmAction({ title: tr('adminRestos.confirmDelete', { name: r.name }), message: tr('adminRestos.deleteBody', { email: r.ownerEmail || '' }), danger: true, run: () => deleteRestaurant(r).catch((e) => toast(e.message)) });
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
    if (!restaurants || !restaurants.length) { toast(tr('adminCommon.nothingToExport')); return; }
    downloadCsv(`restaurants-${Date.now()}.csv`, restaurants, [
      { label: 'Nom', get: (r) => r.name },
      { label: 'Commune', get: (r) => r.commune },
      { label: 'Cuisine', get: (r) => r.cuisine },
      { label: 'Statut', get: (r) => r.businessStatus },
      { label: 'Responsable', get: (r) => r.responsibleName },
      { label: 'Email', get: (r) => r.ownerEmail },
      { label: tr('adminCommon.phone'), get: (r) => r.ownerPhone },
      { label: tr('adminRestos.companyNumber'), get: (r) => r.companyNumber },
      { label: 'TVA', get: (r) => r.vatNumber },
      { label: 'Commandes', get: (r) => r.orderCount },
      { label: 'CA', get: (r) => r.revenue },
      { label: tr('adminRestos.commissionGenerated'), get: (r) => r.commissionGenerated },
      { label: 'Panier moyen', get: (r) => r.avgBasket },
      { label: "Taux d'annulation", get: (r) => r.cancellationRate },
      { label: "Taux d'acceptation", get: (r) => r.acceptanceRate },
      { label: tr('adminRestos.colAvgPrep'), get: (r) => r.avgPrepMinutes }
    ]);
  }

  const filtered = filterBySearch(restaurants, search, (r) => [r.name, r.commune, r.cuisine, r.ownerEmail]);

  return (
    <div>
      <h2 className="section-title" style={{ marginTop: 0 }}>{tr('adminRestos.title')}</h2>
      <div className="row" style={{ marginBottom: 14, gap: 8 }}>
        <input placeholder={tr('adminRestos.phSearch')} value={search} onChange={(e) => setSearch(e.target.value)} style={{ flex: 1 }} />
        <button className="btn-outline" onClick={exportCsv}>{tr('adminCommon.csv')}</button>
      </div>
      {!restaurants && <SkeletonCards count={3} />}
      {restaurants && filtered.length === 0 && <div className="empty">{tr('adminCommon.noResults')}</div>}
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
            <div className="small">{tr('adminRestos.ownerLine', { name: r.responsibleName || r.ownerEmail, phone: r.phone ? ` · ${r.phone}` : '' })}</div>
            {(r.companyNumber || r.vatNumber) && <div className="small">{tr('adminRestos.companyNumber')} {r.companyNumber || '—'} · TVA {r.vatNumber || '—'}</div>}
            <div className="small">
              {tr('adminRestos.statsLine', { n: r.orderCount, revenue: money(r.revenue), commission: money(r.commissionGenerated), basket: money(r.avgBasket) })}
            </div>
            <div className="small">
              {tr('adminRestos.ratesLine', { cancel: pct(r.cancellationRate), accept: pct(r.acceptanceRate), prep: r.avgPrepMinutes !== null ? tr('adminRestos.prepMinutes', { n: r.avgPrepMinutes }) : tr('adminRestos.prepNotMeasured') })}
            </div>
            <div className="row" style={{ gap: 8, marginTop: 8 }} onClick={(e) => e.stopPropagation()}>
              {r.adminStatus !== 'approved' && <button className="btn-teal" style={{ padding: '6px 14px', fontSize: 13 }} onClick={() => setStatus(r.id, 'approved')}>{tr('adminCommon.approve')}</button>}
              {r.adminStatus !== 'blocked' && <button className="btn-danger-ghost" style={{ padding: '6px 14px', fontSize: 13 }} onClick={() => askSuspend(r)}>{tr('adminCommon.suspend')}</button>}
              {r.adminStatus === 'blocked' && <button className="btn-teal" style={{ padding: '6px 14px', fontSize: 13 }} onClick={() => askReactivate(r)}>{tr('adminCommon.reactivate')}</button>}
              <button className="btn-danger-ghost" style={{ padding: '6px 14px', fontSize: 13, marginLeft: 'auto' }} onClick={() => askDelete(r)}>{tr('adminRestos.deleteRestaurant')}</button>
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
          onDelete={() => askDelete(detail)}
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

function RestaurantDetailModal({ selected, detail, orders, onClose, onSuspend, onReactivate, onDelete, onChanged }) {
  const { t: tr } = useLanguage();
  const { token } = useAuth();
  const toast = useToast();
  const [editing, setEditing] = useState(false);
  const [form, setForm] = useState(null);
  const [saving, setSaving] = useState(false);
  const [invoices, setInvoices] = useState(null);
  const [crmProspect, setCrmProspect] = useState(null);
  const [documents, setDocuments] = useState(null);
  const [showUploadDoc, setShowUploadDoc] = useState(false);

  function loadDocuments() {
    setDocuments(null);
    api(`/admin/documents?targetType=restaurant&targetId=${selected.id}&limit=10`, { token }).then((r) => setDocuments(r.rows)).catch(() => setDocuments([]));
  }

  useEffect(() => {
    setInvoices(null);
    api(`/admin/invoices?restaurantId=${selected.id}&limit=5`, { token }).then((r) => setInvoices(r.rows)).catch(() => setInvoices([]));
    setCrmProspect(null);
    api(`/admin/crm/prospects?restaurantId=${selected.id}&limit=1`, { token }).then((r) => setCrmProspect(r.rows[0] || null)).catch(() => {});
    loadDocuments();
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
      toast(tr('adminRestos.toastUpdated'));
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
          <a href={`/restaurants/${selected.id}`} target="_blank" rel="noreferrer" className="small">{tr('adminRestos.viewPage')}</a>
        </div>
        {!detail && <div className="small">{tr('adminCommon.loading')}</div>}
        {detail && !editing && (
          <>
            <p className="small" style={{ margin: '2px 0' }}>{detail.commune}{detail.neighborhood ? ` (${detail.neighborhood})` : ''} · {detail.cuisine} · {detail.rating.toFixed(1)}★</p>
            <p className="small" style={{ margin: '2px 0' }}>📍 {[detail.addressStreet, detail.addressNumber].filter(Boolean).join(' ')}{detail.addressCity ? `, ${detail.addressPostalCode} ${detail.addressCity}` : ''}</p>
            <p className="small" style={{ margin: '2px 0' }}>{tr('adminRestos.ownerEmailLine', { name: detail.responsibleName || '—', email: detail.email, phone: detail.phone ? ` · ${detail.phone}` : '' })}</p>
            <p className="small" style={{ margin: '2px 0' }}>{tr('adminRestos.legalLine', { legal: detail.legalName || '—', n: detail.companyNumber || '—', vat: detail.vatNumber || '—' })}</p>
            <p className="small" style={{ margin: '2px 0' }}>{tr('adminRestos.subscriptionLine', { sub: detail.subscriptionStatus, mode: detail.deliveryMode })}</p>
            <p className="small" style={{ margin: '2px 0' }}>{tr('adminCommon.registeredOnDate', { date: fmtDate(detail.createdAt) })}</p>
            <button className="btn-outline" style={{ marginTop: 6 }} onClick={startEdit}>{tr('adminRestos.editInfo')}</button>
            <div className="divider" />
            <div className="row" style={{ justifyContent: 'space-between' }}><span className="small">{tr('adminCommon.paidOrders')}</span><b className="small">{detail.orderCount}</b></div>
            <div className="row" style={{ justifyContent: 'space-between' }}><span className="small">{tr('adminRestos.foodRevenue')}</span><b className="small">{money(detail.revenue)}</b></div>
            <div className="row" style={{ justifyContent: 'space-between' }}><span className="small">{tr('adminRestos.commissionGenerated')}</span><b className="small">{money(detail.commissionGenerated)}</b></div>
            <div className="row" style={{ justifyContent: 'space-between' }}><span className="small">{tr('adminRestos.netDue')}</span><b className="small">{money(detail.netAmountDue)}</b></div>
            <div className="row" style={{ justifyContent: 'space-between' }}><span className="small">{tr('adminRestos.refundsCharged')}</span><b className="small">{money(detail.refundsTotal)}</b></div>
            <div className="row" style={{ justifyContent: 'space-between' }}><span className="small">{tr('adminCommon.avgBasket')}</span><b className="small">{money(detail.avgBasket)}</b></div>
            <div className="row" style={{ justifyContent: 'space-between' }}><span className="small">{tr('adminCommon.cancellationRate')}</span><b className="small">{pct(detail.cancellationRate)}</b></div>
            <div className="row" style={{ justifyContent: 'space-between' }}><span className="small">{tr('adminRestos.acceptanceRate')}</span><b className="small">{pct(detail.acceptanceRate)}</b></div>
            <div className="row" style={{ justifyContent: 'space-between' }}><span className="small">{tr('adminRestos.avgPrepTime')}</span><b className="small">{detail.avgPrepMinutes !== null ? tr('adminRestos.minutes', { n: detail.avgPrepMinutes }) : tr('adminCommon.notMeasured')}</b></div>
            <div className="row" style={{ gap: 8, marginTop: 10 }}>
              {detail.adminStatus !== 'blocked' && <button className="btn-danger-ghost" onClick={onSuspend}>{tr('adminCommon.suspend')}</button>}
              {detail.adminStatus === 'blocked' && <button className="btn-teal" onClick={onReactivate}>{tr('adminCommon.reactivate')}</button>}
              <button className="btn-danger-ghost" style={{ marginLeft: 'auto' }} onClick={onDelete}>{tr('adminRestos.deleteRestaurant')}</button>
            </div>
            <div className="divider" />
            <h4 style={{ margin: '0 0 6px' }}>{tr('adminCommon.recentOrders')}</h4>
            {!orders && <div className="small">{tr('adminCommon.loading')}</div>}
            {orders && orders.length === 0 && <div className="small">{tr('adminCommon.noOrdersYet')}</div>}
            {orders && orders.map((o) => (
              <div key={o.id} className="row" style={{ justifyContent: 'space-between', padding: '4px 0' }}>
                <span className="small">{o.clientName}{o.driverName ? tr('adminRestos.deliveredBySuffix', { name: o.driverName }) : ''}</span>
                <span className={`status-badge status-${o.status}`}>{o.status}</span>
              </div>
            ))}
            {crmProspect && (
              <>
                <div className="divider" />
                <div className="row" style={{ justifyContent: 'space-between', alignItems: 'center' }}>
                  <h4 style={{ margin: '0 0 6px' }}>{tr('adminRestos.commercialOrigin')}</h4>
                  <Link to="/admin/crm" state={{ presetSearch: crmProspect.name }} className="small">{tr('adminRestos.viewInCrm')}</Link>
                </div>
                <div className="small">{tr('adminRestos.crmOwnerLine', { owner: crmProspect.ownerEmail || '—', source: crmProspect.source || '—' })}</div>
                <div className="small">{tr('adminRestos.convertedOn', { date: fmtDate(crmProspect.convertedAt) })}</div>
              </>
            )}
            <div className="divider" />
            <div className="row" style={{ justifyContent: 'space-between', alignItems: 'center' }}>
              <h4 style={{ margin: '0 0 6px' }}>{tr('adminRestos.invoices')}</h4>
              <Link to="/admin/invoices" state={{ restaurantId: selected.id }} className="small">{tr('adminRestos.seeAll')}</Link>
            </div>
            {!invoices && <div className="small">{tr('adminCommon.loading')}</div>}
            {invoices && invoices.length === 0 && <div className="small">{tr('adminRestos.noInvoices')}</div>}
            {invoices && invoices.map((inv) => (
              <div key={inv.id} className="row" style={{ justifyContent: 'space-between', padding: '2px 0' }}>
                <span className="small" style={{ fontFamily: 'monospace' }}>{inv.invoiceNumber}</span>
                <span className="small">{money(inv.totalTtc)} · <span style={{ color: INVOICE_STATUS_LABELS[inv.status]?.color }}>{INVOICE_STATUS_LABELS[inv.status]?.label}</span></span>
              </div>
            ))}
            <div className="divider" />
            <div className="row" style={{ justifyContent: 'space-between', alignItems: 'center' }}>
              <h4 style={{ margin: '0 0 6px' }}>{tr('adminCommon.documents')}</h4>
              <button className="btn-ghost" style={{ padding: '2px 8px', fontSize: 12 }} onClick={() => setShowUploadDoc(true)}>{tr('adminCommon.add')}</button>
            </div>
            {!documents && <div className="small">{tr('adminCommon.loading')}</div>}
            {documents && documents.length === 0 && <div className="small">{tr('adminCommon.noDocuments')}</div>}
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
                presetTargetType="restaurant" presetTargetId={selected.id} presetTargetLabel={detail.name}
                onClose={() => setShowUploadDoc(false)} onUploaded={() => { setShowUploadDoc(false); loadDocuments(); }}
              />
            )}
            <div className="divider" />
            <div className="row" style={{ gap: 8 }}>
              <CreateTicketButton linkType="linkedRestaurantId" linkId={selected.id} label={detail.name} />
              <CreateTaskButton targetType="restaurant" targetId={selected.id} label={detail.name} />
            </div>
            <div className="divider" />
            <AdminNotesPanel targetType="restaurant" targetId={selected.id} notes={detail.notes} onAdded={onChanged} />
            <div className="divider" />
            <AdminActionHistory actions={detail.actions} />
          </>
        )}
        {detail && editing && form && (
          <div>
            <div className="field"><label>{tr('adminCommon.name')}</label><input value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} /></div>
            <div className="field"><label>{tr('adminCommon.municipality')}</label><input value={form.commune} onChange={(e) => setForm({ ...form, commune: e.target.value })} /></div>
            <div className="field"><label>{tr('adminCommon.owner')}</label><input value={form.responsibleName} onChange={(e) => setForm({ ...form, responsibleName: e.target.value })} /></div>
            <div className="field"><label>{tr('adminRestos.legalName')}</label><input value={form.legalName} onChange={(e) => setForm({ ...form, legalName: e.target.value })} /></div>
            <div className="row" style={{ gap: 8 }}>
              <div className="field" style={{ flex: 1 }}><label>{tr('adminRestos.companyNumber')}</label><input value={form.companyNumber} onChange={(e) => setForm({ ...form, companyNumber: e.target.value })} /></div>
              <div className="field" style={{ flex: 1 }}><label>TVA</label><input value={form.vatNumber} onChange={(e) => setForm({ ...form, vatNumber: e.target.value })} /></div>
            </div>
            <div className="row" style={{ gap: 8 }}>
              <button className="btn-teal" disabled={saving} onClick={saveEdit}>{saving ? '...' : 'Enregistrer'}</button>
              <button className="btn-ghost" onClick={() => setEditing(false)}>{tr('adminCommon.cancel')}</button>
            </div>
          </div>
        )}
        <button className="btn-ghost" style={{ marginTop: 12 }} onClick={onClose}>{tr('adminCommon.close')}</button>
      </div>
    </div>,
    document.body
  );
}
