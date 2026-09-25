import usePageMeta from '../../hooks/usePageMeta';
import Rich from '../../components/Rich';
import { useLanguage } from '../../context/LanguageContext';

/* « Comment nous classons les commerces » et « comment fonctionnent les avis » (backlog C5 du 23/09/2026).
 *
 * CDE VI.45/1 et règlement P2B art. 5 : une place de marché dit quels paramètres déterminent l'ordre
 * d'affichage et leur importance ; CDE VI.99-VI.100 : elle dit si et comment les avis sont vérifiés.
 *
 * CHAQUE PHRASE DE CETTE PAGE DÉCRIT LE CODE, vérifié le 23/09/2026 :
 *   - ordre « recommandé » : pages/client/RestaurantList.jsx (anneaux de communes, puis ordre du serveur,
 *     le plus récemment inscrit d'abord — routes/restaurants.js calculerListe, ORDER BY created_at DESC) ;
 *   - tris « mieux notés » et « plus proches » : même fichier, `tri` ;
 *   - rangées de l'accueil : même fichier (nearbyList, offersList, parMention, discoverList, 10 km, completer) ;
 *   - avis : routes/reviews.js (client de la commande, commande remise, un avis par commande) et
 *     routes/admin.js DELETE /admin/reviews/:id (retrait par l'équipe) ;
 *   - aucune donnée de placement payant n'existe en base.
 * Si l'un de ces fichiers change, cette page change dans le même commit. */
const SECTIONS = ['order', 'sorts', 'rows', 'notPaid', 'reviews', 'contest'];

export default function RankingPage() {
  const { t } = useLanguage();
  usePageMeta({ title: t('conformite.rankingPageTitle'), description: t('conformite.rankingPageDescription'), path: '/classement' });
  return (
    <div className="card">
      <h2 style={{ marginTop: 0 }}>{t('conformite.rankingTitle')}</h2>
      {SECTIONS.map((s) => (
        <div key={s}>
          <h3>{t(`conformite.ranking_${s}Title`)}</h3>
          <p className="small" style={{ whiteSpace: 'pre-line' }}><Rich text={t(`conformite.ranking_${s}`)} /></p>
        </div>
      ))}
    </div>
  );
}
