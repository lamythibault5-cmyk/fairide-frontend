import { useLanguage } from '../context/LanguageContext';

// L'ÉCHEC DE CHARGEMENT D'UNE LISTE : ce qui n'a pas marché, et de quoi le refaire.
//
// Ce composant vivait dans components/admin/AdminListTools.jsx, et rien en lui n'était propre à
// l'administration — seul le dossier l'était. Vingt-trois écrans admin s'en servaient pendant que
// le tableau de bord livreur n'avait AUCUN état d'erreur et que le restaurateur en avait un écrit
// à la main. Il est remonté d'un dossier ; AdminListTools le ré-exporte, donc les vingt-trois
// écrans n'ont pas bougé d'une ligne.
//
// Les classes s'appellent .error-card et non .admin-error-card : la feuille admin-erp.css n'est
// chargée que par AdminLayout, donc les anciennes classes ne peignaient rien hors de /admin — le
// composant serait arrivé nu sur l'écran d'un livreur. Les règles sont désormais dans styles.css,
// sous les deux noms, le temps que AdminErrorBoundary garde le sien.
//
// `titre` : le texte par défaut ("Impossible de charger ces données.") convient à une liste ; un
// appelant qui sait mieux ce qui manque peut le dire à sa place.
export default function ErrorCard({ message, onRetry, titre }) {
  const { t: tr } = useLanguage();
  return (
    <div className="error-card" role="alert">
      <span className="error-card-icone" aria-hidden="true">⚠️</span>
      <div className="error-card-corps">
        <h3>{titre || tr('adminCommon.loadError')}</h3>
        {message && <p className="small">{message}</p>}
        {onRetry && <button type="button" className="btn-outline" onClick={onRetry}>{tr('adminCommon.retry')}</button>}
      </div>
    </div>
  );
}
