import { useEffect, useState } from 'react';
import { useLanguage, getLocale } from './context/LanguageContext';
import Icone from './components/Icone';

// `icon` porte maintenant un NOM DE TRACÉ (voir components/Icone.jsx) et non plus un emoji : les
// consignes s'affichent côte à côte dans une rangée de pastilles au paiement, et quatre emoji
// rendus par la police du système n'y avaient ni la même épaisseur ni la même taille optique.
// Les libellés ont perdu leur emoji de tête pour la même raison — ils sont traduits, donc c'est
// dans les trois tables de translations.js que le caractère a été retiré.
export const DELIVERY_INSTRUCTION_OPTIONS = [
  { value: 'sonner', label: 'Sonner et attendre', icon: 'sonnette' },
  { value: 'deposer', label: 'Déposer devant la porte', icon: 'porte' },
  { value: 'concierge', label: 'Laisser au/à la concierge', icon: 'immeuble' },
  { value: 'appeler', label: "M'appeler à l'arrivée", icon: 'telephone' }
];

export function deliveryInstructionLabel(value, t) {
  if (t) return t(`orderStatus.deliveryInstruction.${value}`);
  return DELIVERY_INSTRUCTION_OPTIONS.find((o) => o.value === value)?.label || value;
}

// "2× Cheeseburger (Extra cheddar, Bacon)"
export function formatOrderItem(i) {
  const options = i.options?.length ? ` (${i.options.map((o) => o.name).join(', ')})` : '';
  // Instruction du client sur ce plat (MNU-5) : « sans oignon », lue par le commerce comme sur le ticket.
  const note = i.note ? ` « ${i.note} »` : '';
  return `${i.qty}× ${i.name}${options}${note}`;
}

export const STEPS = ['nouveau', 'preparation', 'pret', 'livraison', 'livre'];
// Une commande à emporter n'a pas de trajet "en route" — le client vient lui-même.
const PICKUP_STEPS = ['nouveau', 'preparation', 'pret', 'livre'];

const STATUS_LABELS_FR = {
  nouveau: 'Nouvelle', preparation: 'En préparation', pret: 'Prête', livraison: 'En livraison',
  livre: 'Livrée', refuse: 'Refusée', annule: 'Annulée'
};

// `pourClient` : le client et le commerce ne lisent pas le même mot pour le même statut. « Nouvelle » dit
// au restaurateur « à traiter » ; au client, ça ne dit pas que le commerce n'a pas encore confirmé. De même,
// « Prête » pour une livraison laisse croire que ça arrive, alors qu'on attend encore un livreur.
export function statusLabel(status, orderType, t, pourClient = false) {
  if (pourClient && t) {
    if (status === 'nouveau') return t('orderStatus.status.nouveauClient');
    if (status === 'pret' && orderType === 'delivery') return t('orderStatus.status.pretDelivery');
  }
  if (status === 'livre' && orderType === 'pickup') return t ? t('orderStatus.status.livrePickup') : 'Récupérée';
  if (t) return t(`orderStatus.status.${status}`);
  return STATUS_LABELS_FR[status] || status;
}

// Étape opérationnelle d'une commande, du point de vue du restaurateur — distincte du statut brut
// (qui a plus de valeurs) et du type de commande (livraison/emporter) : ce qui compte ici
// c'est "qu'est-ce que je dois faire, là, maintenant ?". Deux étapes distinctes impliquent un livreur
// pas encore là, à ne pas confondre : "attenteConfirmationLivreur" (avant même de cuisiner — aucun
// livreur n'a encore pris la commande, voir GET /orders/available qui l'expose dès le statut
// "preparation") et "attenteLivreur" (le plat est prêt, on attend que ce livreur arrive physiquement
// le récupérer). La première est isolée et placée avant "En préparation" car l'idée est de s'assurer
// qu'un livreur sera bien disponible avant de lancer la cuisson ; la seconde reste isolée de
// "enLivraison" (déjà pris en charge, donc déjà réglé) pour la même raison qu'avant.
export const ORDER_STAGES = [
  { key: 'nouveau', label: 'Nouvelle · à traiter', icon: 'cloche', defaultColor: '#D92D3C' },
  { key: 'attenteConfirmationLivreur', label: 'En attente de la confirmation d\'un livreur', icon: 'megaphone', defaultColor: '#B0459B' },
  { key: 'preparation', label: 'En préparation', icon: 'restaurants', defaultColor: '#C8F03C' },
  { key: 'attenteLivreur', label: 'Prête, en attente de l\'arrivée du livreur', icon: 'horloge', defaultColor: '#E07A1F' },
  { key: 'pretClient', label: 'Prête, en attente du client', icon: 'horloge', defaultColor: '#E07A1F' },
  { key: 'enLivraison', label: 'Livreur en route', icon: 'velo', defaultColor: '#2B7FB8' },
  { key: 'terminee', label: 'Terminée', icon: 'valider', defaultColor: '#14121F' },
  { key: 'annulee', label: 'Refusée / annulée', icon: 'interdit', defaultColor: '#8A8A8A' }
];

