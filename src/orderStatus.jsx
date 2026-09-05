import { useLanguage, getLocale } from './context/LanguageContext';

export const DELIVERY_INSTRUCTION_OPTIONS = [
  { value: 'sonner', label: '🔔 Sonner et attendre', icon: '🔔' },
  { value: 'deposer', label: '🚪 Déposer devant la porte', icon: '🚪' },
  { value: 'concierge', label: '🏢 Laisser au/à la concierge', icon: '🏢' },
  { value: 'appeler', label: "📞 M'appeler à l'arrivée", icon: '📞' }
];

export function deliveryInstructionLabel(value, t) {
  if (t) return t(`orderStatus.deliveryInstruction.${value}`);
  return DELIVERY_INSTRUCTION_OPTIONS.find((o) => o.value === value)?.label || value;
}

// "2× Cheeseburger (Extra cheddar, Bacon)"
export function formatOrderItem(i) {
  const options = i.options?.length ? ` (${i.options.map((o) => o.name).join(', ')})` : '';
  return `${i.qty}× ${i.name}${options}`;
}

export const STEPS = ['nouveau', 'preparation', 'pret', 'livraison', 'livre'];
// Une commande à emporter/sur place n'a pas de trajet "en route" — le client vient lui-même.
const PICKUP_STEPS = ['nouveau', 'preparation', 'pret', 'livre'];

const STATUS_LABELS_FR = {
  nouveau: 'Nouvelle', preparation: 'En préparation', pret: 'Prête', livraison: 'En livraison',
  livre: 'Livrée', refuse: 'Refusée', annule: 'Annulée'
};

// Une réservation de table n'est ni « nouvelle » ni « en préparation » : elle attend une confirmation,
// puis elle est confirmée. Les mêmes statuts bruts, des mots qui parlent de tables.
const STATUS_LABELS_DINE_IN_FR = { nouveau: 'À confirmer', preparation: 'Confirmée', pret: 'Table prête' };

export function statusLabel(status, orderType, t) {
  if (status === 'livre' && orderType === 'pickup') return t ? t('orderStatus.status.livrePickup') : 'Récupérée';
  if (status === 'livre' && orderType === 'dine_in') return t ? t('orderStatus.status.livreDineIn') : 'Terminée';
  if (orderType === 'dine_in' && STATUS_LABELS_DINE_IN_FR[status]) {
    return t ? t(`orderStatus.status.${status}DineIn`) : STATUS_LABELS_DINE_IN_FR[status];
  }
  if (t) return t(`orderStatus.status.${status}`);
  return STATUS_LABELS_FR[status] || status;
}

