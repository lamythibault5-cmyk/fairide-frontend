// Pastille "resto vérifié" (façon certification Instagram) à côté du nom d'un restaurant dont le compte
// a été créé par un vrai restaurateur — absente pour les restos de démonstration (voir `certified` dans
// la réponse de l'API, dérivé de restaurants.is_demo côté backend).
export default function CertifiedBadge({ size = 16 }) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 20 20"
      className="certified-badge"
      role="img"
      aria-label="Restaurant vérifié par Fairide"
    >
      <title>Restaurant vérifié par Fairide</title>
      <circle cx="10" cy="10" r="10" fill="currentColor" />
      <path d="M5.6 10.2l2.7 2.7 6.1-6.1" fill="none" stroke="#fff" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}
