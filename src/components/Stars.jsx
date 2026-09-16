// Les étoiles étaient peintes en lime sur fond blanc. Le CLAUDE.md l'interdit explicitement —
// « Lime as text, as a 1px border or as a thin rule on a white page fails contrast and is
// invisible » — et ça se voyait : une note de 4 sur 5 se lisait comme un trait pâle. L'étoile
// d'Uber est simplement noire, et les étoiles vides prennent le gris des filets.
export function StarsDisplay({ value, size = 14 }) {
  const rounded = Math.round(Number(value) || 0);
  return (
    <span style={{ fontSize: size, color: 'var(--ink)', letterSpacing: 1 }}>
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
