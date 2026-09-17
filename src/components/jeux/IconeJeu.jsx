// L'identité de chaque mini-jeu : une couleur franche et un pictogramme vectoriel.
//
// LES ONGLETS NE SE LISAIENT PAS. Six cases gris clair, un emoji de 22px et un sous-titre gris pâle :
// on ne distinguait ni les jeux entre eux, ni celui qui était choisi. Chaque jeu a maintenant SA
// couleur, portée par une tuile pleine avec un pictogramme blanc bien épais — reconnaissable d'un coup
// d'œil, même en petit, et sans dépendre d'une police emoji (voir dessin.js : sur certains iPhone,
// les emojis ne se dessinent pas).
//
// `texte` : la couleur du texte POSÉ SUR la couleur du jeu. Blanc partout, sauf sur le jaune, où le
// blanc tombait sous le contraste lisible. Toutes les paires couleur/texte dépassent 4,5:1 (mesuré).
export const IDENTITE_JEU = {
  catch: { couleur: '#C25200', texte: '#FFFFFF', doux: '#FDEBDC' },
  dodge: { couleur: '#F5B800', texte: '#14121F', doux: '#FDF1C7' },
  reaction: { couleur: '#C8243A', texte: '#FFFFFF', doux: '#FBDDE1' },
  sort: { couleur: '#0F8049', texte: '#FFFFFF', doux: '#D4EFE2' },
  rider: { couleur: '#3B2FB5', texte: '#FFFFFF', doux: '#E4E1F7' },
  arrow: { couleur: '#0A6DB0', texte: '#FFFFFF', doux: '#D4E9F7' }
};

const TRACES = {
  // Panier : anse, corps évasé, deux lignes de tressage.
  catch: (
    <>
      <path d="M8 10 12 4l4 6" />
      <path d="M3 10h18l-2 9a2 2 0 0 1-2 1.6H7A2 2 0 0 1 5 19z" />
      <path d="M9 13.5v4M15 13.5v4M12 13.5v4" />
    </>
  ),
  // Barrière de chantier : planche rayée sur deux pieds.
  dodge: (
    <>
      <rect x="2.5" y="6" width="19" height="7" rx="1.5" />
      <path d="M7 6l-4 7M13 6l-5 7M19 6l-5 7" />
      <path d="M6 13v7M18 13v7M4 20h4M16 20h4" />
    </>
  ),
  // Cible : trois anneaux, un éclair de réflexe en haut à droite.
  reaction: (
    <>
      <circle cx="11" cy="13" r="8" />
      <circle cx="11" cy="13" r="4.2" />
      <circle cx="11" cy="13" r="1" fill="currentColor" />
      <path d="M17 3l-1.6 3.4H19L17.2 10" />
    </>
  ),
  // Tri : une poubelle et sa flèche de recyclage.
  sort: (
    <>
      <path d="M4 7h16M9 7V4.5h6V7" />
      <path d="M6 7l1 13h10l1-13" />
      <path d="M10 11v6M14 11v6" />
    </>
  ),
  // Vélo : deux roues, cadre, guidon et selle.
  rider: (
    <>
      <circle cx="5.5" cy="16" r="3.8" />
      <circle cx="18.5" cy="16" r="3.8" />
      <path d="M5.5 16 9.5 8.5h6.5L18.5 16M9.5 8.5 12.5 16h-7M12.5 16l3.5-7.5" />
      <path d="M14.5 5.5h3l-1.5 3M8 6.5h3" />
    </>
  ),
  // Flèche qui traverse un passage.
  arrow: (
    <>
      <path d="M3 12h15" />
      <path d="M14 7l5 5-5 5" />
      <path d="M3 9l2 3-2 3" />
      <path d="M21.5 4v4M21.5 16v4" />
    </>
  )
};

export function IconeJeu({ cle, taille = 24, epaisseur = 2.2 }) {
  return (
    <svg width={taille} height={taille} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={epaisseur}
      strokeLinecap="round" strokeLinejoin="round" aria-hidden="true" focusable="false">
      {TRACES[cle] || <circle cx="12" cy="12" r="8" />}
    </svg>
  );
}

// Variables CSS d'un jeu, à poser en style inline : --jeu (couleur), --jeu-texte (texte posé dessus) et
// --jeu-doux (teinte claire, pour les bordures et fonds au repos — sans color-mix, absent des vieux iOS).
export function styleJeu(cle) {
  const id = IDENTITE_JEU[cle] || IDENTITE_JEU.rider;
  return { '--jeu': id.couleur, '--jeu-texte': id.texte, '--jeu-doux': id.doux };
}
