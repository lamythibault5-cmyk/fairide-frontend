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
import NumbersTabs from './reports/NumbersTabs';
import '../../admin-finance.css';
import '../../admin-reports.css';

// Application « Rapports » (analytics) : une période partagée (même sélecteur que le groupe Finance,
// mémorisé entre applications), quatre onglets (Ventes, Clients, Partenaires, Entonnoir) portés par
// l'URL (?tab=), les données de test exclues par défaut, et un export CSV de la table principale de
// chaque onglet via GET /admin/reports/export.
// Rattachée au Tableau de bord depuis le 2026-09-23 : son en-tête se déclare « dashboard » et sa rangée
// d'onglets est celle de reports/NumbersTabs.jsx, qui ajoute « Vue d'ensemble » devant les quatre.
const TABS = ['sales', 'customers', 'partners', 'funnel'];

export default function AdminReportsPage() {
  const { t: tr } = useLanguage();
  const { token } = useAuth();
  const toast = useToast();
  const [searchParams] = useSearchParams();
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
      <AdminPageHeader module="dashboard" actions={(
        <>
          <PeriodPicker period={period} onChange={setPeriod} compact />
          <label className="rep-toggle">
            <input type="checkbox" checked={includeTest} onChange={(e) => setIncludeTest(e.target.checked)} />
            {tr('adminReports.includeTest')}
          </label>
          <button type="button" className="btn-ghost" onClick={() => exporter()} disabled={exporting}>{tr('adminCommon.csv')}</button>
        </>
      )} />
      <NumbersTabs current={tab} />

      {tab === 'sales' && <SalesTab {...common} />}
      {tab === 'customers' && <CustomersTab {...common} />}
      {tab === 'partners' && <PartnersTab {...common} onExport={exporter} />}
      {tab === 'funnel' && <FunnelTab {...common} />}
    </div>
  );
}
