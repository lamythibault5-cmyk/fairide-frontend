import { useCallback, useEffect, useMemo, useState } from 'react';
import { api } from '../../api';
import { useAuth } from '../../context/AuthContext';
import { useToast } from '../../context/ToastContext';
import { useLanguage } from '../../context/LanguageContext';
import { SkeletonCards } from '../../components/Skeleton';
import AdminPageHeader from '../../components/admin/AdminPageHeader';
import AdminDataTable, { useTableSort } from '../../components/admin/AdminDataTable';
import { ErrorCard, ResultCount } from '../../components/admin/AdminListTools';
import { fmtDateTime, useDebouncedValue } from './adminUtils';
import CampaignForm from './marketing/CampaignForm';
import CampaignDrawer from './marketing/CampaignDrawer';
import { StatusPill } from './marketing/MarketingPills';
import { STATUSES, resumeAudience } from './marketing/marketingUtils';
import '../../admin-marketing.css';

// Application Marketing : campagnes e-mail ciblées. Trois onglets — Campagnes (KPI + liste + fiche
// dans le tiroir), Nouvelle campagne (formulaire avec audience en direct et aperçu), Désinscrits.
export default function AdminMarketingPage() {
  const { t: tr } = useLanguage();
  const { token } = useAuth();
  const toast = useToast();
  const [onglet, setOnglet] = useState('campagnes');
  const [stats, setStats] = useState(null);
  const [statsErr, setStatsErr] = useState(null);
  const [liste, setListe] = useState(null);
  const [total, setTotal] = useState(0);
  const [listeErr, setListeErr] = useState(null);
  const [statut, setStatut] = useState('');
  const [search, setSearch] = useState('');
  const q = useDebouncedValue(search, 300);
  const [templates, setTemplates] = useState([]);
  const [selectedId, setSelectedId] = useState(null);
  const [edition, setEdition] = useState(null);
  const { sort, toggle } = useTableSort('createdAt');

  const chargerStats = useCallback(() => {
    setStatsErr(null);
    return api('/admin/marketing/stats', { token }).then(setStats).catch((e) => setStatsErr(e.message));
  }, [token]);

  const chargerListe = useCallback((silencieux = false) => {
    if (!silencieux) { setListeErr(null); setListe(null); }
    const params = new URLSearchParams({ limit: '200' });
    if (statut) params.set('status', statut);
    if (q) params.set('q', q);
    return api(`/admin/marketing/campaigns?${params.toString()}`, { token })
      .then((r) => { setListe(r.items || []); setTotal(r.total || 0); })
      .catch((e) => { setListeErr(e.message); if (!silencieux) setListe([]); });
  }, [token, statut, q]);

  useEffect(() => { chargerStats(); }, [chargerStats]);
  useEffect(() => { chargerListe(); }, [chargerListe]);
  useEffect(() => { api('/admin/marketing/templates', { token }).then((r) => setTemplates(Array.isArray(r) ? r : [])).catch(() => setTemplates([])); }, [token]);

  // Pendant un envoi, la liste se rafraîchit toute seule pour suivre les compteurs.
  const enCours = useMemo(() => (liste || []).some((c) => c.status === 'sending'), [liste]);
  useEffect(() => {
    if (!enCours) return undefined;
    const t = setInterval(() => { chargerListe(true); chargerStats(); }, 5000);
    return () => clearInterval(t);
  }, [enCours, chargerListe, chargerStats]);

  function toutRecharger() { chargerStats(); chargerListe(true); }

  function onSaved(c, modification) {
    toast(modification ? tr('adminMarketing.toastUpdated') : tr('adminMarketing.toastSaved'));
    setEdition(null);
    setOnglet('campagnes');
    toutRecharger();
    if (c?.id) setSelectedId(c.id);
  }
  function ouvrirEdition(c) {
    setSelectedId(null);
    setEdition(c);
    setOnglet('nouvelle');
    window.scrollTo({ top: 0, behavior: 'smooth' });
  }
  function nouvelle() { setEdition(null); setOnglet('nouvelle'); }

  const colonnes = [
    { key: 'name', label: tr('adminMarketing.colName'), get: (c) => <><b>{c.name}</b><div className="small mk-muted mk-ellipsis">{c.subject}</div></>, sortValue: (c) => c.name },
    { key: 'status', label: tr('adminCommon.status'), get: (c) => <StatusPill status={c.status} tr={tr} />, sortValue: (c) => STATUSES.indexOf(c.status) },
    { key: 'audience', label: tr('adminMarketing.colAudience'), get: (c) => <span className="small">{resumeAudience(c.audience, tr)}</span>, sortValue: (c) => (c.audience?.roles || []).join(',') },
    { key: 'recipients', label: tr('adminMarketing.colRecipients'), get: (c) => (c.recipientsCount || (c.status === 'draft' ? '—' : 0)), sortValue: (c) => c.recipientsCount || 0, align: 'right' },
    { key: 'progress', label: tr('adminMarketing.colProgress'), get: (c) => {
      if (c.status === 'draft') return '—';
      const part = c.recipientsCount ? Math.min(100, Math.round(((c.sentCount + c.failedCount) / c.recipientsCount) * 100)) : 0;
      return <><span>{c.sentCount}</span>{c.failedCount > 0 && <span style={{ color: 'var(--red)' }}> / {c.failedCount}</span>}{c.status === 'sending' && <div className="admin-progress"><span style={{ width: `${part}%` }} /></div>}</>;
    }, sortValue: (c) => c.sentCount || 0, align: 'right' },
    { key: 'when', label: tr('adminMarketing.colWhen'), get: (c) => (c.status === 'scheduled' && c.scheduledAt ? `⏰ ${fmtDateTime(c.scheduledAt)}` : c.sentAt ? fmtDateTime(c.sentAt) : '—'), sortValue: (c) => new Date(c.sentAt || c.scheduledAt || 0).getTime() || 0 },
    { key: 'createdAt', label: tr('adminMarketing.colCreated'), get: (c) => fmtDateTime(c.createdAt), sortValue: (c) => new Date(c.createdAt || 0).getTime() || 0 }
  ];

  const onglets = [
    ['campagnes', tr('adminMarketing.tabCampaigns'), stats ? stats.campaigns : null],
    ['nouvelle', edition ? tr('adminMarketing.edit') : tr('adminMarketing.tabNew'), null],
    ['desinscrits', tr('adminMarketing.tabOptOuts'), stats ? stats.optOuts : null]
  ];

  return (
    <div>
      <AdminPageHeader module="marketing" actions={
        <>
          <button type="button" className="btn-outline" onClick={toutRecharger}>{tr('adminMarketing.refresh')}</button>
          <button type="button" className="btn-teal" onClick={nouvelle}>{tr('adminMarketing.newCampaign')}</button>
        </>
      } />

      <nav className="mk-tabs" role="tablist">
        {onglets.map(([k, l, n]) => (
          <button key={k} type="button" role="tab" aria-selected={onglet === k} className={`chip${onglet === k ? ' active' : ''}`} onClick={() => setOnglet(k)}>
            {l}{n !== null && n !== undefined ? <span className="pill" style={{ marginLeft: 6 }}>{n}</span> : null}
          </button>
        ))}
      </nav>

      {onglet === 'campagnes' && (
        <>
          {statsErr && <ErrorCard message={statsErr} onRetry={chargerStats} />}
          {!stats && !statsErr && <SkeletonCards count={2} />}
          {stats && (
            <div className="stat-grid">
              <div className="stat-card highlight"><div className="num">{stats.campaigns}</div><div className="label">{tr('adminMarketing.kpiCampaigns')}</div></div>
              <div className="stat-card"><div className="num">{stats.sent30d}</div><div className="label">{tr('adminMarketing.kpiSent30')}</div></div>
              <div className="stat-card"><div className="num" style={stats.failed30d > 0 ? { color: 'var(--red)' } : undefined}>{stats.failed30d}</div><div className="label">{tr('adminMarketing.kpiFailed30')}</div></div>
              <div className="stat-card"><div className="num">{stats.optOuts}</div><div className="label">{tr('adminMarketing.kpiOptOuts')}</div></div>
              <div className="stat-card">
                <div className="num">{(stats.audienceTotals?.client || 0) + (stats.audienceTotals?.restaurant || 0) + (stats.audienceTotals?.driver || 0)}</div>
                <div className="label">{tr('adminMarketing.kpiAudience')}</div>
                <div className="small mk-muted" style={{ marginTop: 4 }}>{tr('adminMarketing.kpiAudienceDetail', { c: stats.audienceTotals?.client || 0, r: stats.audienceTotals?.restaurant || 0, d: stats.audienceTotals?.driver || 0 })}</div>
              </div>
            </div>
          )}

          <div className="admin-control-panel">
            <input placeholder={tr('adminMarketing.phSearch')} value={search} onChange={(e) => setSearch(e.target.value)} style={{ flex: 1, minWidth: 180 }} aria-label={tr('adminMarketing.phSearch')} />
            <div className="role-pick mk-status-filter" style={{ margin: 0 }}>
              {[['', tr('adminCommon.allF')], ...STATUSES.map((s) => [s, tr(`adminMarketing.status_${s}`)])].map(([k, l]) => (
                <div key={k || 'all'} role="button" tabIndex={0} className={`chip${statut === k ? ' active' : ''}`} onClick={() => setStatut(k)} onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); setStatut(k); } }}>{l}</div>
              ))}
            </div>
            <ResultCount n={(liste || []).length} total={total} />
          </div>

          {listeErr && <ErrorCard message={listeErr} onRetry={() => chargerListe()} />}
          {!liste && !listeErr && <SkeletonCards count={3} />}
          {liste && liste.length === 0 && !listeErr && (
            <div className="empty">
              {statut || q ? tr('adminMarketing.noMatch') : tr('adminMarketing.noCampaigns')}
              {!statut && !q && <div style={{ marginTop: 12 }}><button type="button" className="btn-teal" onClick={nouvelle}>{tr('adminMarketing.newCampaign')}</button></div>}
            </div>
          )}
          {liste && liste.length > 0 && (
            <AdminDataTable columns={colonnes} rows={liste} sort={sort} onSort={toggle} onRowClick={(c) => setSelectedId(c.id)} emptyLabel={tr('adminMarketing.noMatch')} />
          )}
        </>
      )}

      {onglet === 'nouvelle' && (
        <CampaignForm initial={edition} templates={templates} onSaved={onSaved} onCancel={() => { setEdition(null); setOnglet('campagnes'); }} />
      )}

      {onglet === 'desinscrits' && (
        <div className="card mk-optout-card">
          <h3 className="mk-section-title">{tr('adminMarketing.optOutsTitle')}</h3>
          {statsErr && <ErrorCard message={statsErr} onRetry={chargerStats} />}
          {!stats && !statsErr && <p className="small">{tr('adminCommon.loading')}</p>}
          {stats && (
            <>
              <div className="mk-audience-count">{stats.optOuts}</div>
              <p className="small" style={{ margin: '4px 0 12px' }}>{tr('adminMarketing.optOutsCount', { n: stats.optOuts })}</p>
            </>
          )}
          <p className="small">{tr('adminMarketing.optOutsExplain')}</p>
          <p className="small mk-muted">{tr('adminMarketing.optOutsHint')}</p>
        </div>
      )}

      {selectedId && (
        <CampaignDrawer id={selectedId} onClose={() => setSelectedId(null)} onChanged={toutRecharger} onEdit={ouvrirEdition} />
      )}
    </div>
  );
}
