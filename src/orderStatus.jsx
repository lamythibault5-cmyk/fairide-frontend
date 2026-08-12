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
// Une commande à emporter n'a pas de trajet "en route" — le client vient la chercher lui-même.
const PICKUP_STEPS = ['nouveau', 'preparation', 'pret', 'livre'];
const PICKUP_LABELS = ['Envoyée', 'Préparation', 'Prête', 'Récupérée'];

export function statusLabel(status, orderType) {
  if (status === 'livre' && orderType === 'pickup') return 'Récupérée';
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
// jaune = livraison classique, bleu = à emporter, orange = heure programmée (prioritaire sur le type).
export function orderTypeColor(order) {
  if (order.scheduledFor) return 'orange';
  return order.orderType === 'pickup' ? 'blue' : 'yellow';
}

export function orderTypeLabel(order) {
  const base = order.orderType === 'pickup' ? '🏠 À emporter' : '🛵 Livraison';
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

  const isPickup = orderType === 'pickup';
  const doneStatus = 'livre';
  const doneLabel = isPickup ? 'Récupérée' : 'Livrée';

  if (status === doneStatus) {
    return <div className="small">🕐 Commandée à {formatTime(createdAt)} · {doneLabel}</div>;
  }

  if (!estimatedDeliveryAt) {
    return <div className="small">🕐 Commandée à {formatTime(createdAt)}</div>;
  }

  if (scheduledFor) {
    return (
      <div className="small">
        🕐 Commandée à {formatTime(createdAt)} · Programmée pour <b>{formatDateTime(scheduledFor)}</b>
      </div>
    );
  }

  const readyLabel = isPickup ? 'Retrait estimé à' : 'Livraison estimée à';
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
  const steps = orderType === 'pickup' ? PICKUP_STEPS : STEPS;
  const labels = orderType === 'pickup' ? PICKUP_LABELS : LABELS;
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
