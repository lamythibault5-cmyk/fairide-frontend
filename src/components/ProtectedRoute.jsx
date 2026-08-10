import { Navigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';

export default function ProtectedRoute({ role, admin, children }) {
  const { user, role: userRole } = useAuth();
  if (!user) return <Navigate to="/login" replace />;
  if (role && userRole !== role) return <Navigate to="/" replace />;
  if (admin && !user.isAdmin) return <Navigate to="/" replace />;
  return children;
}
