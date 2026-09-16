import { Link } from 'react-router-dom';
import GameSwitcher from '../../components/GameSwitcher';
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
// Le retour est explicite, en tête de page : on est venu du suivi, on doit pouvoir y retourner sans
// chercher — la barre du bas mènerait ailleurs.
export default function JeuxPage() {
  const { t } = useLanguage();
  usePageMeta({ title: `${t('games.pageTitle')} · Fairide`, path: '/jeux' });

  return (
    <div className="jeux-page">
      <div className="jeux-entete">
        <Link to="/orders" className="jeux-retour">
          <Icone nom="commandes" taille={18} />{t('games.backToOrders')}
        </Link>
        <h1 className="page-title" style={{ margin: 0 }}>{t('games.pageTitle')}</h1>
        <p className="small" style={{ margin: '4px 0 0' }}>{t('games.pageSub')}</p>
      </div>
      <div className="jeux-terrain">
        <GameSwitcher fill large />
      </div>
    </div>
  );
}
