import { Navigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import Landing from './Landing';

export default function Home() {
  const { user, role } = useAuth();
  if (!user) return <Landing />;
  if (user.isAdmin) return <Navigate to="/admin" replace />;
  if (role === 'restaurant') return <Navigate to="/dashboard" replace />;
  if (role === 'driver') return <Navigate to="/driver" replace />;
  return <Navigate to="/home" replace />;
}
