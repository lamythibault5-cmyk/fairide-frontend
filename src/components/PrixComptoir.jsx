import { useLanguage } from '../context/LanguageContext';
import Icone from './Icone';

// BADGE « PRIX DU COMPTOIR » (fondateur, 2026-10-19 : « faire fortement envie aux commerces de garder leurs prix magasin »).
// Sur la liste, la recherche et la fiche d'un commerce dont la carte affiche AUJOURD'HUI les prix de son comptoir : prix
// relevés en magasin par l'équipe ET aucune hausse (restaurant.prixComptoir, prixMagasin.prixDuComptoir côté serveur). Un
// commerce qui monte ses prix, ou dont l'équipe retire la coche, le perd tout seul.
//
// Il ne parle jamais de commission (fondateur, 2026-10-19 : dans l'app, le client ne voit pas que Fairide prend une part) :
// il dit seulement un fait vérifié sur CE commerce. L'explication est dans le titre (survol) et lue par les lecteurs d'écran ;
// l'aide (« Les prix sont-ils les mêmes qu'au restaurant ? ») la développe.
export default function PrixComptoir() {
  const { t } = useLanguage();
  return (
    <span className="prix-comptoir" title={t('common.prixComptoirTitre')}>
      <Icone nom="etiquette" taille={13} />
      {t('common.prixComptoir')}
      <span className="sr-only">. {t('common.prixComptoirTitre')}</span>
    </span>
  );
}
