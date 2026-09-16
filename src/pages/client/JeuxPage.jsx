import { Link, useLocation } from 'react-router-dom';
import GameSwitcher from '../../components/GameSwitcher';
import SuiviEnCours from '../../components/SuiviEnCours';
import usePageMeta from '../../hooks/usePageMeta';
import { useLanguage } from '../../context/LanguageContext';
import Icone from '../../components/Icone';

// Les mini-jeux, sur leur propre page.
//
// Ils vivaient serrés dans une colonne à côté de la carte de suivi : un terrain de 140 px de large
// pendant qu'on regarde un livreur avancer. On y jouait mal, et surtout on ne pouvait pas faire
// autrement — les jeux étaient posés là, qu'on les veuille ou non.
//
// Maintenant c'est un choix : un bouton dans le suivi de commande amène ici, et ici le terrain a
// toute la page. Celui qui attend sa commande sans envie de jouer ne voit qu'un bouton ; celui qui
// veut jouer a un vrai jeu.
//
// ON N'A PLUS BESOIN D'UNE COMMANDE POUR JOUER. Cette page n'a jamais rien lu d'une commande : elle
// montre trois jeux, c'est tout. Mais son unique porte d'entrée était un bouton du suivi de
// livraison, ce qui la rendait inaccessible tant qu'on n'avait rien commandé. La carte en ouvre une
// seconde, ouverte en permanence.
//
// Le retour est explicite, en tête de page, et il mène là d'où l'on vient — le suivi de commande ou
// la carte. La barre du bas mènerait ailleurs, et sur cette page qui occupe tout l'écran, repartir
// au hasard est le seul vrai risque.
export default function JeuxPage() {
  const { t } = useLanguage();
  const location = useLocation();
  usePageMeta({ title: `${t('games.pageTitle')} · Fairide`, path: '/jeux' });

  // `state.from` est posé par le lien d'où l'on vient. Sans lui — lien partagé, page rechargée,
  // ouverture directe — on repart vers la carte, qui est désormais l'entrée principale des jeux.
  const venuDesCommandes = location.state?.from === '/orders';
  const retourVers = venuDesCommandes ? '/orders' : '/map';

  return (
    <div className="jeux-page">
      <div className="jeux-entete">
        <Link to={retourVers} className="jeux-retour">
          <Icone nom={venuDesCommandes ? 'commandes' : 'carte'} taille={18} />
          {venuDesCommandes ? t('games.backToOrders') : t('games.backToMap')}
        </Link>
        <h1 className="page-title" style={{ margin: 0 }}>{t('games.pageTitle')}</h1>
        <p className="small" style={{ margin: '4px 0 0' }}>{t('games.pageSub')}</p>
      </div>
      {/* LE SUIVI VIENT AU JOUEUR. Il fallait sortir du jeu pour savoir où en était sa commande —
          et la partie était perdue. Le panneau ne rend rien quand rien n'est en cours, auquel cas
          le terrain récupère toute la largeur sans qu'aucune règle ne change. */}
      <div className="jeux-corps">
        {/* Le suivi AVANT le terrain dans le document, et non apres : sur telephone il s'affiche
            au-dessus, et l'ordre de lecture au clavier comme au lecteur d'ecran doit etre celui
            qu'on voit. Un column-reverse aurait inverse l'un sans l'autre. Sur grand ecran, la
            grille le place en seconde colonne sans toucher a cet ordre. */}
        <SuiviEnCours />
        <div className="jeux-terrain">
          <GameSwitcher fill large />
        </div>
      </div>
    </div>
  );
}
