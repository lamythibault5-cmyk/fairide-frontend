export const DELIVERY_INSTRUCTION_OPTIONS = [
  { value: 'sonner', label: '🔔 Sonner et attendre', icon: '🔔' },
  { value: 'deposer', label: '🚪 Déposer devant la porte', icon: '🚪' },
  { value: 'concierge', label: '🏢 Laisser au/à la concierge', icon: '🏢' },
  { value: 'appeler', label: "📞 M'appeler à l'arrivée", icon: '📞' }
];

export function deliveryInstructionLabel(value) {
  return DELIVERY_INSTRUCTION_OPTIONS.find((o) => o.value === value)?.label || value;
}

// "2× Cheeseburger (Extra cheddar, Bacon)"
export function formatOrderItem(i) {
  const options = i.options?.length ? ` (${i.options.map((o) => o.name).join(', ')})` : '';
  return `${i.qty}× ${i.name}${options}`;
}

export const STEPS = ['nouveau', 'preparation', 'pret', 'livraison', 'livre'];
const LABELS = ['Envoyée', 'Préparation', 'Prête', 'En route', 'Livrée'];
// Une commande à emporter/sur place n'a pas de trajet "en route" — le client vient lui-même.
const PICKUP_STEPS = ['nouveau', 'preparation', 'pret', 'livre'];
const PICKUP_LABELS = ['Envoyée', 'Préparation', 'Prête', 'Récupérée'];
const DINE_IN_LABELS = ['Envoyée', 'Préparation', 'Prête', 'Terminée'];

export function statusLabel(status, orderType) {
  if (status === 'livre' && orderType === 'pickup') return 'Récupérée';
  if (status === 'livre' && orderType === 'dine_in') return 'Terminée';
  return {
    nouveau: 'Nouvelle',
    preparation: 'En préparation',
    pret: 'Prête',
    livraison: 'En livraison',
    livre: 'Livrée',
    refuse: 'Refusée',
    annule: 'Annulée'
  }[status] || status;
}

// Couleur associée au type de commande, pour que le restaurant repère chaque commande d'un coup d'œil :
// jaune = livraison classique, bleu = à emporter, violet = sur place, orange = heure programmée (prioritaire sur le type).
export function orderTypeColor(order) {
  if (order.scheduledFor) return 'orange';
  if (order.orderType === 'pickup') return 'blue';
  if (order.orderType === 'dine_in') return 'purple';
  return 'yellow';
}

export function orderTypeLabel(order) {
  const base = order.orderType === 'pickup' ? '🏠 À emporter' : order.orderType === 'dine_in' ? '🍽️ Sur place' : '🛵 Livraison';
  if (order.scheduledFor) return `${base} · 🕐 ${formatDateTime(order.scheduledFor)}`;
  return base;
}

function formatTime(ms) {
  return new Date(ms).toLocaleTimeString('fr-BE', { hour: '2-digit', minute: '2-digit' });
}

function formatDateTime(ms) {
  const isToday = new Date(ms).toDateString() === new Date().toDateString();
  return isToday
    ? formatTime(ms)
    : new Date(ms).toLocaleString('fr-BE', { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' });
}

export function DeliveryTiming({ order }) {
  const { createdAt, estimatedDeliveryAt, status, orderType, scheduledFor } = order;
  if (status === 'refuse' || status === 'annule') return null;

  const isDineIn = orderType === 'dine_in';
  const isPickup = orderType === 'pickup';
  const doneStatus = 'livre';
  const doneLabel = isDineIn ? 'Terminée' : isPickup ? 'Récupérée' : 'Livrée';

  if (status === doneStatus) {
    return <div className="small">🕐 Commandée à {formatTime(createdAt)} · {doneLabel}</div>;
  }

  if (!estimatedDeliveryAt) {
    return <div className="small">🕐 Commandée à {formatTime(createdAt)}</div>;
  }

  if (scheduledFor) {
    const label = isDineIn ? 'Réservée pour' : 'Programmée pour';
    return (
      <div className="small">
        🕐 Commandée à {formatTime(createdAt)} · {label} <b>{formatDateTime(scheduledFor)}</b>
      </div>
    );
  }

  const readyLabel = isDineIn ? 'Table prête à' : isPickup ? 'Retrait estimé à' : 'Livraison estimée à';
  const minutesLeft = Math.max(0, Math.round((estimatedDeliveryAt - Date.now()) / 60000));
  return (
    <div className="small">
      🕐 Commandée à {formatTime(createdAt)} · {readyLabel} <b>{formatTime(estimatedDeliveryAt)}</b>
      {minutesLeft > 0 ? ` (~${minutesLeft} min)` : ' (imminente)'}
    </div>
  );
}

export function ProgressBar({ status, orderType }) {
  if (status === 'refuse') {
    return <p className="small" style={{ color: 'var(--red)' }}>Commande refusée par le restaurant.</p>;
  }
  if (status === 'annule') {
    return <p className="small" style={{ color: 'var(--red)' }}>Commande annulée.</p>;
  }
  const isDelivery = orderType === 'delivery';
  const steps = isDelivery ? STEPS : PICKUP_STEPS;
  const labels = isDelivery ? LABELS : orderType === 'dine_in' ? DINE_IN_LABELS : PICKUP_LABELS;
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
          <span key={l} style={i === idx ? { color: 'var(--ink)', fontWeight: 600 } : undefined}>{l}</span>
        ))}
      </div>
    </>
  );
}
