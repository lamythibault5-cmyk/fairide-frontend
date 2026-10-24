import { useEffect, useState } from 'react';
import { api } from '../../api';
import { useActionOptimiste } from '../../actionOptimiste';
import { vibrer } from '../../gestes';
import { prochain6h } from './majLocale';
import { useLanguage, getLocale } from '../../context/LanguageContext';
import { getOpenStatus } from '../../openingHours';
import SousEcran from '../SousEcran';
import Icone from '../Icone';

// Interrupteur de service du commerce (Commandes). Il ne savait que « ouvert / fermé » : un commerce débordé fermait et
// oubliait de rouvrir. Plan de test RES-9 (2 octobre 2026) : toucher l'interrupteur propose une PAUSE de 15, 30 ou
// 60 minutes, qui se lève toute seule (PUT /restaurants/:id/pause, voir pauseCommerce.js côté serveur), ou la
// fermeture jusqu'à réouverture manuelle comme avant. Les commandes en cours continuent dans tous les cas.
const DUREES = [15, 30, 60];

// `surBandeau` (2026-10-16, Commandes au bandeau iris) : même geste, dessiné pour le bandeau — un cadre clair et un
// interrupteur lime qui rebondit (ecran-commerce.css).
export default function InterrupteurService({ restaurant, restoId, token, loadDashboard, modifierRestaurant, surBandeau = false, compact = false }) {
  const { t } = useLanguage();
  const [choix, setChoix] = useState(false);
  const [maintenant, setMaintenant] = useState(() => Date.now());
  // L'heure de reprise passe toute seule : on relit l'horloge chaque minute pour rebasculer l'affichage.
  useEffect(() => { const id = setInterval(() => setMaintenant(Date.now()), 30000); return () => clearInterval(id); }, []);
  const enPause = restaurant.pausedUntil && restaurant.pausedUntil > maintenant;
  const ouvert = restaurant.open && !enPause;
  const reprise = enPause ? new Date(restaurant.pausedUntil).toLocaleTimeString(getLocale(), { hour: '2-digit', minute: '2-digit' }) : '';
  // Stoppé pour la journée (fondateur, 2026-10-10) : rouvre tout seul au prochain 6 h. Reconnu à sa durée (plus d'une heure :
  // les pauses font 15 à 60 minutes, 30 après une commande expirée) et non plus au changement de date : stoppé à 00:30, il
  // rouvre le jour même à 6 h (audit du 19/10, shop-302). Le jour est écrit en toutes lettres, « samedi », jamais « demain ».
  const stoppeJour = enPause && restaurant.pausedUntil - maintenant > 61 * 60000;
  const jourReprise = enPause ? new Date(restaurant.pausedUntil).toLocaleDateString(getLocale(), { weekday: 'long' }) : '';
  /* OUVERT… MAIS PAS SELON SES HORAIRES (audit du 19/10, shop-311). L'interrupteur disait « Ouvert aux commandes » à 3 h du
   * matin ou un jour de fermeture exceptionnelle, pendant que les clients lisaient « Fermé ». Le geste ne change pas : la
   * ligne dit seulement pourquoi rien n'arrive, et quand ça rouvre. */
  const selonHoraires = ouvert ? getOpenStatus(restaurant.hours, new Date(maintenant), restaurant.closures || []) : null;
  const horsHoraires = !!selonHoraires && !selonHoraires.isOpen;
  const sousOuvert = !horsHoraires ? t('ordersResto.openSub')
    : selonHoraires.isExceptionalClosure ? t('ordersResto.openButClosure')
      : selonHoraires.opensAt ? t('ordersResto.openButHours', { time: selonHoraires.opensAt.toLocaleTimeString(getLocale(), { hour: '2-digit', minute: '2-digit' }) })
        : t('ordersResto.openButHoursNone');

  /* L'INTERRUPTEUR BASCULE AU TOUCHER (2026-10-23, app lente : il affichait « … », grisé, le temps de l'appel PUIS du
   * rechargement complet de la fiche, des commandes et des livreurs). La fiche gardée par DashboardLayout reçoit tout de suite
   * l'état visé (ouvert, pause jusqu'à telle heure, stoppé jusqu'au prochain 6 h), la feuille des pauses se ferme, l'appel
   * suit ; sa réponse donne l'heure exacte de reprise, un refus remet l'état d'avant avec le message d'erreur
   * (actionOptimiste.js). La relecture (fiche comprise, sans les livreurs) part en arrière-plan une fois les gestes finis.
   *
   * DEUX CLÉS, UNE PAR CHAMP DU SERVEUR (revue du 24/10). Une seule clé « service » couvrait la pause (paused_until) et
   * l'ouverture (open) : comme actionOptimiste.js n'envoie que le DERNIER geste en file d'une clé, une pause (ou sa levée)
   * suivie vite d'un « Fermer jusqu'à réouverture » n'était jamais envoyée, alors que l'écran l'avait montrée ; et un refus
   * remettait les deux champs, défaisant au passage l'autre geste réussi. Pause et « stopper pour aujourd'hui » écrivent le
   * même champ, valeur entière à chaque fois : même clé, le dernier gagne. Chaque clé ne garde et ne remet que son champ. */
  const agirOptimiste = useActionOptimiste();
  function agir(champ, valeur, appel) {
    setChoix(false);
    agirOptimiste(`service:${champ}`, {
      appliquer: () => {
        const avant = champ === 'open' ? restaurant.open : (restaurant.pausedUntil ?? null);
        modifierRestaurant?.((r) => (r ? { ...r, [champ]: valeur } : r));
        return avant;
      },
      envoyer: appel,
      annuler: (avant) => modifierRestaurant?.((r) => (r ? { ...r, [champ]: avant } : r)),
      // Pause et « stopper pour aujourd'hui » rendent l'heure de reprise calculée par le serveur.
      confirmer: (rep) => {
        if (champ === 'pausedUntil' && rep && rep.pausedUntil !== undefined) modifierRestaurant?.((r) => (r ? { ...r, pausedUntil: rep.pausedUntil } : r));
      },
      rafraichir: () => loadDashboard(restoId, { annexes: false, silencieux: true })
    });
  }
  const pause = (minutes) => agir('pausedUntil', minutes ? Date.now() + minutes * 60000 : null,
    () => api(`/restaurants/${restoId}/pause`, { method: 'PUT', token, body: { minutes } }));
  const stopperJour = (closed) => agir('pausedUntil', closed ? prochain6h() : null,
    () => api(`/restaurants/${restoId}/close-today`, { method: 'PUT', token, body: { closed } }));
  const ouvrir = (open) => agir('open', open, () => api(`/restaurants/${restoId}`, { method: 'PATCH', token, body: { open } }));

  function toucher() {
    vibrer('bascule');
    if (ouvert) setChoix(true);
    else if (stoppeJour) stopperJour(false);
    else if (enPause) pause(0);
    else ouvrir(true);
  }

  const texte = (
    <>
      <b>{ouvert ? t('ordersResto.openTitle') : stoppeJour ? t('ordersResto.stoppedTodayTitle') : enPause ? t('ordersResto.pauseUntil', { time: reprise }) : t('ordersResto.pausedTitle')}</b>
      <span>{ouvert ? sousOuvert : stoppeJour ? t('ordersResto.stoppedTodaySub', { day: jourReprise, time: reprise }) : enPause ? t('ordersResto.pauseResumeNow') : t('ordersResto.pausedSub')}</span>
    </>
  );
  return (
    <>
      {/* `compact` (audit design 2, 2026-10-19, écran Commandes de l'app) : l'interrupteur seul dans la ligne du haut du
          bandeau, avec un mot d'état (Ouvert, En pause jusqu'à 20:15…) — la grande carte prenait la place de la commande.
          Même geste, même feuille de pause. */}
      {compact ? (
        <button type="button" className="ec-service-compact" aria-pressed={!!ouvert} onClick={toucher}
          title={ouvert ? t('ordersResto.openSub') : undefined} aria-label={ouvert ? t('ordersResto.openTitle') : undefined}>
          {/* Ouvert : l'interrupteur allumé suffit (la place va au résumé du service) ; sinon on dit pourquoi on ne reçoit rien. */}
          <span>{ouvert ? (horsHoraires ? t('ordersResto.openButHoursShort') : '') : stoppeJour ? t('ordersResto.stoppedTodayTitle') : enPause ? t('ordersResto.pauseUntil', { time: reprise }) : t('ordersResto.pausedTitle')}</span>
          <span className={`ec-interrupteur ec-interrupteur--lime${ouvert ? ' on' : ''}`} aria-hidden="true" />
        </button>
      ) : surBandeau ? (
        <button type="button" className={`ec-service${ouvert ? ' on' : ''}`} aria-pressed={!!ouvert} onClick={toucher}>
          <span className="ec-service-texte">{texte}</span>
          <span className={`ec-interrupteur ec-interrupteur--lime${ouvert ? ' on' : ''}`} aria-hidden="true" />
        </button>
      ) : (
        <button type="button" className={`service-switch${ouvert ? '' : ' off'}`} aria-pressed={!!ouvert} onClick={toucher}>
          <span className="service-switch-dot" aria-hidden="true" />
          <span className="service-switch-text">{texte}</span>
        </button>
      )}
      {choix && (
        <SousEcran titre={t('ordersResto.pauseTitle')} onFermer={() => setChoix(false)}>
          <p className="small" style={{ margin: '0 0 12px' }}>{t('ordersResto.pauseHelp')}</p>
          <div className="row" style={{ gap: 8, flexWrap: 'wrap', marginBottom: 16 }}>
            {DUREES.map((m) => (
              <button key={m} type="button" className="btn-teal" style={{ minHeight: 48, flex: '1 1 30%' }} onClick={() => pause(m)}>{t('ordersResto.pauseMinutes', { n: m })}</button>
            ))}
          </div>
          {/* Plus rien à préparer aujourd'hui : stoppé jusqu'au lendemain 6 h, rouvre tout seul (fondateur, 2026-10-10). */}
          <div className="paiement-encart" style={{ marginBottom: 12 }}>
            {/* Arrêter pour la journée n'est pas l'action mise en avant de cet écran : contour, comme « Fermer jusqu'à réouverture ». */}
            <button type="button" className="btn-outline" style={{ width: '100%', minHeight: 48 }} onClick={() => stopperJour(true)}><Icone nom="interdit" taille={16} className="icone-texte" />{' '}{t('ordersResto.stopTodayBtn')}</button>
            <p className="small" style={{ margin: '8px 0 0' }}>{t('ordersResto.stopTodayHelp')}</p>
          </div>
          <button type="button" className="btn-outline" style={{ width: '100%', minHeight: 48 }} onClick={() => ouvrir(false)}>{t('ordersResto.closeUntilReopen')}</button>
        </SousEcran>
      )}
    </>
  );
}
