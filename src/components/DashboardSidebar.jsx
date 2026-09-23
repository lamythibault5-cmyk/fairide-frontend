import { Link, NavLink, useLocation, useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { useLanguage } from '../context/LanguageContext';
import { usePreviewMode } from '../context/PreviewModeContext';
import BrandMark from './BrandMark';
import Icone from './Icone';
import AdminGlobalSearch from './admin/AdminGlobalSearch';
import useAdminOverview from '../hooks/useAdminOverview';
import useAdminRole from '../hooks/useAdminRole';
import useInbox from '../hooks/useInbox';
import { ADMIN_HUBS, hubBadge, hubModules, moduleForPath } from '../pages/admin/adminModules';

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
      // CINQ onglets, plus six. Sur un téléphone, la barre du bas n'a de place que pour cinq cibles
      // confortables : à six, chacune tombait à 38px de haut, sous le minimum de 44px, et il fallait
      // viser. Les factures étaient déjà parties dans Mon compte pour la même raison ; les favoris
      // les y rejoignent. La règle ne change pas : une rubrique ne figure qu'à UN endroit.
      // « Recherche » a sa propre page, transversale : commerces, plats, cuisines, communes, aide,
      // commandes — pas seulement la liste des restaurants filtrée.
      { to: '/restaurants', icon: 'restaurants', label: t('nav.restaurants') },
      { to: '/map', icon: 'carte', label: t('nav.map') },
      { to: '/recherche', icon: 'recherche', label: t('nav.search') },
      { to: '/orders', icon: 'commandes', label: t('nav.orders') },
      { to: '/account', icon: 'compte', label: t('nav.account') }
    ];
  }
  if (role === 'restaurant') {
    return [
      // Mon commerce = les infos du restaurant lui-même (création, puis modification) ; Ma carte = ce qu'il vend.
      { to: '/dashboard', end: true, icon: 'commerce', label: t('nav.myBusiness') },
      { to: '/dashboard/menu', icon: 'restaurants', label: t('nav.myMenu') },
      { to: '/dashboard/orders', icon: 'commandes', label: t('nav.orders') },
      // Réservations : agenda, plan de salle, règles de réservation, agenda externe, bons, statistiques — onglets
      // d'une même page. Rubrique principale depuis le 2026-09-15 (demande du fondateur), retirée de Mon compte.
      { to: '/dashboard/reservations', icon: 'reservations', label: t('nav.reservations') },
      // Promotions, Factures et Mode d'emploi sont partis dans Mon compte : ce sont des rubriques
      // qu'on ouvre de temps en temps, pas au service. « Aperçu client » et « Carte » les y ont
      // rejoints, pour la même raison et une de plus : à sept onglets, la barre du bas d'un
      // téléphone donnait des cibles de 38px, sous le minimum de 44px. Cinq, pas plus.
      { to: '/account', icon: 'compte', label: t('nav.account') }
    ];
  }
  if (role === 'driver') {
    return [
      // Ce qu'un livreur regarde EN COURSE : ses commandes, la carte, ses pourboires. Avis et factures
      // sont partis dans Mon compte — on les ouvre de temps en temps, pas au guidon. Même règle que
      // pour le client : une rubrique ne figure qu'à UN endroit, jamais aux deux.
      { to: '/driver', end: true, icon: 'commandes', label: 'Mes commandes' },
      { to: '/driver/onboarding', icon: 'dossier', label: t('nav.courierFile') },
      { to: '/driver/map', icon: 'carte', label: t('nav.map') },
      { to: '/driver/tips', icon: 'euro', label: 'Pourboires' },
      { to: '/account', icon: 'compte', label: t('nav.account') }
    ];
  }
  return [{ to: '/account', icon: 'compte', label: t('nav.account') }];
}

// ERP interne : les applications du registre (pages/admin/adminModules.js), groupées par famille comme
// sur l'accueil, avec le compteur « à traiter » de chacune. Affichées à la place de la nav du rôle pour
// tout compte admin (voir isAdminAccount plus bas), quelle que soit la page visitée.
// Neuf entrées, plus vingt-huit : l'accueil, un lien par pôle (voir ADMIN_HUBS), le compte. L'entrée d'un pôle reste allumée
// sur n'importe lequel de ses onglets — d'où le calcul à la main plutôt que l'isActive de NavLink,
// qui ne connaît que sa propre adresse.
function AdminNav({ t }) {
  const { overview } = useAdminOverview();
  // Équipe & accès : on masque les applications fermées au rôle du membre (tout reste visible tant que le
  // rôle n'est pas connu — le serveur applique la vraie règle, voir middleware/auth.js).
  const { role } = useAdminRole();
  const { pathname } = useLocation();
  const poleCourant = moduleForPath(pathname)?.hub;
  const classe = (actif) => `dashboard-nav-link${actif ? ' active' : ''}`;
  return (
    <nav className="dashboard-nav admin">
      <NavLink to="/admin" end title={t('adminHubs.today')} aria-label={t('adminHubs.today')} className={({ isActive }) => classe(isActive)}>
        <span className="dashboard-nav-icon"><Icone nom="maison" taille={20} /></span>
        <span>{t('adminHubs.today')}</span>
      </NavLink>
      {ADMIN_HUBS.map((hub) => {
        const mods = hubModules(hub, role);
        if (!mods.length) return null;
        const badge = hubBadge(hub, overview, role);
        const label = t(`adminHubs.${hub.key}`);
        const actif = poleCourant === hub.key;
        return (
          <Link key={hub.key} to={mods[0].path} title={label} aria-label={label} aria-current={actif ? 'page' : undefined} className={classe(actif)}>
            <span className="dashboard-nav-icon"><Icone nom={hub.icon} taille={20} /></span>
            <span>{label}</span>
            {badge && <span className={`nav-badge tone-${badge.tone}`}>{badge.count}</span>}
          </Link>
        );
      })}
      <NavLink to="/account" title={t('nav.account')} aria-label={t('nav.account')} className={({ isActive }) => classe(isActive)}>
        <span className="dashboard-nav-icon"><Icone nom="compte" taille={20} /></span>
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
  // Messages de Fairide non lus : pastille sur « Mon compte » (0 pour l'admin, le hook se désactive).
  const { unread: nonLus } = useInbox();
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
        <span className="wordmark">fairide</span>
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
            <span className="dashboard-nav-icon"><Icone nom={item.icon} taille={22} /></span>
            <span>{item.label}</span>
            {item.to === '/account' && nonLus > 0 && <span className="nav-badge tone-warn" aria-label={t('inbox.rowSubUnread', { n: nonLus })}>{nonLus}</span>}
          </NavLink>
        ))}
      </nav>
      )}
      <div className="dashboard-profile-card">
        <div className="dashboard-profile-avatar">{initial}</div>
        <div className="dashboard-profile-info">
          <span className="dashboard-profile-name" title={user?.name}>{user?.name}</span>
          <span className="dashboard-profile-role">{previewMode && role === 'restaurant' ? t('nav.customerPreviewLower') : isAdminAccount ? 'admin' : t(`account.role${String(role || 'client').charAt(0).toUpperCase()}${role.slice(1)}`)}</span>
          <button type="button" className="dashboard-profile-logout" onClick={logout}>{t('nav.logout')}</button>
        </div>
      </div>
    </aside>
  );
}
