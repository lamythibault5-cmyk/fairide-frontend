import { useEffect, useMemo, useState } from 'react';
import { createPortal } from 'react-dom';
import { Link } from 'react-router-dom';
import { api } from '../../api';
import { useAuth } from '../../context/AuthContext';
import { useToast } from '../../context/ToastContext';
import { SkeletonCards } from '../../components/Skeleton';
import ConfirmDialog from '../../components/ConfirmDialog';
import AdminPageHeader from '../../components/admin/AdminPageHeader';
import AdminDataTable, { useTableSort } from '../../components/admin/AdminDataTable';
import RecordDrawer, { DrawerRow } from '../../components/admin/RecordDrawer';
import { ErrorCard, ResultCount } from '../../components/admin/AdminListTools';
import { fmtDate, fmtDateTime, money, filterBySearch, downloadCsv } from './adminUtils';
import { useLanguage } from '../../context/LanguageContext';

// Application Promotions : codes promo (solde offert au client, mois d'essai restaurateur), leur
// usage et leur activation. Liste triable (AdminDataTable), fiche dans le tiroir commun (édition de la
// valeur / du plafond / de l'expiration, commandes qui ont utilisé le code), activation et suppression
// confirmées.
const TYPES = ['client_balance', 'restaurant_trial_months'];
const epuise = (p) => !!(p.maxUses && p.usesCount >= p.maxUses);
const expire = (p) => !!(p.expiresAt && p.expiresAt < Date.now());