export function orderStageKey(order) {
  if (order.status === 'refuse' || order.status === 'annule') return 'annulee';
  if (order.status === 'livre') return 'terminee';
  if (order.status === 'livraison') return 'enLivraison';
  if (order.status === 'pret') {
    if (order.orderType === 'delivery') return order.driverId ? 'enLivraison' : 'attenteLivreur';
    return 'pretClient';
  }
  if (order.status === 'preparation') {
    if (order.orderType === 'delivery' && !order.driverId) return 'attenteConfirmationLivreur';
    return 'preparation';
  }
  return 'nouveau';
}

// Priorité d'affichage : ce qui demande une action ou une surveillance du restaurateur en premier,
// ce qui est déjà réglé (terminé/annulé) en dernier — pour qu'il n'ait jamais à chercher dans la liste
// ce qui compte maintenant, réduisant le risque d'en oublier une.
const STAGE_PRIORITY = ['nouveau', 'attenteConfirmationLivreur', 'attenteLivreur', 'preparation', 'pretClient', 'enLivraison', 'terminee', 'annulee'];
export function orderStagePriority(order) {
  const idx = STAGE_PRIORITY.indexOf(orderStageKey(order));
  return idx === -1 ? STAGE_PRIORITY.length : idx;
}

// Couleur de chaque étape de commande, fixe. Le panneau « Couleurs des commandes » qui permettait de les changer a
// été retiré (allègement, 23/09/2026 : personne ne s'en servait). On efface au passage les réglages qu'il avait
// laissés dans le navigateur, pour que tous les restaurateurs voient les mêmes couleurs que le support.
const DEFAULT_STAGE_COLORS = Object.fromEntries(ORDER_STAGES.map((s) => [s.key, s.defaultColor]));
export function stageColors(restoId) {
  try { localStorage.removeItem(`fairide_order_stage_colors_${restoId}`); } catch { /* sans stockage */ }
  return DEFAULT_STAGE_COLORS;
}

// Couleur associée au type de commande, pour que le restaurant repère chaque commande d'un coup d'œil :
// jaune = livraison classique, bleu = à emporter, orange = heure programmée (prioritaire sur le type).
export function orderTypeColor(order) {
  if (order.scheduledFor) return 'orange';
  if (order.orderType === 'pickup') return 'blue';
  return 'yellow';
}

export function orderTypeLabel(order, t) {
  const base = t
    ? (order.orderType === 'pickup' ? t('orderStatus.orderType.pickup') : t('orderStatus.orderType.delivery'))
    : (order.orderType === 'pickup' ? 'À emporter' : 'Livraison');
  if (order.scheduledFor) return `${base} · ${formatDateTime(order.scheduledFor)}`;
  return base;
}

function formatTime(ms) {
  return new Date(ms).toLocaleTimeString(getLocale(), { hour: '2-digit', minute: '2-digit' });
}

