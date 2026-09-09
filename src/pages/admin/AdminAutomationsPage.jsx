import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { api, totalDepuisEntetes } from '../../api';
import AdminPageHeader from '../../components/admin/AdminPageHeader';
import AdminDataTable, { useTableSort } from '../../components/admin/AdminDataTable';
import ConfirmDialog from '../../components/ConfirmDialog';
import { ErrorCard, Pager } from '../../components/admin/AdminListTools';
import { useAuth } from '../../context/AuthContext';
import { useToast } from '../../context/ToastContext';
import { SkeletonCards } from '../../components/Skeleton';
import { fmtDateTime, AUTOMATION_RULES_META } from './adminUtils';
import { useLanguage } from '../../context/LanguageContext';

const PAGE_SIZE = 20;

// Lien vers les tâches créées par un passage : les identifiants quand le serveur les renvoie
// (`createdTaskIds`), sinon la liste des tâches à faire (les règles créent toujours en « à faire »).
function LienTaches({ run, tr }) {
  const n = run.createdCount ?? run.created ?? 0;
  if (!n) return null;
  const ids = run.createdTaskIds || run.taskIds;
  if (Array.isArray(ids) && ids.length === 1) return <Link to={`/admin/tasks?id=${ids[0]}`} className="admin-record-link">→ {tr('adminAutomations.seeTask')}</Link>;
  return <Link to="/admin/tasks?status=a_faire" className="admin-record-link">→ {tr('adminAutomations.seeTasks', { n })}</Link>;
}

