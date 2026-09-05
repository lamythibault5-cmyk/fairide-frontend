// Barre d'état de l'alerte "nouvelle commande", affichée en haut du tableau de bord restaurateur.
//
// Deux rôles distincts :
//   - dire ce qui attend (le compteur), visible d'un coup d'œil depuis le comptoir ;
//   - rendre l'alerte contrôlable et surtout HONNÊTE sur ce qu'elle garantit. Tant que le Web Push
//     n'existe pas, le son et les notifications système ne fonctionnent que si cet onglet reste
//     ouvert : le dire explicitement évite qu'un restaurateur croie être couvert écran éteint.
export default function NewOrderAlertBar({ newCount, soundEnabled, setSoundEnabled, permission, requestPermission }) {
  const { t } = useLanguage();
  const active = newCount > 0;
  return (
    <div
      className="card"
      style={{
        display: 'flex', alignItems: 'center', gap: 12, flexWrap: 'wrap',
        borderLeft: `4px solid ${active ? 'var(--red)' : 'var(--line)'}`,
        marginBottom: 14
      }}
    >
      <strong style={{ fontSize: 15 }}>
        {active
          ? t('alertBar.toHandle', { n: newCount })
          : t('alertBar.nonePending')}
      </strong>

      <span className="small" style={{ flex: 1, minWidth: 220 }}>
        {permission === 'granted'
          ? t('alertBar.soundOnHelp')
          : t('alertBar.keepTabOpen')}
      </span>

      <div className="row" style={{ gap: 8 }}>
        <button
          type="button"
          className="btn-outline"
          style={{ padding: '6px 12px', fontSize: 13 }}
          aria-pressed={soundEnabled}
          onClick={() => setSoundEnabled(!soundEnabled)}
        >
          {soundEnabled ? t('alertBar.soundOn') : t('alertBar.soundOff')}
        </button>

        {/* L'API Notification exige que la demande parte d'un geste de l'utilisateur : d'où un bouton
            explicite plutôt qu'une demande au chargement, que les navigateurs rejettent de toute
            façon et que les utilisateurs refusent par réflexe. */}
        {permission === 'default' && (
          <button type="button" className="btn-gold" style={{ padding: '6px 12px', fontSize: 13 }} onClick={requestPermission}>
            {t('alertBar.enableNotifications')}
          </button>
        )}
        {permission === 'denied' && (
          <span className="small" style={{ color: 'var(--red)' }}>
            {t('alertBar.blocked')}
          </span>
        )}
      </div>
    </div>
  );
}

import { useLanguage } from '../context/LanguageContext';