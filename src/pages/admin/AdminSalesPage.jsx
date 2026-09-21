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
// distribuer), tous les commerces démarchés avec leur étape et leur historique, et les rémunérations (primes 20/40/50 €).
// Côté agent : pages/client/SalesPage.jsx.
// Serveur : routes/adminSales.js.
const TABS = ['agents', 'prospects', 'commissions', 'doublons'];
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
          <div className="stat-card"><div className="num">{stats.dueToday ?? 0}</div><div className="label">{tr('adminSales.statToday')}</div></div>
          <div className="stat-card"><div className="num">{stats.eventsThisWeek ?? 0}</div><div className="label">{tr('adminSales.statActions')}</div></div>
          <button type="button" className={`stat-card${stats.commissions?.earned?.amount > 0 ? ' highlight' : ''}`} style={{ textAlign: 'left', cursor: 'pointer', font: 'inherit' }} onClick={() => setOnglet('commissions')}><div className="num">{new Intl.NumberFormat(locale, { style: 'currency', currency: 'EUR', maximumFractionDigits: 0 }).format(stats.commissions?.earned?.amount || 0)}</div><div className="label">{tr('adminSales.statToPay')}</div></button>
          <button type="button" className={`stat-card${stats.duplicates > 0 ? ' crm-retard' : ''}`} style={{ textAlign: 'left', cursor: 'pointer', font: 'inherit' }} onClick={() => setOnglet('doublons')}><div className="num">{stats.duplicates ?? 0}</div><div className="label">{tr('adminSales.statDuplicates')}</div></button>
        </div>
      )}
      <div className="role-pick" style={{ marginBottom: 14 }}>
        {TABS.map((k) => <button key={k} type="button" className={`chip${onglet === k ? ' active' : ''}`} onClick={() => setOnglet(k)}>{tr(`adminSales.tab_${k}`)}</button>)}
      </div>
      {onglet === 'agents' && <AgentsTab {...commun} />}
      {onglet === 'prospects' && <ProspectsTab {...commun} retardInitial={searchParams.get('overdue') === '1'} />}
      {onglet === 'commissions' && <CommissionsTab {...commun} stats={stats} />}
      {onglet === 'doublons' && <DoublonsTab {...commun} />}
    </div>
  );
}

