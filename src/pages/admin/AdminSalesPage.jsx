import { useCallback, useEffect, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import { api } from '../../api';
import { useAuth } from '../../context/AuthContext';
import { useLanguage, getLocale } from '../../context/LanguageContext';
import { useToast } from '../../context/ToastContext';
import AdminPageHeader from '../../components/admin/AdminPageHeader';
import AdminDataTable, { useTableSort } from '../../components/admin/AdminDataTable';
import RecordDrawer, { DrawerRow } from '../../components/admin/RecordDrawer';
import ConfirmDialog from '../../components/ConfirmDialog';
import { ErrorCard } from '../../components/admin/AdminListTools';
import useEtatPage from '../../hooks/useEtatPage';
import '../../crm.css';

// Application « Sales » : les codes commerciaux (créés ici, donnés aux proches qui démarchent), les agents qui les
// ont activés, et tous les commerces démarchés avec leur étape et leur historique. Côté agent : pages/client/CrmPage.jsx.
// Serveur : routes/adminSales.js.
const TABS = ['codes', 'agents', 'prospects'];
const STAGES = ['a_contacter', 'contacte', 'interesse', 'rdv', 'inscrit', 'carte_en_ligne', 'actif', 'plus_tard', 'refuse'];
const STAGE_ICONES = { a_contacter: '📋', contacte: '📞', interesse: '💡', rdv: '📅', inscrit: '✍️', carte_en_ligne: '🍽️', actif: '✅', plus_tard: '⏳', refuse: '✖️' };
const KIND_ICONES = { visite: '🚶', appel: '📞', message: '💬', note: '📝', etape: '🔀' };

export default function AdminSalesPage() {
  const { t: tr } = useLanguage();
  const { token } = useAuth();
  const toast = useToast();
  const locale = getLocale();
  const [searchParams] = useSearchParams();
  const tabDemande = TABS.includes(searchParams.get('tab')) ? searchParams.get('tab') : null;
  const [onglet, setOnglet] = useEtatPage('onglet', tabDemande || 'codes', { forcer: !!tabDemande });
  const [stats, setStats] = useState(null);
  const [rafraichir, setRafraichir] = useState(0);
  useEffect(() => { api('/admin/sales/stats', { token }).then(setStats).catch(() => {}); }, [token, rafraichir]);
  const fmt = (ms) => (ms ? new Date(ms).toLocaleString(locale, { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' }) : '-');
  const stageLabel = (s) => `${STAGE_ICONES[s] || ''} ${tr(`sales.stage_${s}`)}`;
  const commun = { token, tr, toast, fmt, stageLabel, onChanged: () => setRafraichir((n) => n + 1) };

  return (
    <div>
      <AdminPageHeader module="sales" />
      {stats && (
        <div className="stat-grid">
          <div className="stat-card"><div className="num">{stats.codesActive}/{stats.codes}</div><div className="label">{tr('adminSales.statCodes')}</div></div>
          <div className="stat-card"><div className="num">{stats.agents}</div><div className="label">{tr('adminSales.statAgents')}</div></div>
          <div className="stat-card"><div className="num">{stats.prospects}</div><div className="label">{tr('adminSales.statProspects')}</div></div>
          <div className="stat-card"><div className="num">{stats.newThisWeek}</div><div className="label">{tr('adminSales.statWeek')}</div></div>
          <div className="stat-card highlight"><div className="num">{(stats.byStage.inscrit || 0) + (stats.byStage.carte_en_ligne || 0) + (stats.byStage.actif || 0)}</div><div className="label">{tr('adminSales.statSigned')}</div></div>
          <div className={`stat-card${stats.overdue > 0 ? ' crm-retard' : ''}`}><div className="num">{stats.overdue}</div><div className="label">{tr('adminSales.statOverdue')}</div></div>
        </div>
      )}
      <div className="role-pick" style={{ marginBottom: 14 }}>
        {TABS.map((k) => <button key={k} type="button" className={`chip${onglet === k ? ' active' : ''}`} onClick={() => setOnglet(k)}>{tr(`adminSales.tab_${k}`)}</button>)}
      </div>
      {onglet === 'codes' && <CodesTab {...commun} />}
      {onglet === 'agents' && <AgentsTab {...commun} onVoirProspects={() => setOnglet('prospects')} />}
      {onglet === 'prospects' && <ProspectsTab {...commun} retardInitial={searchParams.get('overdue') === '1'} />}
    </div>
  );
}

// ---------------------------------------------------------------------------------------------- codes
function CodesTab({ token, tr, toast, fmt, onChanged }) {
  const [codes, setCodes] = useState(null);
  const [erreur, setErreur] = useState(null);
  const [form, setForm] = useState({ label: '', code: '', maxUses: '' });
  const [envoi, setEnvoi] = useState(false);
  const { sort, toggle } = useTableSort('createdAt', 'desc');
  const charger = useCallback(() => { setErreur(null); api('/admin/sales/codes', { token }).then(setCodes).catch((e) => setErreur(e.message)); }, [token]);
  useEffect(charger, [charger]);

  async function creer(e) {
    e.preventDefault(); setEnvoi(true);
    try {
      const c = await api('/admin/sales/codes', { method: 'POST', token, body: { label: form.label, code: form.code || undefined, maxUses: form.maxUses === '' ? null : Number(form.maxUses) } });
      setForm({ label: '', code: '', maxUses: '' }); toast(tr('adminSales.toastCodeCreated', { code: c.code })); charger(); onChanged();
    } catch (err) { toast(err.message); } finally { setEnvoi(false); }
  }
  async function basculer(c) {
    try { await api(`/admin/sales/codes/${c.id}`, { method: 'PATCH', token, body: { active: !c.active } }); charger(); onChanged(); } catch (err) { toast(err.message); }
  }
  function copier(code) { navigator.clipboard?.writeText(code).then(() => toast(tr('adminSales.toastCopied'))).catch(() => {}); }

  const columns = [
    { key: 'code', label: tr('adminSales.colCode'), get: (c) => <span className={`sales-code${c.active ? '' : ' sales-inactif'}`}>{c.code}</span>, sortValue: (c) => c.code },
    { key: 'label', label: tr('adminSales.colLabel'), get: (c) => c.label || '-' },
    { key: 'usesCount', label: tr('adminSales.colUses'), get: (c) => `${c.usesCount}${c.maxUses ? ` / ${c.maxUses}` : ''}`, sortValue: (c) => c.usesCount, align: 'right' },
    { key: 'agentsCount', label: tr('adminSales.colAgents'), get: (c) => c.agentsCount, align: 'right' },
    { key: 'active', label: tr('adminSales.colStatus'), get: (c) => <span className={`pill ${c.active ? 'listing-on' : 'listing-off'}`}>{c.active ? tr('adminSales.active') : tr('adminSales.inactive')}</span>, sortValue: (c) => (c.active ? 1 : 0) },
    { key: 'createdAt', label: tr('adminSales.colCreated'), get: (c) => fmt(c.createdAt), sortValue: (c) => c.createdAt },
    { key: 'actions', label: '', get: (c) => (
      <span className="row" style={{ gap: 6 }}>
        <button type="button" className="btn-ghost" style={{ padding: '4px 8px', fontSize: 12 }} onClick={(e) => { e.stopPropagation(); copier(c.code); }}>{tr('adminSales.copy')}</button>
        <button type="button" className={c.active ? 'btn-danger-ghost' : 'btn-outline'} style={{ padding: '4px 8px', fontSize: 12 }} onClick={(e) => { e.stopPropagation(); basculer(c); }}>{c.active ? tr('adminSales.deactivate') : tr('adminSales.reactivate')}</button>
      </span>
    ) }
  ];
  return (
    <div>
      <form className="card" onSubmit={creer} style={{ marginBottom: 14 }}>
        <b>{tr('adminSales.newCodeTitle')}</b>
        <p className="small" style={{ margin: '4px 0 10px' }}>{tr('adminSales.newCodeHelp')}</p>
        <div className="row" style={{ gap: 8, flexWrap: 'wrap', alignItems: 'flex-end' }}>
          <div className="field" style={{ flex: '2 1 200px', margin: 0 }}><label htmlFor="sales-label">{tr('adminSales.fLabel')}</label><input id="sales-label" value={form.label} onChange={(e) => setForm({ ...form, label: e.target.value })} placeholder={tr('adminSales.fLabelPh')} /></div>
          <div className="field" style={{ flex: '1 1 160px', margin: 0 }}><label htmlFor="sales-code">{tr('adminSales.fCode')}</label><input id="sales-code" value={form.code} onChange={(e) => setForm({ ...form, code: e.target.value.toUpperCase() })} placeholder={tr('adminSales.fCodePh')} /></div>
          <div className="field" style={{ flex: '0 1 120px', margin: 0 }}><label htmlFor="sales-max">{tr('adminSales.fMaxUses')}</label><input id="sales-max" type="number" min="1" value={form.maxUses} onChange={(e) => setForm({ ...form, maxUses: e.target.value })} placeholder="∞" /></div>
          <button type="submit" className="btn-gold" disabled={envoi}>{envoi ? '…' : tr('adminSales.createCode')}</button>
        </div>
      </form>
      {erreur && <ErrorCard message={erreur} onRetry={charger} />}
      {codes && <AdminDataTable columns={columns} rows={codes} sort={sort} onSort={toggle} emptyLabel={tr('adminSales.noCodes')} />}
    </div>
  );
}

// ---------------------------------------------------------------------------------------------- agents
function AgentsTab({ token, tr, fmt }) {
  const [agents, setAgents] = useState(null);
  const [erreur, setErreur] = useState(null);
  const { sort, toggle } = useTableSort('activatedAt', 'desc');
  const charger = useCallback(() => { setErreur(null); api('/admin/sales/agents', { token }).then(setAgents).catch((e) => setErreur(e.message)); }, [token]);
  useEffect(charger, [charger]);
  const columns = [
    { key: 'name', label: tr('adminSales.colAgent'), get: (a) => <><b>{a.name}</b><br /><span className="small">{a.email}{a.phone ? ` · ${a.phone}` : ''}</span></>, sortValue: (a) => a.name },
    { key: 'code', label: tr('adminSales.colCode'), get: (a) => <span className="sales-code">{a.code || '-'}</span>, sortValue: (a) => a.code || '' },
    { key: 'prospects', label: tr('adminSales.colProspects'), get: (a) => a.prospects, align: 'right', sum: true },
    { key: 'signed', label: tr('adminSales.colSigned'), get: (a) => a.signed, align: 'right', sum: true },
    { key: 'active', label: tr('adminSales.colActiveRestos'), get: (a) => a.active, align: 'right', sum: true },
    { key: 'lastActivity', label: tr('adminSales.colLastActivity'), get: (a) => fmt(a.lastActivity), sortValue: (a) => a.lastActivity || 0 },
    { key: 'activatedAt', label: tr('adminSales.colActivated'), get: (a) => fmt(a.activatedAt), sortValue: (a) => a.activatedAt }
  ];
  return (
    <div>
      {erreur && <ErrorCard message={erreur} onRetry={charger} />}
      {agents && <AdminDataTable columns={columns} rows={agents} sort={sort} onSort={toggle} emptyLabel={tr('adminSales.noAgents')} showTotals />}
    </div>
  );
}

// ---------------------------------------------------------------------------------------------- prospects
function ProspectsTab({ token, tr, fmt, stageLabel, toast, retardInitial = false }) {
  const [rows, setRows] = useState(null);
  // « En retard » = prochaine action dépassée, hors commerces actifs ou refusés (même règle que /admin/overview).
  const [retard, setRetard] = useState(retardInitial);
  const enRetard = (p) => p.nextActionAt && p.nextActionAt < Date.now() && !['actif', 'refuse'].includes(p.stage);
  const [erreur, setErreur] = useState(null);
  const [stage, setStage] = useEtatPage('etapeProspects', '');
  const [q, setQ] = useState('');
  const [ouvert, setOuvert] = useState(null);
  const { sort, toggle } = useTableSort('updatedAt', 'desc');
  const charger = useCallback(() => {
    setErreur(null);
    const params = new URLSearchParams(); if (stage) params.set('stage', stage); if (q.trim()) params.set('q', q.trim());
    api(`/admin/sales/prospects?${params.toString()}`, { token }).then(setRows).catch((e) => setErreur(e.message));
  }, [token, stage, q]);
  useEffect(charger, [charger]);
  const columns = [
    { key: 'name', label: tr('adminSales.colProspect'), get: (p) => <><b>{p.name}</b>{p.commune ? <><br /><span className="small">{p.commune}</span></> : null}</>, sortValue: (p) => p.name },
    { key: 'stage', label: tr('adminSales.colStage'), get: (p) => <span className={`crm-badge crm-badge-${p.stage}`}>{stageLabel(p.stage)}</span>, sortValue: (p) => STAGES.indexOf(p.stage) },
    { key: 'agentName', label: tr('adminSales.colAgent'), get: (p) => p.agentName, sortValue: (p) => p.agentName },
    { key: 'rating', label: tr('adminSales.colRating'), get: (p) => (p.rating ? '★'.repeat(p.rating) : '-'), sortValue: (p) => p.rating || 0 },
    { key: 'eventsCount', label: tr('adminSales.colEvents'), get: (p) => p.eventsCount, align: 'right' },
    { key: 'lastEventAt', label: tr('adminSales.colLastActivity'), get: (p) => fmt(p.lastEventAt), sortValue: (p) => p.lastEventAt || 0 },
    { key: 'nextActionAt', label: tr('adminSales.colNextAction'), get: (p) => <span className={p.nextActionAt && p.nextActionAt < Date.now() ? 'crm-retard-texte' : ''}>{fmt(p.nextActionAt)}</span>, sortValue: (p) => p.nextActionAt || 0 },
    { key: 'restaurantName', label: tr('adminSales.colLinked'), get: (p) => p.restaurantName || '-' }
  ];
  return (
    <div>
      <div className="admin-control-panel">
        <div className="field" style={{ margin: 0, flex: '1 1 200px' }}><input type="search" value={q} onChange={(e) => setQ(e.target.value)} placeholder={tr('adminSales.searchPh')} aria-label={tr('adminSales.searchPh')} /></div>
        <div className="role-pick" style={{ flexWrap: 'wrap' }}>
          <button type="button" className={`chip${stage === '' ? ' active' : ''}`} onClick={() => setStage('')}>{tr('sales.allStages')}</button>
          {STAGES.map((s) => <button key={s} type="button" className={`chip${stage === s ? ' active' : ''}`} onClick={() => setStage(s)}>{stageLabel(s)}</button>)}
        </div>
        <button type="button" className={`chip${retard ? ' active' : ''}`} aria-pressed={retard} onClick={() => setRetard((v) => !v)}>⏰ {tr('adminSales.filterOverdue')}</button>
      </div>
      {erreur && <ErrorCard message={erreur} onRetry={charger} />}
      {rows && <AdminDataTable columns={columns} rows={retard ? rows.filter(enRetard) : rows} sort={sort} onSort={toggle} onRowClick={(p) => setOuvert(p.id)} emptyLabel={tr('adminSales.noProspects')} />}
      {ouvert && <ProspectDrawer id={ouvert} token={token} tr={tr} fmt={fmt} stageLabel={stageLabel} toast={toast} onClose={() => setOuvert(null)} />}
    </div>
  );
}

function ProspectDrawer({ id, token, tr, fmt, stageLabel, toast, onClose }) {
  const [p, setP] = useState(null);
  useEffect(() => { api(`/admin/sales/prospects/${id}`, { token }).then(setP).catch((e) => { toast(e.message); onClose(); }); }, [id, token, toast, onClose]);
  return (
    <RecordDrawer title={p?.name || '…'} subtitle={p ? `${tr('adminSales.colAgent')} : ${p.agentName} · ${p.agentEmail}` : ''} badge={p ? stageLabel(p.stage) : null} onClose={onClose} width={620}>
      {p && (
        <>
          <DrawerRow label={tr('sales.fAddress')} value={[p.address, p.commune].filter(Boolean).join(', ') || '-'} />
          <DrawerRow label={tr('sales.fContact')} value={[p.contactName, p.phone, p.email].filter(Boolean).join(' · ') || '-'} />
          <DrawerRow label={tr('sales.fCuisine')} value={p.cuisine || '-'} />
          <DrawerRow label={tr('sales.feedbackTitle')} value={`${p.rating ? '★'.repeat(p.rating) + ' ' : ''}${p.feedback || '-'}`} />
          <DrawerRow label={tr('sales.nextActionTitle')} value={fmt(p.nextActionAt)} />
          <DrawerRow label={tr('adminSales.colLinked')} value={p.restaurantName ? `${p.restaurantName} · ${tr(`sales.restoStatus_${p.restaurantStatus || 'pending'}`)}` : '-'} />
          {p.notes && <DrawerRow label={tr('sales.notesTitle')} value={<span style={{ whiteSpace: 'pre-wrap' }}>{p.notes}</span>} />}
          <h4 style={{ margin: '14px 0 6px' }}>{tr('sales.historyTitle')}</h4>
          {p.events.length === 0 ? <p className="small">{tr('sales.noEvents')}</p> : (
            <ol className="crm-historique">
              {p.events.map((e) => (
                <li key={e.id} style={{ gridTemplateColumns: '24px 1fr' }}>
                  <span className="crm-hist-ico" aria-hidden="true">{KIND_ICONES[e.kind]}</span>
                  <div>
                    <div className="small"><b>{tr(`sales.kind_${e.kind}`)}</b>{e.stage ? ` → ${stageLabel(e.stage)}` : ''} · {fmt(e.at)}</div>
                    {e.note && <div className="crm-hist-note">{e.note}</div>}
                  </div>
                </li>
              ))}
            </ol>
          )}
        </>
      )}
      <ConfirmDialog open={false} />
    </RecordDrawer>
  );
}
