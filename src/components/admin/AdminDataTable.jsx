import { useMemo, useState } from 'react';

// Vue « liste » façon Odoo, partagée par les applications de l'ERP : colonnes triables, regroupement
// optionnel (en-têtes de groupe avec compteur et sommes), ligne cliquable, pied de totaux.
//
// columns : [{ key, label, get(row) → contenu affiché, sortValue?(row) → valeur de tri (sinon get),
//              align?: 'right', sum?: true (total en pied et par groupe), width? }]
// groupBy : { get(row) → libellé du groupe } | null

export function useTableSort(defaultKey, defaultDir = 'desc') {
  const [sort, setSort] = useState({ key: defaultKey, dir: defaultDir });
  function toggle(key) {
    setSort((s) => (s.key === key ? { key, dir: s.dir === 'asc' ? 'desc' : 'asc' } : { key, dir: 'desc' }));
  }
  return { sort, toggle, setSort };
}

function valeurTri(col, row) {
  const v = col.sortValue ? col.sortValue(row) : col.get(row);
  if (v === null || v === undefined) return null;
  if (typeof v === 'number' || typeof v === 'boolean') return Number(v);
  if (typeof v === 'string') { const n = Number(v.replace(/[^\d.-]/g, '')); return v.trim() !== '' && /^[\d\s.,€%-]+$/.test(v) && !Number.isNaN(n) ? n : v.toLowerCase(); }
  return String(v);
}

export function sortRows(rows, columns, sort) {
  if (!sort?.key) return rows;
  const col = columns.find((c) => c.key === sort.key);
  if (!col) return rows;
  const sens = sort.dir === 'asc' ? 1 : -1;
  return [...rows].sort((a, b) => {
    const va = valeurTri(col, a); const vb = valeurTri(col, b);
    if (va === null || va === undefined || va === '') return 1;
    if (vb === null || vb === undefined || vb === '') return -1;
    if (typeof va === 'number' && typeof vb === 'number') return (va - vb) * sens;
    return String(va).localeCompare(String(vb), undefined, { numeric: true, sensitivity: 'base' }) * sens;
  });
}

function sommes(columns, rows) {
  const out = {};
  for (const c of columns) if (c.sum) out[c.key] = rows.reduce((s, r) => s + (Number(c.sortValue ? c.sortValue(r) : c.get(r)) || 0), 0);
  return out;
}

export default function AdminDataTable({ columns, rows, sort, onSort, groupBy, onRowClick, rowClassName, emptyLabel = '—', showTotals = false, format = {} }) {
  const tries = useMemo(() => sortRows(rows || [], columns, sort), [rows, columns, sort]);
  const groupes = useMemo(() => {
    if (!groupBy) return null;
    const map = new Map();
    for (const r of tries) { const k = groupBy.get(r) ?? '—'; if (!map.has(k)) map.set(k, []); map.get(k).push(r); }
    return [...map.entries()];
  }, [tries, groupBy]);
  const fmt = (col, v) => (format[col.key] ? format[col.key](v) : (typeof v === 'number' ? v.toLocaleString('fr-BE', { maximumFractionDigits: 2 }) : v));
  const nbCol = columns.length;

  function ligne(r, i) {
    return (
      <tr key={r.id || i} className={`${onRowClick ? 'clickable' : ''} ${rowClassName ? rowClassName(r) : ''}`} onClick={onRowClick ? () => onRowClick(r) : undefined}>
        {columns.map((c) => <td key={c.key} style={{ textAlign: c.align || 'left', width: c.width }}>{c.get(r)}</td>)}
      </tr>
    );
  }
  function ligneTotaux(liste, libelle, cle) {
    const s = sommes(columns, liste);
    return (
      <tr key={cle} className="admin-table-group">
        {columns.map((c, i) => (
          <td key={c.key} style={{ textAlign: c.align || 'left' }}>
            {i === 0 ? <b>{libelle} <span className="pill">{liste.length}</span></b> : (c.sum ? <b>{fmt(c, s[c.key])}</b> : '')}
          </td>
        ))}
      </tr>
    );
  }

  return (
    <div className="table-scroll">
      <table className="admin-table admin-table-sortable">
        <thead>
          <tr>
            {columns.map((c) => (
              <th key={c.key} style={{ textAlign: c.align || 'left', width: c.width }} aria-sort={sort?.key === c.key ? (sort.dir === 'asc' ? 'ascending' : 'descending') : 'none'}>
                {onSort ? (
                  <button type="button" className={`admin-th-sort${sort?.key === c.key ? ' active' : ''}`} onClick={() => onSort(c.key)}>
                    {c.label}<span aria-hidden="true">{sort?.key === c.key ? (sort.dir === 'asc' ? ' ▲' : ' ▼') : ' ⇅'}</span>
                  </button>
                ) : c.label}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {tries.length === 0 && <tr><td colSpan={nbCol} className="small" style={{ textAlign: 'center', padding: 24, opacity: 0.6 }}>{emptyLabel}</td></tr>}
          {!groupes && tries.map(ligne)}
          {groupes && groupes.map(([k, liste]) => [ligneTotaux(liste, k, `g-${k}`), ...liste.map(ligne)])}
        </tbody>
        {showTotals && tries.length > 0 && columns.some((c) => c.sum) && (
          <tfoot>
            <tr>
              {columns.map((c, i) => <td key={c.key} style={{ textAlign: c.align || 'left' }}>{i === 0 ? <b>Σ {tries.length}</b> : (c.sum ? <b>{fmt(c, sommes(columns, tries)[c.key])}</b> : '')}</td>)}
            </tr>
          </tfoot>
        )}
      </table>
    </div>
  );
}
