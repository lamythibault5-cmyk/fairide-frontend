import { Link, NavLink, useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { useLanguage } from '../context/LanguageContext';
import { usePreviewMode } from '../context/PreviewModeContext';
import BrandMark from './BrandMark';

const HOME_PATH_BY_ROLE = { client: '/home', restaurant: '/dashboard', driver: '/driver' };

// Items de nav par rôle : mêmes cibles que l'ancien .role-nav de Layout.jsx, juste redisposées
// verticalement avec une icône — pas de nouvelle page/route inventée ici.
function navItemsForRole(role, t) {
  if (role === 'client') {
    return [
      { to: '/restaurants', icon: '🍽️', label: t('nav.restaurants') },
      { to: '/favorites', icon: '❤️', label: t('nav.favorites') },
      { to: '/orders', icon: '📦', label: t('nav.orders') },
      { to: '/invoices', icon: '📄', label: 'Factures' },
      { to: '/map', icon: '🗺️', label: 'Carte' },
      { to: '/account', icon: '👤', label: t('nav.account') }
    ];
  }
  if (role === 'restaurant') {
    return [
      { to: '/dashboard', end: true, icon: '🏪', label: t('nav.myBusiness') },
      { to: '/dashboard/orders', icon: '📦', label: t('nav.orders') },
      { to: '/dashboard/preview', icon: '👁️', label: 'Aperçu client' },
      { to: '/dashboard/edit', icon: '✏️', label: 'Modifier mon restaurant' },
      { to: '/dashboard/promotions', icon: '🏷️', label: 'Promotions' },
      { to: '/dashboard/map', icon: '🗺️', label: 'Carte' },
      { to: '/account', icon: '👤', label: t('nav.account') }
    ];
  }
  if (role === 'driver') {
    return [
      { to: '/driver', end: true, icon: '📦', label: 'Mes commandes' },
      { to: '/driver/map', icon: '🗺️', label: 'Carte' },
      { to: '/driver/reviews', icon: '⭐', label: 'Avis' },
      { to: '/driver/tips', icon: '💶', label: 'Pourboires' },
      { to: '/driver/invoices', icon: '📄', label: 'Factures' },
      { to: '/account', icon: '👤', label: t('nav.account') }
    ];
  }
  return [{ to: '/account', icon: '👤', label: t('nav.account') }];
}

export default function DashboardSidebar() {
  const { user, role, logout } = useAuth();
  const { t } = useLanguage();
  const { previewMode, exitPreview } = usePreviewMode();
  const navigate = useNavigate();
  // Un restaurateur en mode aperçu voit la nav "client" (favoris, commandes, carte...) au lieu de la
  // sienne, pour explorer l'expérience de bout en bout — voir ProtectedRoute pour l'accès aux pages
  // correspondantes, toujours réservées aux vrais clients côté API.
  const effectiveRole = previewMode && role === 'restaurant' ? 'client' : role;
  const items = navItemsForRole(effectiveRole, t);
  if (user?.isAdmin) items.push({ to: '/admin', icon: '🛠️', label: t('nav.admin') });
  const initial = (user?.name || '?').trim().charAt(0).toUpperCase();

  function leavePreview() {
    exitPreview();
    navigate('/dashboard/preview');
  }

  return (
    <aside className="dashboard-sidebar">
      <Link className="dashboard-sidebar-brand" to={HOME_PATH_BY_ROLE[effectiveRole] || '/'}>
        <BrandMark size={30} />
        <span>Fairide</span>
      </Link>
      {previewMode && role === 'restaurant' && (
        <div className="preview-mode-sidebar-banner">
          <span>👁️ Mode aperçu client</span>
          <button type="button" onClick={leavePreview}>Quitter</button>
        </div>
      )}
      <nav className="dashboard-nav">
        {items.map((item) => (
          <NavLink key={item.to} to={item.to} end={item.end} className={({ isActive }) => `dashboard-nav-link${isActive ? ' active' : ''}`}>
            <span className="dashboard-nav-icon">{item.icon}</span>
            <span>{item.label}</span>
          </NavLink>
        ))}
      </nav>
      <div className="dashboard-profile-card">
        <div className="dashboard-profile-avatar">{initial}</div>
        <div className="dashboard-profile-info">
          <span className="dashboard-profile-name" title={user?.name}>{user?.name}</span>
          <span className="dashboard-profile-role">{previewMode && role === 'restaurant' ? 'aperçu client' : role}</span>
          <button type="button" className="dashboard-profile-logout" onClick={logout}>{t('nav.logout')}</button>
        </div>
      </div>
    </aside>
  );
}
