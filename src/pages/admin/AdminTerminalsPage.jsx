import { useCallback, useEffect, useMemo, useState } from 'react';
import { createPortal } from 'react-dom';
import { Link } from 'react-router-dom';
import { api } from '../../api';
import { useAuth } from '../../context/AuthContext';
import { useToast } from '../../context/ToastContext';
import { useLanguage, getLocale } from '../../context/LanguageContext';
import AdminPageHeader from '../../components/admin/AdminPageHeader';
import AdminDataTable, { useTableSort } from '../../components/admin/AdminDataTable';
import RecordDrawer, { DrawerRow } from '../../components/admin/RecordDrawer';
import ConfirmDialog from '../../components/ConfirmDialog';
import '../../terminal.css';
import '../../simulation.css'; // pastilles de filtre (.simu-filtres)

// Admin › Terminaux : le parc des terminaux Fairide (Goodcom GT81H) de tous les commerces — qui est en ligne, qui
// n'a plus de papier, quels tickets attendent ou ont échoué — pour le support (dépannage à distance, ticket de
// test, relance d'un ticket) et le suivi de la caution. Backend : routes/terminal.js (/admin/terminals…).
const FILTRES = ['problems', 'real', 'offline', 'simulated', 'revoked', 'all'];

function aUnProbleme(x) {
  return !x.revokedAt && !x.simulated && (!x.online || (x.printerStatus && x.printerStatus !== 'ok') || x.failed > 0 || x.stuck > 0);
}