export default function AdminPromotionsPage() {
  const { t: tr } = useLanguage();
  const { token } = useAuth();
  const toast = useToast();
  const [codes, setCodes] = useState(null);
  const [erreur, setErreur] = useState(null);
  const [search, setSearch] = useState('');
  const [filtre, setFiltre] = useState('all'); // all | active | inactive | exhausted
  const [type, setType] = useState('');
  const [form, setForm] = useState({ code: '', type: 'client_balance', value: '', maxUses: '', expiresAt: '' });
  const [creation, setCreation] = useState(false);
  const [ouvert, setOuvert] = useState(false);
  const [selected, setSelected] = useState(null);
  const [confirm, setConfirm] = useState(null); // { title, message, danger, run }
  const [busy, setBusy] = useState(false);
  const { sort, toggle } = useTableSort('createdAt');

  function load() { setErreur(null); api('/admin/promo-codes', { token }).then(setCodes).catch((e) => setErreur(e.message)); }
  useEffect(load, [token]); // eslint-disable-line react-hooks/exhaustive-deps

  const filtres = useMemo(() => {
    let l = filterBySearch(codes || [], search, (p) => [p.code, p.type]);
    if (type) l = l.filter((p) => p.type === type);
    if (filtre === 'active') l = l.filter((p) => p.active && !epuise(p) && !expire(p));
    if (filtre === 'inactive') l = l.filter((p) => !p.active);
    if (filtre === 'exhausted') l = l.filter((p) => epuise(p) || expire(p));
    return l;
  }, [codes, search, filtre, type]);

  const stats = useMemo(() => {
    const l = codes || [];
    return {
      total: l.length,
      actifs: l.filter((p) => p.active && !epuise(p) && !expire(p)).length,
      usages: l.reduce((s, p) => s + (p.usesCount || 0), 0),
      offert: l.filter((p) => p.type === 'client_balance').reduce((s, p) => s + (p.usesCount || 0) * Number(p.value || 0), 0)
    };
  }, [codes]);

  async function creer() {
    if (!form.code.trim() || !form.value) { toast(tr('adminSettings.toastCodeValue')); return; }
    setCreation(true);
    try {
      const created = await api('/admin/promo-codes', { method: 'POST', token, body: { code: form.code.trim().toUpperCase(), type: form.type, value: Number(form.value), maxUses: form.maxUses ? Number(form.maxUses) : undefined, expiresAt: form.expiresAt || undefined } });
      setCodes((prev) => [created, ...(prev || [])]);
      setForm({ code: '', type: 'client_balance', value: '', maxUses: '', expiresAt: '' });
      setOuvert(false);
      toast(tr('adminSettings.toastCodeCreated', { code: created.code }));
    } catch (e) { toast(e.message); } finally { setCreation(false); }
  }

  async function patch(p, body) {
    const updated = await api(`/admin/promo-codes/${p.id}`, { method: 'PATCH', token, body });
    setCodes((prev) => prev.map((x) => (x.id === p.id ? { ...x, ...updated } : x)));
    if (selected?.id === p.id) setSelected((s) => ({ ...s, ...updated }));
    return updated;
  }
  function askToggle(p) {
    setConfirm({ title: p.active ? tr('adminPromos.confirmDisable', { code: p.code }) : tr('adminPromos.confirmEnable', { code: p.code }), message: p.active ? tr('adminPromos.disableBody') : tr('adminPromos.enableBody'), danger: p.active, run: () => patch(p, { active: !p.active }).then(() => toast(tr('adminCommon.doneToast'))) });
  }
  function askDelete(p) {
    setConfirm({ title: tr('adminPromos.confirmDelete', { code: p.code }), message: tr('adminPromos.deleteBody'), danger: true, run: async () => { await api(`/admin/promo-codes/${p.id}`, { method: 'DELETE', token }); setCodes((prev) => prev.filter((x) => x.id !== p.id)); if (selected?.id === p.id) setSelected(null); toast(tr('adminPromos.toastDeleted')); } });
  }
  async function runConfirmed() {
    if (!confirm) return;
    setBusy(true);
    try { await confirm.run(); } catch (e) { toast(e.message); } finally { setBusy(false); setConfirm(null); }
  }

  function exportCsv() {
    if (!filtres.length) { toast(tr('adminCommon.nothingToExport')); return; }
    downloadCsv(`codes-promo-${Date.now()}.csv`, filtres, [
      { label: tr('adminCommon.code'), get: (p) => p.code }, { label: tr('adminCommon.type'), get: (p) => p.type }, { label: tr('adminPromos.value'), get: (p) => p.value },
      { label: tr('adminPromos.uses'), get: (p) => p.usesCount }, { label: tr('adminSettings.maxUses'), get: (p) => p.maxUses || '' }, { label: tr('adminPromos.expiresAt'), get: (p) => (p.expiresAt ? fmtDate(p.expiresAt) : '') }, { label: tr('adminPromos.active'), get: (p) => (p.active ? 'oui' : 'non') }
    ]);
  }

  const libelleType = (v) => (v === 'client_balance' ? tr('adminPromos.typeClient') : tr('adminPromos.typeResto'));
  const etat = (p) => (expire(p) ? <span className="pill" style={{ color: 'var(--red)' }}>{tr('adminPromos.expired')}</span> : epuise(p) ? <span className="pill" style={{ color: 'var(--red)' }}>{tr('adminPromos.exhausted')}</span> : p.active ? <span className="pill gold">{tr('adminPromos.active')}</span> : <span className="pill">{tr('adminSettings.disabled')}</span>);
  const colonnes = [
    { key: 'code', label: tr('adminCommon.code'), get: (p) => <b style={{ fontFamily: 'monospace', fontSize: 14 }}>{p.code}</b>, sortValue: (p) => p.code },
    { key: 'type', label: tr('adminCommon.type'), get: (p) => <span className="pill teal">{libelleType(p.type)}</span>, sortValue: (p) => p.type },
    { key: 'value', label: tr('adminPromos.value'), get: (p) => (p.type === 'client_balance' ? `${p.value} €` : tr('adminPromos.monthsValue', { n: p.value })), sortValue: (p) => p.value, align: 'right' },
    { key: 'usesCount', label: tr('adminPromos.uses'), get: (p) => { const part = p.maxUses ? Math.min(100, Math.round((p.usesCount / p.maxUses) * 100)) : null; return <>{p.usesCount}{p.maxUses ? ` / ${p.maxUses}` : ''}{part !== null && <div className="admin-progress"><span style={{ width: `${part}%` }} /></div>}</>; }, sortValue: (p) => p.usesCount, align: 'right', sum: true },
    { key: 'expiresAt', label: tr('adminPromos.expiresAt'), get: (p) => (p.expiresAt ? fmtDate(p.expiresAt) : '-'), sortValue: (p) => p.expiresAt || 9e15 },
    { key: 'createdAt', label: tr('adminPromos.createdOn'), get: (p) => (p.createdAt ? fmtDate(p.createdAt) : '-'), sortValue: (p) => p.createdAt || 0 },
    { key: 'status', label: tr('adminCommon.status'), get: etat, sortValue: (p) => (p.active ? 1 : 0) },
    { key: 'actions', label: tr('adminCommon.actions'), get: (p) => (
      <span className="row" style={{ gap: 6, justifyContent: 'flex-end' }} onClick={(e) => e.stopPropagation()}>
        <button className={p.active ? 'btn-danger-ghost' : 'btn-outline'} style={{ padding: '4px 10px', fontSize: 12 }} onClick={() => askToggle(p)}>{p.active ? tr('adminCommon.disable') : tr('adminPromos.enable')}</button>
        <button className="btn-danger-ghost" style={{ padding: '4px 10px', fontSize: 12 }} onClick={() => askDelete(p)}>{tr('adminCommon.delete')}</button>
      </span>
    ), sortValue: () => 0, align: 'right' }
  ];

  return (
    <div>
      <AdminPageHeader module="promotions" actions={
        <>
          <button className="btn-outline" onClick={exportCsv}>{tr('adminCommon.csv')}</button>
          <button className="btn-teal" onClick={() => setOuvert((v) => !v)}>{ouvert ? tr('adminCommon.cancel') : tr('adminPromos.newCode')}</button>
        </>
      } />

      <div className="stat-grid">
        <div className="stat-card highlight"><div className="num">{stats.actifs}</div><div className="label">{tr('adminPromos.statActive')}</div></div>
        <div className="stat-card"><div className="num">{stats.total}</div><div className="label">{tr('adminPromos.statTotal')}</div></div>
        <div className="stat-card"><div className="num">{stats.usages}</div><div className="label">{tr('adminPromos.statUses')}</div></div>
        <div className="stat-card"><div className="num">{stats.offert.toFixed(0)} €</div><div className="label">{tr('adminPromos.statOffered')}</div></div>
      </div>

      {ouvert && (
        <div className="card">
          <h3 style={{ margin: '0 0 10px', fontSize: 15 }}>{tr('adminSettings.createPromo')}</h3>
          <div className="row" style={{ gap: 8 }}>
            <div className="field" style={{ flex: 1 }}>
              <label htmlFor="promo-code">{tr('adminCommon.code')}</label>
              <input id="promo-code" value={form.code} onChange={(e) => setForm({ ...form, code: e.target.value })} placeholder={tr('adminSettings.phPromoCode')} />
            </div>
            <div className="field" style={{ flex: 1 }}>
              <label htmlFor="promo-type">{tr('adminCommon.type')}</label>
              <select id="promo-type" value={form.type} onChange={(e) => setForm({ ...form, type: e.target.value })}>
                {TYPES.map((v) => <option key={v} value={v}>{libelleType(v)}</option>)}
              </select>
            </div>
          </div>
          <div className="row" style={{ gap: 8 }}>
            <div className="field" style={{ flex: 1 }}>
              <label htmlFor="promo-value">{tr('adminSettings.valueUnit', { unit: form.type === 'client_balance' ? '€' : tr('adminSettings.months') })}</label>
              <input id="promo-value" type="number" step="1" value={form.value} onChange={(e) => setForm({ ...form, value: e.target.value })} placeholder={form.type === 'client_balance' ? '20' : '2'} />
            </div>
            <div className="field" style={{ flex: 1 }}>
              <label htmlFor="promo-max">{tr('adminSettings.maxUses')}</label>
              <input id="promo-max" type="number" step="1" value={form.maxUses} onChange={(e) => setForm({ ...form, maxUses: e.target.value })} placeholder={tr('adminSettings.phUnlimited')} />
            </div>
            <div className="field" style={{ flex: 1 }}>
              <label htmlFor="promo-exp">{tr('adminPromos.expiresAtOptional')}</label>
              <input id="promo-exp" type="date" value={form.expiresAt} onChange={(e) => setForm({ ...form, expiresAt: e.target.value })} />
            </div>
          </div>
          <button className="btn-teal" disabled={creation} onClick={creer}>{creation ? '...' : tr('adminSettings.createCode')}</button>
        </div>
      )}

      <div className="admin-control-panel">
        <input placeholder={tr('adminPromos.phSearch')} value={search} onChange={(e) => setSearch(e.target.value)} style={{ flex: 1, minWidth: 180 }} />
        <div className="role-pick" style={{ margin: 0 }}>
          {[['all', tr('adminCommon.allF')], ['active', tr('adminPromos.filterActive')], ['inactive', tr('adminPromos.filterInactive')], ['exhausted', tr('adminPromos.filterExhausted')]].map(([k, l]) => (
            <div key={k} className={`chip${filtre === k ? ' active' : ''}`} onClick={() => setFiltre(k)}>{l}</div>
          ))}
        </div>
        <select value={type} onChange={(e) => setType(e.target.value)} style={{ maxWidth: 220 }}>
          <option value="">{tr('adminPromos.allTypes')}</option>
          {TYPES.map((v) => <option key={v} value={v}>{libelleType(v)}</option>)}
        </select>
        <ResultCount n={filtres.length} total={(codes || []).length} />
      </div>

      {erreur && <ErrorCard message={erreur} onRetry={load} />}
      {!codes && !erreur && <SkeletonCards count={3} />}
      {codes && filtres.length === 0 && <div className="empty">{tr('adminSettings.noPromo')}</div>}
      {codes && filtres.length > 0 && (
        <AdminDataTable columns={colonnes} rows={filtres} sort={sort} onSort={toggle} onRowClick={setSelected} showTotals emptyLabel={tr('adminSettings.noPromo')} />
      )}

      {selected && <PromoDrawer p={selected} onClose={() => setSelected(null)} onPatch={(body) => patch(selected, body)} onToggle={() => askToggle(selected)} onDelete={() => askDelete(selected)} libelleType={libelleType} etat={etat} />}
      <ConfirmDialog open={!!confirm} title={confirm?.title} message={confirm?.message} danger={confirm?.danger} loading={busy} onConfirm={runConfirmed} onCancel={() => setConfirm(null)} />
    </div>
  );
}