// ---------------------------------------------------------------------------------------------- commerciaux
// L'admin choisit ici quels comptes clients deviennent commerciaux : il cherche le compte (nom ou e-mail), clique
// « Donner l'accès », et la rubrique « Sales » apparaît dans le Mon compte de cette personne. « Retirer
// l'accès » sur la ligne la referme ; ses commerces démarchés restent visibles dans l'onglet suivant.
function AgentsTab({ token, tr, fmt, toast, onChanged }) {
  const euros = (n) => new Intl.NumberFormat(getLocale(), { style: 'currency', currency: 'EUR', maximumFractionDigits: 0 }).format(n || 0);
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
    { key: 'name', label: tr('adminSales.colAgent'), get: (a) => <><b>{a.name}</b>{a.isDemo ? <span className="pill" style={{ marginLeft: 6 }} title={tr('adminSales.demoHelp')}>{tr('adminSales.demoBadge')}</span> : null}<br /><span className="small">{a.email}{a.phone ? ` · ${a.phone}` : ''}</span></>, sortValue: (a) => a.name },
    { key: 'label', label: tr('adminSales.colLabel'), get: (a) => a.label || '-', sortValue: (a) => a.label },
    { key: 'prospects', label: tr('adminSales.colProspects'), get: (a) => a.prospects, align: 'right', sum: true },
    { key: 'signed', label: tr('adminSales.colSigned'), get: (a) => a.signed, align: 'right', sum: true },
    { key: 'active', label: tr('adminSales.colActiveRestos'), get: (a) => a.active, align: 'right', sum: true },
    { key: 'earned', label: tr('adminSales.colEarned'), get: (a) => <span className={a.earned ? 'crm-prime crm-prime-earned' : ''}>{euros(a.earned)}</span>, sortValue: (a) => a.earned, align: 'right' },
    { key: 'paid', label: tr('adminSales.colPaid'), get: (a) => euros(a.paid), sortValue: (a) => a.paid, align: 'right' },
    { key: 'addedThisWeek', label: tr('adminSales.colWeekAdded'), get: (a) => a.addedThisWeek, align: 'right', sum: true },
    { key: 'eventsThisWeek', label: tr('adminSales.colWeekActions'), get: (a) => a.eventsThisWeek, align: 'right', sum: true },
    { key: 'overdue', label: tr('adminSales.colOverdue'), get: (a) => <span className={a.overdue ? 'crm-retard-texte' : ''}>{a.overdue}{a.dueToday ? ` (+${a.dueToday})` : ''}</span>, sortValue: (a) => a.overdue, align: 'right' },
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
  const [aujourdhui, setAujourdhui] = useState(false);
  const finJournee = (() => { const d = new Date(); d.setHours(23, 59, 59, 999); return d.getTime(); })();
  const duJour = (p) => p.nextActionAt && p.nextActionAt <= finJournee && !['actif', 'refuse'].includes(p.stage);
  // Export CSV de tout ce qui est affiché (tous commerciaux) — Excel l'ouvre tel quel, BOM pour les accents.
  function exporterCsv(lignes) {
    const col = ['name', 'commune', 'stage', 'agentName', 'rating', 'eventsCount', 'lastEventAt', 'nextActionAt', 'restaurantName'];
    const cell = (v) => `"${String(v ?? '').replace(/"/g, '""')}"`;
    const corps = [col.join(';'), ...lignes.map((p) => col.map((c) => cell(c === 'stage' ? tr(`sales.stage_${p[c]}`) : /At$/.test(c) && p[c] ? new Date(p[c]).toLocaleString() : p[c])).join(';'))];
    const blob = new Blob(['\ufeff' + corps.join('\n')], { type: 'text/csv;charset=utf-8' });
    const a = document.createElement('a'); a.href = URL.createObjectURL(blob); a.download = `fairide-sales-${new Date().toISOString().slice(0, 10)}.csv`; a.click(); URL.revokeObjectURL(a.href);
  }
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
  const lignesRetard = (rows || []).filter((p) => (!retard || enRetard(p)) && (!aujourdhui || duJour(p)));
  const lignes = lignesRetard.filter((p) => !zone || p.lat === null || p.lat === undefined || distanceM(zone.lat, zone.lng, p.lat, p.lng) <= zone.radius);
  const zoneTooltip = (z) => `${tr('adminSales.zoneTotal', { n: z.total })}${z.claimedBy ? ` · ${tr('adminSales.zoneClaimedBy', { name: z.claimedBy.firstName })}` : ''}${z.agents?.length ? ` · ${z.agents.map((a) => `${a.name} ${a.n}`).join(', ')}` : ''}`;
  // Attribution d'une zone à un commercial (ou libération) depuis la zone choisie.
  const [agentsListe, setAgentsListe] = useState([]);
  useEffect(() => { api('/admin/sales/agents', { token }).then(setAgentsListe).catch(() => {}); }, [token]);
  async function attribuerZone(key, userId) {
    try { await api(`/admin/sales/zones/${key}`, { method: 'PUT', token, body: { userId: userId || null } }); toast(tr(userId ? 'adminSales.toastZoneAssigned' : 'adminSales.toastZoneFreed')); charger(); } catch (e) { toast(e.message); }
  }
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
        <button type="button" className={`chip${aujourdhui ? ' active' : ''}`} aria-pressed={aujourdhui} onClick={() => setAujourdhui((v) => !v)}>📅 {tr('adminSales.filterToday')}</button>
        <button type="button" className="btn-ghost" style={{ padding: '6px 10px', fontSize: 13 }} disabled={!lignes.length} onClick={() => exporterCsv(lignes)}>⬇️ {tr('sales.exportCsv')}</button>
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
                    🎯 {z.name}{z.claimedBy ? <span className="crm-zone-qui">{z.claimedBy.firstName}</span> : null}{z.total ? <span className="crm-zone-n">{z.total}</span> : null}
                  </button>
                ))}
              </div>
              {zone && <p className="small" style={{ margin: '8px 0 0' }}>🎯 <b>{zone.name}</b> · {zone.commune} · {tr(`sales.zoneTag_${zone.tag}`)} · {zoneTooltip(zone)}</p>}
              {zone && (
                <div className="row" style={{ gap: 8, alignItems: 'center', marginTop: 6, flexWrap: 'wrap' }}>
                  <label htmlFor="zone-agent" className="small">{tr('adminSales.zoneAssignLabel')}</label>
                  <select id="zone-agent" value={zone.claimedBy?.userId || ''} onChange={(e) => attribuerZone(zone.key, e.target.value)} style={{ maxWidth: 280 }}>
                    <option value="">{tr('adminSales.zoneFree')}</option>
                    {agentsListe.map((ag) => <option key={ag.userId} value={ag.userId}>{ag.name}{ag.isDemo ? ` (${tr('adminSales.demoBadge')})` : ''}</option>)}
                  </select>
                </div>
              )}
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

