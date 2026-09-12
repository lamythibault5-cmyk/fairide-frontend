import { api } from '../../../api';
import { useLanguage } from '../../../context/LanguageContext';
import { useApiData } from '../accounting/common';

// Briques partagées des onglets de l'application Rapports : chargement d'un rapport, carte KPI avec
// variation vs période précédente, heatmap, barres horizontales, barres empilées, étapes d'entonnoir.

// Charge /admin/reports/<path>?<query> ; `query` inclut déjà la période et includeTest.
export function useReport(path, token, query) {
  return useApiData(() => api(`/admin/reports/${path}?${query}`, { token }), [path, query, token]);
}

// Même présentation que les KPI du tableau de bord (stat-card + ▲/▼ en couleur). `changePct` null =
// pas de période précédente ; `invert` pour les indicateurs où une hausse est mauvaise.
export function KpiCard({ label, value, changePct = null, invert = false, highlight = false }) {
  const { t: tr } = useLanguage();
  const up = changePct !== null && changePct > 0;
  const bon = invert ? !up : up;
  return (
    <div className={`stat-card${highlight ? ' highlight' : ''}`}>
      <div className="num">{value ?? '-'}</div>
      <div className="label">{label}</div>
      {changePct !== null && changePct !== 0 && (
        <div className="small" style={{ color: bon ? 'var(--teal-deep)' : 'var(--red)', marginTop: 2 }}>
          {up ? '▲' : '▼'} {tr('adminDash.vsPrevious', { pct: Math.abs(changePct) })}
        </div>
      )}
      {changePct === null && <div className="small" style={{ opacity: 0.6, marginTop: 2 }}>{tr('adminAccounting.noPrevious')}</div>}
    </div>
  );
}

// Variation en % entre deux valeurs (null si pas de base).
export function deltaPct(current, previous) {
  const p = Number(previous) || 0;
  if (p <= 0) return null;
  return +((((Number(current) || 0) - p) / p) * 100).toFixed(1);
}

// Libellé d'un type de commande (delivery / pickup / dine_in) ; valeur brute si inconnue.
export function orderTypeLabel(type, tr) {
  const key = `adminReports.type_${type}`;
  const label = tr(key);
  return label === key ? type : label;
}

export function SectionCard({ title, help, actions, children }) {
  return (
    <div className="card">
      <h3 className="rep-card-title">{title}{actions && <><span className="spacer" />{actions}</>}</h3>
      {help && <p className="rep-card-help">{help}</p>}
      {children}
    </div>
  );
}

// Heatmap jour de la semaine (lundi = 0) × heure : grille CSS, intensité proportionnelle au maximum.
export function Heatmap({ cells }) {
  const { t: tr, locale } = useLanguage();
  const map = new Map((cells || []).map((c) => [`${c.weekday}-${c.hour}`, c.orders]));
  const max = Math.max(1, ...(cells || []).map((c) => c.orders));
  // Le 1er janvier 2024 est un lundi : libellés courts des jours dans la langue de l'admin.
  const jours = Array.from({ length: 7 }, (_, i) => new Date(2024, 0, 1 + i).toLocaleDateString(locale, { weekday: 'short' }));
  const heures = Array.from({ length: 24 }, (_, h) => h);
  if (!cells || cells.length === 0) return <div className="empty" style={{ padding: '24px 0' }}>{tr('adminCommon.noDataPeriod')}</div>;
  return (
    <div className="rep-heatmap-wrap">
      <div className="rep-heatmap" role="table" aria-label={tr('adminReports.heatmap')}>
        <div />
        {heures.map((h) => <div key={h} className="hd">{h % 3 === 0 ? `${h}h` : ''}</div>)}
        {jours.map((j, d) => (
          <div key={j} style={{ display: 'contents' }}>
            <div className="lbl">{j}</div>
            {heures.map((h) => {
              const v = map.get(`${d}-${h}`) || 0;
              const alpha = v > 0 ? 0.15 + 0.85 * (v / max) : 0;
              return <div key={h} className="cell" title={`${j} ${h}h : ${v}`} style={v > 0 ? { background: `rgba(59,47,181,${alpha.toFixed(2)})` } : undefined} />;
            })}
          </div>
        ))}
      </div>
    </div>
  );
}

