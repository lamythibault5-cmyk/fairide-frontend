// Cœur de favori réutilisable — pas de fond/bulle, juste l'icône (blanc à contour quand inactif,
// rose/rouge plein quand actif) avec une petite animation "pop" au moment où il devient actif.
export default function FavoriteHeart({ active, onClick, title, busy = false, className = '' }) {
  return (
    <button
      type="button"
      className={`favorite-heart${active ? ' is-active' : ''}${className ? ` ${className}` : ''}`}
      onClick={onClick}
      disabled={busy}
      title={title}
      aria-label={title}
      aria-pressed={active}
    >
      <svg viewBox="0 0 24 24" width="22" height="22" aria-hidden="true">
        <path d="M12 21.35c-.24 0-.47-.09-.65-.26C7.14 17.4 3 13.28 3 9.14 3 6.3 5.1 4.1 7.8 4.1c1.6 0 3.13.78 4.2 2.03A5.63 5.63 0 0 1 16.2 4.1C18.9 4.1 21 6.3 21 9.14c0 4.14-4.14 8.26-8.35 11.95-.18.17-.41.26-.65.26z" />
      </svg>
    </button>
  );
}
