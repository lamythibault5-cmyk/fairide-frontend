import { experienceApp } from '../natif';
import { remplissage } from '../curseur';
// Barre d'état de l'alerte "nouvelle commande", affichée en haut du tableau de bord restaurateur.
//
// Deux rôles distincts :
//   - dire ce qui attend (le compteur), visible d'un coup d'œil depuis le comptoir ;
//   - rendre l'alerte contrôlable et surtout HONNÊTE sur ce qu'elle garantit.
//
// CETTE HONNÊTETÉ A CHANGÉ DE CONTENU, PAS DE PRINCIPE. Tant que le Web Push n'existait pas, cette
// barre devait avertir que le son et les notifications système supposent l'onglet ouvert — sans quoi
// un restaurateur se croyait couvert écran éteint. Le push existe maintenant, mais il ne couvre pas
// tout le monde : sur iPhone et iPad il n'arrive que si le site a été ajouté à l'écran d'accueil, et
// dans Safari ordinaire il n'existe pas du tout. La phrase affichée suit donc l'état réel de CE
// navigateur — abonné, abonnable, ou hors de portée — plutôt que de promettre partout la même chose.
import { useState } from 'react';
import { Link } from 'react-router-dom';
import { useLanguage } from '../context/LanguageContext';
import { useToast } from '../context/ToastContext';

import { SONNERIES, REPETITIONS } from '../hooks/useNewOrderAlert';
import Icone from './Icone';

// Sur le site (2026-10-16, maquettes/site-ordinateur/site-ordinateur.html) : un seul lime par vue, celui de la page (Signer, Accepter…) ; les
// boutons pressants de la barre passent en iris. Dans l'app, ils restent lime, comme avant.
const PRESSANT = experienceApp() ? 'btn-gold' : 'btn-teal';

