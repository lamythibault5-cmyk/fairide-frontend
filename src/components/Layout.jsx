import { Link, NavLink, Outlet } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import BrandMark from './BrandMark';

export default function Layout() {
  const { user, role, logout } = useAuth();

  return (
    <>
      <div className="hero">
        <div className="hero-inner">
          <div className="row" style={{ justifyContent: 'space-between' }}>
            <Link className="brand" to="/">
              <BrandMark />
              <h1>Fairide</h1>
            </Link>
            {user && (
              <div className="userbar" style={{ padding: 0 }}>
                <span style={{ marginRight: 10 }}>{user.name}</span>
                <button className="btn-ghost" style={{ color: 'var(--cream)' }} onClick={logout}>
                  Se déconnecter
                </button>
              </div>
            )}
          </div>
          {user && (
            <nav className="role-nav">
              {role === 'client' && (
                <>
                  <NavLink to="/restaurants" className={({ isActive }) => (isActive ? 'active' : '')}>Restaurants</NavLink>
                  <NavLink to="/orders" className={({ isActive }) => (isActive ? 'active' : '')}>Mes commandes</NavLink>
                </>
              )}
              {role === 'restaurant' && (
                <NavLink to="/dashboard" className={({ isActive }) => (isActive ? 'active' : '')}>Mon restaurant</NavLink>
              )}
              {role === 'driver' && (
                <NavLink to="/driver" className={({ isActive }) => (isActive ? 'active' : '')}>Livraisons</NavLink>
              )}
            </nav>
          )}
        </div>
      </div>
      <div className="wrap" style={{ paddingTop: 24 }}>
        <Outlet />
      </div>
    </>
  );
}
