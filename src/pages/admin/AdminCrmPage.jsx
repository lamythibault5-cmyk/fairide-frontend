import { useEffect, useMemo, useState } from 'react';
import { createPortal } from 'react-dom';
import { useLocation } from 'react-router-dom';
import { api } from '../../api';
import { useAuth } from '../../context/AuthContext';
import { useToast } from '../../context/ToastContext';
import { SkeletonCards } from '../../components/Skeleton';
import AdminNotesPanel from '../../components/admin/AdminNotesPanel';
import AdminActionHistory from '../../components/admin/AdminActionHistory';
import { fmtDate, filterBySearch, pct, CRM_STAGES, CRM_STAGE_LABELS, CRM_PRIORITY_LABELS } from './adminUtils';

const PERIOD_TYPES = [{ key: 'month', label: 'Mois' }, { key: 'quarter', label: 'Trimestre' }, { key: 'year', label: 'Année' }];

function currentMonthValue() {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
}

export default function AdminCrmPage() {
  const { token } = useAuth();
  const toast = useToast();
  const location = useLocation();
  const [prospects, setProspects] = useState(null);
  const [search, setSearch] = useState(location.state?.presetSearch || '');
  const [selectedId, setSelectedId] = useState(null);
  const [showCreate, setShowCreate] = useState(false);
  const [periodType, setPeriodType] = useState('month');
  const [month, setMonth] = useState(currentMonthValue());
  const [year, setYear] = useState(new Date().getFullYear());
  const [stats, setStats] = useState(null);
  const [pendingLossStage, setPendingLossStage] = useState(null); // { prospectId, prospectName }
  const [lossReason, setLossReason] = useState('');

  function load() {
    setProspects(null);
    api('/admin/crm/prospects?limit=500', { token }).then((r) => setProspects(r.rows)).catch((e) => toast(e.message));
  }
  useEffect(load, []); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    setStats(null);
    const params = new URLSearchParams();
    params.set('period', periodType);
    if (periodType === 'month') params.set('month', month);
    else params.set('year', year);
    api(`/admin/crm/stats?${params.toString()}`, { token }).then(setStats).catch((e) => toast(e.message));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [periodType, month, year]);

  const filtered = filterBySearch(prospects, search, (p) => [p.name, p.commune, p.cuisine, p.contactName, p.contactEmail, p.ownerEmail]);
  const linkedRestaurantIds = useMemo(() => new Set((prospects || []).filter((p) => p.convertedRestaurantId).map((p) => p.convertedRestaurantId)), [prospects]);

  async function changeStage(prospect, stage) {
    if (stage === 'perdu') { setPendingLossStage({ id: prospect.id, name: prospect.name }); setLossReason(''); return; }
    try {
      await api(`/admin/crm/prospects/${prospect.id}/stage`, { method: 'PATCH', token, body: { stage } });
      load();
    } catch (e) {
      toast(e.message);
    }
  }

  async function confirmLoss() {
    if (!lossReason.trim()) { toast('Motif requis.'); return; }
    try {
      await api(`/admin/crm/prospects/${pendingLossStage.id}/stage`, { method: 'PATCH', token, body: { stage: 'perdu', lossReason: lossReason.trim() } });
      setPendingLossStage(null);
      load();
    } catch (e) {
      toast(e.message);
    }
  }

  return (
    <div>
      <h2 className="section-title" style={{ marginTop: 0 }}>CRM Restaurants</h2>

      <div className="row" style={{ gap: 8, alignItems: 'center', marginBottom: 14, flexWrap: 'wrap' }}>
        <div className="role-pick" style={{ margin: 0 }}>
          {PERIOD_TYPES.map((p) => <div key={p.key} className={`chip${periodType === p.key ? ' active' : ''}`} onClick={() => setPeriodType(p.key)}>{p.label}</div>)}
        </div>
        {periodType === 'month' && <input type="month" value={month} onChange={(e) => setMonth(e.target.value)} style={{ maxWidth: 160 }} />}
        {periodType === 'year' && <input type="number" value={year} onChange={(e) => setYear(e.target.value)} style={{ maxWidth: 100 }} />}
      </div>

      {!stats && <SkeletonCards count={1} />}
      {stats && (
        <div className="stat-grid" style={{ marginBottom: 16 }}>
          <div className="stat-card highlight"><div className="num">{pct(stats.conversionRate, 1)}</div><div className="label">Taux de conversion</div></div>
          <div className="stat-card"><div className="num">{stats.avgDaysToConversion !== null ? `${stats.avgDaysToConversion} j` : '—'}</div><div className="label">Durée moyenne avant signature</div></div>
          <div className="stat-card"><div className="num">{stats.converted}</div><div className="label">Nouveaux partenaires (période)</div></div>
          <div className="stat-card"><div className="num">{stats.newProspects}</div><div className="label">Nouveaux prospects (période)</div></div>
        </div>
      )}

      {stats && stats.byOwner.length > 0 && (
        <div className="card" style={{ marginBottom: 16 }}>
          <h3 style={{ margin: '0 0 8px', fontSize: 15 }}>Performance commerciale</h3>
          {stats.byOwner.map((o) => (
            <div key={o.ownerEmail} className="row" style={{ justifyContent: 'space-between', padding: '3px 0' }}>
              <span className="small">{o.ownerEmail}</span>
              <span className="small">{o.converted} converti(s) / {o.total} prospect(s)</span>
            </div>
          ))}
        </div>
      )}

      <div className="row" style={{ gap: 8, marginBottom: 14 }}>
        <input placeholder="Chercher un prospect..." value={search} onChange={(e) => setSearch(e.target.value)} style={{ flex: 1 }} />
        <button className="btn-teal" onClick={() => setShowCreate(true)}>+ Nouveau prospect</button>
      </div>

      {!prospects && <SkeletonCards count={4} />}
      {prospects && (
        <div style={{ display: 'flex', gap: 12, overflowX: 'auto', paddingBottom: 8 }}>
          {CRM_STAGES.map((stage) => {
            const items = (filtered || []).filter((p) => p.stage === stage);
            return (
              <div key={stage} style={{ minWidth: 250, flex: '0 0 250px' }}>
                <div className="row" style={{ justifyContent: 'space-between', marginBottom: 8 }}>
                  <b style={{ fontSize: 13, textTransform: 'uppercase', opacity: 0.7 }}>{CRM_STAGE_LABELS[stage]}</b>
                  <span className="pill">{items.length}</span>
                </div>
                {items.map((p) => (
                  <div className="card" key={p.id} style={{ marginBottom: 8, cursor: 'pointer' }}>
                    <div onClick={() => setSelectedId(p.id)}>
                      <div className="row" style={{ justifyContent: 'space-between' }}>
                        <b style={{ fontSize: 13 }}>{p.name}</b>
                        <span className="small" style={{ color: CRM_PRIORITY_LABELS[p.priority]?.color }}>{CRM_PRIORITY_LABELS[p.priority]?.label}</span>
                      </div>
                      <div className="small">{[p.commune, p.cuisine].filter(Boolean).join(' · ')}</div>
                      {p.ownerEmail && <div className="small" style={{ opacity: 0.7 }}>👤 {p.ownerEmail}</div>}
                      {p.nextFollowUpAt && (
                        <div className="small" style={{ color: p.nextFollowUpAt < Date.now() ? 'var(--red)' : 'inherit' }}>
                          🔔 Relance {fmtDate(p.nextFollowUpAt)}
                        </div>
                      )}
                    </div>
                    <select
                      value={p.stage}
                      onChange={(e) => changeStage(p, e.target.value)}
                      onClick={(e) => e.stopPropagation()}
                      style={{ marginTop: 6, fontSize: 12, padding: '4px 6px' }}
                    >
                      {CRM_STAGES.map((s) => <option key={s} value={s}>{CRM_STAGE_LABELS[s]}</option>)}
                    </select>
                  </div>
                ))}
                {items.length === 0 && <div className="small" style={{ opacity: 0.4, padding: '4px 0' }}>—</div>}
              </div>
            );
          })}
        </div>
      )}

      {selectedId && (
        <ProspectDetailModal id={selectedId} onClose={() => setSelectedId(null)} onChanged={load} linkedRestaurantIds={linkedRestaurantIds} />
      )}
      {showCreate && <CreateProspectModal onClose={() => setShowCreate(false)} onCreated={() => { setShowCreate(false); load(); }} />}

      {pendingLossStage && createPortal(
        <div className="modal-overlay" onClick={() => setPendingLossStage(null)}>
          <div className="modal-box" onClick={(e) => e.stopPropagation()} style={{ maxWidth: 400 }}>
            <h3 style={{ margin: '0 0 8px' }}>Marquer "{pendingLossStage.name}" comme perdu ?</h3>
            <input placeholder="Motif de perte (requis)" value={lossReason} onChange={(e) => setLossReason(e.target.value)} autoFocus style={{ width: '100%' }} />
            <div className="row" style={{ gap: 8, marginTop: 10 }}>
              <button className="btn-danger-ghost" onClick={confirmLoss}>Marquer perdu</button>
              <button className="btn-ghost" onClick={() => setPendingLossStage(null)}>Annuler</button>
            </div>
          </div>
        </div>,
        document.body
      )}
    </div>
  );
}

