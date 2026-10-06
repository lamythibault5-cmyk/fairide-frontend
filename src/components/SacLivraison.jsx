// Dessin d'un sac de livraison isotherme (fondateur, 2026-10-06) : montré au livreur quand on lui parle du sac, pour qu'il
// voie de quoi il s'agit — un sac à dos carré, rigide, isolé, à bandoulières, comme ceux des plateformes de livraison.
// Tracé au trait, couleurs de la marque (iris et lime), sans texte dedans : la légende est à côté, traduite.
export default function SacLivraison({ size = 120, className = '' }) {
  return (
    <svg width={size} height={size} viewBox="0 0 120 120" role="img" aria-hidden="true" className={className} fill="none" stroke="#3B2FB5" strokeWidth="2.4" strokeLinejoin="round" strokeLinecap="round">
      {/* Bandoulières */}
      <path d="M38 34c0-10 6-16 12-16M82 34c0-10-6-16-12-16" stroke="#3B2FB5" />
      <path d="M50 18h20" />
      {/* Corps du sac (cube isotherme) */}
      <rect x="22" y="34" width="76" height="66" rx="8" fill="#F1EFFC" />
      {/* Rabat supérieur */}
      <path d="M22 50h76" />
      <rect x="22" y="34" width="76" height="16" rx="8" fill="#C8F03C" stroke="#3B2FB5" />
      {/* Fermeture éclair du rabat */}
      <path d="M30 50c4 3 8 3 12 0s8-3 12 0 8 3 12 0 8-3 12 0 8 3 12 0" strokeWidth="1.6" strokeDasharray="2 2" />
      {/* Poignée */}
      <path d="M50 34v-6a10 10 0 0 1 20 0v6" />
      {/* Poche avant */}
      <rect x="36" y="62" width="48" height="26" rx="5" fill="#FFFFFF" />
      <path d="M36 72h48" strokeWidth="1.6" />
      {/* Logo Fairide sur la poche : pastille */}
      <circle cx="60" cy="80" r="4.5" fill="#C8F03C" stroke="#3B2FB5" strokeWidth="1.6" />
      {/* Ondes de chaleur : isotherme */}
      <path d="M104 60c3-3 3-6 0-9M110 64c5-5 5-12 0-17" strokeWidth="1.8" opacity="0.7" />
    </svg>
  );
}
