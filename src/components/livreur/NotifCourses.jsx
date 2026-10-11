import { useAuth } from '../../context/AuthContext';
import { useLanguage } from '../../context/LanguageContext';
import { useToast } from '../../context/ToastContext';
import usePushNotifications from '../../hooks/usePushNotifications';

/* « Être prévenu des nouvelles courses » — sous « Courses disponibles » du tableau de bord livreur.
 *
 * Le serveur prévient les livreurs qui VERRAIENT une course dès qu'elle apparaît (backend notifLivreurs.js, fondateur
 * 2026-10-11). Il faut pour cela un abonnement sur l'appareil : notification web sur le site (service worker), jeton
 * APNs / FCM dans l'application — usePushNotifications fait les deux. L'application le propose aussi une fois juste
 * après l'inscription (AmorceNotifications.jsx) ; ici, c'est le réglage permanent, pour l'activer plus tard ou le couper.
 *
 * Rien ne s'affiche si l'appareil ne sait pas recevoir de notifications ou si le serveur n'en envoie pas : on ne propose
 * pas un bouton qui ne mènerait à rien. */
export default function NotifCourses() {
  const { token } = useAuth();
  const { t } = useLanguage();
  const toast = useToast();
  const push = usePushNotifications(token);
  if (!push.supporte || !push.disponible) return null;

  async function basculer() {
    if (push.abonne) { await push.desactiver(); toast(t('dashDriver.notifOffDone')); return; }
    const issue = await push.activer();
    if (issue === 'ok') toast(t('dashDriver.notifOnDone'));
    else if (issue === 'refuse') toast(t('dashDriver.notifRefused'), 'erreur');
    else toast(t('dashDriver.notifFailed'), 'erreur');
  }

  return (
    <div className="row" style={{ gap: 10, alignItems: 'center', margin: '0 0 12px', flexWrap: 'wrap' }}>
      <span className="small" style={{ flex: 1, minWidth: 180 }}>{push.abonne ? t('dashDriver.notifOn') : t('dashDriver.notifHelp')}</span>
      <button type="button" className={push.abonne ? 'btn-ghost' : 'btn-outline'} style={{ padding: '8px 14px', fontSize: 14 }} disabled={push.occupe} onClick={basculer}>
        {push.abonne ? t('dashDriver.notifDisable') : t('dashDriver.notifEnable')}
      </button>
    </div>
  );
}
