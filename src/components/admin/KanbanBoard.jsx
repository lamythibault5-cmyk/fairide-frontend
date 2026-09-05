import { useState } from 'react';

// Vue kanban générique (colonnes = statuts ou étapes), avec glisser-déposer natif : déplacer une carte
// appelle onMove(item, colonne) — c'est l'appelant qui confirme et enregistre. Utilisée par Commandes,
// CRM, Support et Tâches, pour que la même manipulation vaille dans tout l'ERP.
//
// columns : [{ key, label, color? , hint? }]   items : tableau   columnOf(item) → key
// renderCard(item) → contenu de la carte   onOpen(item)   onMove(item, key) (absent = lecture seule)
export default function KanbanBoard({ columns, items, columnOf, renderCard, onOpen, onMove, emptyLabel = '—', footer }) {
  const [survol, setSurvol] = useState(null);
  const [glisse, setGlisse] = useState(null);
  const parColonne = Object.fromEntries(columns.map((c) => [c.key, []]));
  for (const it of items || []) {
    const k = columnOf(it);
    (parColonne[k] || (parColonne[k] = [])).push(it);
  }
  return (
    <div className="kanban" role="list">
      {columns.map((col) => {
        const liste = parColonne[col.key] || [];
        return (
          <section
            key={col.key}
            className={`kanban-col${survol === col.key ? ' drop' : ''}`}
            role="listitem"
            onDragOver={(e) => { if (onMove && glisse) { e.preventDefault(); setSurvol(col.key); } }}
            onDragLeave={() => setSurvol((s) => (s === col.key ? null : s))}
            onDrop={(e) => {
              e.preventDefault(); setSurvol(null);
              if (!onMove || !glisse) return;
              if (columnOf(glisse) !== col.key) onMove(glisse, col.key);
              setGlisse(null);
            }}
          >
            <header className="kanban-col-head">
              <span className="kanban-col-dot" style={{ background: col.color || 'var(--line)' }} />
              <b>{col.label}</b>
              <span className="pill">{liste.length}</span>
            </header>
            {col.hint && <p className="small kanban-col-hint">{col.hint}</p>}
            <div className="kanban-col-body">
              {liste.map((it) => (
                <article
                  key={it.id}
                  className={`kanban-card${onMove ? ' draggable' : ''}${glisse?.id === it.id ? ' dragging' : ''}`}
                  draggable={!!onMove}
                  onDragStart={(e) => { setGlisse(it); e.dataTransfer.effectAllowed = 'move'; }}
                  onDragEnd={() => { setGlisse(null); setSurvol(null); }}
                  onClick={() => onOpen?.(it)}
                >
                  {renderCard(it)}
                </article>
              ))}
              {liste.length === 0 && <div className="kanban-empty small">{emptyLabel}</div>}
            </div>
            {footer && <div className="kanban-col-foot">{footer(col, liste)}</div>}
          </section>
        );
      })}
    </div>
  );
}

// Bascule liste / kanban, mémorisée par application (localStorage) — même geste partout.
export function useViewMode(moduleKey, defaut = 'list') {
  const cle = `fairide_admin_view_${moduleKey}`;
  const [mode, setMode] = useState(() => { try { return localStorage.getItem(cle) || defaut; } catch { return defaut; } });
  const changer = (m) => { setMode(m); try { localStorage.setItem(cle, m); } catch { /* sans stockage */ } };
  return [mode, changer];
}

export function ViewSwitcher({ mode, onChange, labels }) {
  return (
    <div className="view-switcher" role="group" aria-label={labels.aria}>
      <button type="button" className={mode === 'list' ? 'active' : ''} onClick={() => onChange('list')} title={labels.list} aria-pressed={mode === 'list'}>☰ <span>{labels.list}</span></button>
      <button type="button" className={mode === 'kanban' ? 'active' : ''} onClick={() => onChange('kanban')} title={labels.kanban} aria-pressed={mode === 'kanban'}>▦ <span>{labels.kanban}</span></button>
    </div>
  );
}
