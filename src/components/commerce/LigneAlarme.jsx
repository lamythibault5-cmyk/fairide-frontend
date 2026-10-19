import { useState } from 'react';
import { useLanguage } from '../../context/LanguageContext';
import Icone from '../Icone';
import SousEcran from '../SousEcran';
import NewOrderAlertBar from '../NewOrderAlertBar';

/* L'ALARME EN UNE LIGNE SUR LE BANDEAU IRIS (audit design 2, section 2, fondateur 2026-10-19). Dans l'app, l'écran
 * Commandes s'ouvrait sur une carte d'alarme (aide, son, réglages, « Couper l'alarme » en lime) : la commande qui attendait
 * commençait en bas de l'écran. Ici : « 1 commande à traiter · alarme active », une pastille BLANCHE « Couper » tant que
 * l'alarme sonne (jamais lime : le lime de l'écran est à « Accepter »), et la roue dentée qui ouvre tous les réglages de
 * l'alarme (son, sonnerie, répétitions, volume, test, notifications) — la carte complète de NewOrderAlertBar, dans une
 * feuille. Son bloqué par le navigateur : la pastille devient « Activer le son ». Mêmes gestes, mêmes règles qu'avant. */
export default function LigneAlarme({ alerte }) {
  const { t } = useLanguage();
  const [reglages, setReglages] = useState(false);
  if (!alerte) return null;
  const { newCount = 0, soundEnabled, audioBloque, debloquerAudio, alarmeEnCours, couperAlarme } = alerte;
  const quoi = newCount > 0 ? (newCount === 1 ? t('alertBar.toHandleOne') : t('alertBar.toHandle', { n: newCount })) : t('alertBar.nonePending');
  const etat = !soundEnabled ? t('serviceCommerce.sonCoupe') : audioBloque ? t('serviceCommerce.sonBloque') : t('serviceCommerce.alarmeActive');
  return (
    <>
      <div className={`ec-alarme${newCount > 0 ? ' ec-alarme--active' : ''}`} role="status">
        <span className={newCount > 0 ? 'ec-sonne' : undefined} aria-hidden="true"><Icone nom={soundEnabled && !audioBloque ? 'cloche' : 'sonCoupe'} taille={18} /></span>
        <span className="ec-alarme-texte"><b>{quoi}</b> · {etat}</span>
        {soundEnabled && audioBloque ? (
          <button type="button" className="ec-pilule-blanche" onClick={debloquerAudio}>{t('serviceCommerce.activerSon')}</button>
        ) : alarmeEnCours && couperAlarme ? (
          <button type="button" className="ec-pilule-blanche" onClick={couperAlarme}>{t('serviceCommerce.couper')}</button>
        ) : null}
        <button type="button" className="ec-alarme-reglages" aria-label={t('serviceCommerce.reglagesAlarme')} title={t('serviceCommerce.reglagesAlarme')} onClick={() => setReglages(true)}>
          <Icone nom="reglages" taille={18} />
        </button>
      </div>
      {reglages && (
        <SousEcran titre={t('serviceCommerce.reglagesAlarme')} onFermer={() => setReglages(false)}>
          <NewOrderAlertBar {...alerte} />
        </SousEcran>
      )}
    </>
  );
}
