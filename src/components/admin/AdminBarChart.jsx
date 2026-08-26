// Graphique en barres maison, sans dépendance (aucune lib de charts dans le projet, bundle déjà signalé
// comme gros par le build) — juste assez pour visualiser une série journalière (commandes/GMV/revenu) sur
// le dashboard et la page Finance. `data` : [{ label, value }]. `formatValue` formate l'infobulle/l'axe.
export default function AdminBarChart({ data, formatValue = (v) => v, color = 'var(--teal)', height = 140 }) {
  if (!data || data.length === 0) {
    return <div className="empty" style={{ padding: '24px 0' }}>Pas encore de données sur cette période.</div>;
  }
  const max = Math.max(1, ...data.map((d) => d.value));
  const barWidth = 100 / data.length;

  return (
    <div style={{ width: '100%', overflowX: data.length > 30 ? 'auto' : 'visible' }}>
      <svg viewBox={`0 0 100 ${height}`} preserveAspectRatio="none" style={{ width: '100%', height, minWidth: data.length > 30 ? data.length * 8 : 'auto' }}>
        {data.map((d, i) => {
          const barHeight = (d.value / max) * (height - 20);
          const x = i * barWidth;
          return (
            <g key={i}>
              <title>{`${d.label} : ${formatValue(d.value)}`}</title>
              <rect
                x={x + barWidth * 0.15}
                y={height - 16 - barHeight}
                width={barWidth * 0.7}
                height={Math.max(1, barHeight)}
                fill={color}
                rx={1}
                opacity={0.85}
              />
            </g>
          );
        })}
        <line x1="0" y1={height - 16} x2="100" y2={height - 16} stroke="var(--line)" strokeWidth="0.5" />
      </svg>
      <div className="row" style={{ justifyContent: 'space-between', marginTop: 4 }}>
        <span className="small" style={{ opacity: 0.6 }}>{data[0]?.label}</span>
        <span className="small" style={{ opacity: 0.6 }}>{data[data.length - 1]?.label}</span>
      </div>
    </div>
  );
}
