import { useLanguage } from '../../context/LanguageContext';
import { rueAdresse } from '../../nomAdresse';
import './bulle-adresse.css';

/* « TU ES À 4,2 KM DE … ON LIVRE BIEN LÀ ? » (fondateur, 2026-11-08, version A de maquettes/retours-08-11 : une bulle qui
 * pointe l'adresse). Posée sous le bouton « Livrer à » du bandeau (TeteListe.jsx, prop `bulle`), la pointe vers lui.
 * Le calcul et ses garde-fous sont dans usePositionLancement.js.
 *
 * « Livrer à ma position » n'enregistre rien tout seul : il ouvre le carnet sur « Utiliser ma position », qui prend la position
 * PRÉCISE et demande de vérifier le numéro (une position prise au salon peut tomber sur la maison d'à côté). « Oui, garder »
 * range la bulle pour cette adresse jusqu'à la prochaine ouverture de l'app. */
export default function BulleAdresseLoin({ km, user, onIci, onGarder }) {
  const { t, language } = useLanguage();
  const distance = new Intl.NumberFormat(language === 'en' ? 'en-GB' : `${language}-BE`, { maximumFractionDigits: km < 10 ? 1 : 0 }).format(km);
  const adresse = rueAdresse({ street: user?.addressStreet, number: user?.addressNumber, city: user?.addressCity });
  return (
    <div className="bulle-loin" role="dialog" aria-live="polite" aria-labelledby="bulle-loin-texte">
      <span className="bulle-loin-pointe" aria-hidden="true" />
      <p id="bulle-loin-texte" className="bulle-loin-texte">
        {t('adresses.farText', { km: distance, adresse })} <b>{t('adresses.farQuestion')}</b>
      </p>
      <div className="bulle-loin-actions">
        <button type="button" className="bulle-loin-ici" onClick={onIci}>{t('adresses.farHere')}</button>
        <button type="button" className="bulle-loin-garder" onClick={onGarder}>{t('adresses.farKeep')}</button>
      </div>
    </div>
  );
}