export default function AdminAutomationsPage() {
  const { t: tr } = useLanguage();
  const { token } = useAuth();
  const toast = useToast();
  const [rules, setRules] = useState(null);
  const [erreurRegles, setErreurRegles] = useState(null);
  const [log, setLog] = useState(null);
  const [logTotal, setLogTotal] = useState(0);
  const [logErreur, setLogErreur] = useState(null);
  const [page, setPage] = useState(0);
  const [regleFiltre, setRegleFiltre] = useState('');
  const [running, setRunning] = useState(false);
  const [confirmRunAll, setConfirmRunAll] = useState(false);
  const { sort, toggle } = useTableSort('ranAt');

  function loadRules() {
    setErreurRegles(null);
    api('/admin/automations/rules', { token }).then(setRules).catch((e) => setErreurRegles(e.message));
  }
  // Journal paginé et filtrable par règle (GET /admin/automations/log?rule&limit&offset, total X-Total-Count).
  function loadLog() {
    setLog(null); setLogErreur(null);
    const params = new URLSearchParams({ limit: PAGE_SIZE, offset: page * PAGE_SIZE });
    if (regleFiltre) params.set('rule', regleFiltre);
    api(`/admin/automations/log?${params.toString()}`, { token, withHeaders: true })
      .then(({ data, headers }) => { const l = Array.isArray(data) ? data : (data?.rows || []); setLog(l); setLogTotal(totalDepuisEntetes(headers, l)); })
      .catch((e) => setLogErreur(e.message));
  }
  function load() { loadRules(); loadLog(); }
  useEffect(loadRules, []); // eslint-disable-line react-hooks/exhaustive-deps
  useEffect(loadLog, [page, regleFiltre]); // eslint-disable-line react-hooks/exhaustive-deps
  useEffect(() => { setPage(0); }, [regleFiltre]);

  async function runNow() {
    setRunning(true);
    try {
      const r = await api('/admin/automations/run', { method: 'POST', token });
      const totalCreated = (r.summary || []).reduce((a, s) => a + (s.created || 0), 0);
      toast(totalCreated > 0 ? tr('adminAutomations.toastCreated', { n: totalCreated }) : tr('adminAutomations.toastNothingNew'));
      load();
    } catch (e) {
      toast(e.message);
    } finally {
      setRunning(false); setConfirmRunAll(false);
    }
  }

  return (
    <div>
      <AdminPageHeader module="automations" actions={<button className="btn-teal" disabled={running} onClick={() => setConfirmRunAll(true)}>{running ? '...' : tr('adminAutomations.runNow')}</button>} />
      <div className="card" style={{ marginBottom: 16, borderLeft: '3px solid var(--gold-deep)' }}>
        <p className="small" style={{ margin: 0 }}>
          {tr('adminAutomations.intro')}
        </p>
      </div>

      {erreurRegles && <ErrorCard message={erreurRegles} onRetry={loadRules} />}
      {!rules && !erreurRegles && <SkeletonCards count={3} />}
      {rules && rules.length === 0 && <div className="empty">{tr('adminAutomations.noRules')}</div>}
      {rules && rules.map((r) => <RuleCard key={r.ruleType} rule={r} onChanged={load} onShowLog={() => setRegleFiltre(r.ruleType)} />)}

      <div className="row" style={{ justifyContent: 'space-between', alignItems: 'center', margin: '20px 0 10px', flexWrap: 'wrap', gap: 8 }}>
        <h3 style={{ margin: 0, fontSize: 15 }}>{tr('adminAutomations.runHistory')}</h3>
        <div className="admin-control-panel" style={{ margin: 0 }}>
          <select value={regleFiltre} onChange={(e) => setRegleFiltre(e.target.value)} style={{ maxWidth: 260 }}>
            <option value="">{tr('adminAutomations.allRules')}</option>
            {(rules || []).map((r) => <option key={r.ruleType} value={r.ruleType}>{AUTOMATION_RULES_META[r.ruleType]?.label || r.ruleType}</option>)}
          </select>
          <span className="small">{tr('adminCommon.resultsCount', { n: logTotal })}</span>
        </div>
      </div>
      {logErreur && <ErrorCard message={logErreur} onRetry={loadLog} />}
      {!log && !logErreur && <SkeletonCards count={1} />}
      {log && log.length === 0 && <div className="empty">{tr('adminAutomations.noRuns')}</div>}
      {log && log.length > 0 && (
        <AdminDataTable rows={log} sort={sort} onSort={toggle} emptyLabel={tr('adminAutomations.noRuns')} columns={[
          { key: 'ranAt', label: tr('adminCommon.date'), get: (l) => fmtDateTime(l.ranAt), sortValue: (l) => l.ranAt },
          { key: 'ruleType', label: tr('adminAutomations.rule'), get: (l) => AUTOMATION_RULES_META[l.ruleType]?.label || l.ruleType, sortValue: (l) => l.ruleType },
          { key: 'matchedCount', label: tr('adminAutomations.colMatched'), get: (l) => l.matchedCount, align: 'right', sum: true },
          { key: 'createdCount', label: tr('adminAutomations.colCreated'), get: (l) => <b>{l.createdCount}</b>, sortValue: (l) => l.createdCount, align: 'right', sum: true },
          { key: 'links', label: '', get: (l) => <LienTaches run={l} tr={tr} />, sortValue: (l) => l.createdCount }
        ]} showTotals />
      )}
      <Pager page={page} pageSize={PAGE_SIZE} total={logTotal} onPage={setPage} />

      <ConfirmDialog open={confirmRunAll} title={tr('adminAutomations.runNow')} message={tr('adminAutomations.runAllBody')} loading={running} onConfirm={runNow} onCancel={() => setConfirmRunAll(false)} />
    </div>
  );
}

