import { useLanguage } from '../context/LanguageContext';
import Icone from './Icone';

// BADGE « PRIX DU COMPTOIR » (fondateur, 2026-10-19 : « faire fortement envie aux commerces de garder leurs prix magasin »).
// Sur la liste, la recherche et la fiche d'un commerce dont la carte affiche AUJOURD'HUI les prix de son comptoir : prix
// relevés en magasin par l'équipe ET aucune hausse (restaurant.prixComptoir, prixMagasin.prixDuComptoir côté serveur). Un
// commerce qui monte ses prix, ou dont l'équipe retire la coche, le perd tout seul.
//
// Il ne parle jamais de commission (fondateur, 2026-10-19 : dans l'app, le client ne voit pas que Fairide prend une part) :
// il dit seulement un fait vérifié sur CE commerce.
//
// UNE SIMPLE PASTILLE, PLUS RIEN AU TOUCHER (fondateur, 2026-10-28, maquettes/badge-ecran/badge-ecran.html). Du 27 au 28/10 il
// ouvrait une fenêtre d'explication, et le premier badge visible recevait une bulle (version D de maquettes/badge-position) :
// la bulle sortait au milieu du défilement et cachait la carte qu'elle expliquait, et toucher la carte à l'endroit du badge
// n'ouvrait plus le restaurant. Le badge est désormais expliqué une fois, avant la liste, par un écran fixe ; ici il ne reste
// que le titre (survol) et le texte des lecteurs d'écran.
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
