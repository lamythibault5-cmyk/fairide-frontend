import { Link, NavLink, Outlet, useLocation } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import BrandMark from './BrandMark';
import Footer from './Footer';
import CookieBanner from './CookieBanner';
import AssistantWidget from './AssistantWidget';

export default function Layout() {
  const { user, role, logout } = useAuth();
  const location = useLocation();

  return (
    <>
      <div className="hero">
        <div className="hero-inner">
          <div className="row" style={{ justifyContent: 'space-between' }}>
            <Link className="brand" to="/">
              <BrandMark size={64} />
              <div className="brand-text">
                <h1>Fairide</h1>
                <span className="brand-slogan">Pay the meal, not the platform.</span>
              </div>
            </Link>
            {user && (
              <div className="userbar" style={{ padding: 0 }}>
                <Link to="/account" style={{ color: 'var(--cream)', textDecoration: 'none', marginRight: 10, fontWeight: 600 }}>
                  {user.name}
                </Link>
                <button className="btn-ghost" style={{ color: 'var(--cream)' }} onClick={logout}>
                  Se déconnecter
                </button>
              </div>
            )}
            {!user && (
              <div className="row header-auth" style={{ gap: 10 }}>
                <Link to="/login" className="header-auth-link">Connexion</Link>
                <Link to="/login?audience=client" className="btn-gold" style={{ padding: '9px 18px', fontSize: 13 }}>Inscription</Link>
              </div>
            )}
          </div>
          {user && (
            <nav className="role-nav">
              {role === 'client' && (
                <>
                  <NavLink to="/restaurants" className={({ isActive }) => (isActive ? 'active' : '')}>Restaurants</NavLink>
                  <NavLink to="/favorites" className={({ isActive }) => (isActive ? 'active' : '')}>Favoris</NavLink>
                  <NavLink to="/orders" className={({ isActive }) => (isActive ? 'active' : '')}>Mes commandes</NavLink>
                </>
              )}
              {role === 'restaurant' && (
                <NavLink to="/dashboard" className={({ isActive }) => (isActive ? 'active' : '')}>Mon commerce</NavLink>
              )}
              {role === 'driver' && (
                <NavLink to="/driver" className={({ isActive }) => (isActive ? 'active' : '')}>Livraisons</NavLink>
              )}
              <NavLink to="/account" className={({ isActive }) => (isActive ? 'active' : '')}>Mon compte</NavLink>
              {user.isAdmin && <NavLink to="/admin" className={({ isActive }) => (isActive ? 'active' : '')}>Admin</NavLink>}
            </nav>
          )}
        </div>
      </div>
      <div className="wrap" style={{ paddingTop: 24 }}>
        <div className="page-fade" key={location.pathname}>
          <Outlet />
        </div>
        <Footer />
      </div>
      <CookieBanner />
      <AssistantWidget />
    </>
  );
}
