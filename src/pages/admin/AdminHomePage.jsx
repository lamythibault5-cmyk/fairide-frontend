import { Link } from 'react-router-dom';
import { useAuth } from '../../context/AuthContext';
import AccountsTable from '../../components/admin/AccountsTable';
import { ErrorCard } from '../../components/admin/AdminListTools';
import { getLocale, useLanguage } from '../../context/LanguageContext';
import useAdminOverview from '../../hooks/useAdminOverview';
import DeletionRequestsPanel from '../../components/admin/DeletionRequestsPanel';
import BoutonGo from '../../components/admin/BoutonGo';
import RappelDoubleAuth from '../../components/admin/RappelDoubleAuth';
import Icone from '../../components/Icone';
import { money } from './adminUtils';
import { attentionItems } from './adminModules';

// « Aujourd'hui » : l'écran d'ouverture de la console. Trois blocs, dans l'ordre où on les lit :
// ce qui tourne en ce moment (chiffres en direct), ce qui attend une action (chaque ligne ouvre la
// vue déjà filtrée), puis les comptes et les demandes de suppression.
//
// CE QUI EN EST PARTI (2026-09-23). La grille de vingt-six tuiles d'applications, chacune avec son
// emoji et sa phrase : elle redisait la barre latérale, en quatre fois plus haut, et reléguait sous
// la ligne de flottaison la seule chose qu'on vient chercher ici — la liste « à traiter ». La barre
// latérale, ramenée à sept pôles (adminModules.js), suffit désormais pour naviguer. Des six raccourcis
// du haut, restent les trois du quotidien ; « + Prospect », « + Dépense » et « + Écriture » vivent
// dans leur application, à un onglet de là.
//
// LE BANDEAU (2026-10-17, même famille que le reste du site) : le salut, les raccourcis en pastilles claires et les
// chiffres en direct vivent sur le bandeau iris ; le point lime « en direct » est le seul lime de l'écran. La liste
// « à traiter », les comptes et les suppressions sont sur la feuille blanche dessous.
export default function AdminHomePage() {
  const { t: tr } = useLanguage();
  const { user } = useAuth();
  const { overview, error, refresh } = useAdminOverview();
  const attention = attentionItems(overview);
  const heure = new Date().getHours();
  const salut = heure < 12 ? tr('adminHome.morning') : heure < 18 ? tr('adminHome.afternoon') : tr('adminHome.evening');
  const prenom = (user?.firstName || user?.name || '').split(' ')[0];
  const n = (v) => Number(v) || 0;

  // Les chiffres en direct. « En ligne » n'existe que si le serveur l'envoie, et le volume du jour
  // que s'il y a un bloc `today` : un zéro inventé se lirait comme une vraie mesure.
  const direct = overview ? [
    { key: 'inProgress', value: n(overview.orders?.inProgress), to: '/admin/orders' },
    overview.today && { key: 'ordersToday', value: n(overview.today.orders), to: '/admin/orders?today=1' },
    overview.today && { key: 'gmvToday', value: money(overview.today.gmv), to: '/admin/dashboard' },
    { key: 'driversAvailable', value: n(overview.drivers?.available), to: '/admin/logistics' },
    overview.drivers?.online !== undefined && { key: 'driversOnline', value: n(overview.drivers?.online), to: '/admin/logistics' },
    { key: 'restaurants', value: n(overview.restaurants?.approved), to: '/admin/restaurants' }
  ].filter(Boolean) : [];

  return (
    <div className="admin-home">
      <header className="admin-bande admin-home-bande">
        <div className="admin-page-header-row">
          <div className="admin-bande-titres">
            <p className="admin-bande-ctx">
              <Icone nom="maison" taille={16} />
              <b>{tr('adminHubs.console')}</b>
              <span>· {new Date().toLocaleDateString(getLocale(), { weekday: 'long', day: 'numeric', month: 'long' })}</span>
            </p>
            <h1 className="admin-page-title">{salut}{prenom ? `, ${prenom}` : ''}</h1>
            <p className="admin-bande-sous">{tr('adminHubs.todayIntro')}</p>
          </div>
          <div className="admin-page-header-actions">
            <Link className="btn-outline" to="/admin/orders?today=1">{tr('adminHome.quickTodayOrders')}</Link>
            <Link className="btn-outline" to="/admin/tasks?new=1">{tr('adminHome.quickTask')}</Link>
            <Link className="btn-teal" to="/admin/support?new=1">{tr('adminHome.quickTicket')}</Link>
          </div>
        </div>

        {direct.length > 0 && (
          <section className="admin-direct" aria-labelledby="admin-direct-titre">
            <h2 id="admin-direct-titre" className="admin-direct-titre"><span className="admin-direct-point" aria-hidden="true" />{tr('adminHubs.liveTitle')}</h2>
            <div className="admin-direct-chiffres">
              {direct.map((d) => (
                <Link key={d.key} to={d.to} className="admin-direct-chiffre">
                  <span className="admin-direct-valeur">{d.value}</span>
                  <span className="admin-direct-libelle">{tr(`adminHubs.kpi_${d.key}`)}</span>
                </Link>
              ))}
            </div>
          </section>
        )}
      </header>

      {/* Bouton GO : la livraison et le paiement en ligne s'ouvrent ici (lancement.js côté serveur). */}
      <BoutonGo />

      {/* Double authentification : rappel et activation pour chaque membre, tous rôles (audit du 19/10, admin-14). */}
      <RappelDoubleAuth />

      {!overview && !error && <p className="small">{tr('adminCommon.loading')}</p>}
      {error && !overview && <ErrorCard message={error} onRetry={refresh} />}
      {error && overview && <p className="small admin-home-stale">{tr('adminHome.staleCounts')} <button type="button" className="btn-ghost" onClick={refresh}>{tr('adminCommon.retry')}</button></p>}

      {overview && (
        <section className="admin-home-section" aria-live="polite">
          <h3 className="admin-section-label">
            {tr('adminHome.attentionTitle')}
            {attention.length > 0 && <span className="admin-section-count">{attention.length}</span>}
          </h3>
          {attention.length === 0 ? (
            <p className="admin-home-clear">{tr('adminHome.allClear')}</p>
          ) : (
            <ul className="admin-list">
              {attention.map((a) => (
                <li key={a.key}>
                  <Link to={a.to} className={`admin-list-row tone-${a.tone}`}>
                    <span className="admin-list-dot" aria-hidden="true" />
                    <span className="admin-list-text">{tr(`adminHome.att_${a.key}`, { n: a.count })}</span>
                    <b className="admin-list-count">{a.count}</b>
                    <span className="admin-list-chevron" aria-hidden="true">›</span>
                  </Link>
                </li>
              ))}
            </ul>
          )}
        </section>
      )}

      {overview && <AccountsTable accounts={overview.accounts} />}
      <DeletionRequestsPanel onHandled={refresh} />
    </div>
  );
}
