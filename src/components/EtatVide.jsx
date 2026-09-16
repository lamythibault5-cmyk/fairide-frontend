import { Link } from 'react-router-dom';
import Icone from './Icone';

// Un écran vide qui dit quoi faire, plutôt qu'une phrase dans un cadre en pointillés.
//
// La classe .empty fait très bien ce pour quoi elle a été écrite : signaler qu'une liste est vide,
// en une ligne, au milieu d'une page qui contient autre chose. Mais quand le vide occupe TOUTE la
// page — aucune commande, aucun favori, aucun panier — une ligne de texte gris dans un rectangle
// en pointillés ressemble à une panne. Ici : une icône assez grande pour se voir, une phrase qui
// nomme ce qui manque, une seconde qui dit comment le remplir, et un seul bouton pour le faire.
//
// C'est la forme des écrans vides de l'application dont le fondateur a fourni les captures, et elle
// tient en quatre éléments — pas d'illustration à dessiner, pas d'image à charger.
export default function EtatVide({ icone, titre, texte, actionVers, actionTexte }) {
  return (
    <div className="etat-vide">
      <span className="etat-vide-icone" aria-hidden="true"><Icone nom={icone} taille={34} /></span>
      <b className="etat-vide-titre">{titre}</b>
      {texte && <p className="etat-vide-texte">{texte}</p>}
      {actionVers && actionTexte && (
        <Link to={actionVers} className="btn-teal etat-vide-action">{actionTexte}</Link>
      )}
    </div>
  );
}
