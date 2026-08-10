export const DELIVERY_INSTRUCTION_OPTIONS = [
  { value: 'sonner', label: '🔔 Sonner et attendre', icon: '🔔' },
  { value: 'deposer', label: '🚪 Déposer devant la porte', icon: '🚪' },
  { value: 'concierge', label: '🏢 Laisser au/à la concierge', icon: '🏢' },
  { value: 'appeler', label: "📞 M'appeler à l'arrivée", icon: '📞' }
];

export function deliveryInstructionLabel(value) {
  return DELIVERY_INSTRUCTION_OPTIONS.find((o) => o.value === value)?.label || value;
}

export const STEPS = ['nouveau', 'preparation', 'pret', 'livraison', 'livre'];
const LABELS = ['Envoyée', 'Préparation', 'Prête', 'En route', 'Livrée'];

export function statusLabel(status) {
  return {
    nouveau: 'Nouvelle',
    preparation: 'En préparation',
    pret: 'Prête',
    livraison: 'En livraison',
    livre: 'Livrée',
    refuse: 'Refusée'
  }[status] || status;
}

function formatTime(ms) {
  return new Date(ms).toLocaleTimeString('fr-BE', { hour: '2-digit', minute: '2-digit' });
}

export function DeliveryTiming({ order }) {
  const { createdAt, estimatedDeliveryAt, status } = order;
  if (status === 'refuse') return null;

  if (status === 'livre') {
    return <div className="small">🕐 Commandée à {formatTime(createdAt)}</div>;
  }

  if (!estimatedDeliveryAt) {
    return <div className="small">🕐 Commandée à {formatTime(createdAt)}</div>;
  }

  const minutesLeft = Math.max(0, Math.round((estimatedDeliveryAt - Date.now()) / 60000));
  return (
    <div className="small">
      🕐 Commandée à {formatTime(createdAt)} · Livraison estimée à <b>{formatTime(estimatedDeliveryAt)}</b>
      {minutesLeft > 0 ? ` (~${minutesLeft} min)` : ' (imminente)'}
    </div>
  );
}

export function ProgressBar({ status }) {
  if (status === 'refuse') {
    return <p className="small" style={{ color: 'var(--red)' }}>Commande refusée par le restaurant.</p>;
  }
  const idx = STEPS.indexOf(status);
  return (
    <>
      <div style={{ display: 'flex', gap: 4, margin: '8px 0 4px' }}>
        {STEPS.map((s, i) => (
          <div key={s} style={{ flex: 1, height: 4, borderRadius: 2, background: i < idx ? 'var(--teal)' : i === idx ? 'var(--gold)' : 'var(--cream-dim)' }} />
        ))}
      </div>
      <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 10, color: 'var(--ink-soft)', marginBottom: 8 }}>
        {LABELS.map((l, i) => (
          <span key={l} style={i === idx ? { color: 'var(--ink)', fontWeight: 600 } : undefined}>{l}</span>
        ))}
      </div>
    </>
  );
}
