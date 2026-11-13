import usePageMeta from '../../hooks/usePageMeta';
import Rich from '../../components/Rich';
import { useLanguage } from '../../context/LanguageContext';

/* « Comment nous classons les commerces » (backlog C5 du 23/09/2026).
 *
 * CDE VI.45/1 et règlement P2B art. 5 : une place de marché dit quels paramètres déterminent l'ordre
 * d'affichage et leur importance. La partie « comment fonctionnent les avis » (CDE VI.99-VI.100) est partie avec les
 * avis clients, retirés le 22/10/2026 (fondateur : pas assez d'utilisateurs, des commerces avec peu d'étoiles feraient
 * mauvaise impression ; on les refera peut-être plus tard) : s'ils reviennent, elle revient avec eux.
 *
 * CHAQUE PHRASE DE CETTE PAGE DÉCRIT LE CODE, revérifié le 21/10/2026 (audit du 19/10, discovery-05) :
 *   - liste filtrée : pages/client/RestaurantList.jsx `list` (anneaux de communes autour de `homeCommune` : ville du compte,
 *     sinon son code postal, sinon `communeProche` de l'accueil ; puis ordre du serveur, routes/restaurants.js calculerListe,
 *     ORDER BY is_demo ASC, created_at DESC). Recherche (SearchPage.jsx) et carte (MapPage.jsx) : ordre du serveur tel quel ;
 *   - tri « plus proches » : masqué (TRI = false ; plus de tri « mieux notés » depuis le 22/10/2026), d'où « pas d'autre tri » ; filtre par prix retiré, filtres
 *     bio, vegan, halal, sans gluten et rangées Bio et Vegan masqués (MENTIONS_ALIMENTAIRES = false, dietary.js), « à emporter »
 *     aussi (FILTRE_EMPORTER = false) : ni la liste des filtres ni celle des rangées ne les citent plus (21/10/2026) ;
 *   - rangées : même fichier (aLaUne + ownCover, nearbyList (PROCHES_MAX = 8) + completer, RangeeDemandes,
 *     livraisonOfferte / livraisonPasCher, offersList, rangeesCuisine, parMention, envies, groceryList, tous) et
 *     accueilRangees.js (accueil plein, 2026-11-12) : bandes de distance BANDES_KM, tour tiré par visite dans une bande,
 *     règle « une tête par rangée » limitée au même groupe (ouvert / fermé ; dans « Tous » : commandable, ouvert, fermé)
 *     et à la même bande, rangées par envie (rangeesEnvies : ENVIE_MIN, ENVIES_MAX, PAR_RANGEE_ENVIE, catégories exclues) ;
 *     `ranger` : position payée (epingler) après tout cela ; une position 'discover' va dans « Tous » ;
 *   - positions payées : misesEnAvant.js `epingler` (admissibles) et routes/placements.js côté API (commune du commerce,
 *     1 à 10 positions, une place par commerce et par rangée, mode automatique).
 * Si l'un de ces fichiers change, cette page change dans le même commit. */
const SECTIONS = ['order', 'sorts', 'rows', 'notPaid', 'contest'];

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
