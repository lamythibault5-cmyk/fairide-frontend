import { Link } from 'react-router-dom';
import Icone from './Icone';
import { useCart } from '../context/CartContext';
import { useLanguage } from '../context/LanguageContext';
import { euros } from '../prixPlat';

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
// `children` : l'action n'est pas toujours un lien. Un écran d'échec propose de REFAIRE ce qui vient
// d'échouer — un bouton, pas une destination — et `actionVers` ne sait exprimer qu'une destination.
// Le reste de la forme (icône, titre, phrase, une seule action) ne change pas pour autant.
/* LE VÉLO QUI ATTEND (fondateur, 2026-10-16, version 4B de maquettes/autres-idees/autres-idees.html). Sur les écrans vides qui occupent
 * toute la page (Mes commandes, Mes favoris, le panier) : `scene` remplace le rond gris par le vélo de la marque qui
 * arrive sur sa route pointillée et attend, à côté d'un repère qui dit ce qui manque (la position pour une commande,
 * le cœur pour un favori, le sac pour le panier). C'est le logo en SVG : rien à charger. Le bouton passe en lime. */
// Le commerce et le livreur aussi depuis le 2026-10-27 (réponse 7 de maquettes/ecrans-pro : « le vélo qui attend partout ») :
// l'étiquette d'une promotion, le document d'une facture.
const REPERES = { commandes: 'position', favoris: 'favoris', panier: 'sac', promos: 'etiquette', factures: 'document' };
const CHEMINS_REPERE = {
  position: <><path d="M12 21s7-5.6 7-11a7 7 0 1 0-14 0c0 5.4 7 11 7 11Z" /><circle cx="12" cy="10" r="2.6" /></>,
  favoris: <path d="M12 20s-7-4.4-7-9.3A4 4 0 0 1 12 8a4 4 0 0 1 7 2.7C19 15.6 12 20 12 20Z" />,
  sac: <><path d="M5 8h14l-1 12a1 1 0 0 1-1 .9H7a1 1 0 0 1-1-.9L5 8Z" /><path d="M9 8V6a3 3 0 0 1 6 0v2" /></>,
  etiquette: <><path d="M20 12.6 12.6 20a1.6 1.6 0 0 1-2.3 0L4 13.7V4h9.7l6.3 6.3a1.6 1.6 0 0 1 0 2.3Z" /><circle cx="8.5" cy="8.5" r="1.6" /></>,
  document: <><path d="M7 3h7l4 4v14H7Z" /><path d="M14 3v4h4" /><path d="M10 12h5M10 16h5" /></>,
};
function Scene({ genre }) {
  const repere = REPERES[genre] || 'position';
  return (
    <svg className="etat-vide-scene" viewBox="0 0 280 140" aria-hidden="true">
      <line className="ev-route" x1="14" y1="123" x2="266" y2="123" strokeWidth="3" strokeLinecap="round" strokeDasharray="8 8" />
      <g transform={repere === 'favoris' ? 'translate(214 58) scale(1.75)' : 'translate(214 74) scale(1.75)'}>
        <g className={repere === 'favoris' ? 'ev-flotte' : undefined}>
          <g className="ev-apparait" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">{CHEMINS_REPERE[repere]}</g>
        </g>
      </g>
      <g transform="translate(70 68) scale(1.25)">
        <g className="ev-velo"><g className="ev-bob">
          <g fill="none" stroke="currentColor" strokeWidth="5" strokeLinecap="round"><circle cx="15" cy="29" r="12.5" /><circle cx="61" cy="29" r="12.5" /></g>
          <g fill="currentColor"><rect x="16" y="8" width="44" height="5" rx="2.5" /><g transform="rotate(42 27 22.5)"><rect x="13" y="20" width="28" height="5" rx="2.5" /></g></g>
        </g></g>
      </g>
    </svg>
  );
}

/* `reprendre` : UN PANIER ATTEND (fondateur, 2026-10-25, maquettes/une-action/panier-et-site, réponse 2). Mes commandes ou Mes
 * favoris vides, avec des plats dans le panier : le geste évident n'est plus « Parcourir les commerces » mais « Reprendre mon
 * panier · 38,10 € ». La bulle du panier s'efface alors (styles.css, .etat-vide-reprendre) : un seul geste à l'écran. */
export default function EtatVide({ icone, titre, texte, actionVers, actionTexte, children, scene, reprendre = false }) {
  const cart = useCart();
  const { t } = useLanguage();
  const reprend = reprendre && cart.count > 0;
  const vers = reprend ? '/panier' : actionVers;
  const libelle = reprend ? t('panier.resume', { amount: euros(cart.sousTotal) }) : actionTexte;
  return (
    <div className={`etat-vide${scene ? ' etat-vide--scene' : ''}`}>
      {scene ? <Scene genre={scene} /> : <span className="etat-vide-icone" aria-hidden="true"><Icone nom={icone} taille={34} /></span>}
      <b className="etat-vide-titre">{titre}</b>
      {texte && <p className="etat-vide-texte">{texte}</p>}
      {vers && libelle && (
        <Link to={vers} className={`${scene ? 'btn-gold' : 'btn-teal'} etat-vide-action${reprend ? ' etat-vide-reprendre' : ''}`}>{libelle}</Link>
      )}
      {children && <div className="etat-vide-actions">{children}</div>}
    </div>
  );
}
