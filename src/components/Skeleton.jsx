/* LE CHARGEMENT EN BANDEAU ET FEUILLE (fondateur, 2026-10-19, audit « Look and feel », propositions A + B). Avant : trois
 * cartes grises sur du blanc, puis le bandeau iris arrivait d'un coup — l'écran sautait. Maintenant :
 *   - SkeletonCards : des lignes à la forme des vraies lignes (vignette, deux traits), teinte iris pâle qui miroite, au lieu
 *     des cartes grises. Partout où les données se font attendre, y compris dans une feuille déjà affichée ;
 *   - SqueletteEcran : l'écran entier qui attend, bandeau iris compris. Avec `titre` (proposition A : on sait quel écran
 *     s'ouvre), le vrai titre est là dès la première image ; sans (proposition B : le titre vient des données, un commerce,
 *     une commande), des barres blanches translucides miroitent à sa place. Le vélo lime roule sur la route tant que ça
 *     charge. `photo` : l'écran commence par une photo (la fiche d'un commerce) — un aplat iris pâle à sa place.
 * Styles : « Chargement en bandeau et feuille » dans styles.css. Le vélo roule aussi sur la route des bandeaux déjà affichés
 * tant que leur feuille contient un squelette (même bloc, :has). */

export function SkeletonCards({ count = 3 }) {
  return (
    <div className="sq-lignes" aria-hidden="true">
      {Array.from({ length: count }).map((_, i) => (
        <div key={i} className="sq-ligne">
          <span className="skeleton sq-vignette" />
          <span className="sq-traits"><i className="skeleton" /><i className="skeleton" /></span>
        </div>
      ))}
    </div>
  );
}

// Le vélo « 5a » de la marque (BrandMark.jsx, sans tuile), à la couleur du texte : lime sur le bandeau.
function Velo() {
  return (
    <svg viewBox="-3 5 82 42" width="36" height="18" aria-hidden="true">
      <g fill="none" stroke="currentColor" strokeWidth="5" strokeLinecap="round"><circle cx="15" cy="29" r="12.5" /><circle cx="61" cy="29" r="12.5" /></g>
      <g fill="currentColor"><rect x="16" y="8" width="44" height="5" rx="2.5" /><g transform="rotate(42 27 22.5)"><rect x="13" y="20" width="28" height="5" rx="2.5" /></g></g>
    </svg>
  );
}

export function SqueletteEcran({ titre, haut, lignes = 4, photo = false, src = null }) {
  return (
    <div className="sq-ecran" aria-busy="true">
      {/* `src` : la photo de la carte touchée dans la liste (transitionPhoto.js) — elle arrive en grandissant, déjà chargée. */}
      {photo ? <div className="skeleton sq-photo" aria-hidden="true">{src && <img src={src} alt="" className="sq-photo-img" />}</div> : (
        <div className="sq-bandeau">
          <div className="sq-haut">{haut ? <span>{haut}</span> : <span className="skeleton skeleton--iris" style={{ width: '42%' }} aria-hidden="true" />}</div>
          {titre ? <h1 className="sq-titre">{titre}</h1> : <span className="skeleton skeleton--iris sq-titre-barre" aria-hidden="true" />}
          {!titre && <span className="skeleton skeleton--iris sq-sous-barre" aria-hidden="true" />}
          <div className="sq-route" aria-hidden="true"><span className="sq-velo"><Velo /></span></div>
        </div>
      )}
      <div className="sq-feuille"><SkeletonCards count={lignes} /></div>
    </div>
  );
}
