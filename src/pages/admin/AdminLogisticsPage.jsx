import { lazy, Suspense } from 'react';
import { useSearchParams } from 'react-router-dom';
import AdminPageHeader from '../../components/admin/AdminPageHeader';
import { SkeletonCards } from '../../components/Skeleton';
import { useLanguage } from '../../context/LanguageContext';
import ZonesTab from './logistics/ZonesTab';
import FleetTab from './logistics/FleetTab';
import CapacityTab from './logistics/CapacityTab';
import SettingsTab from './logistics/SettingsTab';
import '../../admin-logistics.css';

// L'onglet En direct embarque Leaflet : chargé à la demande pour ne pas alourdir les autres onglets.
const LiveTab = lazy(() => import('./logistics/LiveTab'));

const ONGLETS = ['zones', 'fleet', 'live', 'capacity', 'settings'];

// Application « Logistique » : zones de livraison, flotte en direct, livraisons en cours, capacité
// heure par heure et réglages de dispatch. L'onglet courant vit dans l'URL (?tab=) pour être partageable.
export default function AdminLogisticsPage() {
  const { t: tr } = useLanguage();
  const [searchParams, setSearchParams] = useSearchParams();
  const tab = ONGLETS.includes(searchParams.get('tab')) ? searchParams.get('tab') : 'zones';
  const libelles = {
    zones: tr('adminLogistics.tabZones'),
    fleet: tr('adminLogistics.tabFleet'),
    live: tr('adminLogistics.tabLive'),
    capacity: tr('adminLogistics.tabCapacity'),
    settings: tr('adminLogistics.tabSettings')
  };

  function changer(k) {
    const next = Object.fromEntries([...searchParams.entries()]);
    if (k === 'zones') delete next.tab; else next.tab = k;
    setSearchParams(next, { replace: true });
  }

  return (
    <div>
      <AdminPageHeader module="logistics" />
      <nav className="lg-tabs" role="tablist" aria-label={tr('adminModules.logistics')}>
        {ONGLETS.map((k) => (
          <button key={k} type="button" role="tab" aria-selected={tab === k} className={`chip${tab === k ? ' active' : ''}`} onClick={() => changer(k)}>{libelles[k]}</button>
        ))}
      </nav>
      {tab === 'zones' && <ZonesTab />}
      {tab === 'fleet' && <FleetTab />}
      {tab === 'live' && <Suspense fallback={<SkeletonCards count={3} />}><LiveTab /></Suspense>}
      {tab === 'capacity' && <CapacityTab />}
      {tab === 'settings' && <SettingsTab />}
    </div>
  );
}
