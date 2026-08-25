import { Navigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { usePreviewMode } from '../context/PreviewModeContext';

export default function ProtectedRoute({ role, admin, children }) {
  const { user, role: userRole } = useAuth();
  const { previewMode } = usePreviewMode();
  if (!user) return <Navigate to="/login" replace />;
  // Un restaurateur en mode aperçu peut naviguer dans les pages réservées aux clients (favoris,
  // commandes, carte, factures) pour explorer l'expérience cliente depuis son propre compte — jamais
  // l'inverse. Le token reste un vrai token restaurateur : les appels API aux endpoints client échouent
  // toujours côté serveur (403, voir requireRole), ces pages restent donc vides mais navigables.
  const roleOk = !role || userRole === role || (previewMode && userRole === 'restaurant' && role === 'client');
  if (!roleOk) return <Navigate to="/" replace />;
  if (admin && !user.isAdmin) return <Navigate to="/" replace />;
  return children;
}
