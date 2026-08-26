import { Outlet } from 'react-router-dom';

// Coquille légère : chaque page admin charge ses propres données de façon indépendante (pas de
// pré-requis partagé comme restoId côté restaurateur), donc pas de state à faire descendre ici — la
// sidebar admin dédiée vit dans DashboardSidebar.jsx (détectée via l'URL /admin/*).
export default function AdminLayout() {
  return <Outlet />;
}
