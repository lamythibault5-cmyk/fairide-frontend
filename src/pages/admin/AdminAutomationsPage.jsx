import { useEffect, useState } from 'react';
import { api } from '../../api';
import { useAuth } from '../../context/AuthContext';
import { useToast } from '../../context/ToastContext';
import { SkeletonCards } from '../../components/Skeleton';
import { fmtDateTime, AUTOMATION_RULES_META } from './adminUtils';
import { useLanguage } from '../../context/LanguageContext';

export default function AdminAutomationsPage() {
  const { t: tr } = useLanguage();
  const { token } = useAuth();
  const toast = useToast();
  const [rules, setRules] = useState(null);
  const [log, setLog] = useState(null);
  const [running, setRunning] = useState(false);

  function load() {
    api('/admin/automations/rules', { token }).then(setRules).catch((e) => toast(e.message));
    api('/admin/automations/log?limit=20', { token }).then(setLog).catch((e) => toast(e.message));
  }
  useEffect(load, []); // eslint-disable-line react-hooks/exhaustive-deps

  async function runNow() {
    setRunning(true);
    try {
      const r = await api('/admin/automations/run', { method: 'POST', token });
      const totalCreated = r.summary.reduce((a, s) => a + s.created, 0);
      toast(totalCreated > 0 ? tr('adminAutomations.toastCreated', { n: totalCreated }) : tr('adminAutomations.toastNothingNew'));
      load();
    } catch (e) {
      toast(e.message);
    } finally {
      setRunning(false);
    }
  }

  return (
    <div>
      <h2 className="section-title" style={{ marginTop: 0 }}>{tr('adminAutomations.title')}</h2>
      <div className="card" style={{ marginBottom: 16, borderLeft: '3px solid var(--gold-deep)' }}>
        <p className="small" style={{ margin: 0 }}>
          {tr('adminAutomations.intro')}
        </p>
      </div>
      <div className="row" style={{ justifyContent: 'flex-end', marginBottom: 14 }}>
        <button className="btn-teal" disabled={running} onClick={runNow}>{running ? '...' : '▶ Lancer maintenant'}</button>
      </div>

      {!rules && <SkeletonCards count={3} />}
      {rules && rules.map((r) => <RuleCard key={r.ruleType} rule={r} onChanged={load} />)}

      {log && log.length > 0 && (
        <>
          <h3 style={{ margin: '20px 0 10px', fontSize: 15 }}>{tr('adminAutomations.runHistory')}</h3>
          {log.map((l) => (
            <div key={l.id} className="row" style={{ justifyContent: 'space-between', padding: '4px 0', borderBottom: '1px solid var(--cream-dim)' }}>
              <span className="small">{AUTOMATION_RULES_META[l.ruleType]?.label || l.ruleType}</span>
              <span className="small">{tr('adminAutomations.runLine', { created: l.createdCount, matched: l.matchedCount, date: fmtDateTime(l.ranAt) })}</span>
            </div>
          ))}
        </>
      )}
    </div>
  );
}

function RuleCard({ rule, onChanged }) {
  const { t: tr } = useLanguage();
  const { token } = useAuth();
  const toast = useToast();
  const meta = AUTOMATION_RULES_META[rule.ruleType] || { label: rule.ruleType, description: '', params: [] };
  const [params, setParams] = useState(rule.params);
  const [saving, setSaving] = useState(false);

  const dirty = JSON.stringify(params) !== JSON.stringify(rule.params);

  async function toggleEnabled() {
    try {
      await api(`/admin/automations/rules/${rule.ruleType}`, { method: 'PATCH', token, body: { enabled: !rule.enabled } });
      onChanged();
    } catch (e) {
      toast(e.message);
    }
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

  return (
    <div className="card" style={{ opacity: rule.enabled ? 1 : 0.6 }}>
      <div className="row" style={{ justifyContent: 'space-between', alignItems: 'flex-start' }}>
        <div>
          <b>{meta.label}</b>
          <p className="small" style={{ margin: '2px 0 0', opacity: 0.75 }}>{meta.description}</p>
        </div>
        <button className={rule.enabled ? 'btn-danger-ghost' : 'btn-teal'} style={{ padding: '4px 12px', fontSize: 12, flexShrink: 0 }} onClick={toggleEnabled}>
          {rule.enabled ? tr('adminCommon.disable') : 'Activer'}
        </button>
      </div>
      {meta.params.length > 0 && (
        <div className="row" style={{ gap: 8, marginTop: 8, flexWrap: 'wrap', alignItems: 'flex-end' }}>
          {meta.params.map((pf) => (
            <div className="field" key={pf.key} style={{ maxWidth: 160 }}>
              <label>{pf.label}</label>
              <input type="number" step={pf.step || '1'} value={params[pf.key] ?? ''} onChange={(e) => setParams({ ...params, [pf.key]: Number(e.target.value) })} />
            </div>
          ))}
          <button className="btn-outline" style={{ padding: '6px 14px', fontSize: 13 }} disabled={!dirty || saving} onClick={saveParams}>{saving ? '...' : 'Enregistrer'}</button>
        </div>
      )}
      <p className="small" style={{ margin: '8px 0 0', opacity: 0.6 }}>
        {rule.lastRunAt ? tr('adminAutomations.lastRun', { date: fmtDateTime(rule.lastRunAt), created: rule.lastRunCreatedCount ?? 0, matched: rule.lastRunMatchedCount ?? 0 }) : tr('adminAutomations.neverRun')}
      </p>
    </div>
  );
}
