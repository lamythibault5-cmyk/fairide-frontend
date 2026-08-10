export function StarsDisplay({ value, size = 14 }) {
  const rounded = Math.round(Number(value) || 0);
  return (
    <span style={{ fontSize: size, color: 'var(--gold)', letterSpacing: 1 }}>
      {[1, 2, 3, 4, 5].map((i) => (i <= rounded ? '★' : '☆'))}
    </span>
  );
}

export function StarsInput({ value, onChange }) {
  return (
    <span style={{ fontSize: 24, letterSpacing: 2, cursor: 'pointer' }}>
      {[1, 2, 3, 4, 5].map((i) => (
        <span key={i} onClick={() => onChange(i)} style={{ color: i <= value ? 'var(--gold)' : 'var(--line)' }}>
          ★
        </span>
      ))}
    </span>
  );
}
