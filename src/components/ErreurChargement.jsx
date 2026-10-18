import { useEffect } from 'react';
import { useLanguage } from '../context/LanguageContext';
import EtatVide from './EtatVide';

/* « IMPOSSIBLE DE CHARGER » — JAMAIS UN FAUX ÉCRAN VIDE (audit du 18/10/2026).
 *
 * Un réseau coupé ou un serveur lent donnait « Aucun commerce pour le moment » ou « Rien en route pour l'instant » : le
 * client croyait sa commande perdue, ou Fairide vide. Ici, l'échec est dit tel quel, avec un seul geste : Réessayer. La
 * même forme que l'écran d'échec de la fiche d'un commerce (RestaurantMenu.jsx). Le retour de la connexion relance aussi
 * le chargement tout seul. */
export default function ErreurChargement({ onReessayer, enLigne = true }) {
  const { t } = useLanguage();
  useEffect(() => {
    if (!enLigne) return undefined;
    window.addEventListener('online', onReessayer);
    return () => window.removeEventListener('online', onReessayer);
  }, [onReessayer, enLigne]);
  return (
    <EtatVide icone="antenne" titre={t('common.loadFailedTitle')} texte={t('common.loadFailedText')}>
      <button type="button" className="btn-teal" onClick={onReessayer}>{t('common.retry')}</button>
    </EtatVide>
  );
}
