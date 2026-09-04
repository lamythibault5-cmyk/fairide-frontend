import { Link, NavLink, useLocation, useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { useLanguage } from '../context/LanguageContext';
import { usePreviewMode } from '../context/PreviewModeContext';
import BrandMark from './BrandMark';
import AdminGlobalSearch from './admin/AdminGlobalSearch';

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
      // Six onglets : ce qu'on ouvre au quotidien. Les factures sont parties dans Mon compte — on
      // les consulte rarement, et une rubrique ne figure qu'à UN endroit, jamais aux deux.
      // « Recherche » mène à la même liste que « Restaurants », avec ?recherche : la page pose alors
      // le curseur dans le champ. Une page de recherche à part aurait dupliqué la liste et ses filtres
      // pour un seul champ de plus. Comme les deux partagent le chemin, l'état actif ne peut pas venir
      // de NavLink (qui ne lit que le chemin) : chacun porte son propre test sur l'emplacement.
      { to: '/restaurants', icon: '🍽️', label: t('nav.restaurants'), actif: (l) => l.pathname.startsWith('/restaurants') && !l.search.includes('recherche') },
      { to: '/restaurants?recherche=1', icon: '🔍', label: t('nav.search'), actif: (l) => l.pathname.startsWith('/restaurants') && l.search.includes('recherche') },
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
      { to: '/dashboard/preview', icon: '👁️', label: 'Aperçu client' },
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

// ERP interne : mêmes 7 sections que demandées, affichées à la place de la nav du rôle pour tout compte
// admin (voir isAdminAccount plus bas), quelle que soit la page visitée.
const ADMIN_NAV_ITEMS = [
  { to: '/admin', end: true, icon: '📊', label: 'Dashboard' },
  { to: '/admin/orders', icon: '📦', label: 'Commandes' },
  { to: '/admin/crm', icon: '🤝', label: 'CRM' },
  { to: '/admin/restaurants', icon: '🏪', label: 'Restaurants' },
  { to: '/admin/drivers', icon: '🛵', label: 'Livreurs' },
  { to: '/admin/clients', icon: '👥', label: 'Clients' },
  { to: '/admin/support', icon: '🎫', label: 'Support' },
  { to: '/admin/documents', icon: '📁', label: 'Documents' },
  { to: '/admin/tasks', icon: '✅', label: 'Tâches' },
  { to: '/admin/automations', icon: '⚡', label: 'Automatisations' },
  { to: '/admin/finance', icon: '💶', label: 'Finance' },
  { to: '/admin/payments', icon: '💳', label: 'Paiements' },
  { to: '/admin/accounting', icon: '📚', label: 'Comptabilité' },
  { to: '/admin/invoices', icon: '🧾', label: 'Factures' },
  { to: '/admin/settings', icon: '⚙️', label: 'Paramètres' },
  { to: '/account', icon: '👤', label: 'Mon compte' }
];

export default function DashboardSidebar() {
  const { user, role, logout } = useAuth();
  const { t } = useLanguage();
  const { previewMode, exitPreview } = usePreviewMode();
  const navigate = useNavigate();
  const emplacement = useLocation();
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
  const items = isAdminAccount ? ADMIN_NAV_ITEMS : navItemsForRole(effectiveRole, t);
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
          <span>👁️ Mode aperçu client</span>
          <button type="button" onClick={leavePreview}>Quitter</button>
        </div>
      )}
      {isAdminAccount && <AdminGlobalSearch />}
      {/* title et aria-label portent le libellé en toutes lettres : sous 520px la barre du bas
          n'affiche plus que les icônes (voir styles.css), et une icône seule ne dit rien à un
          lecteur d'écran ni au survol. */}
      <nav className="dashboard-nav">
        {items.map((item) => (
          <NavLink key={item.to} to={item.to} end={item.end} title={item.label} aria-label={item.label} className={({ isActive }) => `dashboard-nav-link${(item.actif ? item.actif(emplacement) : isActive) ? ' active' : ''}`}>
            <span className="dashboard-nav-icon">{item.icon}</span>
            <span>{item.label}</span>
          </NavLink>
        ))}
      </nav>
      <div className="dashboard-profile-card">
        <div className="dashboard-profile-avatar">{initial}</div>
        <div className="dashboard-profile-info">
          <span className="dashboard-profile-name" title={user?.name}>{user?.name}</span>
          <span className="dashboard-profile-role">{previewMode && role === 'restaurant' ? 'aperçu client' : isAdminAccount ? 'admin' : role}</span>
          <button type="button" className="dashboard-profile-logout" onClick={logout}>{t('nav.logout')}</button>
        </div>
      </div>
    </aside>
  );
}
