import { useEffect, useState } from 'react';
import { api } from '../../../api';
import { useAuth } from '../../../context/AuthContext';
import { useToast } from '../../../context/ToastContext';
import { useLanguage } from '../../../context/LanguageContext';
import { money, fmtDateTime, useDebouncedValue, ORDER_STATUS_LABELS } from '../adminUtils';
import { INCIDENT_TYPES, RESPONSIBILITIES, PRIORITIES, typeLabel, respLabel, priorityLabel } from './labels';

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

// Formulaire « Nouvel incident » : on cherche d'abord la commande (identifiant, nom du client, du
// restaurant… via GET /admin/orders?q=), puis on qualifie l'incident. `onCreated(incident)` reçoit la
// fiche créée pour l'ouvrir directement.
export default function NewIncidentForm({ onCreated, onCancel, presetOrderId = '' }) {
  const { t: tr } = useLanguage();
  const { token } = useAuth();
  const toast = useToast();
  const [q, setQ] = useState(presetOrderId);
  const qd = useDebouncedValue(q, 300);
  const [resultats, setResultats] = useState(null);
  const [cherche, setCherche] = useState(false);
  const [commande, setCommande] = useState(null);
  const [form, setForm] = useState({ type: 'complaint', responsibility: 'unknown', priority: 'normal', amount: '', description: '' });
  const [busy, setBusy] = useState(false);
  const set = (k) => (e) => setForm((f) => ({ ...f, [k]: e.target.value }));

  // Recherche de commandes (max 8) dès 3 caractères ; un identifiant complet est accepté tel quel même
  // si la recherche échoue (ancien serveur, commande hors de la fenêtre de liste…).
  useEffect(() => {
    const terme = qd.trim();
    if (commande || terme.length < 3) { setResultats(null); return undefined; }
    let actif = true;
    setCherche(true);
    api(`/admin/orders?q=${encodeURIComponent(terme)}&limit=8`, { token })
      .then((d) => { if (actif) setResultats(Array.isArray(d) ? d : (d?.rows || [])); })
      .catch(() => { if (actif) setResultats([]); })
      .finally(() => { if (actif) setCherche(false); });
    return () => { actif = false; };
  }, [qd, commande, token]);

  function choisir(o) { setCommande(o); setQ(o.id); setResultats(null); }
  function changer() { setCommande(null); setQ(''); }

  const orderId = commande ? commande.id : q.trim();
  const valide = UUID_RE.test(orderId) && form.description.trim().length > 0;

  async function creer() {
    if (!valide) return;
    setBusy(true);
    try {
      const inc = await api('/admin/incidents', { method: 'POST', token, body: { orderId, type: form.type, responsibility: form.responsibility, priority: form.priority, amount: form.amount === '' ? null : Number(form.amount), description: form.description.trim() } });
      toast(tr('adminIncidents.toastCreated'));
      onCreated(inc);
    } catch (e) { toast(e.message); } finally { setBusy(false); }
  }

  return (
    <div className="card inc-new-card">
      <h3 style={{ marginTop: 0 }}>{tr('adminIncidents.newIncident')}</h3>
      <p className="small" style={{ marginTop: 0 }}>{tr('adminIncidents.newIncidentHelp')}</p>
      {commande ? (
        <div className="inc-order-picked">
          <div>
            <b>#{String(commande.id).slice(0, 8)}</b> · {commande.restaurantName} → {commande.clientName}
            <div className="small">{ORDER_STATUS_LABELS[commande.status] || commande.status} · {money(commande.total)} · {fmtDateTime(commande.createdAt)}</div>
          </div>
          <button type="button" className="btn-ghost" onClick={changer}>{tr('adminIncidents.changeOrder')}</button>
        </div>
      ) : (
        <div className="field inc-order-search">
          <label>{tr('adminIncidents.orderSearch')}</label>
          <input value={q} onChange={(e) => setQ(e.target.value)} placeholder={tr('adminIncidents.orderSearchPlaceholder')} autoFocus autoComplete="off" />
          {(cherche || (resultats && resultats.length > 0) || (resultats && resultats.length === 0 && !UUID_RE.test(q.trim()))) && (
            <div className="inc-order-results">
              {cherche && <button type="button" disabled><span className="small">{tr('adminCommon.loading')}</span></button>}
              {!cherche && resultats && resultats.length === 0 && <button type="button" disabled><span className="small">{tr('adminIncidents.noOrderFound')}</span></button>}
              {!cherche && (resultats || []).map((o) => (
                <button type="button" key={o.id} onClick={() => choisir(o)}>
                  <span><b>#{String(o.id).slice(0, 8)}</b> · {o.restaurantName} → {o.clientName}<br /><span className="small">{ORDER_STATUS_LABELS[o.status] || o.status} · {fmtDateTime(o.createdAt)}</span></span>
                  <b>{money(o.total)}</b>
                </button>
              ))}
            </div>
          )}
          {!commande && q.trim() && UUID_RE.test(q.trim()) && <p className="small" style={{ margin: '4px 0 0', opacity: 0.7 }}>{tr('adminIncidents.orderIdAccepted')}</p>}
        </div>
      )}
      <div className="inc-form-grid">
        <div className="field">
          <label>{tr('adminCommon.type')}</label>
          <select value={form.type} onChange={set('type')}>{INCIDENT_TYPES.map((t) => <option key={t} value={t}>{typeLabel(tr, t)}</option>)}</select>
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
          <label>{tr('adminIncidents.amountEur')} <span className="small">({tr('adminCommon.optional')})</span></label>
          <input type="number" min="0" step="0.01" value={form.amount} onChange={set('amount')} placeholder="0.00" />
        </div>
        <div className="field full">
          <label>{tr('adminIncidents.description')}</label>
          <textarea rows={4} value={form.description} onChange={set('description')} placeholder={tr('adminIncidents.descriptionPlaceholder')} />
        </div>
      </div>
      <div className="inc-form-actions">
        <button type="button" className="btn-gold" disabled={!valide || busy} onClick={creer}>{busy ? '...' : tr('adminIncidents.createIncident')}</button>
        <button type="button" className="btn-ghost" onClick={onCancel}>{tr('adminCommon.cancel')}</button>
      </div>
    </div>
  );
}
