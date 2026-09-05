import { Link } from 'react-router-dom';

// Une rangée de menu : icône, titre, sous-titre, et à droite un chevron ou une action. Le même dessin
// partout dans l'espace connecté — la page Mon compte, les statuts en tête des tableaux de bord du
// restaurateur et du livreur — pour que l'œil reconnaisse la forme d'une page à l'autre.
//
// Quatre variantes selon les props :
// - `to`        : un lien vers une page.
// - `onClick`   : une action (ouvrir l'assistant, partager). Un <button>, pas un <a href="#"> déguisé —
//                 un lien qui ne mène nulle part est annoncé comme tel par les lecteurs d'écran et
//                 s'ouvre dans un nouvel onglet au clic du milieu.
// - `children`  : une rangée qui se DÉPLIE (`ouverte`, `onClick` pour basculer) et montre un
//                 formulaire ou une explication en dessous.
// - `action`    : une rangée d'état, statique, avec un bouton à droite (« Configurer », « Pause »).
//
// `accent` colore la pastille de l'icône pour les rangées d'état : 'ok', 'warn', 'danger'.
export default function LigneCompte({ to, onClick, icone, titre, sous, danger = false, ouverte = false, children, action, accent }) {
  const pliable = children !== undefined;
  const contenu = (
    <>
      <span className={`account-link-icon${accent ? ` account-link-icon--${accent}` : ''}`} aria-hidden="true">{icone}</span>
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
  if (to) return <Link to={to} className={classe}>{contenu}</Link>;
  if (!pliable) return <button type="button" className={classe} onClick={onClick}>{contenu}</button>;
  return (
    <div className={`account-pliable${ouverte ? ' ouverte' : ''}`}>
      <button type="button" className={classe} onClick={onClick} aria-expanded={ouverte}>{contenu}</button>
      {ouverte && <div className="account-panneau">{children}</div>}
    </div>
  );
}