// Heure limite d'acceptation d'une commande (côté commerce) : sans réponse avant, elle est annulée et le client
// remboursé automatiquement (voir backend acceptation.js). Le compte à rebours se met à jour toutes les 20 s et
// passe en rouge sous 5 minutes.
export function EcheanceAcceptation({ order }) {
  const { t } = useLanguage();
  const [maintenant, setMaintenant] = useState(Date.now());
  useEffect(() => {
    if (!order.acceptDeadline) return undefined;
    const id = setInterval(() => setMaintenant(Date.now()), 20000);
    return () => clearInterval(id);
  }, [order.acceptDeadline]);
  if (!order.acceptDeadline || order.status !== 'nouveau') return null;
  // Échéance d'une commande programmée : un autre jour, avec sa date (audit du 19/10, shop-221 : « avant 11:30 (encore 2850 min) »).
  const minutes = Math.max(0, Math.ceil((order.acceptDeadline - maintenant) / 60000));
  const urgent = minutes <= 5;
  return (
    <div className={`small echeance-acceptation${urgent ? ' urgente' : ''}`} role={urgent ? 'alert' : undefined}>
      <Icone nom="horloge" taille={16} className="icone-texte" />{' '}{minutes > 0
        ? t(minutes > 60 ? 'orderStatus.acceptBeforeLater' : 'orderStatus.acceptBefore', { time: formatDateTime(order.acceptDeadline), min: minutes })
        : t('orderStatus.acceptNow')}
    </div>
  );
}