// Fiche d'un code : Infos (édition de la valeur, du plafond, de l'expiration) et Commandes (celles qui
// l'ont utilisé, GET /admin/promo-codes/:id/orders).
function PromoDrawer({ p, onClose, onPatch, onToggle, onDelete, libelleType, etat }) {
  const { t: tr } = useLanguage();
  const { token } = useAuth();
  const toast = useToast();
  const [onglet, setOnglet] = useState('infos');
  const [form, setForm] = useState({ value: p.value, maxUses: p.maxUses || '', expiresAt: p.expiresAt ? new Date(p.expiresAt).toISOString().slice(0, 10) : '' });
  const [saving, setSaving] = useState(false);
  const [orders, setOrders] = useState(null);
  const [ordersErr, setOrdersErr] = useState(null);

  useEffect(() => { setForm({ value: p.value, maxUses: p.maxUses || '', expiresAt: p.expiresAt ? new Date(p.expiresAt).toISOString().slice(0, 10) : '' }); }, [p.id, p.value, p.maxUses, p.expiresAt]);
  useEffect(() => {
    if (onglet !== 'commandes' || orders) return;
    setOrdersErr(null);
    api(`/admin/promo-codes/${p.id}/orders`, { token }).then((r) => setOrders(Array.isArray(r) ? r : (r?.rows || []))).catch((e) => setOrdersErr(e.message));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [onglet, p.id]);

  async function save() {
    setSaving(true);
    try {
      const body = { value: Number(form.value), maxUses: form.maxUses === '' ? null : Number(form.maxUses) };
      if (form.expiresAt || p.expiresAt) body.expiresAt = form.expiresAt || null;
      await onPatch(body);
      toast(tr('adminPromos.toastUpdated'));
    } catch (e) { toast(e.message); } finally { setSaving(false); }
  }

  return createPortal(
    <RecordDrawer
      title={p.code} subtitle={libelleType(p.type)} badge={etat(p)}
      tabs={[{ key: 'infos', label: tr('adminCommon.tabOverview') }, { key: 'commandes', label: tr('adminCommon.tabOrders'), count: orders ? orders.length : (p.usesCount ?? null) }]}
      tab={onglet} onTab={setOnglet} onClose={onClose} width={560}
      actions={<><button className={p.active ? 'btn-danger-ghost' : 'btn-outline'} style={{ padding: '6px 10px', fontSize: 12 }} onClick={onToggle}>{p.active ? tr('adminCommon.disable') : tr('adminPromos.enable')}</button><button className="btn-danger-ghost" style={{ padding: '6px 10px', fontSize: 12 }} onClick={onDelete}>{tr('adminCommon.delete')}</button></>}
    >
      {onglet === 'infos' && (
        <>
          <DrawerRow label={tr('adminPromos.uses')} value={`${p.usesCount}${p.maxUses ? ` / ${p.maxUses}` : ''}`} strong />
          <DrawerRow label={tr('adminPromos.createdOn')} value={p.createdAt ? fmtDate(p.createdAt) : '-'} />
          {p.type === 'client_balance' && <DrawerRow label={tr('adminPromos.statOffered')} value={money((p.usesCount || 0) * Number(p.value || 0))} />}
          <div className="divider" />
          <h4 className="drawer-section-title">{tr('adminCommon.edit')}</h4>
          <div className="row" style={{ gap: 8 }}>
            <div className="field" style={{ flex: 1 }}><label>{tr('adminSettings.valueUnit', { unit: p.type === 'client_balance' ? '€' : tr('adminSettings.months') })}</label><input type="number" step="1" value={form.value} onChange={(e) => setForm({ ...form, value: e.target.value })} /></div>
            <div className="field" style={{ flex: 1 }}><label>{tr('adminSettings.maxUses')}</label><input type="number" step="1" value={form.maxUses} onChange={(e) => setForm({ ...form, maxUses: e.target.value })} placeholder={tr('adminSettings.phUnlimited')} /></div>
            <div className="field" style={{ flex: 1 }}><label>{tr('adminPromos.expiresAtOptional')}</label><input type="date" value={form.expiresAt} onChange={(e) => setForm({ ...form, expiresAt: e.target.value })} /></div>
          </div>
          <p className="small" style={{ opacity: 0.7, margin: '0 0 8px' }}>{tr('adminPromos.editHint')}</p>
          <button className="btn-teal" disabled={saving} onClick={save}>{saving ? '...' : tr('adminCommon.save')}</button>
        </>
      )}
      {onglet === 'commandes' && (
        <>
          {ordersErr && <ErrorCard message={ordersErr} onRetry={() => { setOrders(null); setOrdersErr(null); }} />}
          {!orders && !ordersErr && <div className="small">{tr('adminCommon.loading')}</div>}
          {orders && orders.length === 0 && <div className="small">{tr('adminPromos.noOrders')}</div>}
          {orders && orders.map((o) => (
            <DrawerRow key={o.id} label={<Link to={`/admin/orders?q=${encodeURIComponent(o.clientName || o.clientEmail || o.id)}`} className="admin-record-link">{fmtDateTime(o.createdAt)} · {o.clientName || o.clientEmail || o.id}{o.restaurantName ? ` · ${o.restaurantName}` : ''}</Link>} value={o.total !== undefined ? money(o.total) : (o.amount !== undefined ? money(o.amount) : '')} />
          ))}
        </>
      )}
    </RecordDrawer>,
    document.body
  );
}
