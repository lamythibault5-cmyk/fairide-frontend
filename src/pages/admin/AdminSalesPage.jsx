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
import CrmMap, { distanceM } from '../../components/CrmMap';
import '../../crm.css';

// Application « Sales » : les commerciaux (des comptes clients auxquels l'admin donne l'accès ici — pas de code à
// distribuer) et tous les commerces démarchés avec leur étape et leur historique. Côté agent : pages/client/CrmPage.jsx.
// Serveur : routes/adminSales.js.
const TABS = ['agents', 'prospects'];
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
  const [onglet, setOnglet] = useEtatPage('onglet', tabDemande || 'agents', { forcer: !!tabDemande });
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
      {onglet === 'agents' && <AgentsTab {...commun} />}
      {onglet === 'prospects' && <ProspectsTab {...commun} retardInitial={searchParams.get('overdue') === '1'} />}
    </div>
  );
}

// ---------------------------------------------------------------------------------------------- commerciaux
// L'admin choisit ici quels comptes clients deviennent commerciaux : il cherche le compte (nom ou e-mail), clique
// « Donner l'accès », et la rubrique « CRM commerçants » apparaît dans le Mon compte de cette personne. « Retirer
// l'accès » sur la ligne la referme ; ses commerces démarchés restent visibles dans l'onglet suivant.
function AgentsTab({ token, tr, fmt, toast, onChanged }) {
  const [agents, setAgents] = useState(null);
  const [erreur, setErreur] = useState(null);
  const [q, setQ] = useState('');
  const [resultats, setResultats] = useState(null);
  const [label, setLabel] = useState('');
  const [aRetirer, setARetirer] = useState(null);
  const { sort, toggle } = useTableSort('activatedAt', 'desc');
  const charger = useCallback(() => { setErreur(null); api('/admin/sales/agents', { token }).then(setAgents).catch((e) => setErreur(e.message)); }, [token]);
  useEffect(charger, [charger]);

  // Recherche d'un compte client (nom ou e-mail), avec un léger délai pour ne pas interroger à chaque frappe.
  useEffect(() => {
    const terme = q.trim();
    if (terme.length < 2) { setResultats(null); return undefined; }
    const id = setTimeout(() => {
      api(`/admin/users?role=client&search=${encodeURIComponent(terme)}`, { token })
        .then((rows) => setResultats(rows.filter((u) => !u.isDeleted).slice(0, 8)))
        .catch(() => setResultats([]));
    }, 250);
    return () => clearTimeout(id);
  }, [q, token]);
  const estAgent = (u) => !!agents?.some((a) => a.userId === u.id);

  async function donner(u) {
    try {
      await api('/admin/sales/agents', { method: 'POST', token, body: { userId: u.id, label } });
      toast(tr('adminSales.toastAgentAdded', { name: u.name })); setQ(''); setResultats(null); setLabel(''); charger(); onChanged();
    } catch (err) { toast(err.message); }
  }
  async function retirer() {
    const a = aRetirer; setARetirer(null);
    try { await api(`/admin/sales/agents/${a.userId}`, { method: 'DELETE', token }); toast(tr('adminSales.toastAgentRemoved', { name: a.name })); charger(); onChanged(); } catch (err) { toast(err.message); }
  }

  const columns = [
    { key: 'name', label: tr('adminSales.colAgent'), get: (a) => <><b>{a.name}</b><br /><span className="small">{a.email}{a.phone ? ` · ${a.phone}` : ''}</span></>, sortValue: (a) => a.name },
    { key: 'label', label: tr('adminSales.colLabel'), get: (a) => a.label || '-', sortValue: (a) => a.label },
    { key: 'prospects', label: tr('adminSales.colProspects'), get: (a) => a.prospects, align: 'right', sum: true },
    { key: 'signed', label: tr('adminSales.colSigned'), get: (a) => a.signed, align: 'right', sum: true },
    { key: 'active', label: tr('adminSales.colActiveRestos'), get: (a) => a.active, align: 'right', sum: true },
    { key: 'lastActivity', label: tr('adminSales.colLastActivity'), get: (a) => fmt(a.lastActivity), sortValue: (a) => a.lastActivity || 0 },
    { key: 'activatedAt', label: tr('adminSales.colActivated'), get: (a) => fmt(a.activatedAt), sortValue: (a) => a.activatedAt },
    { key: 'actions', label: '', get: (a) => (
      <button type="button" className="btn-danger-ghost" style={{ padding: '4px 8px', fontSize: 12 }} onClick={(e) => { e.stopPropagation(); setARetirer(a); }}>{tr('adminSales.removeAccess')}</button>
    ) }
  ];
  return (
    <div>
      <div className="card" style={{ marginBottom: 14 }}>
        <b>{tr('adminSales.addAgentTitle')}</b>
        <p className="small" style={{ margin: '4px 0 10px' }}>{tr('adminSales.addAgentHelp')}</p>
        <div className="row" style={{ gap: 8, flexWrap: 'wrap', alignItems: 'flex-end' }}>
          <div className="field" style={{ flex: '2 1 220px', margin: 0 }}><label htmlFor="sales-user">{tr('adminSales.fUser')}</label><input id="sales-user" value={q} onChange={(e) => setQ(e.target.value)} placeholder={tr('adminSales.fUserPh')} autoComplete="off" /></div>
          <div className="field" style={{ flex: '1 1 160px', margin: 0 }}><label htmlFor="sales-label">{tr('adminSales.fLabel')}</label><input id="sales-label" value={label} onChange={(e) => setLabel(e.target.value)} placeholder={tr('adminSales.fLabelPh')} /></div>
        </div>
        {resultats && (resultats.length === 0
          ? <p className="small" style={{ margin: '10px 0 0' }}>{tr('adminSales.noUserFound')}</p>
          : (
            <ul className="sales-resultats">
              {resultats.map((u) => (
                <li key={u.id}>
                  <span><b>{u.name}</b> <span className="small">{u.email}</span></span>
                  {estAgent(u)
                    ? <span className="pill listing-on">{tr('adminSales.alreadyAgent')}</span>
                    : <button type="button" className="btn-teal" style={{ padding: '6px 12px', fontSize: 13 }} onClick={() => donner(u)}>{tr('adminSales.giveAccess')}</button>}
                </li>
              ))}
            </ul>
          ))}
      </div>
      {erreur && <ErrorCard message={erreur} onRetry={charger} />}
      {agents && <AdminDataTable columns={columns} rows={agents} sort={sort} onSort={toggle} emptyLabel={tr('adminSales.noAgents')} showTotals />}
      <ConfirmDialog open={!!aRetirer} danger title={tr('adminSales.confirmRemoveTitle')} message={aRetirer ? tr('adminSales.confirmRemoveText', { name: aRetirer.name }) : ''} confirmLabel={tr('adminSales.removeAccess')} onConfirm={retirer} onCancel={() => setARetirer(null)} />
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
  // Carte de tous les commerciaux : zones (avec total et détail par commercial), zone choisie, carte repliée ou non.
  const [zones, setZones] = useState([]);
  const [zoneActive, setZoneActive] = useEtatPage('zoneProspects', null);
  const [carteVisible, setCarteVisible] = useState(() => { try { return localStorage.getItem('admin_sales_carte') !== 'off'; } catch { return true; } });
  const basculerCarte = () => setCarteVisible((v) => { try { localStorage.setItem('admin_sales_carte', v ? 'off' : 'on'); } catch { /* sans stockage */ } return !v; });
  const { sort, toggle } = useTableSort('updatedAt', 'desc');
  const charger = useCallback(() => {
    setErreur(null);
    const params = new URLSearchParams(); if (stage) params.set('stage', stage); if (q.trim()) params.set('q', q.trim());
    api(`/admin/sales/prospects?${params.toString()}`, { token }).then(setRows).catch((e) => setErreur(e.message));
    api('/admin/sales/zones', { token }).then(setZones).catch(() => {});
  }, [token, stage, q]);
  useEffect(charger, [charger]);
  const zone = zones.find((z) => z.key === zoneActive) || null;
  // Lignes affichées : filtre « en retard », puis rayon de la zone choisie (les commerces sans position restent, on ne sait pas où ils sont).
  const lignesRetard = (rows || []).filter((p) => !retard || enRetard(p));
  const lignes = lignesRetard.filter((p) => !zone || p.lat === null || p.lat === undefined || distanceM(zone.lat, zone.lng, p.lat, p.lng) <= zone.radius);
  const zoneTooltip = (z) => `${tr('adminSales.zoneTotal', { n: z.total })}${z.agents?.length ? ` · ${z.agents.map((a) => `${a.name} ${a.n}`).join(', ')}` : ''}`;
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
      <div className="card crm-carte-carte">
        <div className="crm-carte-tete">
          <div>
            <b>{tr('adminSales.mapTitle')}</b>
            <p className="small" style={{ margin: '2px 0 0' }}>{tr('adminSales.mapIntro')}</p>
          </div>
          <button type="button" className="btn-ghost" style={{ padding: '4px 8px', fontSize: 13 }} onClick={basculerCarte}>{carteVisible ? tr('sales.mapHide') : tr('sales.mapShow')}</button>
        </div>
        {carteVisible && (
          <>
            <CrmMap prospects={lignesRetard} zones={zones} zoneActive={zoneActive} ouvert={ouvert} stageIcones={STAGE_ICONES} onOpen={setOuvert} onZone={setZoneActive} legende={{ mine: tr('adminSales.mapLegendAll'), others: null }} zoneTooltip={zoneTooltip} height={400} />
            <div className="crm-zones">
              <b className="crm-bloc-titre" style={{ marginTop: 10 }}>{tr('sales.zonesTitle')}</b>
              <div className="role-pick crm-filtres">
                <button type="button" className={`chip${!zoneActive ? ' active' : ''}`} onClick={() => setZoneActive(null)}>{tr('sales.zoneAll')}</button>
                {zones.map((z) => (
                  <button type="button" key={z.key} className={`chip crm-zone-chip${zoneActive === z.key ? ' active' : ''}`} onClick={() => setZoneActive(zoneActive === z.key ? null : z.key)} title={`${z.commune} · ${tr(`sales.zoneTag_${z.tag}`)}`}>
                    🎯 {z.name}{z.total ? <span className="crm-zone-n">{z.total}</span> : null}
                  </button>
                ))}
              </div>
              {zone && <p className="small" style={{ margin: '8px 0 0' }}>🎯 <b>{zone.name}</b> · {zone.commune} · {tr(`sales.zoneTag_${zone.tag}`)} · {zoneTooltip(zone)}</p>}
            </div>
          </>
        )}
      </div>
      {erreur && <ErrorCard message={erreur} onRetry={charger} />}
      {rows && <AdminDataTable columns={columns} rows={lignes} sort={sort} onSort={toggle} onRowClick={(p) => setOuvert(p.id)} emptyLabel={tr('adminSales.noProspects')} />}
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