function formatDateTime(ms) {
  const isToday = new Date(ms).toDateString() === new Date().toDateString();
  return isToday
    ? formatTime(ms)
    : new Date(ms).toLocaleString(getLocale(), { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' });
}

export function DeliveryTiming({ order }) {
  const { t } = useLanguage();
  const { createdAt, estimatedDeliveryAt, status, orderType, scheduledFor } = order;
  if (status === 'refuse' || status === 'annule') return null;

  const isPickup = orderType === 'pickup';
  const doneStatus = 'livre';
  const doneLabel = isPickup ? t('orderStatus.status.livrePickup') : t('orderStatus.status.livre');
  const orderedAt = t('orderStatus.timing.orderedAt', { time: formatTime(createdAt) });

  if (status === doneStatus) {
    return <div className="small">{orderedAt} · {doneLabel}</div>;
  }

  if (!estimatedDeliveryAt) {
    return <div className="small">{orderedAt}</div>;
  }

  if (scheduledFor) {
    const label = t('orderStatus.timing.scheduledFor');
    return (
      <div className="small">
        {orderedAt} · {label} <b>{formatDateTime(scheduledFor)}</b>
      </div>
    );
  }

  const readyLabel = isPickup ? t('orderStatus.timing.pickupEstimate') : t('orderStatus.timing.deliveryEstimate');
  const minutesLeft = Math.max(0, Math.round((estimatedDeliveryAt - Date.now()) / 60000));
  return (
    <div className="small">
      {orderedAt} · {readyLabel} <b>{formatTime(estimatedDeliveryAt)}</b>
      {minutesLeft > 0 ? t('orderStatus.timing.minutesLeft', { min: minutesLeft }) : t('orderStatus.timing.imminent')}
    </div>
  );
}

/* SUIVI EN BANDEAU IRIS (fondateur, 2026-10-16, version 1C de mockups/autres-idees.html). Une commande en cours s'ouvre
   sur un bandeau iris : le statut en grand (titreSuivi), l'heure, et une route où le vélo de la marque, en lime, roule
   d'arrêt en arrêt — chaque étape passée garde une coche lime, la route défile sous les roues pendant la livraison. Le
   déplacement est une transition CSS sur `left` : quand le statut change (rafraîchissement de Mes commandes), le vélo
   roule de lui-même de l'ancien arrêt au nouveau. Les étapes restent écrites en clair dessous. */
export function titreSuivi(order, t) {
  const { status, orderType } = order;
  // Paiement en ligne pas terminé : le commerce ne voit pas encore la commande (même règle que ProchaineEtape).
  if (status === 'nouveau' && order.paid === false && order.paymentMode !== 'on_site') return statusLabel(status, orderType, t, true);
  // À payer sur place mais jamais partie au commerce : « le commerce regarde ta commande » serait faux.
  if (status === 'nouveau' && order.paid === false) return t('orders.notSentTitle');
  if (status === 'pret') return t(orderType === 'delivery' ? 'orderStatus.grand.pretDelivery' : 'orderStatus.grand.pretPickup');
  if (['nouveau', 'preparation', 'livraison'].includes(status)) return t(`orderStatus.grand.${status}`);
  return statusLabel(status, orderType, t, true);
}

export function RouteSuivi({ status, orderType }) {
  const { t } = useLanguage();
  const [roule, setRoule] = useState(false);
  const livraison = orderType === 'delivery';
  const steps = livraison ? STEPS : PICKUP_STEPS;
  const idx = steps.indexOf(status);
  useEffect(() => {
    setRoule(true);
    const f = setTimeout(() => setRoule(false), 900);
    return () => clearTimeout(f);
  }, [idx]);
  if (idx < 0) return null;
  const dernier = livraison ? t('orderStatus.progress.delivered') : t('orderStatus.progress.pickedUp');
  const labels = livraison
    ? [t('orderStatus.progress.sent'), t('orderStatus.progress.preparation'), t('orderStatus.progress.ready'), t('orderStatus.progress.onTheWay'), dernier]
    : [t('orderStatus.progress.sent'), t('orderStatus.progress.preparation'), t('orderStatus.progress.ready'), dernier];
  const pas = 100 / steps.length;
  return (
    <>
      <div className={`route-suivi${status === 'livraison' ? ' en-route' : ''}`} aria-hidden="true">
        <span className="rs-voie" style={{ left: `${pas / 2}%`, right: `${pas / 2}%` }} />
        <i className="rs-fait" style={{ left: `${pas / 2}%`, width: `${idx * pas}%` }} />
        {steps.map((s, k) => (
          <span key={s} className={`rs-arret${k < idx ? ' fait' : k === idx ? ' actuel' : ''}`} style={{ left: `${(k + 0.5) * pas}%` }}>
            {k < idx && <svg viewBox="0 0 24 24" width="12" height="12" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round"><path d="m5 12.5 4.5 4.5L19 7.5" /></svg>}
          </span>
        ))}
        <span className={`rs-velo${roule ? ' roule' : ''}`} style={{ left: `${(idx + 0.5) * pas}%` }}>
          <svg viewBox="-3 5 82 42" width="42" height="22">
            <g fill="none" stroke="currentColor" strokeWidth="5" strokeLinecap="round"><circle cx="15" cy="29" r="12.5" /><circle cx="61" cy="29" r="12.5" /></g>
            <g fill="currentColor"><rect x="16" y="8" width="44" height="5" rx="2.5" /><g transform="rotate(42 27 22.5)"><rect x="13" y="20" width="28" height="5" rx="2.5" /></g></g>
          </svg>
        </span>
      </div>
      <ol className="rs-libs" style={{ gridTemplateColumns: `repeat(${steps.length}, 1fr)` }}>
        {labels.map((l, k) => <li key={l} className={k < idx ? 'fait' : k === idx ? 'actuel' : ''} aria-current={k === idx ? 'step' : undefined}>{l}</li>)}
      </ol>
    </>
  );
}

// « Et maintenant ? » — une phrase sous le statut, qui dit ce qui se passe et ce que le client a à faire.
// Les badges seuls laissaient deviner : entre « Prête » et l'arrivée du livreur, plus rien n'expliquait
// l'attente.
export function ProchaineEtape({ order }) {
  const { t } = useLanguage();
  const { status, orderType } = order;
  const livraison = orderType === 'delivery';
  let cle = null;
  // Paiement en ligne pas terminé : le commerce ne voit pas encore la commande, « il doit la confirmer » serait faux. Mes
  // commandes affiche à la place « Paiement non terminé » et ses deux choix (Orders.jsx, impayeeEnLigne).
  // Pas encore payée en ligne, ou jamais envoyée au commerce (sur place) : la carte de la commande propose ses deux choix.
  if (status === 'nouveau' && order.paid === false) return null;
  if (status === 'nouveau' && order.acceptDeadline) {
    // Payée sur place : rien n'a été débité, il n'y a rien à rembourser (audit du 18/10/2026).
    return <div className="small order-next">{t(order.paymentMode === 'on_site' ? 'orderStatus.next_nouveau_deadline_on_site' : 'orderStatus.next_nouveau_deadline', { time: formatDateTime(order.acceptDeadline) })}</div>;
  }
  // Remboursement automatique refusé par Stripe (audit du 19/10/2026, AO-02, backend refundPending) : on ne dit pas
  // « remboursée » tant que l'équipe ne l'a pas refait.
  if (['annule', 'refuse'].includes(status) && order.refundPending) {
    return <div className="small order-next">{t('orderStatus.next_refund_pending')}</div>;
  }
  // Jamais envoyée ni payée, puis close par le ménage des commandes impayées (45 min) : le commerce n'y est pour rien.
  if (status === 'annule' && order.expiredUnaccepted && order.paid === false) {
    return <div className="small order-next">{t('orderStatus.next_never_sent')}</div>;
  }
  // Close après une attente sans client (livraison « client absent », à emporter non récupérée, audit du 19/10, shop-206) :
  // la ligne de l'incident dit déjà que la commande reste due (Orders.jsx) ; « un paiement éventuel est remboursé » serait faux.
  if (status === 'annule' && ['client_absent', 'pickup_not_collected'].includes(order.deliveryIncident)) return null;
  if (status === 'annule' && order.expiredUnaccepted) {
    return <div className="small order-next">{t(order.paymentMode === 'on_site' ? 'orderStatus.next_expired_on_site' : 'orderStatus.next_expired')}</div>;
  }
  // Client absent à la porte (audit du 19/10, AO-04) : la carte disait à la fois « Un paiement éventuel est remboursé » et,
  // juste dessous, « une commande non réceptionnée reste due » (orders.noCourier_incident_client_absent, conforme aux CGU).
  // Le texte de l'incident, affiché partout où la commande l'est (Orders.jsx), suffit : pas de note « remboursé ».
  if (status === 'annule' && order.deliveryIncident === 'client_absent') return null;
  if (status === 'nouveau') cle = 'next_nouveau';
  else if (status === 'preparation') cle = livraison ? 'next_preparation_delivery' : 'next_preparation_pickup';
  else if (status === 'pret') cle = livraison ? 'next_pret_delivery' : 'next_pret_pickup';
  else if (status === 'livraison') cle = 'next_livraison';
  else if (status === 'livre') cle = livraison ? 'next_livre_delivery' : 'next_livre_pickup';
  else if (status === 'refuse') cle = 'next_refuse';
  else if (status === 'annule') cle = order.pickupNoShow ? 'next_no_show' : 'next_annule';
  if (!cle) return null;
  return <div className="small order-next">{t(`orderStatus.${cle}`)}</div>;
}

export function ProgressBar({ status, orderType }) {
  const { t } = useLanguage();
  if (status === 'refuse') {
    return <p className="small texte-erreur">{t('orderStatus.progress.refused')}</p>;
  }
  if (status === 'annule') {
    return <p className="small texte-erreur">{t('orderStatus.progress.cancelled')}</p>;
  }
  const isDelivery = orderType === 'delivery';
  const steps = isDelivery ? STEPS : PICKUP_STEPS;
  const lastLabel = isDelivery ? t('orderStatus.progress.delivered') : t('orderStatus.progress.pickedUp');
  const labels = isDelivery
    ? [t('orderStatus.progress.sent'), t('orderStatus.progress.preparation'), t('orderStatus.progress.ready'), t('orderStatus.progress.onTheWay'), lastLabel]
    : [t('orderStatus.progress.sent'), t('orderStatus.progress.preparation'), t('orderStatus.progress.ready'), lastLabel];
  const idx = steps.indexOf(status);
  // Des points reliés par un trait, l'étape en cours cerclée (refonte du 2026-09-29) : quatre traits de 4 px et des
  // intitulés en 10 px ne se lisaient pas au premier coup d'œil.
  return (
    <ol className="suivi-etapes">
      {steps.map((s, i) => (
        <li key={s} className={i < idx ? 'est-fait' : i === idx ? 'est-actuel' : ''} aria-current={i === idx ? 'step' : undefined}>
          <span className="suivi-etape-point" aria-hidden="true">{i < idx ? '✓' : ''}</span>
          <span className="suivi-etape-lib">{labels[i]}</span>
        </li>
      ))}
    </ol>
  );
}