// ---------------------------------------------------------------------------------------------- doublons
// Le même commerce démarché par deux commerciaux ou plus : l'admin voit qui, à quelle étape, et tranche (il ouvre la
// fiche de chacun ; supprimer l'un des deux se fait depuis le CRM du commercial concerné).
function DoublonsTab({ token, tr, fmt, stageLabel }) {
  const [groupes, setGroupes] = useState(null);
  const [erreur, setErreur] = useState(null);
  const [ouvert, setOuvert] = useState(null);
  const charger = useCallback(() => { setErreur(null); api('/admin/sales/duplicates', { token }).then(setGroupes).catch((e) => setErreur(e.message)); }, [token]);
  useEffect(charger, [charger]);
  return (
    <div>
      <p className="small" style={{ margin: '0 0 12px' }}>{tr('adminSales.dupIntro')}</p>
      {erreur && <ErrorCard message={erreur} onRetry={charger} />}
      {groupes && groupes.length === 0 && <div className="card"><p className="small" style={{ margin: 0 }}>{tr('adminSales.dupEmpty')}</p></div>}
      {(groupes || []).map((g) => (
        <div key={g.key} className="card" style={{ marginBottom: 10 }}>
          <b>{g.name}</b> <span className="small">· {tr('adminSales.dupGroup', { n: g.items.length })}</span>
          <div className="crm-liste" style={{ marginTop: 8 }}>
            {g.items.map((p) => (
              <button type="button" key={p.id} className={`card crm-carte crm-etape-${p.stage}`} style={{ marginBottom: 0 }} onClick={() => setOuvert(p.id)}>
                <div className="crm-carte-tete"><b>🧑‍💼 {p.agentName}</b><span className={`crm-badge crm-badge-${p.stage}`}>{stageLabel(p.stage)}</span></div>
                <div className="small crm-carte-ligne">{p.commune && <span>📍 {p.commune}</span>}<span>{fmt(p.updatedAt)}</span></div>
              </button>
            ))}
          </div>
        </div>
      ))}
      {ouvert && <ProspectDrawer id={ouvert} token={token} tr={tr} fmt={fmt} stageLabel={stageLabel} toast={() => {}} onClose={() => setOuvert(null)} />}
    </div>
  );
}

