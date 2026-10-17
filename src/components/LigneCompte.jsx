import { Link, useLocation } from 'react-router-dom';
import { etatFeuille } from '../feuilles';
import Icone from './Icone';
import SousEcran from './SousEcran';
import { experienceApp } from '../natif';

// Application (2026-10-15) : une rangée pliable n'ouvre plus son contenu sous elle (« Mes infos » dépliait huit champs au
// milieu de Mon compte) mais dans une feuille, comme l'adresse ou la remise au paiement. Fermer la feuille replie la rangée.
const APPLI = experienceApp();

// Une rangée de menu : icône, titre, sous-titre, et à droite un chevron ou une action. Le même dessin
// partout dans l'espace connecté — la page Mon compte, les statuts en tête des tableaux de bord du
// restaurateur et du livreur — pour que l'œil reconnaisse la forme d'une page à l'autre.
//
// Quatre variantes selon les props :
// - `to`        : un lien vers une page.
// - `onClick`   : une action (partager Fairide). Un <button>, pas un <a href="#"> déguisé —
//                 un lien qui ne mène nulle part est annoncé comme tel par les lecteurs d'écran et
//                 s'ouvre dans un nouvel onglet au clic du milieu.
// - `children`  : une rangée qui se DÉPLIE (`ouverte`, `onClick` pour basculer) et montre un
//                 formulaire ou une explication en dessous.
// - `action`    : une rangée d'état, statique, avec un bouton à droite (« Configurer », « Pause »).
//
// `accent` colore l'icône des rangées d'état : 'ok', 'warn', 'danger'.
//
// `icone` prend un NOM de tracé (voir Icone.jsx) — « cadenas », « cadeau », « document ». Une chaîne
// est donc résolue en SVG ; tout autre nœud React est rendu tel quel, ce qui laisse passer le cas
// où l'icône est du contenu et non de l'interface (un emoji de cuisine, par exemple).
export default function LigneCompte({ to, onClick, icone, titre, sous, danger = false, ouverte = false, children, action, accent }) {
  const location = useLocation();
  const pliable = children !== undefined;
  const contenu = (
    <>
      <span className={`account-link-icon${accent ? ` account-link-icon--${accent}` : ''}`} aria-hidden="true">
        {typeof icone === 'string' ? <Icone nom={icone} taille={22} /> : icone}
      </span>
      <span className="account-link-text">
        <b>{titre}</b>
        {sous && <span className="small">{sous}</span>}
      </span>
      {action !== undefined
        ? <span className="account-link-action">{action}</span>
        : <span className={`account-link-chevron${pliable ? ' account-link-chevron--pliable' : ''}`} aria-hidden="true">›</span>}
    </>
  );
  const classe = `account-link-row${danger ? ' account-link-danger' : ''}${ouverte ? ' ouverte' : ''}`;
  if (action !== undefined && !pliable && !to && !onClick) {
    return <div className={`${classe} account-link-row--statique`}>{contenu}</div>;
  }
  // Favoris, Mes factures, Mes documents… s'ouvrent en feuille par-dessus Mon compte (feuilles.js).
  if (to) return <Link to={to} state={etatFeuille(to, location)} className={classe}>{contenu}</Link>;
  if (!pliable) return <button type="button" className={classe} onClick={onClick}>{contenu}</button>;
  /* En feuille dans l'app, et sur le site au téléphone (fondateur, 2026-10-17 : « une pleine page avec le bouton retour, pas
     un dépliage dans Mon compte ») ; sur un ordinateur, le contenu se déplie sous la rangée, comme avant. */
  const enFeuille = APPLI || (typeof window !== 'undefined' && window.innerWidth <= 900);
  return (
    <div className={`account-pliable${ouverte ? ' ouverte' : ''}`}>
      <button type="button" className={classe} onClick={onClick} aria-expanded={ouverte}>{contenu}</button>
      {ouverte && !enFeuille && <div className="account-panneau">{children}</div>}
      {ouverte && enFeuille && (
        <SousEcran titre={typeof titre === 'string' ? titre : ''} onFermer={onClick}>
          {/* « card » : tout ce que la CSS règle « dans une carte » (sélecteur de langue, tableaux…) vaut aussi dans la feuille. */}
          <div className="card account-panneau account-panneau--feuille">{children}</div>
        </SousEcran>
      )}
    </div>
  );
}
