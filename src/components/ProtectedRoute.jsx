import { Navigate, useLocation } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { usePreviewMode } from '../context/PreviewModeContext';
import RedirectionRole from './RedirectionRole';
import { lazyPage } from '../lazyPage';

// Commerce et livreur : numéro prouvé avant d'entrer (fondateur, 2026-11-05, voir MurTelephone.jsx). Le client, lui, le prouve à
// sa première commande. Code reçu par e-mail après un SMS perdu (phoneEmailFallback) : il entre. Ni l'équipe qui agit pour le
// compte, ni un compte de test, ni la simulation.
const MurTelephone = lazyPage(() => import('./MurTelephone'));
function murTelephone(user, role, actingAdminEmail) {
  return (role === 'restaurant' || role === 'driver') && !user.phoneVerified && !user.phoneEmailFallback
    && !user.simulation && !user.isTest && !user.isAdmin && !actingAdminEmail;
}

export default function ProtectedRoute({ role, admin, children }) {
  const { user, role: userRole, roles, deconnexionVoulue, actingAdminEmail } = useAuth();
  const { previewMode } = usePreviewMode();
  const location = useLocation();
  // On retient la page demandée : après une session expirée au checkout, la reconnexion ramène au checkout (panier
  // intact) au lieu de la liste des commerces (plan de test USR-6). Auth.jsx lit location.state.from.
  // Après « Se déconnecter » (audit du 19/10, auth-14) : l'accueil, sans garder la page quittée (voir AuthContext.jsx).
  if (!user && deconnexionVoulue) return <Navigate to="/" replace />;
  if (!user) return <Navigate to="/login" replace state={{ from: location.pathname + location.search }} />;
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
  // Page d'un autre rôle (audit du 19/10, auth-17) : on le dit, et « Mes casquettes » (Mon compte) permet d'ajouter ce rôle.
  if (!roleOk) return ['client', 'restaurant', 'driver'].includes(role) ? <RedirectionRole role={role} /> : <Navigate to="/" replace />;
  if (admin && !user.isAdmin) return <Navigate to="/" replace />;
  if (murTelephone(user, role, actingAdminEmail)) return <MurTelephone role={role} />;
  return children;
}