function RuleCard({ rule, onChanged, onShowLog }) {
  const { t: tr } = useLanguage();
  const { token } = useAuth();
  const toast = useToast();
  const meta = AUTOMATION_RULES_META[rule.ruleType] || { label: rule.ruleType, description: '', params: [] };
  const [params, setParams] = useState(rule.params);
  const [saving, setSaving] = useState(false);
  const [confirm, setConfirm] = useState(null); // 'toggle' | 'test'
  const [busy, setBusy] = useState(false);
  const [dernierTest, setDernierTest] = useState(null);

  const dirty = JSON.stringify(params) !== JSON.stringify(rule.params);

  async function toggleEnabled() {
    setBusy(true);
    try {
      await api(`/admin/automations/rules/${rule.ruleType}`, { method: 'PATCH', token, body: { enabled: !rule.enabled } });
      toast(rule.enabled ? tr('adminAutomations.toastDisabled') : tr('adminAutomations.toastEnabled'));
      onChanged();
    } catch (e) {
      toast(e.message);
    } finally { setBusy(false); setConfirm(null); }
  }

  async function saveParams() {
    setSaving(true);
    try {
      await api(`/admin/automations/rules/${rule.ruleType}`, { method: 'PATCH', token, body: { params } });
      toast(tr('adminAutomations.toastSaved'));
      onChanged();
    } catch (e) {
      toast(e.message);
    } finally {
      setSaving(false);
    }
  }

  // « Tester cette règle » : exécution immédiate de cette seule règle (POST run/:ruleKey ; force=1 si
  // elle est désactivée) — crée réellement les tâches, d'où la confirmation.
  async function testRule() {
    setBusy(true);
    try {
      const r = await api(`/admin/automations/run/${rule.ruleType}${rule.enabled ? '' : '?force=1'}`, { method: 'POST', token });
      setDernierTest(r);
      toast(tr('adminAutomations.toastTested', { created: r.created ?? 0, matched: r.matched ?? 0 }));
      onChanged();
    } catch (e) {
      toast(e.message);
    } finally { setBusy(false); setConfirm(null); }
  }

  return (
    <div className="card" style={{ opacity: rule.enabled ? 1 : 0.7 }}>
      <div className="row" style={{ justifyContent: 'space-between', alignItems: 'flex-start', flexWrap: 'wrap' }}>
        <div style={{ flex: '1 1 260px' }}>
          <b>{meta.label}</b> {!rule.enabled && <span className="pill">{tr('adminAutomations.disabledPill')}</span>}
          <p className="small" style={{ margin: '2px 0 0', opacity: 0.75 }}>{meta.description}</p>
        </div>
        <div className="admin-rule-actions">
          <button className="btn-outline" style={{ padding: '4px 12px', fontSize: 12 }} disabled={busy} onClick={() => setConfirm('test')}>{tr('adminAutomations.testRule')}</button>
          <button className="btn-ghost" style={{ padding: '4px 12px', fontSize: 12 }} onClick={onShowLog}>{tr('adminAutomations.showLog')}</button>
          <button className={rule.enabled ? 'btn-danger-ghost' : 'btn-teal'} style={{ padding: '4px 12px', fontSize: 12, flexShrink: 0 }} disabled={busy} onClick={() => setConfirm('toggle')}>
            {rule.enabled ? tr('adminCommon.disable') : tr('adminCommon.enable')}
          </button>
        </div>
      </div>
      {meta.params.length > 0 && (
        <div className="row" style={{ gap: 8, marginTop: 8, flexWrap: 'wrap', alignItems: 'flex-end' }}>
          {meta.params.map((pf) => (
            <div className="field" key={pf.key} style={{ maxWidth: 160, margin: 0 }}>
              <label>{pf.label}</label>
              <input type="number" step={pf.step || '1'} value={params[pf.key] ?? ''} onChange={(e) => setParams({ ...params, [pf.key]: Number(e.target.value) })} />
            </div>
          ))}
          <button className="btn-outline" style={{ padding: '6px 14px', fontSize: 13 }} disabled={!dirty || saving} onClick={saveParams}>{saving ? '...' : tr('adminCommon.save')}</button>
        </div>
      )}
      <p className="small" style={{ margin: '8px 0 0', opacity: 0.6 }}>
        {rule.lastRunAt ? tr('adminAutomations.lastRun', { date: fmtDateTime(rule.lastRunAt), created: rule.lastRunCreatedCount ?? 0, matched: rule.lastRunMatchedCount ?? 0 }) : tr('adminAutomations.neverRun')}
        {dernierTest && <> · {tr('adminAutomations.testResult', { created: dernierTest.created ?? 0, matched: dernierTest.matched ?? 0 })} <LienTaches run={dernierTest} tr={tr} /></>}
      </p>
      <ConfirmDialog
        open={confirm === 'toggle'}
        title={rule.enabled ? tr('adminAutomations.confirmDisable', { rule: meta.label }) : tr('adminAutomations.confirmEnable', { rule: meta.label })}
        message={rule.enabled ? tr('adminAutomations.disableBody') : tr('adminAutomations.enableBody')}
        danger={rule.enabled} loading={busy} onConfirm={toggleEnabled} onCancel={() => setConfirm(null)}
      />
      <ConfirmDialog
        open={confirm === 'test'}
        title={tr('adminAutomations.confirmTest', { rule: meta.label })}
        message={rule.enabled ? tr('adminAutomations.testBody') : tr('adminAutomations.testBodyDisabled')}
        loading={busy} onConfirm={testRule} onCancel={() => setConfirm(null)}
      />
    </div>
  );
}
