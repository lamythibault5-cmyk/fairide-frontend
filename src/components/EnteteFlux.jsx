import { Link } from 'react-router-dom';
import { useLanguage } from '../context/LanguageContext';

// En-tête des pages du parcours de commande : un seul geste, en haut à gauche.
//
// POURQUOI. À partir du moment où l'on entre dans un commerce, on est dans un parcours : voir la
// carte, remplir son panier, payer. Les onglets du bas n'y servent plus à rien — ils proposent de
// partir ailleurs au moment précis où l'on est en train de faire quelque chose — et sur téléphone
// ils recouvraient le total au moment de payer (les pastilles flottent à z-index 50, la barre de
// total est collante sans z-index : voir styles.css). Les onglets s'effacent donc sur ces pages
// (Layout.jsx, classe .dashboard-shell--flux), et ce bouton devient la seule sortie.
//
// C'est le motif d'Uber Eats, et la distinction entre les deux gestes en est le cœur :
//
//   ×  SORTIR du parcours        — la fiche d'un commerce renvoie à la liste
//   ←  RECULER d'un pas          — le panier renvoie à la fiche, le paiement au panier
//
// Une croix qui reculerait d'un pas, ou une flèche qui ferait tout quitter, trompent la main : on
// apprend le geste en deux écrans et on s'y fie ensuite sans regarder.
//
// PAS DE navigate(-1). L'historique du navigateur n'est pas le parcours : on arrive souvent sur une
// fiche par un lien partagé, et reculer ferait alors SORTIR du site. Le dépôt n'utilise d'ailleurs
// `navigate(-1)` nulle part dans pages/client — les retours y sont toujours des liens explicites.
//
// Le bouton reprend `button-floating` de DESIGN.md (fond blanc, texte encre, forme pilule, ombre
// légère) exprimé avec les jetons Fairide — c'est déjà ce qu'avaient fait les pastilles du bas.
// `onRetour` plutôt que `vers` : le paiement recule d'une ÉTAPE, pas d'une adresse. Le geste reste
// exactement le même à l'écran — c'est ce qui compte — mais il ne change pas de page.
// IL EST COLLANT DEPUIS LE 2026-09-21. Il ne l'était pas, et sur téléphone le geste de sortie
// partait donc vers le haut au premier défilement : arrivé au milieu de la carte d'un commerce, il
// n'y avait plus AUCUN moyen de revenir en arrière — les onglets du bas s'effacent sur ces pages
// (Layout.jsx, .dashboard-shell--flux) précisément parce que ce bouton est censé être la sortie.
// Un bouton qui est la seule sortie et qui disparaît au défilement n'est pas une sortie.
// Le défaut valait pour les trois pages qui montent ce composant — fiche, panier, paiement — et se
// règle pour les trois d'un coup, ici.
//
// `titreEstompe` et `actions` servent la fiche d'un commerce, qui en fait un vrai bandeau à la
// manière d'Uber Eats : croix à gauche, nom du commerce au milieu, recherche à droite. Le nom y
// est rendu en permanence — jamais monté puis démonté — mais estompé tant que le grand titre de la
// page est encore à l'écran : l'afficher deux fois à dix pixels d'écart est du bruit, et le faire
// APPARAÎTRE ferait sauter la largeur du bandeau à chaque passage. On ne bouge que l'opacité.
export default function EnteteFlux({ vers, onRetour, geste = 'retour', titre = '', libelle = '', titreEstompe = false, actions = null }) {
  const { t } = useLanguage();
  const fermer = geste === 'fermer';
  // Le libellé accessible dit où l'on va, pas ce que le bouton dessine : « Fermer » tout court ne
  // renseigne pas un lecteur d'écran sur ce qu'on retrouvera derrière.
  const nomAccessible = libelle || (fermer ? t('flux.close') : t('flux.back'));
  const classe = `flux-bouton${fermer ? ' flux-bouton--fermer' : ''}`;
  // Un glyphe littéral, comme les autres fermetures du dépôt (.tracking-fullscreen-close,
  // .carte-recherche-vider) : Icone.jsx n'a ni croix ni flèche. aria-hidden parce que le nom
  // accessible est porté par le bouton lui-même — sans quoi il serait annoncé deux fois.
  const glyphe = <span aria-hidden="true">{fermer ? '×' : '‹'}</span>;
  return (
    <div className="flux-entete">
      {onRetour ? (
        // Un vrai <button> et non un lien : reculer d'une étape n'est pas une adresse. Un lien
        // vide donnerait un clic droit « ouvrir dans un nouvel onglet » qui ne mènerait nulle part.
        <button type="button" className={classe} onClick={onRetour} aria-label={nomAccessible} title={nomAccessible}>
          {glyphe}
        </button>
      ) : (
        <Link to={vers} className={classe} aria-label={nomAccessible} title={nomAccessible}>
          {glyphe}
        </Link>
      )}
      {/* aria-hidden quand il est estompé : le nom est alors déjà annoncé par le <h1> de la page,
          et un lecteur d'écran lirait deux fois le même commerce à la suite. */}
      {titre && (
        <span className={`flux-titre${titreEstompe ? ' flux-titre--estompe' : ''}`} aria-hidden={titreEstompe || undefined}>
          {titre}
        </span>
      )}
      {actions && <div className="flux-actions">{actions}</div>}
    </div>
  );
}
