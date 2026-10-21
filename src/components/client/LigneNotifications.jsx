import LigneCompte from '../LigneCompte';
import ReglageNotifications from '../ReglageNotifications';
import { useLanguage } from '../../context/LanguageContext';
import { estSupporte } from '../../push';

/* LES NOTIFICATIONS DU SUIVI, AUSSI DANS MON COMPTE (audit du 19/10, AO-26). Le réglage n'existait qu'en tête de Mes
 * commandes ; c'est dans Mon compte qu'on cherche un réglage. Même composant, mêmes textes que Mes commandes
 * (ReglageNotifications.jsx). Pas de rangée sur un navigateur qui ne sait pas recevoir de notifications : elle s'ouvrirait
 * sur rien. */
export default function LigneNotifications({ ouverte, onClick }) {
  const { t } = useLanguage();
  if (!estSupporte()) return null;
  return (
    <LigneCompte icone="cloche" titre={t('account.notificationsTitle')} sous={t('account.notificationsSub')} ouverte={ouverte} onClick={onClick}>
      <ReglageNotifications textes={{ aide: t('orders.notifHelp'), actif: t('orders.notifOn') }} />
    </LigneCompte>
  );
}
