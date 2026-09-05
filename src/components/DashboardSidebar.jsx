import { Link, NavLink, useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { useLanguage } from '../context/LanguageContext';
import { usePreviewMode } from '../context/PreviewModeContext';
import BrandMark from './BrandMark';
import AdminGlobalSearch from './admin/AdminGlobalSearch';
import useAdminOverview from '../hooks/useAdminOverview';
import { ADMIN_GROUPS, ADMIN_MODULES, moduleBadge } from '../pages/admin/adminModules';

// Où mène le logo de la barre latérale, et où l'on atterrit après connexion (voir pages/Home.jsx).
// Pour un client, c'est la liste des restaurants : la page /home qui s'y interposait n'affichait
// qu'un titre de bienvenue et un bouton « Parcourir les restaurants », et son suivi de commande
// était un sous-ensemble strict de /orders. Elle a été supprimée.
const HOME_PATH_BY_ROLE = { client: '/restaurants', restaurant: '/dashboard', driver: '/driver' };

// Items de nav par rôle : mêmes cibles que l'ancien .role-nav de Layout.jsx, juste redisposées
// verticalement avec une icône — pas de nouvelle page/route inventée ici.
function navItemsForRole(role, t) {
  if (role === 'client') {
    return [
      // Six onglets : ce qu'on ouvre au quotidien. Les factures sont parties dans Mon compte — on les
      // consulte rarement, et une rubrique ne figure qu'à UN endroit, jamais aux deux.
      // « Recherche » a sa propre page, transversale : commerces, plats, cuisines, communes, aide,
      // commandes — pas seulement la liste des restaurants filtrée.
      { to: '/restaurants', icon: '🍽️', label: t('nav.restaurants') },
      { to: '/recherche', icon: '🔍', label: t('nav.search') },
      { to: '/orders', icon: '📦', label: t('nav.orders') },
      { to: '/favorites', icon: '❤️', label: t('nav.favorites') },
      { to: '/map', icon: '🗺️', label: t('nav.map') },
      { to: '/account', icon: '👤', label: t('nav.account') }
    ];
  }
  if (role === 'restaurant') {
    return [
      { to: '/dashboard', end: true, icon: '🏪', label: t('nav.myBusiness') },
      { to: '/dashboard/orders', icon: '📦', label: t('nav.orders') },
      { to: '/dashboard/preview', icon: '👁️', label: t('nav.customerPreview') },
      { to: '/dashboard/edit', icon: '✏️', label: 'Modifier mon restaurant' },
      // Promotions, Factures et Mode d'emploi sont partis dans Mon compte : ce sont des rubriques
      // qu'on ouvre de temps en temps, pas au service. Neuf onglets ne tiennent pas dans une barre
      // du bas — sous 520px ils deviennent des icônes muettes, et la sixième est déjà de trop.
      { to: '/dashboard/map', icon: '🗺️', label: t('nav.map') },
      { to: '/account', icon: '👤', label: t('nav.account') }
    ];
  }
  if (role === 'driver') {
    return [
      // Ce qu'un livreur regarde EN COURSE : ses commandes, la carte, ses pourboires. Avis et factures
      // sont partis dans Mon compte — on les ouvre de temps en temps, pas au guidon. Même règle que
      // pour le client : une rubrique ne figure qu'à UN endroit, jamais aux deux.
      { to: '/driver', end: true, icon: '📦', label: 'Mes commandes' },
      { to: '/driver/map', icon: '🗺️', label: t('nav.map') },
      { to: '/driver/tips', icon: '💶', label: 'Pourboires' },
      { to: '/account', icon: '👤', label: t('nav.account') }
    ];
  }
  return [{ to: '/account', icon: '👤', label: t('nav.account') }];
}

// ERP interne : les applications du registre (pages/admin/adminModules.js), groupées par famille comme
// sur l'accueil, avec le compteur « à traiter » de chacune. Affichées à la place de la nav du rôle pour
// tout compte admin (voir isAdminAccount plus bas), quelle que soit la page visitée.
function AdminNav({ t }) {
  const { overview } = useAdminOverview();
  return (
    <nav className="dashboard-nav">
      <NavLink to="/admin" end title={t('adminHome.apps')} aria-label={t('adminHome.apps')} className={({ isActive }) => `dashboard-nav-link${isActive ? ' active' : ''}`}>
        <span className="dashboard-nav-icon">🏠</span>
        <span>{t('adminHome.apps')}</span>
      </NavLink>
      {ADMIN_GROUPS.map((groupe) => {
        const mods = ADMIN_MODULES.filter((m) => m.group === groupe);
        if (!mods.length) return null;
        return (
          <div key={groupe} className="dashboard-nav-section">
            <div className="dashboard-nav-group">{t(`adminHome.group_${groupe}`)}</div>
            {mods.map((m) => {
              const badge = moduleBadge(m, overview);
              const label = t(`adminModules.${m.key}`);
              return (
                <NavLink key={m.key} to={m.path} title={label} aria-label={label} className={({ isActive }) => `dashboard-nav-link${isActive ? ' active' : ''}`}>
                  <span className="dashboard-nav-icon">{m.icon}</span>
                  <span>{label}</span>
                  {badge && <span className={`nav-badge tone-${badge.tone}`}>{badge.count}</span>}
                </NavLink>
              );
            })}
          </div>
        );
      })}
      <NavLink to="/account" title={t('nav.account')} aria-label={t('nav.account')} className={({ isActive }) => `dashboard-nav-link${isActive ? ' active' : ''}`}>
        <span className="dashboard-nav-icon">👤</span>
        <span>{t('nav.account')}</span>
      </NavLink>
    </nav>
  );
}

export default function DashboardSidebar() {
  const { user, role, logout } = useAuth();
  const { t } = useLanguage();
  const { previewMode, exitPreview } = usePreviewMode();
  const navigate = useNavigate();
  // Le compte admin (fairide.entreprise@gmail.com, voir middleware/auth.js isAdminEmail) sert
  // exclusivement à l'ERP interne : peu importe le rôle "métier" sous-jacent du compte ou la page visitée,
  // la sidebar ne montre jamais la nav client/restaurateur/livreur pour ce compte — seulement les 7
  // sections ERP. Un vrai utilisateur (non-admin) garde sa propre nav, avec juste un lien "Admin" en plus
  // s'il a aussi ce statut.
  const isAdminAccount = !!user?.isAdmin;
  // Un restaurateur en mode aperçu voit la nav "client" (favoris, commandes, carte...) au lieu de la
  // sienne, pour explorer l'expérience de bout en bout — voir ProtectedRoute pour l'accès aux pages
  // correspondantes, toujours réservées aux vrais clients côté API.
  const effectiveRole = previewMode && role === 'restaurant' ? 'client' : role;
  const items = isAdminAccount ? [] : navItemsForRole(effectiveRole, t);
  const initial = (user?.name || '?').trim().charAt(0).toUpperCase();
  const brandHome = isAdminAccount ? '/admin' : (HOME_PATH_BY_ROLE[effectiveRole] || '/');

  function leavePreview() {
    exitPreview();
    navigate('/dashboard/preview');
  }

  return (
    <aside className="dashboard-sidebar">
      <Link className="dashboard-sidebar-brand" to={brandHome}>
        <BrandMark size={30} />
        <span>fairide</span>
      </Link>
      {previewMode && role === 'restaurant' && (
        <div className="preview-mode-sidebar-banner">
          <span>{t('nav.previewModeBanner')}</span>
          <button type="button" onClick={leavePreview}>{t('nav.leave')}</button>
        </div>
      )}
      {isAdminAccount && <AdminGlobalSearch />}
      {/* title et aria-label portent le libellé en toutes lettres : sous 520px la barre du bas
          n'affiche plus que les icônes (voir styles.css), et une icône seule ne dit rien à un
          lecteur d'écran ni au survol. */}
      {isAdminAccount ? <AdminNav t={t} /> : (
      <nav className="dashboard-nav">
        {items.map((item) => (
          <NavLink key={item.to} to={item.to} end={item.end} title={item.label} aria-label={item.label} className={({ isActive }) => `dashboard-nav-link${isActive ? ' active' : ''}`}>
            <span className="dashboard-nav-icon">{item.icon}</span>
            <span>{item.label}</span>
          </NavLink>
        ))}
      </nav>
      )}
      <div className="dashboard-profile-card">
        <div className="dashboard-profile-avatar">{initial}</div>
        <div className="dashboard-profile-info">
          <span className="dashboard-profile-name" title={user?.name}>{user?.name}</span>
          <span className="dashboard-profile-role">{previewMode && role === 'restaurant' ? t('nav.customerPreviewLower') : isAdminAccount ? 'admin' : t(`account.role${role.charAt(0).toUpperCase()}${role.slice(1)}`)}</span>
          <button type="button" className="dashboard-profile-logout" onClick={logout}>{t('nav.logout')}</button>
        </div>
      </div>
    </aside>
  );
}
