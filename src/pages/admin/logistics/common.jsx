import { useEffect } from 'react';
import { useLanguage, getLocale } from '../../../context/LanguageContext';

// Briques partagées par les onglets de l'application Logistique : chargement (réutilise celles du groupe
// Finance pour garder les mêmes états erreur / réessai), rafraîchissement automatique, indicateur de
// fraîcheur des données, tuile KPI et formats d'heure.
export { useApiData, LoadState, ErrorState } from '../accounting/common';

export function fmtTime(ts) {
  if (!ts) return '-';
  return new Date(ts).toLocaleTimeString(getLocale(), { hour: '2-digit', minute: '2-digit' });
}

// Minutes écoulées depuis un horodatage (null si inconnu).
export function minutesDepuis(ts) {
  if (!ts) return null;
  return Math.max(0, Math.round((Date.now() - ts) / 60000));
}

// Relance `reload` toutes les `ms` millisecondes tant que l'onglet du navigateur est visible (inutile
// de bombarder l'API depuis un onglet en arrière-plan).
export function useAutoRefresh(reload, ms) {
  useEffect(() => {
    const id = setInterval(() => { if (document.visibilityState === 'visible') reload(); }, ms);
    return () => clearInterval(id);
  }, [reload, ms]);
}

// « Données à jour à HH:MM » + bouton Actualiser.
export function Freshness({ at, onRefresh, loading }) {
  const { t: tr } = useLanguage();
  return (
    <div className="lg-fresh">
      <span className="dot" aria-hidden="true" />
      <span>{tr('adminLogistics.freshAt', { time: fmtTime(at) })}</span>
      <button type="button" className="btn-ghost" onClick={onRefresh} disabled={loading}>{tr('adminLogistics.refresh')}</button>
    </div>
  );
}

export function KpiCard({ value, label, highlight, warn }) {
  return (
    <div className={`stat-card${highlight ? ' highlight' : ''}`}>
      <div className="num" style={warn ? { color: 'var(--red)' } : undefined}>{value}</div>
      <div className="label">{label}</div>
    </div>
  );
}

// Libellés des états d'un livreur (pastille + compteurs), une seule table pour toute l'application.
export function useDriverStatusLabels() {
  const { t: tr } = useLanguage();
  return {
    online: tr('adminLogistics.statusOnline'),
    delivering: tr('adminLogistics.statusDelivering'),
    paused: tr('adminLogistics.statusPaused'),
    offline: tr('adminLogistics.statusOffline')
  };
}

export function useVehicleLabels() {
  const { t: tr } = useLanguage();
  return {
    velo: tr('adminLogistics.vehicleBike'),
    velo_electrique: tr('adminLogistics.vehicleEbike'),
    scooter: tr('adminLogistics.vehicleScooter'),
    voiture: tr('adminLogistics.vehicleCar')
  };
}
