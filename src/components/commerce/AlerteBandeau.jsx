import { useState } from 'react';
import { Link } from 'react-router-dom';
import { useLanguage } from '../../context/LanguageContext';
import { useToast } from '../../context/ToastContext';
import { SONNERIES, REPETITIONS } from '../../hooks/useNewOrderAlert';
import Icone from '../Icone';

/* L'ALARME DES COMMANDES SUR LE BANDEAU IRIS (site seulement, 2026-10-16, mockups/site-ordinateur.html › Espace commerce,
 * « Le service, le son et la prochaine étape montent dans le bandeau »). Les mêmes gestes que NewOrderAlertBar — son
 * activé / coupé, son bloqué par le navigateur, couper l'alarme, réglages (sonnerie, répétitions, volume, test),
 * notifications push ou système — et la même phrase honnête sur ce que l'alerte garantit, mais en pastilles claires sur
 * l'iris : le lime de la page reste à « Accepter ». Les règles (quand proposer le push, quand la permission) sont celles
 * de NewOrderAlertBar.jsx : y changer une règle, c'est la changer ici aussi. Dans l'app, la barre d'origine reste. */
export default function AlerteBandeau({ audioBloque, debloquerAudio, soundEnabled, setSoundEnabled, permission, requestPermission, push, sonnerie, setSonnerie, testerAlarme, volume, setVolume, repetitions, setRepetitions, alarmeEnCours, couperAlarme, terminal }) {
  const { t } = useLanguage();
  const toast = useToast();
  const [reglagesOuverts, setReglagesOuverts] = useState(false);

  async function basculerPush() {
    if (push.abonne) {
      await push.desactiver();
      toast(t('alertBar.pushOffDone'), 'succes');
      return;
    }
    const issue = await push.activer();
    if (issue === 'ok') toast(t('alertBar.pushOnDone'), 'succes');
    else if (issue === 'refuse') toast(t('alertBar.pushRefused'), 'erreur');
    else toast(t('alertBar.pushFailed'), 'erreur');
  }

  const aide = push?.abonne ? t('alertBar.pushOnHelp') : permission === 'granted' ? t('alertBar.soundOnHelp') : t('alertBar.keepTabOpen');
  const sonActif = soundEnabled && !audioBloque;
  const pushPossible = push?.supporte && push?.disponible;

  return (
    <div className="sp-alerte">
      <div className="sp-puces" role="group" aria-label={t('sitePro.reglagesService')}>
        <button type="button" className="sp-puce" aria-pressed={soundEnabled} onClick={() => setSoundEnabled(!soundEnabled)}>
          <Icone nom={sonActif ? 'son' : 'sonCoupe'} taille={16} />{sonActif ? t('alertBar.soundOn') : t('alertBar.soundOff')}
        </button>
        {terminal && (
          <Link to="/dashboard/terminal" className="sp-puce"><Icone nom="imprimante" taille={16} />{terminal}</Link>
        )}
        {setSonnerie && (
          <button type="button" className="sp-puce" aria-expanded={reglagesOuverts} onClick={() => setReglagesOuverts((v) => !v)}>
            <Icone nom="reglages" taille={16} />{t('alertBar.settings')}
          </button>
        )}
        {pushPossible && (
          <button type="button" className="sp-puce" aria-pressed={push.abonne} disabled={push.occupe} onClick={basculerPush}>
            <Icone nom="cloche" taille={16} />{push.abonne ? t('alertBar.pushOn') : t('alertBar.pushOff')}
          </button>
        )}
        {permission === 'default' && !pushPossible && (
          <button type="button" className="sp-puce" onClick={requestPermission}><Icone nom="cloche" taille={16} />{t('alertBar.enableNotifications')}</button>
        )}
      </div>
      {reglagesOuverts && setSonnerie && (
        <div className="sp-reglages">
          <label>
            <span>{t('alertBar.ringtone')}</span>
            <select value={sonnerie} onChange={(e) => { setSonnerie(e.target.value); testerAlarme?.(e.target.value); }}>
              {SONNERIES.map((s) => <option key={s} value={s}>{t(`alertBar.ringtone_${s}`)}</option>)}
            </select>
          </label>
          {setRepetitions && (
            <label>
              <span>{t('alertBar.repeats')}</span>
              <select value={repetitions} onChange={(e) => setRepetitions(e.target.value)}>
                {REPETITIONS.map((n) => <option key={n} value={n}>{n === 0 ? t('alertBar.repeatsForever') : t('alertBar.repeatsN', { n })}</option>)}
              </select>
            </label>
          )}
          {setVolume && (
            <label>
              <span>{t('alertBar.volume')}</span>
              <input type="range" min="0" max="100" step="5" value={volume} onChange={(e) => setVolume(e.target.value)} onPointerUp={() => testerAlarme?.()}
                onKeyUp={(e) => { if (['ArrowLeft', 'ArrowRight', 'ArrowUp', 'ArrowDown'].includes(e.key)) testerAlarme?.(); }} />
            </label>
          )}
          {testerAlarme && (
            <button type="button" className="sp-puce" onClick={async () => { if (!(await testerAlarme())) toast(t('alertBar.testFailed'), 'erreur'); }}>
              <Icone nom="cloche" taille={16} />{t('alertBar.testAlarm')}
            </button>
          )}
        </div>
      )}
      {/* L'aide, et ce qui presse : le son bloqué par le navigateur (l'alarme ne sonnerait pas), l'alarme qui sonne. */}
      <div className="sp-b-alerte">
        <p className="sp-b-aide">{aide}{permission === 'denied' && <> <b>{t('alertBar.blocked')}</b></>}</p>
        {soundEnabled && audioBloque && (
          <button type="button" className="sp-puce sp-puce--blanche" onClick={debloquerAudio}>
            <Icone nom="sonCoupe" taille={16} />{t('alertBar.tapToEnableSound')}
          </button>
        )}
        {alarmeEnCours && couperAlarme && (
          <button type="button" className="sp-puce sp-puce--blanche" onClick={couperAlarme}><Icone nom="sonCoupe" taille={16} />{t('alertBar.stopAlarm')}</button>
        )}
      </div>
    </div>
  );
}
