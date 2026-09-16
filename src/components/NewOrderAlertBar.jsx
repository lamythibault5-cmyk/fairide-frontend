// Barre d'état de l'alerte "nouvelle commande", affichée en haut du tableau de bord restaurateur.
//
// Deux rôles distincts :
//   - dire ce qui attend (le compteur), visible d'un coup d'œil depuis le comptoir ;
//   - rendre l'alerte contrôlable et surtout HONNÊTE sur ce qu'elle garantit.
//
// CETTE HONNÊTETÉ A CHANGÉ DE CONTENU, PAS DE PRINCIPE. Tant que le Web Push n'existait pas, cette
// barre devait avertir que le son et les notifications système supposent l'onglet ouvert — sans quoi
// un restaurateur se croyait couvert écran éteint. Le push existe maintenant, mais il ne couvre pas
// tout le monde : sur iPhone et iPad il n'arrive que si le site a été ajouté à l'écran d'accueil, et
// dans Safari ordinaire il n'existe pas du tout. La phrase affichée suit donc l'état réel de CE
// navigateur — abonné, abonnable, ou hors de portée — plutôt que de promettre partout la même chose.
import { useLanguage } from '../context/LanguageContext';
import { useToast } from '../context/ToastContext';

export default function NewOrderAlertBar({ newCount, soundEnabled, setSoundEnabled, permission, requestPermission, push }) {
  const { t } = useLanguage();
  const toast = useToast();
  const active = newCount > 0;

  async function basculerPush() {
    if (push.abonne) {
      await push.desactiver();
      toast(t('alertBar.pushOffDone'));
      return;
    }
    const issue = await push.activer();
    if (issue === 'ok') toast(t('alertBar.pushOnDone'));
    else if (issue === 'refuse') toast(t('alertBar.pushRefused'));
    else toast(t('alertBar.pushFailed'));
  }

  // Ce que la barre peut promettre, dans l'ordre décroissant de garantie.
  const aide = push?.abonne
    ? t('alertBar.pushOnHelp')
    : permission === 'granted'
      ? t('alertBar.soundOnHelp')
      : t('alertBar.keepTabOpen');

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

      <span className="small" style={{ flex: 1, minWidth: 220 }}>{aide}</span>

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

        {/* Le bouton du push ne s'affiche que là où il peut tenir sa promesse : navigateur capable
            ET clés VAPID configurées côté serveur. Ailleurs, rien — plutôt qu'un bouton qui échoue.
            C'est aussi la seule action de cette barre qui vaut du lime : elle couvre l'onglet
            fermé, ce qu'aucune des autres ne fait. */}
        {push?.supporte && push?.disponible && (
          <button
            type="button"
            className={push.abonne ? 'btn-outline' : 'btn-gold'}
            style={{ padding: '6px 12px', fontSize: 13 }}
            aria-pressed={push.abonne}
            disabled={push.occupe}
            onClick={basculerPush}
          >
            {push.abonne ? t('alertBar.pushOn') : t('alertBar.pushOff')}
          </button>
        )}

        {/* L'API Notification exige que la demande parte d'un geste de l'utilisateur : d'où un bouton
            explicite plutôt qu'une demande au chargement, que les navigateurs rejettent de toute
            façon et que les utilisateurs refusent par réflexe.
            Il ne s'affiche QUE là où le push n'est pas proposé. Les deux demandent exactement la
            même permission au navigateur : côte à côte, ils donnaient deux boutons presque
            identiques, dont l'un couvrait moins que l'autre sans que rien ne le dise. */}
        {permission === 'default' && !(push?.supporte && push?.disponible) && (
          <button type="button" className="btn-outline" style={{ padding: '6px 12px', fontSize: 13 }} onClick={requestPermission}>
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
