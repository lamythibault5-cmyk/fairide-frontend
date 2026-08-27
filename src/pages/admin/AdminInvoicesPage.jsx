import { useEffect, useState } from 'react';
import { createPortal } from 'react-dom';
import { useLocation } from 'react-router-dom';
import { api } from '../../api';
import { useAuth } from '../../context/AuthContext';
import { useToast } from '../../context/ToastContext';
import { SkeletonCards } from '../../components/Skeleton';
import ConfirmDialog from '../../components/admin/ConfirmDialog';
import { money, fmtDate, fmtDateTime, useDebouncedValue, downloadPdf, INVOICE_STATUS_LABELS, ACCOUNTING_ENTRY_TYPE_LABELS } from './adminUtils';

const TABS = ['Factures', 'Relevés livreurs'];
const PAGE_SIZE = 25;
const STATUS_FILTERS = [{ key: '', label: 'Tous' }, ...Object.entries(INVOICE_STATUS_LABELS).map(([key, v]) => ({ key, label: v.label }))];

function statusPill(status) {
  const s = INVOICE_STATUS_LABELS[status];
  return <span className="pill" style={{ color: s?.color }}>{s?.label || status}</span>;
}

export default function AdminInvoicesPage() {
  const { token } = useAuth();
  const toast = useToast();
  const location = useLocation();
  const [tab, setTab] = useState('Factures');
  const [restaurantFilter, setRestaurantFilter] = useState(location.state?.restaurantId || '');

  return (
    <div>
      <h2 className="section-title" style={{ marginTop: 0 }}>Factures</h2>
      <div className="role-pick" style={{ marginBottom: 14 }}>
        {TABS.map((t) => <div key={t} className={`chip${tab === t ? ' active' : ''}`} onClick={() => setTab(t)}>{t}</div>)}
      </div>
      {tab === 'Factures' && restaurantFilter && (
        <div className="row" style={{ gap: 8, alignItems: 'center', marginBottom: 10 }}>
          <span className="pill teal">Filtré sur ce restaurant</span>
          <button className="btn-ghost" style={{ padding: '2px 8px', fontSize: 12 }} onClick={() => setRestaurantFilter('')}>✕ Retirer le filtre</button>
        </div>
      )}
      {tab === 'Factures' && <InvoicesTab token={token} toast={toast} presetRestaurantId={restaurantFilter} />}
      {tab === 'Relevés livreurs' && <DriverStatementsTab token={token} toast={toast} />}
    </div>
  );
}

