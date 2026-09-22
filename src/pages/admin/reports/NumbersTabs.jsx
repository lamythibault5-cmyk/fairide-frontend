import { Link } from 'react-router-dom';
import { useLanguage } from '../../../context/LanguageContext';
import '../../../admin-finance.css';

// Les chiffres en un seul endroit (2026-09-23). Tableau de bord et Rapports étaient deux applications
// qui répondaient à la même question — « comment va Fairide ? » — sur deux périodes et deux écrans.
// Rapports est masquée de la navigation (adminModules.js) et ses quatre onglets deviennent ceux du
// Tableau de bord, derrière « Vue d'ensemble ». Les deux pages restent distinctes dans le code (elles
// n'ont ni les mêmes données ni le même sélecteur de période) ; seule cette rangée les réunit.
const VUES = [
  { key: 'overview', to: '/admin/dashboard' },
  { key: 'sales', to: '/admin/reports?tab=sales' },
  { key: 'customers', to: '/admin/reports?tab=customers' },
  { key: 'partners', to: '/admin/reports?tab=partners' },
  { key: 'funnel', to: '/admin/reports?tab=funnel' }
];

export default function NumbersTabs({ current }) {
  const { t: tr } = useLanguage();
  return (
    <nav className="fin-tabs" aria-label={tr('adminReports.tabsAria')}>
      {VUES.map((v) => (
        <Link key={v.key} to={v.to} aria-current={current === v.key ? 'page' : undefined} className={`chip${current === v.key ? ' active' : ''}`} style={{ textDecoration: 'none' }}>
          {tr(`adminReports.tab_${v.key}`)}
        </Link>
      ))}
    </nav>
  );
}