export default function AdminTerminalsPage() {
  const { t: tr } = useLanguage();
  const { token } = useAuth();
  const toast = useToast();
  const [liste, setListe] = useState(null);
  const [filtre, setFiltre] = useState('real');
  const [choisi, setChoisi] = useState(null);
  const [jobs, setJobs] = useState(null);
  const [busy, setBusy] = useState(false);
  const [aRetirer, setARetirer] = useState(null);
  const { sort, toggle } = useTableSort('lastSeen');

  const charger = useCallback(() => {
    api('/admin/terminals', { token }).then((r) => setListe(r.terminals || [])).catch((e) => toast(e.message, 'erreur'));
  }, [token, toast]);
  useEffect(() => { charger(); const i = setInterval(charger, 30000); return () => clearInterval(i); }, [charger]);

  const chargerJobs = useCallback((id) => {
    setJobs(null);
    api(`/admin/terminals/${id}/jobs`, { token }).then((r) => setJobs(r.jobs || [])).catch(() => setJobs([]));
  }, [token]);
  useEffect(() => { if (choisi) chargerJobs(choisi.id); }, [choisi?.id]); // eslint-disable-line react-hooks/exhaustive-deps

  const actifs = (liste || []).filter((x) => !x.revokedAt && !x.simulated);
  const kpi = {
    active: actifs.length,
    online: actifs.filter((x) => x.online).length,
    issues: actifs.filter((x) => x.printerStatus && x.printerStatus !== 'ok').length,
    failed: actifs.reduce((s, x) => s + (x.failed || 0), 0)
  };
  const visibles = useMemo(() => (liste || []).filter((x) => {
    if (filtre === 'all') return true;
    if (filtre === 'revoked') return !!x.revokedAt;
    if (x.revokedAt) return false;
    if (filtre === 'simulated') return x.simulated;
    if (x.simulated) return false;
    if (filtre === 'offline') return !x.online;
    if (filtre === 'problems') return aUnProbleme(x);
    return true;
  }), [liste, filtre]);
  const compte = (f) => (liste || []).filter((x) => {
    if (f === 'all') return true;
    if (f === 'revoked') return !!x.revokedAt;
    if (x.revokedAt) return false;
    if (f === 'simulated') return x.simulated;
    if (x.simulated) return false;
    if (f === 'offline') return !x.online;
    if (f === 'problems') return aUnProbleme(x);
    return true;
  }).length;

  const quand = (d) => (d ? new Date(d).toLocaleString(getLocale(), { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' }) : '—');
  const imprimante = (s) => (s ? tr(`terminal.printer_${s}`) : '—');
  const etatLigne = (x) => (x.revokedAt ? tr('adminTerminals.revoked') : x.online ? tr('terminal.online') : tr('terminal.offline'));

  const colonnes = [
    { key: 'restaurant', label: tr('adminTerminals.colRestaurant'), get: (x) => <span><b>{x.restaurantName}</b>{x.restaurantCommune ? <span className="small" style={{ color: 'var(--ink-faint)' }}> · {x.restaurantCommune}</span> : null}</span>, sortValue: (x) => x.restaurantName },
    { key: 'terminal', label: tr('adminTerminals.colTerminal'), get: (x) => <span>{x.label}{x.simulated && <span className="pill" style={{ marginLeft: 6 }}>{tr('terminal.simulated')}</span>}</span>, sortValue: (x) => x.label },
    { key: 'lastSeen', label: tr('adminTerminals.colState'), get: (x) => <span className={`print-etat ${x.revokedAt ? 'attente' : x.online ? 'ok' : 'erreur'}`}>{etatLigne(x)}</span>, sortValue: (x) => (x.lastSeenAt ? new Date(x.lastSeenAt).getTime() : 0) },
    { key: 'printer', label: tr('terminal.printerLabel'), get: (x) => <span className={`print-etat ${!x.printerStatus || x.printerStatus === 'ok' ? 'ok' : 'erreur'}`}>{imprimante(x.printerStatus)}</span>, sortValue: (x) => x.printerStatus || '' },
    { key: 'battery', label: tr('adminTerminals.colBattery'), get: (x) => (x.batteryLevel != null ? `${x.batteryLevel} %${x.charging ? ' ⚡' : ''}` : '—'), sortValue: (x) => x.batteryLevel ?? -1, align: 'right' },
    { key: 'tickets', label: tr('adminTerminals.colTickets'), get: (x) => <span>{x.printed}{x.waiting > 0 && <span className="print-etat attente" style={{ marginLeft: 6 }}>{tr('adminTerminals.waiting', { n: x.waiting })}</span>}{x.failed > 0 && <span className="print-etat erreur" style={{ marginLeft: 6 }}>{tr('adminTerminals.failed', { n: x.failed })}</span>}</span>, sortValue: (x) => (x.failed * 1000) + (x.stuck * 100) + x.waiting },
    { key: 'app', label: tr('adminTerminals.colApp'), get: (x) => x.appVersion || '—', sortValue: (x) => x.appVersion || '' }
  ];

  async function test(x) {
    setBusy(true);
    try { await api(`/admin/terminals/${x.id}/test`, { method: 'POST', token }); toast(tr('adminTerminals.testSent')); chargerJobs(x.id); } catch (e) { toast(e.message, 'erreur'); } finally { setBusy(false); }
  }
  async function relancer(job) {
    try { await api(`/admin/terminals/jobs/${job.id}/retry`, { method: 'POST', token }); toast(tr('adminTerminals.retried')); chargerJobs(choisi.id); charger(); } catch (e) { toast(e.message, 'erreur'); }
  }
  async function retirer() {
    const x = aRetirer;
    try {
      await api(`/admin/terminals/${x.id}`, { method: 'DELETE', token });
      setARetirer(null); setChoisi(null); toast(tr('terminal.removed')); charger();
    } catch (e) { toast(e.message, 'erreur'); }
  }

  const detail = choisi ? (liste || []).find((x) => x.id === choisi.id) || choisi : null;

  return (
    <div>
      <AdminPageHeader module="terminals" actions={<button type="button" className="btn-outline" onClick={charger}>{tr('adminTerminals.refresh')}</button>} />
      <div className="stat-grid">
        <div className="stat-card"><div className="num">{kpi.active}</div><div className="label">{tr('adminTerminals.kpiActive')}</div></div>
        <div className={`stat-card${kpi.active && kpi.online < kpi.active ? ' is-alert' : ''}`}><div className="num">{kpi.online}/{kpi.active}</div><div className="label">{tr('adminTerminals.kpiOnline')}</div></div>
        <div className={`stat-card${kpi.issues ? ' is-alert' : ''}`}><div className="num">{kpi.issues}</div><div className="label">{tr('adminTerminals.kpiIssues')}</div></div>
        <div className={`stat-card${kpi.failed ? ' is-alert' : ''}`}><div className="num">{kpi.failed}</div><div className="label">{tr('adminTerminals.kpiFailed')}</div></div>
      </div>
      <div className="simu-filtres" style={{ display: 'flex', gap: 6, flexWrap: 'wrap', margin: '14px 0 10px' }}>
        {FILTRES.map((f) => (
          <button key={f} type="button" className={`chip${filtre === f ? ' active' : ''}`} onClick={() => setFiltre(f)}>{tr(`adminTerminals.filter_${f}`)} ({compte(f)})</button>
        ))}
      </div>
      {!liste && <p className="small">…</p>}
      {liste && visibles.length === 0 && <div className="card"><p className="small" style={{ margin: 0 }}>{filtre === 'problems' ? tr('adminTerminals.noProblem') : tr('adminTerminals.empty')}</p></div>}
      {visibles.length > 0 && (
        <div className="card" style={{ padding: 0, overflowX: 'auto' }}>
          <AdminDataTable columns={colonnes} rows={visibles} sort={sort} onSort={toggle} onRowClick={(x) => setChoisi(x)} />
        </div>
      )}

      {detail && createPortal(
        <RecordDrawer
          title={`${detail.label} — ${detail.restaurantName}`}
          subtitle={[detail.model, detail.serial, detail.androidVersion ? `Android ${detail.androidVersion}` : null].filter(Boolean).join(' · ')}
          badge={<span className={`print-etat ${detail.revokedAt ? 'attente' : detail.online ? 'ok' : 'erreur'}`}>{etatLigne(detail)}</span>}
          onClose={() => setChoisi(null)} width={620}
        >
          <DrawerRow label={tr('adminTerminals.lastSeen')} value={quand(detail.lastSeenAt)} strong />
          <DrawerRow label={tr('terminal.printerLabel')} value={imprimante(detail.printerStatus)} />
          <DrawerRow label={tr('adminTerminals.colBattery')} value={detail.batteryLevel != null ? `${detail.batteryLevel} %${detail.charging ? ` · ${tr('adminTerminals.charging')}` : ''}` : '—'} />
          <DrawerRow label={tr('adminTerminals.network')} value={detail.network || '—'} />
          <DrawerRow label={tr('adminTerminals.playServices')} value={detail.playServices == null ? '—' : detail.playServices ? tr('adminTerminals.yes') : tr('adminTerminals.no')} />
          <DrawerRow label={tr('adminTerminals.colApp')} value={detail.appVersion || '—'} />
          <DrawerRow label={tr('adminTerminals.paper')} value={tr('adminTerminals.columns', { n: detail.paperColumns })} />
          <DrawerRow label={tr('adminTerminals.pairedAt')} value={quand(detail.pairedAt)} />
          <DrawerRow label={tr('adminTerminals.deposit')} value={tr(`adminRestos.terminalStatus_${detail.depositStatus || 'none'}`)} />
          <DrawerRow label={tr('adminTerminals.lastPrinted')} value={quand(detail.lastPrintedAt)} />
          {detail.lastError && <DrawerRow label={tr('adminTerminals.lastError')} value={imprimante(detail.lastError)} />}
          <div className="row" style={{ gap: 8, flexWrap: 'wrap', margin: '12px 0' }}>
            {!detail.revokedAt && <button type="button" className="btn-teal" disabled={busy} onClick={() => test(detail)}>{tr('terminal.testButton')}</button>}
            <Link className="btn-outline" to="/admin/restaurants" state={{ presetSearch: detail.restaurantName }}>{tr('adminTerminals.openRestaurant')}</Link>
            {!detail.revokedAt && <button type="button" className="btn-danger-ghost" style={{ marginLeft: 'auto' }} onClick={() => setARetirer(detail)}>{tr('terminal.remove')}</button>}
          </div>
          <div className="divider" />
          <h4 className="drawer-section-title">{tr('adminTerminals.jobsTitle')}</h4>
          {!jobs && <p className="small">…</p>}
          {jobs && jobs.length === 0 && <p className="small">{tr('adminTerminals.noJobs')}</p>}
          {(jobs || []).map((j) => (
            <div key={j.id} className="drawer-row" style={{ alignItems: 'center' }}>
              <span className="small">
                <b>{tr(`simulation.ticket_${j.kind}`)}</b>{j.orderNumber ? ` · #${String(j.orderNumber).padStart(3, '0')}` : ''}
                <span style={{ color: 'var(--ink-faint)' }}> · {quand(j.printedAt || j.createdAt)}</span>
              </span>
              <span className="small" style={{ display: 'inline-flex', gap: 6, alignItems: 'center' }}>
                <span className={`print-etat ${j.status === 'printed' ? 'ok' : j.status === 'failed' ? 'erreur' : 'attente'}`}>
                  {tr(`adminTerminals.job_${j.status}`)}{j.errorCode ? ` · ${imprimante(j.errorCode)}` : ''}
                </span>
                {j.status === 'failed' && <button type="button" className="btn-ghost" onClick={() => relancer(j)}>{tr('adminTerminals.retry')}</button>}
              </span>
            </div>
          ))}
        </RecordDrawer>,
        document.body
      )}
      <ConfirmDialog open={!!aRetirer} danger title={tr('terminal.removeTitle')} message={tr('terminal.removeText', { name: aRetirer?.label || '' })}
        confirmLabel={tr('terminal.remove')} onCancel={() => setARetirer(null)} onConfirm={retirer} />
    </div>
  );
}
