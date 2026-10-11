import { useLanguage } from '../../context/LanguageContext';
import ReglageNotifications from '../ReglageNotifications';

/* « Être prévenu des nouvelles courses » — sous « Courses disponibles » du tableau de bord livreur.
 *
 * Le serveur prévient les livreurs qui VERRAIENT une course dès qu'elle apparaît (backend notifLivreurs.js), puis celui
 * qui l'a prise quand elle est prête, annulée ou retirée par le client (pushFile.js). L'application le propose aussi une
 * fois juste après l'inscription (AmorceNotifications.jsx) ; ici, c'est le réglage permanent. */
export default function NotifCourses() {
  const { t } = useLanguage();
  return <ReglageNotifications textes={{ aide: t('dashDriver.notifHelp'), actif: t('dashDriver.notifOn') }} />;
}
