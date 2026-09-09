import { useMemo, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import AdminPageHeader from '../../components/admin/AdminPageHeader';
import PeriodPicker, { usePeriod } from '../../components/admin/PeriodPicker';
import { useAuth } from '../../context/AuthContext';
import { useLanguage } from '../../context/LanguageContext';
import { useToast } from '../../context/ToastContext';
import { downloadPdf } from './adminUtils';
import SalesTab from './reports/SalesTab';
import CustomersTab from './reports/CustomersTab';
import PartnersTab from './reports/PartnersTab';
import FunnelTab from './reports/FunnelTab';
import '../../admin-finance.css';
import '../../admin-reports.css';

// Application « Rapports » (analytics) : une période partagée (même sélecteur que le groupe Finance,
// mémorisé entre applications), quatre onglets (Ventes, Clients, Partenaires, Entonnoir) portés par
// l'URL (?tab=), les données de test exclues par défaut, et un export CSV de la table principale de
// chaque onglet via GET /admin/reports/export.
const TABS = ['sales', 'customers', 'partners', 'funnel'];
const TAB_KEYS = { sales: 'adminReports.tab_sales', customers: 'adminReports.tab_customers', partners: 'adminReports.tab_partners', funnel: 'adminReports.tab_funnel' };

export default function AdminReportsPage() {
  const { t: tr } = useLanguage();
  const { token } = useAuth();
  const toast = useToast();
  const [searchParams, setSearchParams] = useSearchParams();
  const tab = TABS.includes(searchParams.get('tab')) ? searchParams.get('tab') : 'sales';
  const { period, setPeriod, queryString } = usePeriod();
  const [includeTest, setIncludeTest] = useState(false);
  const [exporting, setExporting] = useState(false);
  const query = useMemo(() => (includeTest ? `${queryString}&includeTest=1` : queryString), [queryString, includeTest]);

  async function exporter(table) {
    if (exporting) return;
    setExporting(true);
    try {
      const suffix = table ? `-${table}` : '';
      await downloadPdf(`/admin/reports/export?report=${tab}${table ? `&table=${table}` : ''}&${query}`, token, `rapport-${tab}${suffix}.csv`);
    } catch (e) {
      toast(e.message || tr('adminReports.exportError'));
    } finally {
      setExporting(false);
    }
  }

  const common = { token, query };
  return (
    <div>
      <AdminPageHeader module="reports" actions={(
        <>
          <PeriodPicker period={period} onChange={setPeriod} compact />
          <label className="rep-toggle">
            <input type="checkbox" checked={includeTest} onChange={(e) => setIncludeTest(e.target.checked)} />
            {tr('adminReports.includeTest')}
          </label>
          <button type="button" className="btn-ghost" onClick={() => exporter()} disabled={exporting}>{tr('adminCommon.csv')}</button>
        </>
      )} />
      <nav className="fin-tabs" aria-label={tr('adminReports.tabsAria')}>
        {TABS.map((k) => <div key={k} role="tab" aria-selected={tab === k} className={`chip${tab === k ? ' active' : ''}`} onClick={() => setSearchParams({ tab: k })}>{tr(TAB_KEYS[k])}</div>)}
      </nav>
      {tab === 'sales' && <SalesTab {...common} />}
      {tab === 'customers' && <CustomersTab {...common} />}
      {tab === 'partners' && <PartnersTab {...common} onExport={exporter} />}
      {tab === 'funnel' && <FunnelTab {...common} />}
    </div>
  );
}
