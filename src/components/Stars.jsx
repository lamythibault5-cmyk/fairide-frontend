export function StarsDisplay({ value, size = 14 }) {
  const rounded = Math.round(Number(value) || 0);
  return (
    <span style={{ fontSize: size, color: 'var(--gold)', letterSpacing: 1 }}>
      {[1, 2, 3, 4, 5].map((i) => (i <= rounded ? '★' : '☆'))}
    </span>
  );
}

// Vrais boutons, zone de toucher d'au moins 40 px : de simples caractères de 24 px se ratent au doigt.
export function StarsInput({ value, onChange }) {
  return (
    <span className="stars-input" role="radiogroup">
      {[1, 2, 3, 4, 5].map((i) => (
        <button key={i} type="button" role="radio" aria-checked={value === i} aria-label={`${i}/5`} onClick={() => onChange(i)} style={{ color: i <= value ? 'var(--gold)' : 'var(--line)' }}>
          ★
        </button>
      ))}
    </span>
  );
}