function InvoicesTab({ token, toast, presetRestaurantId }) {
  const [qInput, setQInput] = useState('');
  const q = useDebouncedValue(qInput, 350);
  const [status, setStatus] = useState('');
  const [page, setPage] = useState(0);
  const [data, setData] = useState(null);
  const [selectedId, setSelectedId] = useState(null);
  const [showGenerate, setShowGenerate] = useState(false);

  function load() {
    setData(null);
    const params = new URLSearchParams();
    if (q) params.set('q', q);
    if (status) params.set('status', status);
    if (presetRestaurantId) params.set('restaurantId', presetRestaurantId);
    params.set('limit', PAGE_SIZE);
    params.set('offset', page * PAGE_SIZE);
    api(`/admin/invoices?${params.toString()}`, { token }).then(setData).catch((e) => toast(e.message));
  }

  useEffect(load, [q, status, page, presetRestaurantId]); // eslint-disable-line react-hooks/exhaustive-deps
  useEffect(() => { setPage(0); }, [q, status]);

  return (
    <>
      <div className="row" style={{ gap: 8, marginBottom: 10, flexWrap: 'wrap' }}>
        <input placeholder="Chercher par n° de facture ou restaurant..." value={qInput} onChange={(e) => setQInput(e.target.value)} style={{ flex: 1, minWidth: 200 }} />
        <button className="btn-teal" onClick={() => setShowGenerate(true)}>+ Générer une facture</button>
      </div>
      <div className="role-pick" style={{ marginBottom: 14, flexWrap: 'wrap' }}>
        {STATUS_FILTERS.map((f) => <div key={f.key || 'all'} className={`chip${status === f.key ? ' active' : ''}`} onClick={() => setStatus(f.key)}>{f.label}</div>)}
      </div>

      {!data && <SkeletonCards count={4} />}
      {data && data.rows.length === 0 && <div className="empty">Aucune facture pour ce filtre.</div>}
      {data && data.rows.map((inv) => (
        <div className="card order-card-clickable" key={inv.id} onClick={() => setSelectedId(inv.id)}>
          <div className="row" style={{ justifyContent: 'space-between' }}>
            <b style={{ fontFamily: 'monospace' }}>{inv.invoiceNumber}</b>
            {statusPill(inv.status)}
          </div>
          <div className="small">{inv.restaurantName} · période {fmtDate(inv.periodStart)}</div>
          <div className="row" style={{ justifyContent: 'space-between', marginTop: 4 }}>
            <span className="small">HTVA {money(inv.subtotalHt)} + TVA {money(inv.vatAmount)}</span>
            <b className="small">{money(inv.totalTtc)}</b>
          </div>
          <div className="small" style={{ opacity: 0.6, marginTop: 2 }}>Émise le {fmtDateTime(inv.issuedAt)}</div>
        </div>
      ))}
      {data && data.total > PAGE_SIZE && (
        <div className="row" style={{ justifyContent: 'center', gap: 12, marginTop: 12 }}>
          <button className="btn-ghost" disabled={page === 0} onClick={() => setPage((p) => p - 1)}>← Précédent</button>
          <span className="small">Page {page + 1} / {Math.ceil(data.total / PAGE_SIZE)} ({data.total} factures)</span>
          <button className="btn-ghost" disabled={(page + 1) * PAGE_SIZE >= data.total} onClick={() => setPage((p) => p + 1)}>Suivant →</button>
        </div>
      )}

      {selectedId && <InvoiceDetailModal id={selectedId} onClose={() => setSelectedId(null)} onChanged={load} />}
      {showGenerate && <GenerateInvoiceModal onClose={() => setShowGenerate(false)} onGenerated={() => { setShowGenerate(false); load(); }} />}
    </>
  );
}

