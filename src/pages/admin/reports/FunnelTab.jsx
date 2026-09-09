import { useLanguage } from '../../../context/LanguageContext';
import { LoadState } from '../accounting/common';
import { useReport, SectionCard, FunnelSteps, StackedBars } from './common';

// Onglet Entonnoir : parcours d'activation des trois publics (clients, restaurants, livreurs) inscrits
// dans la période, et inscriptions par semaine ISO en barres empilées.
export default function FunnelTab({ token, query }) {
  const { t: tr } = useLanguage();
  const state = useReport('funnel', token, query);
  const series = [
    { key: 'client', label: tr('adminReports.clients'), color: 'var(--iris)' },
    { key: 'restaurant', label: tr('adminCommon.restaurants'), color: 'var(--teal)' },
    { key: 'driver', label: tr('adminCommon.drivers'), color: 'var(--lime)' }
  ];

  return (
    <LoadState state={state} skeleton={3}>
      {(d) => (
        <>
          <div className="rep-grid">
            <SectionCard title={tr('adminReports.clients')}>
              <FunnelSteps steps={[
                { label: tr('adminReports.step_signed'), value: d.clients.signed },
                { label: tr('adminReports.step_verified'), value: d.clients.verified },
                { label: tr('adminReports.step_firstOrder'), value: d.clients.firstOrder }
              ]} />
            </SectionCard>
            <SectionCard title={tr('adminCommon.restaurants')}>
              <FunnelSteps steps={[
                { label: tr('adminReports.step_signed'), value: d.restaurants.signed },
                { label: tr('adminReports.step_approved'), value: d.restaurants.approved },
                { label: tr('adminReports.step_published'), value: d.restaurants.published },
                { label: tr('adminReports.step_firstOrder'), value: d.restaurants.firstOrder }
              ]} />
            </SectionCard>
            <SectionCard title={tr('adminCommon.drivers')}>
              <FunnelSteps steps={[
                { label: tr('adminReports.step_signed'), value: d.drivers.signed },
                { label: tr('adminReports.step_approved'), value: d.drivers.approved },
                { label: tr('adminReports.step_firstDelivery'), value: d.drivers.firstDelivery }
              ]} />
            </SectionCard>
          </div>
          <SectionCard title={tr('adminReports.signupsByWeek')}>
            <StackedBars data={d.signupsByWeek.map((w) => ({ label: w.week, values: w }))} series={series} />
          </SectionCard>
        </>
      )}
    </LoadState>
  );
}