// Liste de barres horizontales : rows = [{ label, value, display? }].
export function BarList({ rows, emptyLabel }) {
  const max = Math.max(1, ...(rows || []).map((r) => Number(r.value) || 0));
  if (!rows || rows.length === 0 || rows.every((r) => !r.value)) return <div className="empty" style={{ padding: '24px 0' }}>{emptyLabel}</div>;
  return (
    <div className="rep-bars">
      {rows.map((r) => (
        <div key={r.label} className="rep-bar-row">
          <span>{r.label}</span>
          <div className="rep-bar-track"><div className="rep-bar-fill" style={{ width: `${Math.max(1, ((Number(r.value) || 0) / max) * 100)}%` }} /></div>
          <span className="val">{r.display ?? r.value}</span>
        </div>
      ))}
    </div>
  );
}

// Barres empilées SVG (sans dépendance, comme AdminBarChart) : data = [{ label, values: { key: n } }],
// series = [{ key, label, color }].
export function StackedBars({ data, series, height = 150 }) {
  const { t: tr } = useLanguage();
  if (!data || data.length === 0) return <div className="empty" style={{ padding: '24px 0' }}>{tr('adminCommon.noDataPeriod')}</div>;
  const totals = data.map((d) => series.reduce((s, k) => s + (Number(d.values[k.key]) || 0), 0));
  const max = Math.max(1, ...totals);
  const w = 100 / data.length;
  return (
    <div className="rep-stacked">
      <svg viewBox={`0 0 100 ${height}`} preserveAspectRatio="none" style={{ height }}>
        {data.map((d, i) => {
          let y = height - 16;
          return (
            <g key={d.label}>
              <title>{`${d.label} : ${series.map((s) => `${s.label} ${d.values[s.key] || 0}`).join(', ')}`}</title>
              {series.map((s) => {
                const v = Number(d.values[s.key]) || 0;
                const h = (v / max) * (height - 20);
                y -= h;
                return <rect key={s.key} x={i * w + w * 0.15} y={y} width={w * 0.7} height={h} fill={s.color} rx={0.5} opacity={0.9} />;
              })}
            </g>
          );
        })}
        <line x1="0" y1={height - 16} x2="100" y2={height - 16} stroke="var(--line)" strokeWidth="0.5" />
      </svg>
      <div className="row" style={{ justifyContent: 'space-between', marginTop: 4 }}>
        <span className="small" style={{ opacity: 0.6 }}>{data[0]?.label}</span>
        <span className="small" style={{ opacity: 0.6 }}>{data[data.length - 1]?.label}</span>
      </div>
      <div className="rep-legend">{series.map((s) => <span key={s.key}><i style={{ background: s.color }} />{s.label}</span>)}</div>
    </div>
  );
}

// Étapes d'un entonnoir : steps = [{ label, value }], largeur relative à la première étape, taux de
// conversion par rapport à l'étape précédente.
export function FunnelSteps({ steps }) {
  const { t: tr } = useLanguage();
  const base = Math.max(1, Number(steps[0]?.value) || 0);
  return (
    <div className="rep-funnel">
      {steps.map((s, i) => {
        const v = Number(s.value) || 0;
        const prev = i > 0 ? Number(steps[i - 1].value) || 0 : null;
        const conv = prev ? Math.round((v / prev) * 100) : null;
        return (
          <div key={s.label} className="rep-funnel-step">
            <div>
              <div>{s.label}</div>
              {conv !== null && <div className="rep-funnel-conv">{tr('adminReports.pctOfPrevious', { pct: conv })}</div>}
            </div>
            <div className="rep-funnel-bar" style={{ width: `${Math.max(1, (v / base) * 100)}%`, opacity: 1 - i * 0.18 }} />
            <div className="num">{v}</div>
          </div>
        );
      })}
    </div>
  );
}
