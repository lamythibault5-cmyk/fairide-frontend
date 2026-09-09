import { Outlet, useLocation } from 'react-router-dom';
import AdminErrorBoundary from '../../components/admin/AdminErrorBoundary';
import '../../admin-erp.css';

// Coquille légère : chaque page admin charge ses propres données de façon indépendante (pas de
// pré-requis partagé comme restoId côté restaurateur), donc pas de state à faire descendre ici — la
// sidebar admin dédiée vit dans DashboardSidebar.jsx (détectée via l'URL /admin/*).
//
// La limite d'erreur enveloppe seulement la page courante : une application qui plante affiche une
// carte « Recharger » sans emporter la barre latérale ni les autres applications.
export default function AdminLayout() {
  const { pathname } = useLocation();
  // La coquille (Layout.jsx) ne se recrée plus à chaque adresse admin : c'est ici que chaque page apparaît en fondu.
  return (
    <div className="page-fade" key={pathname}>
      <AdminErrorBoundary resetKey={pathname}><Outlet /></AdminErrorBoundary>
    </div>
  );
}
