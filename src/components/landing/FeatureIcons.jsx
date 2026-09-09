// Icônes vectorielles des trois arguments de la page d'accueil, au trait de la marque (iris, 2 px), à la
// place des emojis dont le rendu variait d'un appareil à l'autre. Décoratives : aria-hidden.
const base = { width: 40, height: 40, viewBox: '0 0 48 48', fill: 'none', stroke: 'currentColor', strokeWidth: 2.4, strokeLinecap: 'round', strokeLinejoin: 'round', 'aria-hidden': true };

export function IconLocal() {
  return (
    <svg {...base}>
      <path d="M6 20l3-9h30l3 9" /><path d="M6 20a4 4 0 0 0 8 0a4 4 0 0 0 8 0a4 4 0 0 0 8 0a4 4 0 0 0 8 0a4 4 0 0 0 4 0" />
      <path d="M9 24v16h30V24" /><path d="M19 40V30h10v10" /><path d="M13 16h22" />
    </svg>
  );
}
export function IconBike() {
  return (
    <svg {...base}>
      <circle cx="12" cy="32" r="8" /><circle cx="36" cy="32" r="8" />
      <path d="M12 32l8-16h10l6 16" /><path d="M20 16h-5" /><path d="M24 32l6-16" /><path d="M30 12h6l-4 4" />
    </svg>
  );
}
export function IconFair() {
  return (
    <svg {...base}>
      <path d="M24 6v36" /><path d="M8 18h32" /><path d="M8 18l-5 12h10z" /><path d="M40 18l-5 12h10z" />
      <path d="M16 42h16" /><circle cx="24" cy="6" r="2.5" />
    </svg>
  );
}