// ---------------------------------------------------------------------------------------------- rémunérations
// Les primes des commerciaux (20 € inscription, 40 € premier mois payé, 50 € fidélité à 7 mois), créées par le serveur
// au lien prospect ↔ commerce inscrit et au rapprochement quotidien avec l'abonnement. L'admin marque « payée » quand
// le virement est fait, peut annuler, et ajoute à la main une prime hors circuit (abonnement réglé sur facture).
const COMMISSION_STATUSES = ['earned', 'scheduled', 'paid', 'cancelled'];
function CommissionsTab({ token, tr, fmt, toast, onChanged, stats }) {
  const [rows, setRows] = useState(null);
  const [erreur, setErreur] = useState(null);
  const [statut, setStatut] = useEtatPage('statutPrimes', 'earned');
  const [ouvert, setOuvert] = useState(null);
  const { sort, toggle } = useTableSort('date', 'desc');
  const locale = getLocale();
  const euros = (n) => new Intl.NumberFormat(locale, { style: 'currency', currency: 'EUR', maximumFractionDigits: 0 }).format(n || 0);
  const charger = useCallback(() => { setErreur(null); api(`/admin/sales/commissions${statut ? `?status=${statut}` : ''}`, { token }).then(setRows).catch((e) => setErreur(e.message)); }, [token, statut]);
  useEffect(charger, [charger]);
  async function changer(c, status) {
    try { await api(`/admin/sales/commissions/${c.id}`, { method: 'PATCH', token, body: { status } }); toast(tr(`adminSales.toastCom_${status}`)); charger(); onChanged(); } catch (err) { toast(err.message); }
  }
  async function rapprocher() {
    try { const r = await api('/admin/sales/reconcile', { method: 'POST', token }); toast(tr('adminSales.toastReconciled', { n: r.earned })); charger(); onChanged(); } catch (err) { toast(err.message); }
  }
  const dateDe = (c) => c.paidAt || c.earnedAt || c.dueAt || c.createdAt;
  const columns = [
    { key: 'agent', label: tr('adminSales.colAgent'), get: (c) => <><b>{c.agentName}</b><br /><span className="small">{c.agentEmail}</span></>, sortValue: (c) => c.agentName },
    { key: 'commerce', label: tr('adminSales.colProspect'), get: (c) => c.restaurantName || c.prospectName || '-', sortValue: (c) => c.restaurantName || c.prospectName || '' },
    { key: 'kind', label: tr('adminSales.colKind'), get: (c) => tr(`sales.commission_${c.kind}`), sortValue: (c) => c.kind },
    { key: 'amount', label: tr('adminSales.colAmount'), get: (c) => euros(c.amount), sortValue: (c) => c.amount, align: 'right' },
    { key: 'status', label: tr('adminSales.colStatus'), get: (c) => <span className={`crm-prime crm-prime-${c.status}`}>{tr(`sales.payStatus_${c.status}`)}</span>, sortValue: (c) => COMMISSION_STATUSES.indexOf(c.status) },
    { key: 'date', label: tr('adminSales.colDate'), get: (c) => <>{fmt(dateDe(c))}{c.note ? <><br /><span className="small">{c.note}</span></> : null}</>, sortValue: (c) => dateDe(c) || 0 },
    { key: 'actions', label: '', get: (c) => (
      <span className="row" style={{ gap: 6, justifyContent: 'flex-end' }}>
        {c.status === 'earned' && <button type="button" className="btn-teal" style={{ padding: '4px 8px', fontSize: 12 }} onClick={(e) => { e.stopPropagation(); changer(c, 'paid'); }}>{tr('adminSales.comMarkPaid')}</button>}
        {c.status === 'paid' && <button type="button" className="btn-ghost" style={{ padding: '4px 8px', fontSize: 12 }} onClick={(e) => { e.stopPropagation(); changer(c, 'earned'); }}>{tr('adminSales.comUnpay')}</button>}
        {c.status !== 'cancelled' && c.status !== 'paid' && <button type="button" className="btn-danger-ghost" style={{ padding: '4px 8px', fontSize: 12 }} onClick={(e) => { e.stopPropagation(); changer(c, 'cancelled'); }}>{tr('adminSales.comCancel')}</button>}
        {c.status === 'cancelled' && <button type="button" className="btn-ghost" style={{ padding: '4px 8px', fontSize: 12 }} onClick={(e) => { e.stopPropagation(); changer(c, 'earned'); }}>{tr('adminSales.comRestore')}</button>}
      </span>
    ) }
  ];
  const totalAffiche = (rows || []).reduce((s, c) => s + c.amount, 0);
  return (
    <div>
      <p className="small" style={{ margin: '0 0 12px' }}>{tr('adminSales.comIntro', { signup: euros(stats?.rules?.signup ?? 20), first: euros(stats?.rules?.first_month ?? 40), retention: euros(stats?.rules?.retention ?? 50), months: stats?.rules?.retentionMonths ?? 7 })}</p>
      <div className="admin-control-panel">
        <div className="role-pick" style={{ flexWrap: 'wrap' }}>
          <button type="button" className={`chip${statut === '' ? ' active' : ''}`} onClick={() => setStatut('')}>{tr('adminSales.comAll')}</button>
          {COMMISSION_STATUSES.map((s) => <button key={s} type="button" className={`chip${statut === s ? ' active' : ''}`} onClick={() => setStatut(s)}>{tr(`sales.payStatus_${s}`)}{stats?.commissions?.[s]?.n ? ` · ${stats.commissions[s].n}` : ''}</button>)}
        </div>
        <button type="button" className="btn-ghost" style={{ padding: '6px 10px', fontSize: 13 }} onClick={rapprocher}>🔄 {tr('adminSales.comReconcile')}</button>
      </div>
      {rows && rows.length > 0 && <p className="small" style={{ margin: '0 0 8px' }}>{tr('adminSales.comShownTotal', { n: rows.length, total: euros(totalAffiche) })}</p>}
      {erreur && <ErrorCard message={erreur} onRetry={charger} />}
      {rows && <AdminDataTable columns={columns} rows={rows} sort={sort} onSort={toggle} onRowClick={(c) => c.prospectId && setOuvert(c.prospectId)} emptyLabel={tr('adminSales.comEmpty')} />}
      {ouvert && <ProspectDrawer id={ouvert} token={token} tr={tr} fmt={fmt} stageLabel={(s) => `${STAGE_ICONES[s] || ''} ${tr(`sales.stage_${s}`)}`} toast={toast} onClose={() => { setOuvert(null); charger(); }} />}
    </div>
  );
}