// Étape opérationnelle d'une commande, du point de vue du restaurateur — distincte du statut brut
// (qui a plus de valeurs) et du type de commande (livraison/emporter/sur place) : ce qui compte ici
// c'est "qu'est-ce que je dois faire, là, maintenant ?". Deux étapes distinctes impliquent un livreur
// pas encore là, à ne pas confondre : "attenteConfirmationLivreur" (avant même de cuisiner — aucun
// livreur n'a encore pris la commande, voir GET /orders/available qui l'expose dès le statut
// "preparation") et "attenteLivreur" (le plat est prêt, on attend que ce livreur arrive physiquement
// le récupérer). La première est isolée et placée avant "En préparation" car l'idée est de s'assurer
// qu'un livreur sera bien disponible avant de lancer la cuisson ; la seconde reste isolée de
// "enLivraison" (déjà pris en charge, donc déjà réglé) pour la même raison qu'avant.
export const ORDER_STAGES = [
  { key: 'nouveau', label: 'Nouvelle — à traiter', icon: '🆕', defaultColor: '#D92D3C' },
  { key: 'attenteConfirmationLivreur', label: 'En attente de la confirmation d\'un livreur', icon: '📣', defaultColor: '#B0459B' },
  { key: 'preparation', label: 'En préparation', icon: '👨‍🍳', defaultColor: '#C8F03C' },
  { key: 'attenteLivreur', label: 'Prête — en attente de l\'arrivée du livreur', icon: '⏳', defaultColor: '#E07A1F' },
  { key: 'pretClient', label: 'Prête — en attente du client', icon: '⏳', defaultColor: '#E07A1F' },
  { key: 'enLivraison', label: 'Livreur en route', icon: '🛵', defaultColor: '#2B7FB8' },
  { key: 'terminee', label: 'Terminée', icon: '✅', defaultColor: '#14121F' },
  { key: 'annulee', label: 'Refusée / annulée', icon: '🚫', defaultColor: '#8A8A8A' }
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

const DEFAULT_STAGE_COLORS = Object.fromEntries(ORDER_STAGES.map((s) => [s.key, s.defaultColor]));

function stageColorsKey(restoId) {
  return `fairide_order_stage_colors_${restoId}`;
}

export function loadStageColors(restoId) {
  try {
    const saved = JSON.parse(localStorage.getItem(stageColorsKey(restoId)) || '{}');
    return { ...DEFAULT_STAGE_COLORS, ...saved };
  } catch {
    return { ...DEFAULT_STAGE_COLORS };
  }
}

export function saveStageColors(restoId, colors) {
  localStorage.setItem(stageColorsKey(restoId), JSON.stringify(colors));
}

export function resetStageColors(restoId) {
  localStorage.removeItem(stageColorsKey(restoId));
  return { ...DEFAULT_STAGE_COLORS };
}

// Couleur associée au type de commande, pour que le restaurant repère chaque commande d'un coup d'œil :
// jaune = livraison classique, bleu = à emporter, violet = sur place, orange = heure programmée (prioritaire sur le type).
export function orderTypeColor(order) {
  if (order.scheduledFor) return 'orange';
  if (order.orderType === 'pickup') return 'blue';
  if (order.orderType === 'dine_in') return 'purple';
  return 'yellow';
}

export function orderTypeLabel(order, t) {
  const base = t
    ? (order.orderType === 'pickup' ? t('orderStatus.orderType.pickup') : order.orderType === 'dine_in' ? t('orderStatus.orderType.dineIn') : t('orderStatus.orderType.delivery'))
    : (order.orderType === 'pickup' ? '🏠 À emporter' : order.orderType === 'dine_in' ? '🍽️ Sur place' : '🛵 Livraison');
  if (order.scheduledFor) return `${base} · 🕐 ${formatDateTime(order.scheduledFor)}`;
  return base;
}

function formatTime(ms) {
  return new Date(ms).toLocaleTimeString(getLocale(), { hour: '2-digit', minute: '2-digit' });
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

  const isDineIn = orderType === 'dine_in';
  const isPickup = orderType === 'pickup';
  const doneStatus = 'livre';
  const doneLabel = isDineIn ? t('orderStatus.status.livreDineIn') : isPickup ? t('orderStatus.status.livrePickup') : t('orderStatus.status.livre');
  const orderedAt = t('orderStatus.timing.orderedAt', { time: formatTime(createdAt) });

  if (status === doneStatus) {
    return <div className="small">{orderedAt} · {doneLabel}</div>;
  }

  if (!estimatedDeliveryAt) {
    return <div className="small">{orderedAt}</div>;
  }

  if (scheduledFor) {
    const label = isDineIn ? t('orderStatus.timing.reservedFor') : t('orderStatus.timing.scheduledFor');
    return (
      <div className="small">
        {orderedAt} · {label} <b>{formatDateTime(scheduledFor)}</b>
      </div>
    );
  }

  const readyLabel = isDineIn ? t('orderStatus.timing.tableReadyAt') : isPickup ? t('orderStatus.timing.pickupEstimate') : t('orderStatus.timing.deliveryEstimate');
  const minutesLeft = Math.max(0, Math.round((estimatedDeliveryAt - Date.now()) / 60000));
  return (
    <div className="small">
      {orderedAt} · {readyLabel} <b>{formatTime(estimatedDeliveryAt)}</b>
      {minutesLeft > 0 ? t('orderStatus.timing.minutesLeft', { min: minutesLeft }) : t('orderStatus.timing.imminent')}
    </div>
  );
}

export function ProgressBar({ status, orderType }) {
  const { t } = useLanguage();
  if (status === 'refuse') {
    return <p className="small" style={{ color: 'var(--red)' }}>{t('orderStatus.progress.refused')}</p>;
  }
  if (status === 'annule') {
    return <p className="small" style={{ color: 'var(--red)' }}>{t('orderStatus.progress.cancelled')}</p>;
  }
  const isDelivery = orderType === 'delivery';
  const steps = isDelivery ? STEPS : PICKUP_STEPS;
  const lastLabel = isDelivery ? t('orderStatus.progress.delivered') : orderType === 'dine_in' ? t('orderStatus.progress.dineInDone') : t('orderStatus.progress.pickedUp');
  const labels = isDelivery
    ? [t('orderStatus.progress.sent'), t('orderStatus.progress.preparation'), t('orderStatus.progress.ready'), t('orderStatus.progress.onTheWay'), lastLabel]
    : [t('orderStatus.progress.sent'), t('orderStatus.progress.preparation'), t('orderStatus.progress.ready'), lastLabel];
  const idx = steps.indexOf(status);
  return (
    <>
      <div style={{ display: 'flex', gap: 4, margin: '8px 0 4px' }}>
        {steps.map((s, i) => (
          <div key={s} style={{ flex: 1, height: 4, borderRadius: 2, background: i < idx ? 'var(--teal)' : i === idx ? 'var(--gold)' : 'var(--cream-dim)' }} />
        ))}
      </div>
      <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 10, color: 'var(--ink-soft)', marginBottom: 8 }}>
        {labels.map((l, i) => (
          <span key={i} style={i === idx ? { color: 'var(--ink)', fontWeight: 600 } : undefined}>{l}</span>
        ))}
      </div>
    </>
  );
}
