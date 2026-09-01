import { useState } from 'react';
import { Link, NavLink, Outlet, useLocation } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { useLanguage } from '../context/LanguageContext';
import { usePreviewMode } from '../context/PreviewModeContext';
import BrandMark from './BrandMark';
import Footer from './Footer';
import CookieBanner from './CookieBanner';
import AssistantWidget from './AssistantWidget';
import LanguageSwitcher from './LanguageSwitcher';
import DashboardSidebar from './DashboardSidebar';
import FloatingCart from './FloatingCart';
import BrandWatermark from './BrandWatermark';

// Pages "connectées" qui utilisent la coquille sidebar (client/livreur/restaurateur/admin) au lieu de
// la nav du haut classique.
const DASHBOARD_PATHS = ['/home', '/restaurants', '/favorites', '/orders', '/map', '/invoices', '/checkout', '/order-success', '/order-cancelled', '/account', '/dashboard', '/driver', '/admin'];
function isDashboardPath(pathname) {
  return DASHBOARD_PATHS.some((p) => pathname === p || pathname.startsWith(`${p}/`));
}
// Fiche resto (/restaurants/:id) consultable sans compte (voir App.jsx) — un visiteur non connecté y
// arrive donc sur la nav publique plutôt que la coquille sidebar. On y allège quand même ce header
// (pas de gros bloc "Connexion/Inscription" au-dessus d'une carte de menu) : l'ajout au panier redirige
// déjà vers /login au bon moment (voir RestaurantMenu.jsx), le module d'auth du header y est redondant.
const RESTAURANT_DETAIL_PATH = /^\/restaurants\/[^/]+$/;
export default function Layout() {
  const { user, role, logout } = useAuth();
  const { t } = useLanguage();
  const location = useLocation();
  const { previewMode } = usePreviewMode();
  const [rightSlot, setRightSlot] = useState(null);
  // Le restaurateur en mode aperçu voit le panier flottant comme un vrai client (voir RestaurantMenu.jsx
  // "addToCart" réel, pas le panier isolé de RestaurantPreview) — pousser jusqu'au paiement échoue
  // volontairement côté serveur (requireRole('client')), ce qui bloque naturellement au bon endroit.
  const seesClientCart = !user?.isAdmin && (role === 'client' || (previewMode && role === 'restaurant'));
  const leanHeader = !user && RESTAURANT_DETAIL_PATH.test(location.pathname);

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
        {seesClientCart && <FloatingCart />}
        <AssistantWidget />
        <BrandWatermark />
      </>
    );
  }

  return (
    <>
      <div className={`hero${leanHeader ? ' hero-lean' : ''}`}>
        <div className="hero-inner">
          <div className="row" style={{ justifyContent: 'space-between' }}>
            <Link className="brand" to="/">
              <BrandMark size={leanHeader ? 34 : 48} />
              {!leanHeader && (
                <div className="brand-text">
                  <h1>fairide</h1>
                  <span className="brand-slogan">{t('common.slogan')}</span>
                </div>
              )}
            </Link>
            <LanguageSwitcher />
            {!leanHeader && user && (
              <div className="userbar" style={{ padding: 0 }}>
                <Link to="/account" style={{ color: 'var(--cream)', textDecoration: 'none', marginRight: 10, fontWeight: 600 }}>
                  {user.name}
                </Link>
                <button className="btn-ghost" style={{ color: 'var(--cream)' }} onClick={logout}>
                  {t('nav.logout')}
                </button>
              </div>
            )}
            {/* header-auth reste un item atomique (non wrappable) de cette même rangée flex-wrap : sur
                grand écran il tient à côté de la marque/langues, et retombe proprement à la ligne (seul,
                sous la zone du filigrane .brand-watermark) dès que la largeur manque — voir styles.css. */}
            {!leanHeader && !user && (
              <div className="row header-auth">
                <Link to="/login" className="header-auth-link">{t('nav.login')}</Link>
                <Link to="/login?audience=client" className="btn-gold header-register-btn">{t('nav.register')}</Link>
              </div>
            )}
          </div>
          {user && (
            <nav className="role-nav">
              {/* Le compte admin ne voit jamais la nav client/restaurateur/livreur, seulement l'ERP —
                  voir la même règle dans DashboardSidebar.jsx (isAdminAccount). */}
              {!user.isAdmin && role === 'client' && (
                <>
                  <NavLink to="/restaurants" className={({ isActive }) => (isActive ? 'active' : '')}>{t('nav.restaurants')}</NavLink>
                  <NavLink to="/favorites" className={({ isActive }) => (isActive ? 'active' : '')}>{t('nav.favorites')}</NavLink>
                  <NavLink to="/orders" className={({ isActive }) => (isActive ? 'active' : '')}>{t('nav.orders')}</NavLink>
                </>
              )}
              {!user.isAdmin && role === 'restaurant' && (
                <NavLink to="/dashboard" className={({ isActive }) => (isActive ? 'active' : '')}>{t('nav.myBusiness')}</NavLink>
              )}
              {!user.isAdmin && role === 'driver' && (
                <NavLink to="/driver" className={({ isActive }) => (isActive ? 'active' : '')}>{t('nav.deliveries')}</NavLink>
              )}
              {!user.isAdmin && <NavLink to="/account" className={({ isActive }) => (isActive ? 'active' : '')}>{t('nav.account')}</NavLink>}
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
      {seesClientCart && <FloatingCart />}
      <AssistantWidget />
      <BrandWatermark />
    </>
  );
}
