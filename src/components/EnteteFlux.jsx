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
export default function EnteteFlux({ vers, geste = 'retour', titre = '', libelle = '' }) {
  const { t } = useLanguage();
  const fermer = geste === 'fermer';
  // Le libellé accessible dit où l'on va, pas ce que le bouton dessine : « Fermer » tout court ne
  // renseigne pas un lecteur d'écran sur ce qu'on retrouvera derrière.
  const nomAccessible = libelle || (fermer ? t('flux.close') : t('flux.back'));
  return (
    <div className="flux-entete">
      <Link
        to={vers}
        className={`flux-bouton${fermer ? ' flux-bouton--fermer' : ''}`}
        aria-label={nomAccessible}
        title={nomAccessible}
      >
        {/* Un glyphe littéral, comme les autres fermetures du dépôt (.tracking-fullscreen-close,
            .carte-recherche-vider) : Icone.jsx n'a ni croix ni flèche. aria-hidden parce que le nom
            accessible est porté par le lien lui-même — sans quoi il serait annoncé deux fois. */}
        <span aria-hidden="true">{fermer ? '×' : '‹'}</span>
      </Link>
      {titre && <span className="flux-titre">{titre}</span>}
    </div>
  );
}
