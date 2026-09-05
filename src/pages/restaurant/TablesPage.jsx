import { Navigate } from 'react-router-dom';

// Le plan de salle a rejoint la page Réservations (onglet « Plan de salle ») : tables, zones, acompte
// par table et règles de réservation s'y règlent ensemble. L'adresse reste servie pour les liens
// déjà partagés ou mis en favori.
export default function TablesPage() {
  return <Navigate to="/dashboard/reservations?onglet=salle" replace />;
}