export default function NewOrderAlertBar({ audioBloque, debloquerAudio, newCount, soundEnabled, setSoundEnabled, permission, requestPermission, push, sonnerie, setSonnerie, testerAlarme, volume, setVolume, repetitions, setRepetitions, alarmeEnCours, couperAlarme, compact = false, onOuvrir = null, sansCommande = false }) {
  const { t } = useLanguage();
  const toast = useToast();
  const active = newCount > 0;
  // Hooks avant tout retour anticipé (règle de React) : la version compacte n'en a pas besoin, mais la complète si.
  const [reglagesOuverts, setReglagesOuverts] = useState(false);

  /* VERSION COMPACTE, sur les pages du commerce autres que l'accueil et les commandes (fondateur, 2026-10-17 : la barre
     complète, avec son grand bouton lime, se répétait au-dessus du titre de chaque page). Le son se débloque de toute façon
     au premier geste, n'importe où (useNewOrderAlert.js, unlock) : ici on garde seulement ce qui doit suivre partout —
     les commandes qui attendent, avec un lien vers elles et de quoi couper l'alarme — et, tant que le navigateur bloque
     encore le son sans qu'on ait rien touché, un petit bouton pour l'activer. Le reste (réglages, notifications) vit sur
     l'accueil et la page Commandes. Rien à dire : rien d'affiché. */
  if (compact) {
    // Sur téléphone, la commande qui attend a sa bande au-dessus des onglets (BandeATraiter.jsx) : ici, seulement le son.
    if (active && !sansCommande) {
      return (
        <div className="alerte-compacte est-active" role="status">
          <strong>{newCount === 1 ? t('alertBar.toHandleOne') : t('alertBar.toHandle', { n: newCount })}</strong>
          {alarmeEnCours && <button type="button" className="btn-ghost btn-sm" onClick={couperAlarme}><Icone nom="sonCoupe" taille={16} className="icone-texte" />{' '}{t('alertBar.stopAlarm')}</button>}
          <Link to="/dashboard/orders" className="alerte-compacte-lien">{t('alertBar.voir')} <span aria-hidden="true">→</span></Link>
        </div>
      );
    }
    // Plus de « Activer le son des commandes » en tête de chaque page (fondateur, 2026-10-27, S3 de maquettes/audit-ecrans) :
    // il passait avant le contenu de Ma carte, Promotions, Statistiques, Factures… Le son reste à activer sur l'accueil et sur
    // Commandes (sa ligne du bandeau), et il se débloque de toute façon au premier toucher.
    return null;
  }
  // Les réglages (sonnerie, répétitions, volume, test) sont repliés : dépliés, ils prenaient tout l'écran d'un téléphone
  // et poussaient la commande à traiter sous la ligne de flottaison (simulation du 2026-10-01). État déclaré plus haut.

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

  /* SUR TÉLÉPHONE, L'ACCUEIL NE GARDE QUE CE QUI MANQUE (fondateur, 2026-10-27, réponse 1 A de maquettes/ecrans-pro/ecrans-pro.html).
     La commande qui attend a sa bande lime au-dessus des onglets (BandeATraiter.jsx) ; le compteur, la phrase d'aide et les
     réglages vivent sur la ligne d'alarme de Commandes (LigneAlarme). Restent ici, en une carte et seulement tant qu'ils
     manquent, le son bloqué et les notifications, en contour : le lime de l'écran est à la bande. Rien ne manque : rien. */
  if (sansCommande) {
    const pushPossible = push?.supporte && push?.disponible;
    const sonBloque = soundEnabled && audioBloque;
    const pushAActiver = pushPossible && !push.abonne;
    const notifAActiver = permission === 'default' && !pushPossible;
    if (!sonBloque && !pushAActiver && !notifAActiver && permission !== 'denied') return null;
    return (
      <div className="card alerte-manque">
        <b>{t('ecransPro.rienRater')}</b>
        <div className="row alerte-actions" style={{ gap: 8 }}>
          {sonBloque && (
            <button type="button" className="btn-outline btn-sm" onClick={debloquerAudio}>
              <Icone nom="sonCoupe" taille={16} className="icone-texte" />{' '}{t('alertBar.activerSon')}
            </button>
          )}
          {pushAActiver && (
            <button type="button" className="btn-outline btn-sm" disabled={push.occupe} onClick={basculerPush}>{t('alertBar.pushOff')}</button>
          )}
          {notifAActiver && (
            <button type="button" className="btn-outline btn-sm" onClick={requestPermission}>{t('alertBar.enableNotifications')}</button>
          )}
          {permission === 'denied' && <span className="small texte-erreur">{t('alertBar.blocked')}</span>}
        </div>
      </div>
    );
  }

  // Ce que la barre peut promettre, dans l'ordre décroissant de garantie.
  const aide = push?.abonne
    ? t('alertBar.pushOnHelp')
    : permission === 'granted'
      ? t('alertBar.soundOnHelp')
      // Dans l'app il n'y a pas d'onglet : « garde cet onglet ouvert » ne voulait rien dire (audit du 15/10/2026).
      : experienceApp() ? t('appli.alerteGarderOuverte') : t('alertBar.keepTabOpen');

  return (
    <div
      className={`card alerte-commandes ${active ? 'est-active' : 'est-calme'}`}
      style={{
        display: 'flex', alignItems: 'center', gap: 12, flexWrap: 'wrap',
        borderLeft: `4px solid ${active ? 'var(--red)' : 'var(--line)'}`,
        marginBottom: 14
      }}
    >
      {/* « 1 commande à traiter » se touche (audit design 2, 2026-10-19) : il ouvre la feuille de la commande qui attend, où elle
          s'accepte d'un geste (NouvelleCommandeModale) — plus besoin d'aller la chercher dans Commandes. */}
      {active && onOuvrir ? (
        <button type="button" className="alerte-ouvrir" onClick={onOuvrir}>
          <span>{newCount === 1 ? t('alertBar.toHandleOne') : t('alertBar.toHandle', { n: newCount })}</span>
          <span className="alerte-ouvrir-voir">{t('serviceCommerce.ouvrirCommande')}</span>
        </button>
      ) : (
        <strong style={{ fontSize: 15 }}>
          {active
            ? (newCount === 1 ? t('alertBar.toHandleOne') : t('alertBar.toHandle', { n: newCount }))
            : t('alertBar.nonePending')}
        </strong>
      )}

      <span className="small alerte-aide" style={{ flex: 1, minWidth: 220 }}>{aide}</span>

      {/* Son voulu mais encore bloqué par le navigateur (page rechargée, aucun geste depuis) : l'alarme ne sonnerait pas.
          Un toucher n'importe où suffit à la débloquer ; ce bouton donne une raison de le faire (audit du 15/10/2026). */}
      {soundEnabled && audioBloque && (
        <button type="button" className={`${PRESSANT} alerte-son-bloque`} onClick={debloquerAudio}>
          <Icone nom="sonCoupe" taille={18} className="icone-texte" />{' '}{t('alertBar.tapToEnableSound')}
        </button>
      )}

      <div className="row alerte-actions" style={{ gap: 8 }}>
        <button
          type="button"
          className="btn-outline btn-sm"
         
          aria-pressed={soundEnabled}
          // Bloqué par le navigateur, ce bouton débloque au lieu de couper (même piège que dans AlerteBandeau.jsx, 2026-10-20).
          onClick={() => (soundEnabled && audioBloque ? debloquerAudio() : setSoundEnabled(!soundEnabled))}
        >
          {soundEnabled && !audioBloque ? t('alertBar.soundOn') : soundEnabled ? t('alertBar.soundBlocked') : t('alertBar.soundOff')}
        </button>

        {/* Sonnerie au choix (3) et test de l'alarme (fondateur, 2026-10-01) : on entend tout de suite ce qui sonnera
            à la prochaine commande. Choisir une sonnerie la fait aussi entendre. */}
        {setSonnerie && (
          <button type="button" className="btn-ghost btn-sm" aria-expanded={reglagesOuverts} onClick={() => setReglagesOuverts((v) => !v)}>
            <Icone nom="reglages" taille={16} className="icone-texte" />{' '}{t('alertBar.settings')}
          </button>
        )}
        {/* Jamais lime (audit design 2, 2026-10-19) : le lime de l'écran est à « Accepter ». */}
        {alarmeEnCours && couperAlarme && (
          <button type="button" className="btn-outline btn-sm" onClick={couperAlarme}><Icone nom="sonCoupe" taille={16} className="icone-texte" />{' '}{t('alertBar.stopAlarm')}</button>
        )}
        {/* LES RÉGLAGES EN GRILLE (fondateur, 2026-10-17, capture d'iPhone : « ça n'a pas l'air propre »). Ils s'enroulaient au
            fil de la barre — deux menus de largeurs différentes, le curseur coincé à côté d'un bouton. Ici : la sonnerie et le
            nombre de sonneries côte à côte, à largeur égale ; puis le volume sur toute la largeur restante et « Tester l'alarme ».
            Pensé pour le terminal du commerce (grand téléphone) comme pour l'ordinateur. */}
        {reglagesOuverts && (setSonnerie || setVolume || testerAlarme) && (
          <div className="alerte-reglages">
            {setSonnerie && (
              <select className="alerte-choix" aria-label={t('alertBar.ringtone')} value={sonnerie}
                onChange={(e) => { setSonnerie(e.target.value); testerAlarme?.(e.target.value); }}>
                {SONNERIES.map((s) => <option key={s} value={s}>{t(`alertBar.ringtone_${s}`)}</option>)}
              </select>
            )}
            {/* Combien de fois l'alarme sonne par commande (fondateur, 2026-10-01). */}
            {setRepetitions && (
              <select className="alerte-choix" aria-label={t('alertBar.repeats')} value={repetitions} onChange={(e) => setRepetitions(e.target.value)}>
                {REPETITIONS.map((n) => <option key={n} value={n}>{n === 0 ? t('alertBar.repeatsForever') : t('alertBar.repeatsN', { n })}</option>)}
              </select>
            )}
            {setVolume && (
              <label className="alerte-volume" title={t('alertBar.volume')}>
                <span aria-hidden="true">{volume === 0 ? <Icone nom="sonCoupe" taille={18} className="icone-texte" /> : <Icone nom="son" taille={18} className="icone-texte" />}</span>
                <input type="range" min="0" max="100" step="5" value={volume} style={remplissage(volume, 0, 100)} aria-label={t('alertBar.volume')} onChange={(e) => setVolume(e.target.value)} onPointerUp={() => testerAlarme?.()} onKeyUp={(e) => { if (['ArrowLeft', 'ArrowRight', 'ArrowUp', 'ArrowDown'].includes(e.key)) testerAlarme?.(); }} />
              </label>
            )}
            {testerAlarme && (
              <button type="button" className="btn-outline btn-sm alerte-tester"
                onClick={async () => { if (!(await testerAlarme())) toast(t('alertBar.testFailed'), 'erreur'); }}>
                <Icone nom="cloche" taille={16} className="icone-texte" />{' '}{t('alertBar.testAlarm')}
              </button>
            )}
          </div>
        )}

        {/* Le bouton du push ne s'affiche que là où il peut tenir sa promesse : navigateur capable
            ET clés VAPID configurées côté serveur. Ailleurs, rien — plutôt qu'un bouton qui échoue.
            C'est aussi la seule action de cette barre qui vaut du lime : elle couvre l'onglet
            fermé, ce qu'aucune des autres ne fait. */}
        {push?.supporte && push?.disponible && (
          <button
            type="button"
            className={push.abonne ? 'btn-outline' : PRESSANT}
            style={{ padding: '6px 12px', fontSize: 13 }}
            aria-pressed={push.abonne}
            disabled={push.occupe}
            onClick={basculerPush}
          >
            {push.abonne ? t('alertBar.pushOn') : t('alertBar.pushOff')}
          </button>
        )}

        {/* L'API Notification exige que la demande parte d'un geste de l'utilisateur : d'où un bouton
            explicite plutôt qu'une demande au chargement, que les navigateurs rejettent de toute
            façon et que les utilisateurs refusent par réflexe.
            Il ne s'affiche QUE là où le push n'est pas proposé. Les deux demandent exactement la
            même permission au navigateur : côte à côte, ils donnaient deux boutons presque
            identiques, dont l'un couvrait moins que l'autre sans que rien ne le dise. */}
        {permission === 'default' && !(push?.supporte && push?.disponible) && (
          <button type="button" className="btn-outline btn-sm" onClick={requestPermission}>
            {t('alertBar.enableNotifications')}
          </button>
        )}
        {permission === 'denied' && (
          <span className="small texte-erreur">
            {t('alertBar.blocked')}
          </span>
        )}
      </div>
    </div>
  );
}
