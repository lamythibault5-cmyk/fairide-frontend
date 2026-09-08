import { Outlet, useLocation } from 'react-router-dom';

// Coquille légère : chaque page admin charge ses propres données de façon indépendante (pas de
// pré-requis partagé comme restoId côté restaurateur), donc pas de state à faire descendre ici — la
// sidebar admin dédiée vit dans DashboardSidebar.jsx (détectée via l'URL /admin/*).
export default function AdminLayout() {
  const { pathname } = useLocation();
  // La coquille (Layout.jsx) ne se recrée plus à chaque adresse admin : c'est ici que chaque page apparaît en fondu.
  return <div className="page-fade" key={pathname}><Outlet /></div>;
}
