import { useState } from 'react';
import { Link } from 'react-router-dom';
import { useLanguage } from '../../context/LanguageContext';
import { moduleByKey } from '../../pages/admin/adminModules';

// En-tête commun des applications de l'ERP : fil d'Ariane (Applications › Module), icône, titre, phrase
// d'aide dépliable (« à quoi sert cette application, que faire ici ») et emplacement pour les actions.
// Une seule façon d'entrer dans chaque module, pour que l'ERP se lise partout de la même manière.
export default function AdminPageHeader({ module, title, actions, children }) {
  const { t: tr } = useLanguage();
  const [aide, setAide] = useState(false);
  const mod = moduleByKey(module);
  const nom = title || (mod ? tr(`adminModules.${mod.key}`) : '');
  const description = mod ? tr(`adminModules.${mod.key}_desc`) : '';
  const conseils = mod ? tr(`adminModules.${mod.key}_help`) : '';
  return (
    <header className="admin-page-header">
      <nav className="admin-breadcrumb" aria-label={tr('adminHome.breadcrumbAria')}>
        <Link to="/admin">{tr('adminHome.apps')}</Link>
        <span aria-hidden="true">›</span>
        <span>{nom}</span>
      </nav>
      <div className="admin-page-header-row">
        <div className="admin-page-header-title">
          {mod && <span className="admin-page-header-icon" aria-hidden="true">{mod.icon}</span>}
          <div>
            <h2>{nom}</h2>
            {description && (
              <p className="small">
                {description}
                {conseils && conseils !== `adminModules.${mod.key}_help` && (
                  <button type="button" className="admin-help-toggle" onClick={() => setAide((v) => !v)} aria-expanded={aide}>{aide ? tr('adminHome.helpLess') : tr('adminHome.helpMore')}</button>
                )}
              </p>
            )}
          </div>
        </div>
        {actions && <div className="admin-page-header-actions">{actions}</div>}
      </div>
      {aide && conseils && <div className="admin-help-box">{conseils}</div>}
      {children}
    </header>
  );
}