function CreateProspectModal({ onClose, onCreated }) {
  const { token } = useAuth();
  const toast = useToast();
  const [form, setForm] = useState({ name: '', commune: '', cuisine: '', contactName: '', contactEmail: '', contactPhone: '', priority: 'medium', ownerEmail: '', source: '' });
  const [saving, setSaving] = useState(false);

  async function create() {
    if (!form.name.trim()) { toast('Nom requis.'); return; }
    setSaving(true);
    try {
      await api('/admin/crm/prospects', { method: 'POST', token, body: form });
      toast('Prospect créé.');
      onCreated();
    } catch (e) {
      toast(e.message);
    } finally {
      setSaving(false);
    }
  }

  return createPortal(
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal-box" onClick={(e) => e.stopPropagation()} style={{ maxWidth: 440 }}>
        <h3 style={{ margin: '0 0 10px' }}>Nouveau prospect</h3>
        <div className="field"><label>Nom du restaurant</label><input value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} /></div>
        <div className="row" style={{ gap: 8 }}>
          <div className="field" style={{ flex: 1 }}><label>Commune</label><input value={form.commune} onChange={(e) => setForm({ ...form, commune: e.target.value })} /></div>
          <div className="field" style={{ flex: 1 }}><label>Cuisine</label><input value={form.cuisine} onChange={(e) => setForm({ ...form, cuisine: e.target.value })} /></div>
        </div>
        <div className="field"><label>Contact</label><input placeholder="Nom du contact" value={form.contactName} onChange={(e) => setForm({ ...form, contactName: e.target.value })} /></div>
        <div className="row" style={{ gap: 8 }}>
          <div className="field" style={{ flex: 1 }}><label>Email</label><input value={form.contactEmail} onChange={(e) => setForm({ ...form, contactEmail: e.target.value })} /></div>
          <div className="field" style={{ flex: 1 }}><label>Téléphone</label><input value={form.contactPhone} onChange={(e) => setForm({ ...form, contactPhone: e.target.value })} /></div>
        </div>
        <div className="row" style={{ gap: 8 }}>
          <div className="field" style={{ flex: 1 }}>
            <label>Priorité</label>
            <select value={form.priority} onChange={(e) => setForm({ ...form, priority: e.target.value })}>
              <option value="low">Basse</option><option value="medium">Moyenne</option><option value="high">Haute</option>
            </select>
          </div>
          <div className="field" style={{ flex: 1 }}><label>Responsable commercial</label><input placeholder="email@fairide.be" value={form.ownerEmail} onChange={(e) => setForm({ ...form, ownerEmail: e.target.value })} /></div>
        </div>
        <div className="field"><label>Source</label><input placeholder="prospection, inbound..." value={form.source} onChange={(e) => setForm({ ...form, source: e.target.value })} /></div>
        <div className="row" style={{ gap: 8, marginTop: 8 }}>
          <button className="btn-teal" disabled={saving} onClick={create}>{saving ? '...' : 'Créer'}</button>
          <button className="btn-ghost" onClick={onClose}>Annuler</button>
        </div>
      </div>
    </div>,
    document.body
  );
}

