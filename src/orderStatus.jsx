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
