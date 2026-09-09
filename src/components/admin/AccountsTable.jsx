import { Link } from 'react-router-dom';
import { useLanguage } from '../../context/LanguageContext';

// Deux colonnes, pour chaque type d'utilisateur : tous les comptes, et les vrais comptes — ni comptes test
// (fondateur, essais, alias +qa), ni démos, ni comptes supprimés. Les chiffres viennent de /admin/overview.
const LIGNES = [
  ['clients', '👥', '/admin/clients'], ['drivers', '🛵', '/admin/drivers'], ['couriers', '📁', '/admin/couriers'], ['restaurants', '🏪', '/admin/restaurants']
];

export default function AccountsTable({ accounts }) {
  const { t: tr } = useLanguage();
  if (!accounts) return null;
  return (
    <div className="card accounts-table" style={{ marginTop: 12 }}>
      <div className="row" style={{ justifyContent: 'space-between', alignItems: 'baseline', marginBottom: 6 }}>
        <h4 style={{ margin: 0 }}>{tr('adminCommon.accountsTitle')}</h4>
        <span className="small">{tr('adminCommon.realAccountsHint')}</span>
      </div>
      <div className="service-table-wrap">
        <table className="service-table" style={{ width: '100%' }}>
          <thead>
            <tr><th></th><th style={{ textAlign: 'right' }}>{tr('adminCommon.allAccounts')}</th><th style={{ textAlign: 'right' }}>{tr('adminCommon.realAccounts')}</th></tr>
          </thead>
          <tbody>
            {LIGNES.map(([k, icone, to]) => {
              const a = accounts[k] || { all: 0, real: 0 };
              return (
                <tr key={k}>
                  <td><Link to={to}>{icone} {tr(`adminCommon.accRow_${k}`)}</Link></td>
                  <td style={{ textAlign: 'right' }}>{a.all}</td>
                  <td style={{ textAlign: 'right' }}><b>{a.real}</b></td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
}
