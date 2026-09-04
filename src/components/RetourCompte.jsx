import { Link } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';

// Lien de retour vers Mon compte, pour les sous-sections qui vivent HORS de l'espace connecté (aide,
// histoire) et n'ont donc pas la barre du haut du tableau de bord. Rendu seulement pour quelqu'un
// de connecté : un visiteur n'a pas de compte où retourner, et un lien vers une page de connexion
// déguisé en « retour » serait un mensonge.
export default function RetourCompte() {
  const { user } = useAuth();
  if (!user) return null;
  return <Link to="/account" className="retour-compte">← Mon compte</Link>;
}
