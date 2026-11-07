// Commerce et livreur : numéro prouvé avant d'entrer (fondateur, 2026-11-05, voir components/MurTelephone.jsx). Le client, lui, le
// prouve à sa première commande. Code reçu par e-mail après un SMS perdu (phoneEmailFallback) : il entre. Ni l'équipe qui agit
// pour le compte, ni un compte de test, ni la simulation. Lue par ProtectedRoute (le mur) et DashboardLayout (le bandeau de la
// page Commandes, qui reste ouverte : G16).
export function murTelephone(user, role, actingAdminEmail) {
  return !!user && (role === 'restaurant' || role === 'driver') && !user.phoneVerified && !user.phoneEmailFallback
    && !user.simulation && !user.isTest && !user.isAdmin && !actingAdminEmail;
}

// La seule page du commerce que le mur laisse ouverte (G16) : les commandes, leur alarme et la feuille « Nouvelle commande ».
export const PAGE_HORS_MUR = '/dashboard/orders';