function ProspectDrawer({ id, token, tr, fmt, stageLabel, toast, onClose }) {
  const [p, setP] = useState(null);
  const [primes, setPrimes] = useState([]);
  const euros = (n) => new Intl.NumberFormat(getLocale(), { style: 'currency', currency: 'EUR', maximumFractionDigits: 0 }).format(n || 0);
  const chargerPrimes = useCallback(() => { api('/admin/sales/commissions', { token }).then((rows) => setPrimes(rows.filter((c) => c.prospectId === id))).catch(() => {}); }, [token, id]);
  useEffect(() => { api(`/admin/sales/prospects/${id}`, { token }).then(setP).catch((e) => { toast(e.message); onClose(); }); chargerPrimes(); }, [id, token, toast, onClose, chargerPrimes]);
  async function ajouterPrime(kind) {
    try { const r = await api('/admin/sales/commissions', { method: 'POST', token, body: { prospectId: id, kind } }); toast(tr(r.deja ? 'adminSales.comAlready' : 'adminSales.comAdded')); chargerPrimes(); } catch (e) { toast(e.message); }
  }
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
          <h4 style={{ margin: '14px 0 6px' }}>{tr('adminSales.comForProspect')}</h4>
          {primes.length === 0 ? <p className="small" style={{ margin: '0 0 6px' }}>{tr('adminSales.comEmpty')}</p> : (
            <ul className="crm-primes" style={{ marginTop: 0 }}>
              {primes.map((c) => <li key={c.id}><span>{tr(`sales.commission_${c.kind}`)}<br /><span className="small">{fmt(c.paidAt || c.earnedAt || c.dueAt)}</span></span><span className={`crm-prime crm-prime-${c.status}`}>{euros(c.amount)} · {tr(`sales.payStatus_${c.status}`)}</span></li>)}
            </ul>
          )}
          <p className="small" style={{ margin: '0 0 4px' }}>{tr('adminSales.comAddManual')}{['signup', 'first_month', 'retention'].filter((k) => !primes.some((c) => c.kind === k)).map((k) => <button key={k} type="button" className="btn-ghost" style={{ padding: '2px 8px', fontSize: 12 }} onClick={() => ajouterPrime(k)}>+ {tr(`sales.commission_${k}`)}</button>)}</p>
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
