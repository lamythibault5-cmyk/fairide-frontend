import { useLanguage } from '../context/LanguageContext';
import Icone from './Icone';

// Barre d'alertes du livreur, en tête de ses courses : ce qui l'attend, le son, les notifications — et ce que
// l'alerte garantit vraiment (onglet ouvert ; sinon e-mail). Voir useAlerteLivreur.js.
export default function AlerteLivreurBar({ sonActif, setSonActif, permission, demanderPermission, nbDispo, nbPretes }) {
  const { t } = useLanguage();
  const urgent = nbPretes > 0;
  return (
    <div className="card alerte-livreur" style={{ borderLeft: `4px solid ${urgent ? 'var(--red)' : nbDispo ? 'var(--gold-deep, #B8860B)' : 'var(--line)'}` }}>
      <strong>
        {urgent ? (nbPretes === 1 ? t('driverAlert.readyWaitingOne') : t('driverAlert.readyWaiting', { n: nbPretes })) : nbDispo ? (nbDispo === 1 ? t('driverAlert.availableOne') : t('driverAlert.available', { n: nbDispo })) : t('driverAlert.none')}
      </strong>
      <span className="small alerte-livreur-aide">
        {permission === 'granted' ? t('driverAlert.helpGranted') : t('driverAlert.helpDefault')}
      </span>
      <div className="row" style={{ gap: 8, flexWrap: 'wrap' }}>
        <button type="button" className="btn-outline btn-sm" aria-pressed={sonActif} onClick={() => setSonActif(!sonActif)}>
          {sonActif ? t('driverAlert.soundOn') : t('driverAlert.soundOff')}
        </button>
        {permission === 'default' && (
          <button type="button" className="btn-gold btn-sm" onClick={demanderPermission}>
            <Icone nom="cloche" taille={16} className="icone-texte" />{' '}{t('driverAlert.enableNotifications')}
          </button>
        )}
        {permission === 'denied' && <span className="small texte-erreur">{t('driverAlert.blocked')}</span>}
      </div>
    </div>
  );
}
