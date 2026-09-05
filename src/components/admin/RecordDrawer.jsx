import { useEffect } from 'react';
import { useLanguage } from '../../context/LanguageContext';

// Panneau latéral de fiche (vue « formulaire » d'Odoo) : glisse depuis la droite, en-tête fixe (titre,
// sous-titre, pastille de statut, actions, fermeture), onglets optionnels, corps qui défile seul.
// Le parent l'affiche dans un portail (createPortal) comme les anciennes modales ; Échap ferme.
export default function RecordDrawer({ title, subtitle, badge, actions, tabs, tab, onTab, onClose, width = 640, children, footer }) {
  const { t: tr } = useLanguage();
  useEffect(() => {
    function onKey(e) { if (e.key === 'Escape') onClose?.(); }
    document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
  }, [onClose]);

  return (
    <div className="modal-overlay drawer-overlay" onClick={onClose}>
      <aside className="record-drawer" role="dialog" aria-modal="true" aria-label={title || undefined} style={{ width: `min(${width}px, 100vw)` }} onClick={(e) => e.stopPropagation()}>
        <header className="record-drawer-head">
          <div className="record-drawer-title">
            {title && <h3>{title}</h3>}
            {subtitle && <p className="small">{subtitle}</p>}
          </div>
          <div className="record-drawer-tools">
            {badge}
            {actions}
            <button type="button" className="record-drawer-close" onClick={onClose} aria-label={tr('adminCommon.close')} title={tr('adminCommon.close')}>✕</button>
          </div>
        </header>
        {tabs && tabs.length > 0 && (
          <nav className="record-drawer-tabs" role="tablist">
            {tabs.map((t) => (
              <button key={t.key} type="button" role="tab" aria-selected={tab === t.key} className={tab === t.key ? 'active' : ''} onClick={() => onTab(t.key)}>
                {t.label}{t.count !== undefined && t.count !== null ? <span className="pill">{t.count}</span> : null}
              </button>
            ))}
          </nav>
        )}
        <div className="record-drawer-body">{children}</div>
        {footer && <footer className="record-drawer-foot">{footer}</footer>}
      </aside>
    </div>
  );
}

// Ligne « libellé → valeur » des fiches, pour que toutes les applications présentent leurs chiffres pareil.
export function DrawerRow({ label, value, strong }) {
  return (
    <div className="drawer-row">
      <span className="small">{label}</span>
      {strong ? <b className="small">{value}</b> : <span className="small">{value}</span>}
    </div>
  );
}