function GenerateInvoiceModal({ onClose, onGenerated }) {
  const { token } = useAuth();
  const toast = useToast();
  const [restaurants, setRestaurants] = useState(null);
  const [restaurantId, setRestaurantId] = useState('');
  const [month, setMonth] = useState(() => { const d = new Date(); return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`; });
  const [generating, setGenerating] = useState(false);

  useEffect(() => { api('/admin/restaurants', { token }).then(setRestaurants).catch((e) => toast(e.message)); }, []); // eslint-disable-line react-hooks/exhaustive-deps

  async function generate() {
    if (!restaurantId) { toast('Choisis un restaurant.'); return; }
    setGenerating(true);
    try {
      const inv = await api('/admin/invoices/generate', { method: 'POST', token, body: { restaurantId, month } });
      toast(`Facture ${inv.invoiceNumber} générée.`);
      onGenerated();
    } catch (e) {
      toast(e.message);
    } finally {
      setGenerating(false);
    }
  }

  return createPortal(
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal-box" onClick={(e) => e.stopPropagation()} style={{ maxWidth: 420 }}>
        <h3 style={{ margin: '0 0 8px' }}>Générer une facture de commission</h3>
        <p className="small" style={{ margin: '0 0 12px' }}>Si une facture existe déjà pour ce restaurant sur ce mois, elle sera simplement renvoyée (jamais renumérotée).</p>
        <div className="field">
          <label>Restaurant</label>
          <select value={restaurantId} onChange={(e) => setRestaurantId(e.target.value)}>
            <option value="">Choisir...</option>
            {restaurants && restaurants.map((r) => <option key={r.id} value={r.id}>{r.name}</option>)}
          </select>
        </div>
        <div className="field">
          <label>Mois</label>
          <input type="month" value={month} onChange={(e) => setMonth(e.target.value)} />
        </div>
        <div className="row" style={{ gap: 8, marginTop: 8 }}>
          <button className="btn-teal" disabled={generating} onClick={generate}>{generating ? '...' : 'Générer'}</button>
          <button className="btn-ghost" onClick={onClose}>Annuler</button>
        </div>
      </div>
    </div>,
    document.body
  );
}

function InvoiceDetailModal({ id, onClose, onChanged }) {
  const { token } = useAuth();
  const toast = useToast();
  const [inv, setInv] = useState(null);
  const [busy, setBusy] = useState(false);
  const [confirmAction, setConfirmAction] = useState(null);
  const [creditNoteReason, setCreditNoteReason] = useState('');
  const [showCreditNoteForm, setShowCreditNoteForm] = useState(false);

  function load() {
    api(`/admin/invoices/${id}`, { token }).then(setInv).catch((e) => toast(e.message));
  }
  useEffect(load, [id]); // eslint-disable-line react-hooks/exhaustive-deps

  async function changeStatus(status) {
    setBusy(true);
    try {
      await api(`/admin/invoices/${id}/status`, { method: 'PATCH', token, body: { status } });
      toast('Statut mis à jour.');
      load(); onChanged();
    } catch (e) {
      toast(e.message);
    } finally {
      setBusy(false);
    }
  }

  async function sendEmail() {
    setBusy(true);
    try {
      await api(`/admin/invoices/${id}/send`, { method: 'POST', token });
      toast('Facture envoyée par email.');
      load(); onChanged();
    } catch (e) {
      toast(e.message);
    } finally {
      setBusy(false);
    }
  }

  async function downloadInvoicePdf() {
    try {
      await downloadPdf(`/admin/invoices/${id}/pdf`, token, `${inv.invoiceNumber}.pdf`);
    } catch (e) {
      toast(e.message);
    }
  }

  async function createCreditNote() {
    if (!creditNoteReason.trim()) { toast('Motif requis.'); return; }
    setBusy(true);
    try {
      await api(`/admin/invoices/${id}/credit-note`, { method: 'POST', token, body: { reason: creditNoteReason.trim() } });
      toast('Note de crédit créée — facture annulée.');
      setShowCreditNoteForm(false); setCreditNoteReason('');
      load(); onChanged();
    } catch (e) {
      toast(e.message);
    } finally {
      setBusy(false);
      setConfirmAction(null);
    }
  }

  return createPortal(
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal-box" onClick={(e) => e.stopPropagation()} style={{ maxWidth: 560 }}>
        {!inv && <div className="small">Chargement...</div>}
        {inv && (
          <>
            <div className="row" style={{ justifyContent: 'space-between', alignItems: 'flex-start' }}>
              <h3 style={{ margin: '0 0 8px', fontFamily: 'monospace' }}>{inv.invoiceNumber}</h3>
              {statusPill(inv.status)}
            </div>
            <p className="small" style={{ margin: '2px 0' }}>{inv.restaurant.name} · période {fmtDate(inv.periodStart)} — {fmtDate(inv.periodEnd)}</p>
            <p className="small" style={{ margin: '2px 0' }}>Émise le {fmtDateTime(inv.issuedAt)}</p>
            {!inv.fairide.configured && (
              <p className="small" style={{ color: 'var(--red)' }}>⚠️ Identité légale Fairide non configurée côté serveur.</p>
            )}
            <div className="divider" />
            <h4 style={{ margin: '0 0 6px' }}>Commandes ({inv.items.length})</h4>
            {inv.items.map((o) => (
              <div key={o.id} className="row" style={{ justifyContent: 'space-between', padding: '2px 0' }}>
                <span className="small">{fmtDate(o.createdAt)} · #{o.id.slice(0, 8)}</span>
                <span className="small">{money(o.commission)}</span>
              </div>
            ))}
            <div className="divider" />
            <div className="row" style={{ justifyContent: 'space-between' }}><span className="small">Total HTVA</span><span className="small">{money(inv.subtotalHt)}</span></div>
            <div className="row" style={{ justifyContent: 'space-between' }}><span className="small">TVA ({(inv.vatRate * 100).toFixed(0)}%)</span><span className="small">{money(inv.vatAmount)}</span></div>
            <div className="row" style={{ justifyContent: 'space-between' }}><b className="small">Total TTC</b><b className="small">{money(inv.totalTtc)}</b></div>

            {inv.entries.length > 0 && (
              <>
                <div className="divider" />
                <h4 style={{ margin: '0 0 6px' }}>Écritures comptables liées</h4>
                {inv.entries.map((e) => (
                  <div key={e.id} className="row" style={{ justifyContent: 'space-between', padding: '2px 0' }}>
                    <span className="small">{ACCOUNTING_ENTRY_TYPE_LABELS[e.entryType] || e.entryType}</span>
                    <span className="small">{e.debit > 0 ? `-${money(e.debit)}` : money(e.credit)}</span>
                  </div>
                ))}
              </>
            )}

            {inv.creditNotes.length > 0 && (
              <>
                <div className="divider" />
                <h4 style={{ margin: '0 0 6px' }}>Notes de crédit</h4>
                {inv.creditNotes.map((cn) => (
                  <div key={cn.id} className="row" style={{ justifyContent: 'space-between', padding: '2px 0' }}>
                    <span className="small" style={{ fontFamily: 'monospace' }}>{cn.creditNoteNumber}</span>
                    <div className="row" style={{ gap: 8 }}>
                      <span className="small" style={{ color: 'var(--red)' }}>-{money(cn.totalTtc)}</span>
                      <button className="btn-ghost" style={{ padding: '2px 8px', fontSize: 11 }} onClick={() => downloadPdf(`/admin/credit-notes/${cn.id}/pdf`, token, `${cn.creditNoteNumber}.pdf`).catch((e) => toast(e.message))}>PDF</button>
                    </div>
                  </div>
                ))}
              </>
            )}

            <div className="divider" />
            <h4 style={{ margin: '0 0 6px' }}>Actions</h4>
            <div className="row" style={{ gap: 8, marginBottom: 8, flexWrap: 'wrap' }}>
              <button className="btn-outline" onClick={downloadInvoicePdf}>⬇️ PDF</button>
              <button className="btn-outline" disabled={busy} onClick={sendEmail}>✉️ Envoyer par email</button>
              {inv.status !== 'annulee' && inv.status !== 'payee' && (
                <button className="btn-outline" disabled={busy} onClick={() => changeStatus('payee')}>Marquer payée</button>
              )}
              {inv.status !== 'annulee' && inv.status !== 'en_retard' && (
                <button className="btn-outline" disabled={busy} onClick={() => changeStatus('en_retard')}>Marquer en retard</button>
              )}
            </div>
            {inv.status !== 'annulee' && (
              !showCreditNoteForm ? (
                <button className="btn-danger-ghost" onClick={() => setShowCreditNoteForm(true)}>Annuler (note de crédit)</button>
              ) : (
                <div className="row" style={{ gap: 8, flexWrap: 'wrap' }}>
                  <input placeholder="Motif de l'annulation" value={creditNoteReason} onChange={(e) => setCreditNoteReason(e.target.value)} style={{ flex: 1, minWidth: 180 }} />
                  <button className="btn-danger-ghost" onClick={() => setConfirmAction(true)}>Confirmer</button>
                  <button className="btn-ghost" onClick={() => { setShowCreditNoteForm(false); setCreditNoteReason(''); }}>Annuler</button>
                </div>
              )
            )}
          </>
        )}
        <button className="btn-ghost" style={{ marginTop: 12 }} onClick={onClose}>Fermer</button>
      </div>
      <ConfirmDialog
        open={!!confirmAction}
        title="Créer une note de crédit ?"
        message="La facture sera marquée annulée et une note de crédit du montant total sera émise. Cette action est définitive et tracée."
        danger
        loading={busy}
        onConfirm={createCreditNote}
        onCancel={() => setConfirmAction(null)}
      />
    </div>,
    document.body
  );
}

function DriverStatementsTab({ token, toast }) {
  const [page, setPage] = useState(0);
  const [data, setData] = useState(null);
  const [showGenerate, setShowGenerate] = useState(false);

  function load() {
    setData(null);
    const params = new URLSearchParams();
    params.set('limit', PAGE_SIZE);
    params.set('offset', page * PAGE_SIZE);
    api(`/admin/driver-statements?${params.toString()}`, { token }).then(setData).catch((e) => toast(e.message));
  }
  useEffect(load, [page]); // eslint-disable-line react-hooks/exhaustive-deps

  async function downloadStatementPdf(st) {
    try {
      await downloadPdf(`/admin/driver-statements/${st.id}/pdf`, token, `${st.statementNumber}.pdf`);
    } catch (e) {
      toast(e.message);
    }
  }

  return (
    <>
      <p className="small" style={{ margin: '0 0 10px', opacity: 0.7 }}>
        Documents informatifs — pas des factures au sens légal (livreurs indépendants, pas de TVA applicable). Voir InvoicesPage.jsx côté livreur.
      </p>
      <div className="row" style={{ justifyContent: 'flex-end', marginBottom: 10 }}>
        <button className="btn-teal" onClick={() => setShowGenerate(true)}>+ Générer un relevé</button>
      </div>
      {!data && <SkeletonCards count={3} />}
      {data && data.rows.length === 0 && <div className="empty">Aucun relevé.</div>}
      {data && data.rows.map((st) => (
        <div className="card" key={st.id}>
          <div className="row" style={{ justifyContent: 'space-between' }}>
            <b style={{ fontFamily: 'monospace' }}>{st.statementNumber}</b>
            <button className="btn-outline" style={{ padding: '4px 10px', fontSize: 12 }} onClick={() => downloadStatementPdf(st)}>⬇️ PDF</button>
          </div>
          <div className="small">{st.driverName} · période {fmtDate(st.periodStart)} · {st.deliveriesCount} livraison(s)</div>
          <div className="row" style={{ justifyContent: 'space-between', marginTop: 4 }}><span className="small">Émis le {fmtDateTime(st.issuedAt)}</span><b className="small">{money(st.totalAmount)}</b></div>
        </div>
      ))}
      {data && data.total > PAGE_SIZE && (
        <div className="row" style={{ justifyContent: 'center', gap: 12, marginTop: 12 }}>
          <button className="btn-ghost" disabled={page === 0} onClick={() => setPage((p) => p - 1)}>← Précédent</button>
          <span className="small">Page {page + 1} / {Math.ceil(data.total / PAGE_SIZE)}</span>
          <button className="btn-ghost" disabled={(page + 1) * PAGE_SIZE >= data.total} onClick={() => setPage((p) => p + 1)}>Suivant →</button>
        </div>
      )}
      {showGenerate && <GenerateStatementModal onClose={() => setShowGenerate(false)} onGenerated={() => { setShowGenerate(false); load(); }} />}
    </>
  );
}

function GenerateStatementModal({ onClose, onGenerated }) {
  const { token } = useAuth();
  const toast = useToast();
  const [drivers, setDrivers] = useState(null);
  const [driverId, setDriverId] = useState('');
  const [month, setMonth] = useState(() => { const d = new Date(); return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`; });
  const [generating, setGenerating] = useState(false);

  useEffect(() => { api('/admin/drivers', { token }).then(setDrivers).catch((e) => toast(e.message)); }, []); // eslint-disable-line react-hooks/exhaustive-deps

  async function generate() {
    if (!driverId) { toast('Choisis un livreur.'); return; }
    setGenerating(true);
    try {
      const st = await api('/admin/driver-statements/generate', { method: 'POST', token, body: { driverId, month } });
      toast(`Relevé ${st.statementNumber} généré.`);
      onGenerated();
    } catch (e) {
      toast(e.message);
    } finally {
      setGenerating(false);
    }
  }

  return createPortal(
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal-box" onClick={(e) => e.stopPropagation()} style={{ maxWidth: 420 }}>
        <h3 style={{ margin: '0 0 8px' }}>Générer un relevé de paiement livreur</h3>
        <div className="field">
          <label>Livreur</label>
          <select value={driverId} onChange={(e) => setDriverId(e.target.value)}>
            <option value="">Choisir...</option>
            {drivers && drivers.map((d) => <option key={d.id} value={d.id}>{d.name}</option>)}
          </select>
        </div>
        <div className="field">
          <label>Mois</label>
          <input type="month" value={month} onChange={(e) => setMonth(e.target.value)} />
        </div>
        <div className="row" style={{ gap: 8, marginTop: 8 }}>
          <button className="btn-teal" disabled={generating} onClick={generate}>{generating ? '...' : 'Générer'}</button>
          <button className="btn-ghost" onClick={onClose}>Annuler</button>
        </div>
      </div>
    </div>,
    document.body
  );
}
