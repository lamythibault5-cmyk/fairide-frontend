import { Navigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { usePreviewMode } from '../context/PreviewModeContext';

export default function ProtectedRoute({ role, admin, children }) {
  const { user, role: userRole, roles } = useAuth();
  const { previewMode } = usePreviewMode();
  if (!user) return <Navigate to="/login" replace />;
  // Un compte peut porter plusieurs casquettes (voir AuthContext) : une page réservée aux clients
  // s'ouvre donc aussi pour un restaurateur qui a pris la casquette client, même s'il consulte
  // actuellement son commerce. Le serveur dit la même chose (requireRole teste l'appartenance), et
  // c'est lui qui fait foi.
  const porteLeRole = !role || (Array.isArray(roles) && roles.includes(role));
  // Un restaurateur en mode aperçu peut naviguer dans les pages réservées aux clients (favoris,
  // commandes, carte, factures) pour explorer l'expérience cliente depuis son propre compte — jamais
  // l'inverse. Le token reste un vrai token restaurateur : les appels API aux endpoints client échouent
  // toujours côté serveur (403, voir requireRole), ces pages restent donc vides mais navigables.
  const roleOk = !role || porteLeRole || userRole === role || (previewMode && userRole === 'restaurant' && role === 'client');
  if (!roleOk) return <Navigate to="/" replace />;
  if (admin && !user.isAdmin) return <Navigate to="/" replace />;
  return children;
}
