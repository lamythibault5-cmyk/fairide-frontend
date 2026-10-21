import { useEffect } from 'react';
import { useLanguage } from '../context/LanguageContext';
import EtatVide from './EtatVide';

function texteErreur(erreur, t) {
  const statut = Number(erreur?.status) || 0;
  if (statut >= 500) return t('common.loadFailedServer');
  if (statut >= 400 && erreur?.message) return erreur.message;
  return t('common.loadFailedText');
}

/* « IMPOSSIBLE DE CHARGER » — JAMAIS UN FAUX ÉCRAN VIDE (audit du 18/10/2026).
 *
 * Un réseau coupé ou un serveur lent donnait « Aucun commerce pour le moment » ou « Rien en route pour l'instant » : le
 * client croyait sa commande perdue, ou Fairide vide. Ici, l'échec est dit tel quel, avec un seul geste : Réessayer. La
 * même forme que l'écran d'échec de la fiche d'un commerce (RestaurantMenu.jsx). Le retour de la connexion relance aussi
 * le chargement tout seul. */
/* `erreur` (facultatif) : l'ApiError reçue. « Vérifie ta connexion » ne convient qu'à un réseau coupé (statut 0) ; quand le
 * serveur a répondu par un refus ou une panne, on le dit tel quel (audit du 19/10, CROSS-49). */
export default function ErreurChargement({ onReessayer, enLigne = true, erreur }) {
  const { t } = useLanguage();
  useEffect(() => {
    if (!enLigne) return undefined;
    window.addEventListener('online', onReessayer);
    return () => window.removeEventListener('online', onReessayer);
  }, [onReessayer, enLigne]);
  return (
    <EtatVide icone="antenne" titre={t('common.loadFailedTitle')} texte={texteErreur(erreur, t)}>
      <button type="button" className="btn-teal" onClick={onReessayer}>{t('common.retry')}</button>
    </EtatVide>
  );
}
