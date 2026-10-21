import { useEffect } from 'react';
import { Navigate, useLocation } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { usePreviewMode } from '../context/PreviewModeContext';
import { useToast } from '../context/ToastContext';
import { useLanguage } from '../context/LanguageContext';

/* LIEN D'UN AUTRE RÔLE (audit du 19/10, CROSS-21) : un livreur qui ouvre une invitation à une commande groupée, un client qui
 * ouvre le lien d'un e-mail de commerce, arrivaient sur leur propre accueil sans un mot, et le lien était perdu. On le dit,
 * avec ce qui permet de l'ouvrir : prendre la casquette dans Mon compte (MesCasquettes.jsx). */
function RoleManquant({ role }) {
  const toast = useToast();
  const { t } = useLanguage();
  useEffect(() => {
    if (['client', 'restaurant', 'driver'].includes(role)) toast(t(`common.wrongRole_${role}`), 'erreur');
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);
  return <Navigate to="/" replace />;
}

export default function ProtectedRoute({ role, admin, children }) {
  const { user, role: userRole, roles } = useAuth();
  const { previewMode } = usePreviewMode();
  const location = useLocation();
  // On retient la page demandée : après une session expirée au checkout, la reconnexion ramène au checkout (panier
  // intact) au lieu de la liste des commerces (plan de test USR-6). Auth.jsx lit location.state.from.
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
  if (!roleOk) return <RoleManquant role={role} />;
  if (admin && !user.isAdmin) return <Navigate to="/" replace />;
  return children;
}
