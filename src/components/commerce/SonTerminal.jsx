import { useEffect, useState } from 'react';
import { useLanguage } from '../../context/LanguageContext';
import { abonnerTerminalNavigateur } from '../../terminalNavigateur';
import Icone from '../Icone';

/* LE SON DU TERMINAL GOODCOM, ALLUMÉ PAR DÉFAUT (fondateur, 2026-10-20 : « les terminaux ont-ils le son ? »).
 *
 * Sur le Goodcom, Fairide tourne dans le navigateur GC Web et l'alarme des commandes est celle de la page
 * (useNewOrderAlert.js). Or un navigateur coupe tout son tant que personne n'a touché la page depuis son chargement :
 * après un rechargement, une coupure de courant ou une mise à jour du site, le terminal se taisait, et la petite pastille
 * « Activer le son » du bandeau passait inaperçue sur un comptoir. Aucune page ne peut lever cette règle elle-même ; ce
 * qu'on fait ici :
 *   - tant que le son est bloqué, un écran plein « Touche l'écran pour activer le son » : impossible à ignorer, et le
 *     toucher qui le ferme est justement celui qui débloque le son. La sonnerie joue une fois : on entend que ça marche,
 *     et à quel volume ;
 *   - l'écran reste allumé (Wake Lock) tant que le tableau de bord est ouvert : écran éteint, la page s'endort et ne
 *     sonne plus.
 *
 * Seulement sur un appareil associé comme terminal (terminalNavigateur.js) : l'ordinateur du restaurateur garde la
 * pastille discrète. On ne sonde pas le service d'impression Goodcom pour le deviner : une sonde vers localhost ferait
 * demander à Chrome l'accès au réseau local sur tous les appareils des commerces.
 *
 * Dans l'application Android, le son n'est jamais bloqué : Capacitor ouvre sa WebView avec
 * setMediaPlaybackRequiresUserGesture(false) (Bridge.java, initWebView). L'écran plein n'y apparaît donc pas. */
export default function SonTerminal({ alerte }) {
  const { t } = useLanguage();
  const [terminal, setTerminal] = useState(false);
  useEffect(() => abonnerTerminalNavigateur((e) => setTerminal(!!e.config)), []);

  // Le verrou tombe de lui-même quand la page passe en arrière-plan : on le redemande à son retour.
  useEffect(() => {
    if (!terminal || !navigator.wakeLock) return undefined;
    let verrou = null;
    let fini = false;
    const demander = () => {
      if (document.visibilityState !== 'visible') return;
      navigator.wakeLock.request('screen').then((v) => { if (fini) v.release().catch(() => {}); else verrou = v; }).catch(() => {});
    };
    demander();
    document.addEventListener('visibilitychange', demander);
    return () => { fini = true; document.removeEventListener('visibilitychange', demander); verrou?.release().catch(() => {}); };
  }, [terminal]);

  if (!terminal || !alerte.soundEnabled || !alerte.audioBloque) return null;
  return (
    <button type="button" className="son-terminal" onClick={() => alerte.testerAlarme()}>
      <span className="son-terminal-icone" aria-hidden="true"><Icone nom="cloche" taille={40} /></span>
      <b>{t('serviceCommerce.sonTerminalTitre')}</b>
      <span>{t('serviceCommerce.sonTerminalTexte')}</span>
    </button>
  );
}