function ProspectDetailModal({ id, onClose, onChanged, linkedRestaurantIds }) {
  const { token } = useAuth();
  const toast = useToast();
  const [p, setP] = useState(null);
  const [notes, setNotes] = useState(null);
  const [actions, setActions] = useState(null);
  const [editing, setEditing] = useState(false);
  const [form, setForm] = useState(null);
  const [saving, setSaving] = useState(false);
  const [showConvert, setShowConvert] = useState(false);
  const [restaurants, setRestaurants] = useState(null);
  const [convertRestaurantId, setConvertRestaurantId] = useState('');
  const [converting, setConverting] = useState(false);

  function load() {
    api(`/admin/crm/prospects/${id}`, { token }).then(setP).catch((e) => toast(e.message));
    api(`/admin/notes?targetType=crm_prospect&targetId=${id}`, { token }).then(setNotes).catch(() => {});
    api(`/admin/actions?targetType=crm_prospect&targetId=${id}`, { token }).then(setActions).catch(() => {});
  }
  useEffect(load, [id]); // eslint-disable-line react-hooks/exhaustive-deps

  function startEdit() {
    setForm({
      name: p.name, commune: p.commune || '', cuisine: p.cuisine || '', contactName: p.contactName || '',
      contactEmail: p.contactEmail || '', contactPhone: p.contactPhone || '', priority: p.priority,
      ownerEmail: p.ownerEmail || '', source: p.source || '', nextFollowUpAt: p.nextFollowUpAt ? new Date(p.nextFollowUpAt).toISOString().slice(0, 10) : ''
    });
    setEditing(true);
  }

  async function saveEdit() {
    setSaving(true);
    try {
      await api(`/admin/crm/prospects/${id}`, { method: 'PATCH', token, body: form });
      toast('Prospect mis à jour.');
      setEditing(false);
      load(); onChanged();
    } catch (e) {
      toast(e.message);
    } finally {
      setSaving(false);
    }
  }

  function openConvert() {
    setShowConvert(true);
    if (!restaurants) api('/admin/restaurants', { token }).then(setRestaurants).catch((e) => toast(e.message));
  }

  async function convert() {
    if (!convertRestaurantId) { toast('Choisis un restaurant.'); return; }
    setConverting(true);
    try {
      await api(`/admin/crm/prospects/${id}/convert`, { method: 'POST', token, body: { restaurantId: convertRestaurantId } });
      toast('Prospect converti en partenaire.');
      setShowConvert(false);
      load(); onChanged();
    } catch (e) {
      toast(e.message);
    } finally {
      setConverting(false);
    }
  }

  return createPortal(
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal-box" onClick={(e) => e.stopPropagation()} style={{ maxWidth: 560 }}>
        {!p && <div className="small">Chargement...</div>}
        {p && !editing && (
          <>
            <div className="row" style={{ justifyContent: 'space-between' }}>
              <h3 style={{ margin: '0 0 8px' }}>{p.name}</h3>
              <span className="pill">{CRM_STAGE_LABELS[p.stage]}</span>
            </div>
            <p className="small" style={{ margin: '2px 0' }}>{[p.commune, p.cuisine].filter(Boolean).join(' · ') || '—'}</p>
            <p className="small" style={{ margin: '2px 0' }}>Contact : {p.contactName || '—'}{p.contactEmail ? ` · ${p.contactEmail}` : ''}{p.contactPhone ? ` · ${p.contactPhone}` : ''}</p>
            <p className="small" style={{ margin: '2px 0' }}>Priorité : {CRM_PRIORITY_LABELS[p.priority]?.label} · Responsable : {p.ownerEmail || '—'} · Source : {p.source || '—'}</p>
            {p.nextFollowUpAt && <p className="small" style={{ margin: '2px 0' }}>🔔 Prochaine relance : {fmtDate(p.nextFollowUpAt)}</p>}
            {p.stage === 'perdu' && p.lossReason && <p className="small" style={{ margin: '2px 0', color: 'var(--red)' }}>Motif de perte : {p.lossReason}</p>}
            {p.convertedRestaurantId && <p className="small" style={{ margin: '2px 0' }}>✅ Converti en restaurant "{p.convertedRestaurantName}" le {fmtDate(p.convertedAt)}</p>}
            <p className="small" style={{ margin: '2px 0', opacity: 0.6 }}>Créé le {fmtDate(p.createdAt)}</p>
            <div className="row" style={{ gap: 8, marginTop: 8 }}>
              <button className="btn-outline" onClick={startEdit}>✏️ Modifier</button>
              {!p.convertedRestaurantId && <button className="btn-teal" onClick={openConvert}>Convertir en restaurant</button>}
            </div>

            <div className="divider" />
            <AdminNotesPanel targetType="crm_prospect" targetId={id} notes={notes} onAdded={load} showChannel />
            <div className="divider" />
            <AdminActionHistory actions={actions} />
          </>
        )}
        {p && editing && form && (
          <div>
            <div className="field"><label>Nom</label><input value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} /></div>
            <div className="row" style={{ gap: 8 }}>
              <div className="field" style={{ flex: 1 }}><label>Commune</label><input value={form.commune} onChange={(e) => setForm({ ...form, commune: e.target.value })} /></div>
              <div className="field" style={{ flex: 1 }}><label>Cuisine</label><input value={form.cuisine} onChange={(e) => setForm({ ...form, cuisine: e.target.value })} /></div>
            </div>
            <div className="field"><label>Contact</label><input value={form.contactName} onChange={(e) => setForm({ ...form, contactName: e.target.value })} /></div>
            <div className="row" style={{ gap: 8 }}>
              <div className="field" style={{ flex: 1 }}><label>Email</label><input value={form.contactEmail} onChange={(e) => setForm({ ...form, contactEmail: e.target.value })} /></div>
              <div className="field" style={{ flex: 1 }}><label>Téléphone</label><input value={form.contactPhone} onChange={(e) => setForm({ ...form, contactPhone: e.target.value })} /></div>
            </div>
            <div className="row" style={{ gap: 8 }}>
              <div className="field" style={{ flex: 1 }}>
                <label>Priorité</label>
                <select value={form.priority} onChange={(e) => setForm({ ...form, priority: e.target.value })}>
                  <option value="low">Basse</option><option value="medium">Moyenne</option><option value="high">Haute</option>
                </select>
              </div>
              <div className="field" style={{ flex: 1 }}><label>Responsable</label><input value={form.ownerEmail} onChange={(e) => setForm({ ...form, ownerEmail: e.target.value })} /></div>
            </div>
            <div className="row" style={{ gap: 8 }}>
              <div className="field" style={{ flex: 1 }}><label>Source</label><input value={form.source} onChange={(e) => setForm({ ...form, source: e.target.value })} /></div>
              <div className="field" style={{ flex: 1 }}><label>Prochaine relance</label><input type="date" value={form.nextFollowUpAt} onChange={(e) => setForm({ ...form, nextFollowUpAt: e.target.value })} /></div>
            </div>
            <div className="row" style={{ gap: 8 }}>
              <button className="btn-teal" disabled={saving} onClick={saveEdit}>{saving ? '...' : 'Enregistrer'}</button>
              <button className="btn-ghost" onClick={() => setEditing(false)}>Annuler</button>
            </div>
          </div>
        )}
        <button className="btn-ghost" style={{ marginTop: 12 }} onClick={onClose}>Fermer</button>
      </div>

      {showConvert && createPortal(
        <div className="modal-overlay" onClick={() => setShowConvert(false)}>
          <div className="modal-box" onClick={(e) => e.stopPropagation()} style={{ maxWidth: 400 }}>
            <h3 style={{ margin: '0 0 8px' }}>Convertir en restaurant</h3>
            <p className="small" style={{ margin: '0 0 10px' }}>Choisis le restaurant réellement inscrit correspondant à ce prospect.</p>
            <select value={convertRestaurantId} onChange={(e) => setConvertRestaurantId(e.target.value)}>
              <option value="">Choisir...</option>
              {restaurants && restaurants.filter((r) => !linkedRestaurantIds.has(r.id)).map((r) => <option key={r.id} value={r.id}>{r.name}</option>)}
            </select>
            <div className="row" style={{ gap: 8, marginTop: 10 }}>
              <button className="btn-teal" disabled={converting} onClick={convert}>{converting ? '...' : 'Convertir'}</button>
              <button className="btn-ghost" onClick={() => setShowConvert(false)}>Annuler</button>
            </div>
          </div>
        </div>,
        document.body
      )}
    </div>,
    document.body
  );
}
