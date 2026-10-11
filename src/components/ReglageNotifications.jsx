import { useAuth } from '../context/AuthContext';
import { useLanguage } from '../context/LanguageContext';
import { useToast } from '../context/ToastContext';
import usePushNotifications from '../hooks/usePushNotifications';

/* Réglage « recevoir les notifications sur cet appareil » — une ligne et un bouton, pour le client (Mes commandes) et le
 * livreur (Courses disponibles, via NotifCourses.jsx). Le commerce a le sien dans NewOrderAlertBar.
 *
 * Ce que le serveur envoie (vérifié le 2026-10-11) : au client, chaque étape de sa commande (acceptée, refusée, livreur
 * trouvé, en route, livrée, prête à retirer, annulée) et le livreur à la porte ; au livreur, les nouvelles courses qu'il
 * verrait, sa course prête, annulée ou retirée par le client (backend pushFile.js, notifLivreurs.js). Abonnement web sur le
 * site, jeton APNs / FCM dans l'application — usePushNotifications fait les deux.
 *
 * Rien ne s'affiche si l'appareil ne sait pas en recevoir ou si le serveur n'en envoie pas : pas de bouton qui ne mène
 * à rien. `textes` : { aide, actif } — la ligne avant et après activation. */
export default function ReglageNotifications({ textes }) {
  const { token } = useAuth();
  const { t } = useLanguage();
  const toast = useToast();
  const push = usePushNotifications(token);
  if (!push.supporte || !push.disponible) return null;

  async function basculer() {
    if (push.abonne) { await push.desactiver(); toast(t('notifs.offDone')); return; }
    const issue = await push.activer();
    if (issue === 'ok') toast(t('notifs.onDone'));
    else if (issue === 'refuse') toast(t('notifs.refused'), 'erreur');
    else toast(t('notifs.failed'), 'erreur');
  }

  return (
    <div className="row" style={{ gap: 10, alignItems: 'center', margin: '0 0 12px', flexWrap: 'wrap' }}>
      <span className="small" style={{ flex: 1, minWidth: 180 }}>{push.abonne ? textes.actif : textes.aide}</span>
      <button type="button" className={push.abonne ? 'btn-ghost' : 'btn-outline'} style={{ padding: '8px 14px', fontSize: 14 }} disabled={push.occupe} onClick={basculer}>
        {push.abonne ? t('notifs.disable') : t('notifs.enable')}
      </button>
    </div>
  );
}
