// Icônes vectorielles des deux arguments de la page d'accueil, au trait de la marque (iris, 2 px), à la
// place des emojis dont le rendu variait d'un appareil à l'autre. Décoratives : aria-hidden.
//
// Il y en avait trois : IconBike accompagnait « Livraison agile en deux-roues », carte retirée le
// 2026-09-21. Elle est partie avec sa carte plutôt que de rester ici au cas où — une icône que rien
// n'affiche est une icône que personne ne remarque quand elle cesse de ressembler à la marque.
const base = { width: 40, height: 40, viewBox: '0 0 48 48', fill: 'none', stroke: 'currentColor', strokeWidth: 2.4, strokeLinecap: 'round', strokeLinejoin: 'round', 'aria-hidden': true };

export function IconLocal() {
  return (
    <svg {...base}>
      <path d="M6 20l3-9h30l3 9" /><path d="M6 20a4 4 0 0 0 8 0a4 4 0 0 0 8 0a4 4 0 0 0 8 0a4 4 0 0 0 8 0a4 4 0 0 0 4 0" />
      <path d="M9 24v16h30V24" /><path d="M19 40V30h10v10" /><path d="M13 16h22" />
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
