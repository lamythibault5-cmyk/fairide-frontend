import usePageMeta from '../../hooks/usePageMeta';
import Rich from '../../components/Rich';
import { useLanguage } from '../../context/LanguageContext';

/* « Comment nous classons les commerces » et « comment fonctionnent les avis » (backlog C5 du 23/09/2026).
 *
 * CDE VI.45/1 et règlement P2B art. 5 : une place de marché dit quels paramètres déterminent l'ordre
 * d'affichage et leur importance ; CDE VI.99-VI.100 : elle dit si et comment les avis sont vérifiés.
 *
 * CHAQUE PHRASE DE CETTE PAGE DÉCRIT LE CODE, revérifié le 21/10/2026 (audit du 19/10, discovery-05) :
 *   - liste filtrée : pages/client/RestaurantList.jsx `list` (anneaux de communes autour de `homeCommune` : ville du compte,
 *     sinon son code postal, sinon `communeProche` de l'accueil ; puis ordre du serveur, routes/restaurants.js calculerListe,
 *     ORDER BY is_demo ASC, created_at DESC). Recherche (SearchPage.jsx) et carte (MapPage.jsx) : ordre du serveur tel quel ;
 *   - tris « mieux notés » / « plus proches » et prix : masqués (TRI_ET_PRIX = false), d'où « pas d'autre tri » ;
 *   - rangées : même fichier (aLaUne + ownCover, inscrits = GET /restaurants/landing et son score, nearbyList + completer,
 *     enviesList, livraisonOfferte / livraisonPasCher, offersList, rangeesCuisine, parMention, groceryList, discoverList) ;
 *     `epinglerOuMelanger` : hasard par commune sans position payée, ordre propre de la rangée sinon ;
 *   - positions payées : misesEnAvant.js `epingler` (admissibles) et routes/placements.js côté API (commune du commerce,
 *     1 à 10 positions, une place par commerce et par rangée, mode automatique) ;
 *   - avis : routes/reviews.js (client de la commande, commande remise, un avis par commande) et
 *     routes/admin.js DELETE /admin/reviews/:id (retrait par l'équipe).
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
