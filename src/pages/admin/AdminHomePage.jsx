import { Link } from 'react-router-dom';
import { useAuth } from '../../context/AuthContext';
import { useLanguage } from '../../context/LanguageContext';
import useAdminOverview from '../../hooks/useAdminOverview';
import { ADMIN_GROUPS, ADMIN_MODULES, attentionItems, moduleBadge } from './adminModules';

// Accueil de l'ERP, sur le modèle du menu d'applications d'Odoo : ce qui réclame une action
// aujourd'hui, puis une tuile par application, rangée par famille, avec son compteur « à traiter ».
// Chaque tuile dit en une phrase à quoi sert l'application : on n'a pas besoin de connaître l'ERP
// pour trouver où aller.
export default function AdminHomePage() {
  const { t: tr } = useLanguage();
  const { user } = useAuth();
  const { overview } = useAdminOverview();
  const attention = attentionItems(overview);
  const heure = new Date().getHours();
  const salut = heure < 12 ? tr('adminHome.morning') : heure < 18 ? tr('adminHome.afternoon') : tr('adminHome.evening');
  const prenom = (user?.firstName || user?.name || '').split(' ')[0];

  return (
    <div className="admin-home">
      <div className="admin-home-hero">
        <div>
          <h2>{salut}{prenom ? `, ${prenom}` : ''} 👋</h2>
          <p className="small">{tr('adminHome.intro')}</p>
        </div>
        <div className="admin-home-quick">
          <Link className="btn-teal" to="/admin/support?new=1">{tr('adminHome.quickTicket')}</Link>
          <Link className="btn-outline" to="/admin/tasks?new=1">{tr('adminHome.quickTask')}</Link>
          <Link className="btn-outline" to="/admin/crm?new=1">{tr('adminHome.quickProspect')}</Link>
        </div>
      </div>

      <section className="admin-home-attention card" aria-live="polite">
        <div className="row" style={{ justifyContent: 'space-between', alignItems: 'baseline' }}>
          <h3 style={{ margin: 0, fontSize: 15 }}>{tr('adminHome.attentionTitle')}</h3>
          {overview && <span className="small">{tr('adminHome.liveCounts')}</span>}
        </div>
        {!overview && <p className="small" style={{ margin: '8px 0 0' }}>{tr('adminCommon.loading')}</p>}
        {overview && attention.length === 0 && <p className="admin-home-clear">✅ {tr('adminHome.allClear')}</p>}
        {overview && attention.length > 0 && (
          <ul className="admin-home-attention-list">
            {attention.map((a) => (
              <li key={a.key}>
                <Link to={a.to} className={`admin-attention tone-${a.tone}`}>
                  <b>{a.count}</b>
                  <span>{tr(`adminHome.att_${a.key}`, { n: a.count })}</span>
                  <i aria-hidden="true">›</i>
                </Link>
              </li>
            ))}
          </ul>
        )}
        {overview && (
          <div className="admin-home-pulse small">
            <span>🟢 {tr('adminHome.pulseInProgress', { n: overview.orders.inProgress })}</span>
            <span>🛵 {tr('adminHome.pulseDrivers', { n: overview.drivers.available })}</span>
            <span>🍽️ {tr('adminHome.pulseReservations', { n: overview.reservations.today })}</span>
            <span>🏪 {tr('adminHome.pulseRestaurants', { n: overview.restaurants.approved })}</span>
          </div>
        )}
      </section>

      {ADMIN_GROUPS.map((groupe) => {
        const mods = ADMIN_MODULES.filter((m) => m.group === groupe);
        if (!mods.length) return null;
        return (
          <section key={groupe} className="admin-home-group">
            <h3>{tr(`adminHome.group_${groupe}`)}</h3>
            <div className="admin-apps-grid">
              {mods.map((m) => {
                const badge = moduleBadge(m, overview);
                return (
                  <Link key={m.key} to={m.path} className="admin-app-tile">
                    <span className="admin-app-icon" aria-hidden="true">{m.icon}</span>
                    <span className="admin-app-name">{tr(`adminModules.${m.key}`)}</span>
                    <span className="admin-app-desc small">{tr(`adminModules.${m.key}_desc`)}</span>
                    {badge && <span className={`admin-badge tone-${badge.tone}`} title={tr('adminHome.toHandle')}>{badge.count}</span>}
                  </Link>
                );
              })}
            </div>
          </section>
        );
      })}
    </div>
  );
}
