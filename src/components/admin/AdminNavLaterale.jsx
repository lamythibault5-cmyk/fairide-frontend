import { useRef } from 'react';
import { Link, NavLink, useLocation } from 'react-router-dom';
import Icone from '../Icone';
import useAdminOverview from '../../hooks/useAdminOverview';
import useAdminRole from '../../hooks/useAdminRole';
import { useCurseurOnglets } from '../../hooks/useCurseurOnglets';
import { ADMIN_HUBS, hubBadge, hubModules, moduleForPath } from '../../pages/admin/adminModules';

/* SORTIE DE DashboardSidebar.jsx (audit du 24/10). La barre latérale est chargée par TOUS les visiteurs (Layout s'en sert pour
   la barre d'onglets du bas) ; cette navigation, elle, ne sert qu'au compte admin. Importée en dur, elle faisait entrer le
   registre des applications (adminModules.js) dans le premier chargement de chaque client. DashboardSidebar la charge
   maintenant avec lazy(), seulement pour un compte admin sur le site. Le code n'a pas changé. */
// ERP interne : les applications du registre (pages/admin/adminModules.js), groupées par famille comme
// sur l'accueil, avec le compteur « à traiter » de chacune. Affichées à la place de la nav du rôle pour
// tout compte admin (voir isAdminAccount plus bas), quelle que soit la page visitée.
// Neuf entrées, plus vingt-huit : l'accueil, un lien par pôle (voir ADMIN_HUBS), le compte. L'entrée d'un pôle reste allumée
// sur n'importe lequel de ses onglets — d'où le calcul à la main plutôt que l'isActive de NavLink,
// qui ne connaît que sa propre adresse.
export default function AdminNav({ t }) {
  const { overview } = useAdminOverview();
  // Équipe & accès : on masque les applications fermées au rôle du membre (tout reste visible tant que le
  // rôle n'est pas connu — le serveur applique la vraie règle, voir middleware/auth.js).
  const { role } = useAdminRole();
  const { pathname } = useLocation();
  const poleCourant = moduleForPath(pathname)?.hub;
  const classe = (actif) => `dashboard-nav-link${actif ? ' active' : ''}`;
  const navRef = useRef(null);
  useCurseurOnglets(navRef, pathname);
  return (
    <nav className="dashboard-nav admin" ref={navRef}>
      <span className="nav-curseur" aria-hidden="true" />
      <NavLink to="/admin" end title={t('adminHubs.today')} aria-label={t('adminHubs.today')} className={({ isActive }) => classe(isActive)}>
        <span className="dashboard-nav-icon"><Icone nom="maison" taille={20} /></span>
        <span className="dashboard-nav-label">{t('adminHubs.today')}</span>
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
            <span className="dashboard-nav-label">{label}</span>
            {badge && <span className={`nav-badge tone-${badge.tone}`}>{badge.count}</span>}
          </Link>
        );
      })}
      <NavLink to="/account" title={t('nav.account')} aria-label={t('nav.account')} className={({ isActive }) => classe(isActive)}>
        <span className="dashboard-nav-icon"><Icone nom="compte" taille={20} /></span>
        <span className="dashboard-nav-label">{t('nav.account')}</span>
      </NavLink>
    </nav>
  );
}
