import { useLanguage } from '../context/LanguageContext';

// Barre d'alertes du livreur, en tête de ses courses : ce qui l'attend, le son, les notifications — et ce que
// l'alerte garantit vraiment (onglet ouvert ; sinon e-mail). Voir useAlerteLivreur.js.
export default function AlerteLivreurBar({ sonActif, setSonActif, permission, demanderPermission, nbDispo, nbPretes }) {
  const { t } = useLanguage();
  const urgent = nbPretes > 0;
  return (
    <div className="card alerte-livreur" style={{ borderLeft: `4px solid ${urgent ? 'var(--red)' : nbDispo ? 'var(--gold-deep, #B8860B)' : 'var(--line)'}` }}>
      <strong>
        {urgent ? t('driverAlert.readyWaiting', { n: nbPretes }) : nbDispo ? t('driverAlert.available', { n: nbDispo }) : t('driverAlert.none')}
      </strong>
      <span className="small alerte-livreur-aide">
        {permission === 'granted' ? t('driverAlert.helpGranted') : t('driverAlert.helpDefault')}
      </span>
      <div className="row" style={{ gap: 8, flexWrap: 'wrap' }}>
        <button type="button" className="btn-outline" style={{ padding: '8px 12px', fontSize: 13 }} aria-pressed={sonActif} onClick={() => setSonActif(!sonActif)}>
          {sonActif ? t('driverAlert.soundOn') : t('driverAlert.soundOff')}
        </button>
        {permission === 'default' && (
          <button type="button" className="btn-gold" style={{ padding: '8px 12px', fontSize: 13 }} onClick={demanderPermission}>
            🔔 {t('driverAlert.enableNotifications')}
          </button>
        )}
        {permission === 'denied' && <span className="small" style={{ color: 'var(--red)' }}>{t('driverAlert.blocked')}</span>}
      </div>
    </div>
  );
}
