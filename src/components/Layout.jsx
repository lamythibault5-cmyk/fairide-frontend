import { useState } from 'react';
import { Link, NavLink, Outlet, useLocation } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { useLanguage } from '../context/LanguageContext';
import BrandMark from './BrandMark';
import Footer from './Footer';
import CookieBanner from './CookieBanner';
import AssistantWidget from './AssistantWidget';
import LanguageSwitcher from './LanguageSwitcher';
import DashboardSidebar from './DashboardSidebar';
import FloatingCart from './FloatingCart';

// Pages "connectées" qui utilisent la coquille sidebar (client/livreur/restaurateur) au lieu de la
// nav du haut classique. /admin en est volontairement exclu (hors périmètre de cette passe).
const DASHBOARD_PATHS = ['/home', '/restaurants', '/favorites', '/orders', '/map', '/checkout', '/order-success', '/order-cancelled', '/account', '/dashboard', '/driver'];
function isDashboardPath(pathname) {
  return DASHBOARD_PATHS.some((p) => pathname === p || pathname.startsWith(`${p}/`));
}

export default function Layout() {
  const { user, role, logout } = useAuth();
  const { t } = useLanguage();
  const location = useLocation();
  const [rightSlot, setRightSlot] = useState(null);

  if (user && isDashboardPath(location.pathname)) {
    return (
      <>
        <div className={`dashboard-shell${rightSlot ? ' has-right' : ''}`}>
          <DashboardSidebar />
          <main className="dashboard-main">
            <div className="page-fade" key={location.pathname}>
              <Outlet context={{ setRightSlot }} />
            </div>
            <div className="dashboard-footer-links">
              <Link to="/mentions-legales">{t('footer.legalNotice')}</Link>
              <Link to="/cgv">{t('footer.terms')}</Link>
              <Link to="/confidentialite">{t('footer.privacy')}</Link>
            </div>
          </main>
          {rightSlot && <aside className="dashboard-right">{rightSlot}</aside>}
        </div>
        <CookieBanner />
        {role === 'client' && <FloatingCart />}
        <AssistantWidget />
      </>
    );
  }

  return (
    <>
      <div className="hero">
        <div className="hero-inner">
          <div className="row" style={{ justifyContent: 'space-between' }}>
            <Link className="brand" to="/">
              <BrandMark size={64} />
              <div className="brand-text">
                <h1>Fairide</h1>
                <span className="brand-slogan">{t('common.slogan')}</span>
              </div>
            </Link>
            <div className="row" style={{ gap: 12, alignItems: 'center' }}>
              <LanguageSwitcher />
              {user && (
                <div className="userbar" style={{ padding: 0 }}>
                  <Link to="/account" style={{ color: 'var(--cream)', textDecoration: 'none', marginRight: 10, fontWeight: 600 }}>
                    {user.name}
                  </Link>
                  <button className="btn-ghost" style={{ color: 'var(--cream)' }} onClick={logout}>
                    {t('nav.logout')}
                  </button>
                </div>
              )}
              {!user && (
                <div className="row header-auth" style={{ gap: 10 }}>
                  <Link to="/login" className="header-auth-link">{t('nav.login')}</Link>
                  <Link to="/login?audience=client" className="btn-gold" style={{ padding: '9px 18px', fontSize: 13 }}>{t('nav.register')}</Link>
                </div>
              )}
            </div>
          </div>
          {user && (
            <nav className="role-nav">
              {role === 'client' && (
                <>
                  <NavLink to="/restaurants" className={({ isActive }) => (isActive ? 'active' : '')}>{t('nav.restaurants')}</NavLink>
                  <NavLink to="/favorites" className={({ isActive }) => (isActive ? 'active' : '')}>{t('nav.favorites')}</NavLink>
                  <NavLink to="/orders" className={({ isActive }) => (isActive ? 'active' : '')}>{t('nav.orders')}</NavLink>
                </>
              )}
              {role === 'restaurant' && (
                <NavLink to="/dashboard" className={({ isActive }) => (isActive ? 'active' : '')}>{t('nav.myBusiness')}</NavLink>
              )}
              {role === 'driver' && (
                <NavLink to="/driver" className={({ isActive }) => (isActive ? 'active' : '')}>{t('nav.deliveries')}</NavLink>
              )}
              <NavLink to="/account" className={({ isActive }) => (isActive ? 'active' : '')}>{t('nav.account')}</NavLink>
              {user.isAdmin && <NavLink to="/admin" className={({ isActive }) => (isActive ? 'active' : '')}>{t('nav.admin')}</NavLink>}
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
      {role === 'client' && <FloatingCart />}
      <AssistantWidget />
    </>
  );
}
