import { useEffect, useMemo, useState } from 'react';
import { api } from '../../api';
import { useAuth } from '../../context/AuthContext';
import { useToast } from '../../context/ToastContext';
import { SkeletonCards } from '../../components/Skeleton';
import AdminPageHeader from '../../components/admin/AdminPageHeader';
import { fmtDate, filterBySearch, downloadCsv } from './adminUtils';
import { useLanguage } from '../../context/LanguageContext';

// Application Promotions : codes promo (solde offert au client, mois d'essai restaurateur), leur
// usage et leur activation. Extraite des Paramètres pour avoir sa place dans l'ERP, comme les autres
// applications — avec recherche, filtres et export.
const TYPES = ['client_balance', 'restaurant_trial_months'];

export default function AdminPromotionsPage() {
  const { t: tr } = useLanguage();
  const { token } = useAuth();
  const toast = useToast();
  const [codes, setCodes] = useState(null);
  const [search, setSearch] = useState('');
  const [filtre, setFiltre] = useState('all'); // all | active | inactive | exhausted
  const [type, setType] = useState('');
  const [form, setForm] = useState({ code: '', type: 'client_balance', value: '', maxUses: '' });
  const [creation, setCreation] = useState(false);
  const [ouvert, setOuvert] = useState(false);

  useEffect(() => { api('/admin/promo-codes', { token }).then(setCodes).catch((e) => toast(e.message)); }, [token]); // eslint-disable-line react-hooks/exhaustive-deps

  const filtres = useMemo(() => {
    let l = filterBySearch(codes || [], search, (p) => [p.code, p.type]);
    if (type) l = l.filter((p) => p.type === type);
    if (filtre === 'active') l = l.filter((p) => p.active && !(p.maxUses && p.usesCount >= p.maxUses));
    if (filtre === 'inactive') l = l.filter((p) => !p.active);
    if (filtre === 'exhausted') l = l.filter((p) => p.maxUses && p.usesCount >= p.maxUses);
    return l;
  }, [codes, search, filtre, type]);

  const stats = useMemo(() => {
    const l = codes || [];
    return {
      total: l.length,
      actifs: l.filter((p) => p.active).length,
      usages: l.reduce((s, p) => s + (p.usesCount || 0), 0),
      offert: l.filter((p) => p.type === 'client_balance').reduce((s, p) => s + (p.usesCount || 0) * Number(p.value || 0), 0)
    };
  }, [codes]);

  async function creer() {
    if (!form.code.trim() || !form.value) { toast(tr('adminSettings.toastCodeValue')); return; }
    setCreation(true);
    try {
      const created = await api('/admin/promo-codes', { method: 'POST', token, body: { code: form.code.trim().toUpperCase(), type: form.type, value: Number(form.value), maxUses: form.maxUses ? Number(form.maxUses) : undefined } });
      setCodes((prev) => [created, ...(prev || [])]);
      setForm({ code: '', type: 'client_balance', value: '', maxUses: '' });
      setOuvert(false);
      toast(tr('adminSettings.toastCodeCreated', { code: created.code }));
    } catch (e) { toast(e.message); } finally { setCreation(false); }
  }

  async function basculer(p) {
    try {
      const updated = await api(`/admin/promo-codes/${p.id}`, { method: 'PATCH', token, body: { active: !p.active } });
      setCodes((prev) => prev.map((x) => (x.id === p.id ? updated : x)));
    } catch (e) { toast(e.message); }
  }

  function exportCsv() {
    if (!filtres.length) { toast(tr('adminCommon.nothingToExport')); return; }
    downloadCsv(`codes-promo-${Date.now()}.csv`, filtres, [
      { label: tr('adminCommon.code'), get: (p) => p.code }, { label: tr('adminCommon.type'), get: (p) => p.type }, { label: tr('adminPromos.value'), get: (p) => p.value },
      { label: tr('adminPromos.uses'), get: (p) => p.usesCount }, { label: tr('adminSettings.maxUses'), get: (p) => p.maxUses || '' }, { label: tr('adminPromos.active'), get: (p) => (p.active ? 'oui' : 'non') }
    ]);
  }

  const libelleType = (v) => (v === 'client_balance' ? tr('adminPromos.typeClient') : tr('adminPromos.typeResto'));

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
      </div>

      {!codes && <SkeletonCards count={3} />}
      {codes && filtres.length === 0 && <div className="empty">{tr('adminSettings.noPromo')}</div>}
      {codes && filtres.length > 0 && (
        <div className="table-scroll">
          <table className="admin-table">
            <thead>
              <tr><th>{tr('adminCommon.code')}</th><th>{tr('adminCommon.type')}</th><th>{tr('adminPromos.value')}</th><th>{tr('adminPromos.uses')}</th><th>{tr('adminPromos.createdOn')}</th><th>{tr('adminCommon.status')}</th><th /></tr>
            </thead>
            <tbody>
              {filtres.map((p) => {
                const epuise = p.maxUses && p.usesCount >= p.maxUses;
                const part = p.maxUses ? Math.min(100, Math.round((p.usesCount / p.maxUses) * 100)) : null;
                return (
                  <tr key={p.id}>
                    <td><b style={{ fontFamily: 'monospace', fontSize: 14 }}>{p.code}</b></td>
                    <td><span className="pill teal">{libelleType(p.type)}</span></td>
                    <td>{p.type === 'client_balance' ? `${p.value} €` : tr('adminPromos.monthsValue', { n: p.value })}</td>
                    <td>
                      {p.usesCount}{p.maxUses ? ` / ${p.maxUses}` : ''}
                      {part !== null && <div className="admin-progress"><span style={{ width: `${part}%` }} /></div>}
                    </td>
                    <td className="small">{p.createdAt ? fmtDate(p.createdAt) : '—'}</td>
                    <td>
                      {epuise ? <span className="pill" style={{ color: 'var(--red)' }}>{tr('adminPromos.exhausted')}</span>
                        : p.active ? <span className="pill gold">{tr('adminPromos.active')}</span>
                        : <span className="pill">{tr('adminSettings.disabled')}</span>}
                    </td>
                    <td style={{ textAlign: 'right' }}>
                      <button className={p.active ? 'btn-danger-ghost' : 'btn-outline'} style={{ padding: '6px 12px', fontSize: 13 }} onClick={() => basculer(p)}>
                        {p.active ? tr('adminCommon.disable') : tr('adminPromos.enable')}
                      </button>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
