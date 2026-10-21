import { useEffect, useMemo, useRef, useState } from 'react';
import Icone from '../../components/Icone';
import { Link, useNavigate } from 'react-router-dom';
import { api } from '../../api';
import { platBio, platVegan, platHalal, platSansGluten, restoBio, restoVegan, restoHalal, restoSansGluten } from '../../dietary';
import { useAuth } from '../../context/AuthContext';
import { COMMUNES, COMMUNES_SUGGEREES, RESTAURANT_TYPES, illustrationCuisine, restaurantTypeLabel } from '../../menuCategories';
import usePageMeta from '../../hooks/usePageMeta';
import { useLanguage } from '../../context/LanguageContext';
import { euros } from '../../prixPlat';
import { experienceApp } from '../../natif';
import { lireRecherches, retenirRecherche, effacerRecherches } from '../../recherchesRecentes';
import { RouteVelo } from '../../components/TeteListe';
import { lienFiche } from '../../murCompte';
import VisuelVide from '../../components/VisuelVide';
import ErreurChargement from '../../components/ErreurChargement';
import CertifiedBadge from '../../components/CertifiedBadge';
import { imgProps, cacherImageCassee } from '../../images';
import ErreurChargement from '../../components/ErreurChargement';
import { normaliserRecherche } from '../../normaliserRecherche';
import '../../ecran-liste.css';
import '../../site-liste.css';

// Recherche transversale — un seul champ, tout ce que Fairide sait chercher.
//
// La liste des restaurants a son propre champ, qui ne filtre que les restaurants. Ici, la même
// saisie interroge d'un coup les commerces, les plats de leurs cartes, les types de cuisine, les
// communes, les réponses du centre d'aide, les rubriques de Mon compte et — connecté — ses propres
// commandes. Quelqu'un qui tape « tiramisu » veut un plat, pas un restaurant qui s'appellerait ainsi ;
// quelqu'un qui tape « ixelles » veut la liste filtrée sur la commune ; quelqu'un qui tape « carte
// bancaire » veut la réponse du centre d'aide. Un champ unique n'oblige pas à savoir d'avance dans
// quelle rubrique la réponse se trouve.
//
// Tout se fait côté client : GET /restaurants renvoie déjà les cartes complètes (attachMenu côté
// serveur), et les autres sources sont statiques ou déjà chargées pour l'utilisateur. Un aller-retour
// par frappe n'apporterait rien ici et rendrait la saisie poisseuse.

// Les accents ne comptent pas : « creme » trouve « crème », « ixelles » trouve « Ixelles ». Ni l'apostrophe d'un iPhone, ni
// les ligatures (« boeuf » trouve « bœuf ») : normaliserRecherche.js, partagé avec la liste et la carte d'un commerce
// (audit du 19/10, discovery-21).
const normaliser = normaliserRecherche;
function contient(texte, requete) {
  return normaliser(texte).includes(requete);
}

// Réponses du centre d'aide, avec les mots par lesquels on les cherche vraiment. Le titre seul ne
// suffirait pas : personne ne tape « moyens de paiement », on tape « carte » ou « bancontact ».
const sujetsAide = (t) => [
  { to: '/aide?sujet=paiement', titre: t('search.paymentMethods'), sous: t('search.paymentMethodsSub'), mots: 'paiement payer carte bancaire visa mastercard bancontact stripe apple pay google pay solde argent rembourser remboursement' },
  { to: '/aide?sujet=titres-restaurant', titre: t('search.vouchers'), sous: t('search.vouchersSub'), mots: 'titres restaurant ticket cheque repas monizze edenred sodexo pluxee' },
  { to: '/aide', titre: t('search.deliveryAddress'), sous: t('search.deliveryAddressSub'), mots: 'adresse livraison livrer domicile rue changer' },
  { to: '/aide', titre: t('search.orderIssue'), sous: t('search.orderIssueSub'), mots: 'probleme souci commande retard erreur manquant froid remboursement suivi livreur' },
  { to: '/aide?sujet=bug', titre: t('search.reportBug'), sous: t('search.reportBugSub'), mots: 'bug bogue erreur plante marche pas probleme technique error crash fout probleem werkt niet' },
  { to: '/aide?sujet=avis', titre: t('search.feedback'), sous: t('search.feedbackSub'), mots: 'avis suggestion idee amelioration retour' },
  { to: '/aide', titre: t('search.helpContact'), sous: t('search.helpContactSub'), mots: 'aide contact question support telephone email joindre' }
];

const rubriquesCompte = (t) => [
  { to: '/orders', titre: t('search.myOrders'), sous: t('search.myOrdersSub'), mots: 'commande commandes historique suivi order orders history tracking bestelling bestellingen geschiedenis', connecte: true },
  { to: '/favorites', titre: t('search.myFavourites'), sous: t('search.myFavouritesSub'), mots: 'favoris favori coeur enregistre', connecte: true },
  { to: '/invoices', titre: t('search.myInvoices'), sous: t('search.myInvoicesSub'), mots: 'facture factures recu recus justificatif', connecte: true },
  { to: '/account', titre: t('search.myAccount'), sous: t('search.myAccountSub'), mots: 'compte profil mot de passe email telephone langue adresse parrainage code promo supprimer', connecte: true },
  { to: '/map', titre: t('search.businessMap'), sous: t('search.businessMapSub'), mots: 'carte plan autour de moi proche geolocalisation map near me nearby kaart in de buurt', connecte: true },
  { to: '/notre-histoire', titre: t('search.ourStory'), sous: t('search.ourStorySub'), mots: 'histoire mission valeurs commission equitable fairide qui sommes nous', connecte: false }
];

// Libellés lisibles des statuts de commande, pour le sous-titre des résultats.
const statuts = (t) => ({ nouveau: t('search.stNew'), preparation: t('search.stPreparing'), pret: t('search.stReady'), livraison: t('search.stDelivering'), livre: t('search.stDelivered'), refuse: t('search.stRefused'), annule: t('search.stCancelled') });

const MAX_PAR_GROUPE = 6;

export default function SearchPage() {
  const { t } = useLanguage();
  const { user, token } = useAuth();
  const navigate = useNavigate();
  usePageMeta({ title: t('seo.searchTitle'), description: t('seo.searchDescription'), path: '/recherche', robots: 'noindex, follow' });

  const [requete, setRequete] = useState('');
  const [bio, setBio] = useState(false);
  const [vegan, setVegan] = useState(false);
  // Halal et sans gluten (backend migration 042) : déclarés par le commerce, voir dietary.js.
  const [halal, setHalal] = useState(false);
  const [sansGluten, setSansGluten] = useState(false);
  const [restaurants, setRestaurants] = useState([]);
  const [commandes, setCommandes] = useState([]);
  const [chargement, setChargement] = useState(true);
  // Commerces pas lus (réseau, serveur) : « Impossible de charger », pas « Rien trouvé pour … » (audit du 19/10, discovery-19).
  const [echec, setEchec] = useState(false);
  const champ = useRef(null);

  // Le curseur est dans le champ à l'arrivée, mais SEULEMENT sur un ordinateur (souris, pas d'écran tactile) et hors de
  // l'app. Sur téléphone, le clavier s'ouvrait d'office et cachait les pastilles « Par envie », « Par commune »… qui
  // sont justement ce qu'on vient toucher (fondateur, 2026-10-17). Là, le clavier ne s'ouvre qu'en touchant le champ.
  useEffect(() => {
    const souris = window.matchMedia?.('(hover: hover) and (pointer: fine)')?.matches;
    if (souris && !experienceApp()) champ.current?.focus();
  }, []);

  const chargerCommerces = () => {
    setEchec(false); setChargement(true);
    return api('/restaurants').then(setRestaurants).catch(() => setEchec(true)).finally(() => setChargement(false));
  };
  useEffect(() => {
    chargerCommerces();
    if (token) api('/orders/mine', { token }).then(setCommandes).catch(() => {});
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [token]);

  const q = normaliser(requete);
  const filtreRegime = bio || vegan || halal || sansGluten;
  const actif = q.length >= 2 || filtreRegime;
  const platOk = (p) => (!bio || platBio(p)) && (!vegan || platVegan(p)) && (!halal || platHalal(p)) && (!sansGluten || platSansGluten(p));
  const restoOk = (r) => (!bio || restoBio(r)) && (!vegan || restoVegan(r)) && (!halal || restoHalal(r)) && (!sansGluten || restoSansGluten(r));

  const resultats = useMemo(() => {
    if (!actif) return null;
    // Le type de cuisine se cherche aussi dans la langue affichée (« Italian », « Italiaans ») : audit du 19/10, discovery-22.
    const texteOk = (r) => q.length < 2 || contient(r.name, q) || contient(r.cuisine, q) || contient(restaurantTypeLabel(r.cuisine, t), q) || contient(r.desc, q) || contient(r.neighborhood, q);
    const commerces = restaurants
      .filter((r) => restoOk(r) && texteOk(r))
      .slice(0, filtreRegime && q.length < 2 ? 30 : MAX_PAR_GROUPE);

    // Un plat par ligne, avec son commerce : on cherche « tiramisu », on veut savoir OÙ il y en a.
    const plats = [];
    for (const r of restaurants) {
      for (const p of r.menu || []) {
        if (p.available === false) continue;
        if (!platOk(p)) continue;
        if (q.length < 2 || contient(p.name, q) || contient(p.desc || p.description, q)) {
          plats.push({ restaurant: r, plat: p });
          if (plats.length >= MAX_PAR_GROUPE) break;
        }
      }
      if (plats.length >= MAX_PAR_GROUPE) break;
    }

    const cuisines = q.length < 2 ? [] : RESTAURANT_TYPES.filter((c) => contient(c.value, q) || contient(restaurantTypeLabel(c.value, t), q)).slice(0, MAX_PAR_GROUPE);
    // La recherche trouve aussi la périphérie (Tervuren…) ; les puces « Par commune » restent les 19.
    const communes = q.length < 2 ? [] : COMMUNES_SUGGEREES.filter((c) => contient(c, q)).slice(0, MAX_PAR_GROUPE);
    const aide = q.length < 2 ? [] : sujetsAide(t).filter((s) => contient(s.titre, q) || contient(s.sous, q) || contient(s.mots, q)).slice(0, MAX_PAR_GROUPE);
    const rubriques = rubriquesCompte(t)
      .filter((s) => q.length >= 2 && (!s.connecte || user) && (contient(s.titre, q) || contient(s.sous, q) || contient(s.mots, q)))
      .slice(0, MAX_PAR_GROUPE);
    const mesCommandes = commandes
      .filter((o) => q.length >= 2 && (contient(o.restaurantName || o.restaurant?.name, q) || (o.items || []).some((i) => contient(i.name, q)) || contient(String(o.id).slice(0, 8), q)))
      .slice(0, MAX_PAR_GROUPE);

    const total = commerces.length + plats.length + cuisines.length + communes.length + aide.length + rubriques.length + mesCommandes.length;
    return { commerces, plats, cuisines, communes, aide, rubriques, mesCommandes, total };
  }, [actif, q, restaurants, commandes, user, bio, vegan, halal, sansGluten]); // eslint-disable-line react-hooks/exhaustive-deps

  // Récemment (app seulement, voir recherchesRecentes.js) : le mot est retenu quand il a servi — Entrée, ou un résultat touché.
  const [recentes, setRecentes] = useState(() => (experienceApp() ? lireRecherches() : []));
  const retenir = () => { if (experienceApp() && q.length >= 2) setRecentes(retenirRecherche(requete)); };

  // Entrée sur un texte qui n'a qu'un résultat : on y va. Sur plusieurs, on ne devine pas.
  function soumettre(e) {
    e.preventDefault();
    retenir();
    if (!resultats || resultats.total !== 1) return;
    const r = resultats;
    const versFiche = (id) => { const l = lienFiche(user, id); return navigate(l.to, { state: l.state }); };
    if (r.commerces[0]) return versFiche(r.commerces[0].id);
    if (r.plats[0]) return versFiche(r.plats[0].restaurant.id);
    if (r.cuisines[0]) return navigate('/restaurants', { state: { cuisine: r.cuisines[0].value } });
    if (r.communes[0]) return navigate('/restaurants', { state: { commune: r.communes[0] } });
    if (r.aide[0]) return navigate(r.aide[0].to);
    if (r.rubriques[0]) return navigate(r.rubriques[0].to);
    if (r.mesCommandes[0]) return navigate('/orders');
    return undefined;
  }

  const prix = (p) => (typeof p.price === 'number' ? euros(p.price) : p.price ? euros(Number(p.price)) : '');

  /* LE SITE (fondateur, 2026-10-16, mockups/site-ordinateur.html, « Le cadre ») : le titre et le champ sur un bandeau iris,
   * avec la route et le vélo, et ce qu'on trouve dans la feuille blanche dessous — les commerces en cartes (grille), les
   * plats sur deux colonnes à partir de 1 100 px. Mêmes résultats, même ordre, mêmes liens. L'app garde son écran tel quel. */
  const site = !experienceApp();
  const champRecherche = (
      <form className={`recherche-champ${site ? ' sl-cherche' : ''}`} onSubmit={soumettre} role="search">
        <span className="recherche-loupe" aria-hidden="true"><Icone nom="recherche" taille={20} /></span>
        <input
          ref={champ}
          type="search"
          value={requete}
          onChange={(e) => setRequete(e.target.value)}
          placeholder={t('search.phSearch')}
          aria-label={t('search.ariaSearch')}
          autoComplete="off"
          enterKeyHint="search"
        />
        {requete && (
          <button type="button" className="recherche-effacer" onClick={() => { setRequete(''); champ.current?.focus(); }} aria-label={t('search.clear')}>✕</button>
        )}
      </form>
  );
  const pastillesRegime = filtreRegime && (
        <div className="recherche-pastilles" role="group" aria-label={t('search.dietFilters')} style={{ margin: '0 0 12px' }}>
          {bio && <button type="button" className="pill recherche-pastille active" aria-pressed onClick={() => setBio(false)}>{t('search.filterBio')} ✕</button>}
          {vegan && <button type="button" className="pill recherche-pastille active" aria-pressed onClick={() => setVegan(false)}>{t('search.filterVegan')} ✕</button>}
          {halal && <button type="button" className="pill recherche-pastille active" aria-pressed onClick={() => setHalal(false)}>{t('search.filterHalal')} ✕</button>}
          {sansGluten && <button type="button" className="pill recherche-pastille active" aria-pressed onClick={() => setSansGluten(false)}>{t('search.filterGlutenFree')} ✕</button>}
          <span className="small">{t('search.dietHint')}</span>
        </div>
  );
  const corps = (
    <>
      {/* Avant la première lettre, on montre par où commencer : les cuisines et les communes, qui sont
          ce qu'on cherche le plus, plus le chemin vers l'aide. Une page vide avec un champ ne dit
          rien de ce qu'il accepte. */}
      {/* DANS L'APP (fondateur, 2026-10-17, « Search » de mockups/commerces-marque.html) : les envies en tuiles, les régimes en
          pastilles dessous, puis les communes et l'aide comme avant. Le site garde ses pastilles. Depuis le 2026-10-21 (piste A
          de maquettes/recherche-couleurs), chaque tuile montre l'illustration en couleur de la cuisine sur son fond pastel, au
          lieu de l'icône iris dans un carré blanc sur lavande : la grille paraissait sans vie, et dix cuisines partageaient la
          même icône. */}
      {!actif && !site && (
        <>
          <h3 className="recherche-titre-app">{t('search.byCraving')}</h3>
          <div className="recherche-tuiles">
            {RESTAURANT_TYPES.slice(0, 14).map((c) => (
              <Link key={c.value} to="/restaurants" state={{ cuisine: c.value }} className="recherche-tuile" style={{ '--tuile-fond': c.fond }}>
                <img className="recherche-tuile-illu" src={illustrationCuisine(c.illustration)} alt="" width="52" height="52" decoding="async" draggable="false" />
                <span>{restaurantTypeLabel(c.value, t) || c.value}</span>
              </Link>
            ))}
          </div>
          <div className="recherche-pastilles recherche-regimes-app" role="group" aria-label={t('search.dietFilters')}>
            <button type="button" className={`pill recherche-pastille${bio ? ' active' : ''}`} aria-pressed={bio} onClick={() => setBio((v) => !v)}>{t('search.filterBio')}</button>
            <button type="button" className={`pill recherche-pastille${vegan ? ' active' : ''}`} aria-pressed={vegan} onClick={() => setVegan((v) => !v)}>{t('search.filterVegan')}</button>
            <button type="button" className={`pill recherche-pastille${halal ? ' active' : ''}`} aria-pressed={halal} onClick={() => setHalal((v) => !v)}>{t('search.filterHalal')}</button>
            <button type="button" className={`pill recherche-pastille${sansGluten ? ' active' : ''}`} aria-pressed={sansGluten} onClick={() => setSansGluten((v) => !v)}>{t('search.filterGlutenFree')}</button>
          </div>
          {recentes.length > 0 && (
            <section className="recherche-recentes" aria-labelledby="recherche-recentes-titre">
              <div className="recherche-recentes-tete">
                <h3 className="recherche-titre-app" id="recherche-recentes-titre">{t('search.recentTitle')}</h3>
                <button type="button" className="recherche-recentes-effacer" onClick={() => { effacerRecherches(); setRecentes([]); }}>{t('search.recentClear')}</button>
              </div>
              {recentes.map((mot) => (
                // Toucher un mot le remet dans le champ : les résultats s'affichent comme si on venait de le taper.
                <button key={mot} type="button" className="recherche-recente" onClick={() => setRequete(mot)}>
                  <Icone nom="horloge" taille={17} /><span>{mot}</span>
                </button>
              ))}
            </section>
          )}
          <h3 className="recherche-titre-app">{t('search.byMunicipality')}</h3>
          <div className="recherche-pastilles">
            {COMMUNES.map((c) => (
              <Link key={c} to="/restaurants" state={{ commune: c }} className="pill recherche-pastille">{c}</Link>
            ))}
          </div>
          <h3 className="recherche-titre-app">{t('search.aQuestion')}</h3>
          <div className="recherche-pastilles">
            {sujetsAide(t).slice(0, 4).map((s) => (
              <Link key={s.to + s.titre} to={s.to} className="pill recherche-pastille">{s.titre}</Link>
            ))}
          </div>
        </>
      )}
      {!actif && site && (
        <>
          <div className="card">
            <h3 className="recherche-titre-groupe">{t('search.byCraving')}</h3>
            <div className="recherche-pastilles">
              {RESTAURANT_TYPES.slice(0, 14).map((c) => (
                <Link key={c.value} to="/restaurants" state={{ cuisine: c.value }} className="pill recherche-pastille">
                  <Icone nom={c.icone} taille={16} className="icone-texte" /> {restaurantTypeLabel(c.value, t) || c.value}
                </Link>
              ))}
              <button type="button" className={`pill recherche-pastille${bio ? ' active' : ''}`} aria-pressed={bio} onClick={() => setBio((v) => !v)}>{t('search.filterBio')}</button>
              <button type="button" className={`pill recherche-pastille${vegan ? ' active' : ''}`} aria-pressed={vegan} onClick={() => setVegan((v) => !v)}>{t('search.filterVegan')}</button>
              <button type="button" className={`pill recherche-pastille${halal ? ' active' : ''}`} aria-pressed={halal} onClick={() => setHalal((v) => !v)}>{t('search.filterHalal')}</button>
              <button type="button" className={`pill recherche-pastille${sansGluten ? ' active' : ''}`} aria-pressed={sansGluten} onClick={() => setSansGluten((v) => !v)}>{t('search.filterGlutenFree')}</button>
            </div>
          </div>
          <div className="card">
            <h3 className="recherche-titre-groupe">{t('search.byMunicipality')}</h3>
            <div className="recherche-pastilles">
              {COMMUNES.map((c) => (
                <Link key={c} to="/restaurants" state={{ commune: c }} className="pill recherche-pastille">{c}</Link>
              ))}
            </div>
          </div>
          <div className="card">
            <h3 className="recherche-titre-groupe">{t('search.aQuestion')}</h3>
            <div className="recherche-pastilles">
              {sujetsAide(t).slice(0, 4).map((s) => (
                <Link key={s.to + s.titre} to={s.to} className="pill recherche-pastille">{s.titre}</Link>
              ))}
            </div>
          </div>
        </>
      )}

      {actif && chargement && <p className="small">{t('search.searching')}</p>}

      {actif && !chargement && echec && restaurants.length === 0 && <ErreurChargement onReessayer={chargerCommerces} />}
      {actif && !chargement && resultats.total === 0 && !(echec && restaurants.length === 0) && (
        <div className="card">
          <p style={{ margin: '0 0 6px', fontWeight: 600 }}>{t('search.nothingFor', { q: requete })}</p>
          <p className="small" style={{ margin: 0 }}>
            {t('search.tryOther')} <Link to="/aide">{t('search.theHelp')}</Link>.
          </p>
        </div>
      )}

      {actif && !chargement && resultats.total > 0 && (
        <>
          {site && resultats.commerces.length > 0 && (
            <section className="sl-res-commerces">
              <h3 className="recherche-titre-groupe">{t('search.businesses')}</h3>
              <div className="rest-grid sl-grille">
                {resultats.commerces.map((r) => <CarteCommerce key={r.id} r={r} t={t} lien={lienFiche(user, r.id, r.name)} />)}
              </div>
            </section>
          )}
          {!site && (
            <Groupe titre={t('search.businesses')} quand={resultats.commerces.length}>
              {resultats.commerces.map((r) => (
                <Ligne key={r.id} {...lienFiche(user, r.id, r.name)} image={r.coverImageUrl} icone="commerce" titre={r.name}
                  sous={[r.cuisine && (restaurantTypeLabel(r.cuisine, t) || r.cuisine), r.commune].filter(Boolean).join(' · ')} />
              ))}
            </Groupe>
          )}
          <Groupe titre={t('search.dishes')} quand={resultats.plats.length}>
            {resultats.plats.map(({ restaurant, plat }) => (
              <Ligne key={`${restaurant.id}-${plat.id || plat.name}`} {...lienFiche(user, restaurant.id, restaurant.name)} image={plat.imageUrl} icone="restaurants"
                titre={plat.name} sous={`${restaurant.name}${prix(plat) ? ` · ${prix(plat)}` : ''}`} />
            ))}
          </Groupe>
          <Groupe titre={t('search.cuisineTypes')} quand={resultats.cuisines.length}>
            {resultats.cuisines.map((c) => (
              <Ligne key={c.value} to="/restaurants" state={{ cuisine: c.value }} icone={<Icone nom={c.icone} taille={20} />} titre={restaurantTypeLabel(c.value, t) || c.value} sous={t('search.seeTypeBusinesses')} />
            ))}
          </Groupe>
          <Groupe titre={t('search.municipalities')} quand={resultats.communes.length}>
            {resultats.communes.map((c) => (
              <Ligne key={c} to="/restaurants" state={{ commune: c }} icone="position" titre={c} sous={t('search.seeMunicipalityBusinesses')} />
            ))}
          </Groupe>
          <Groupe titre={t('search.myOrders')} quand={resultats.mesCommandes.length}>
            {resultats.mesCommandes.map((o) => (
              <Ligne key={o.id} to="/orders" icone="commandes" titre={o.restaurantName || o.restaurant?.name || 'Commande'}
                sous={[statuts(t)[o.status] || o.status, o.total != null ? euros(Number(o.total)) : null].filter(Boolean).join(' · ')} />
            ))}
          </Groupe>
          <Groupe titre={t('search.help')} quand={resultats.aide.length}>
            {resultats.aide.map((s) => <Ligne key={s.to + s.titre} to={s.to} icone="bouee" titre={s.titre} sous={s.sous} />)}
          </Groupe>
          <Groupe titre={t('search.myAccount')} quand={resultats.rubriques.length}>
            {resultats.rubriques.map((s) => <Ligne key={s.to} to={s.to} icone="compte" titre={s.titre} sous={s.sous} />)}
          </Groupe>
        </>
      )}
    </>
  );

  /* L'APP (fondateur, 2026-10-17, « Search » de mockups/commerces-marque.html) : le titre et le champ sur le bandeau iris,
     comme Favoris et Mon compte, le reste dans la feuille blanche. Pas de « bleu sur bleu » : dans l'app, aucun en-tête iris
     ne se pose au-dessus (le site, lui, garde son écran ci-dessous). */
  if (!site) {
    return (
      <div className="ecran-bandeau recherche-app">
        <div className="eb-bandeau">
          <h1 className="eb-titre">{t('search.title')}</h1>
          {champRecherche}
        </div>
        {/* Un résultat touché après avoir tapé : le mot rejoint « Récemment ». */}
        <div className="eb-feuille" onClickCapture={(e) => { if (e.target.closest('a')) retenir(); }}>
          {pastillesRegime}
          {corps}
        </div>
      </div>
    );
  }
  return (
    <div className="ecran-bandeau sl-recherche">
      <div className="eb-bandeau sl-bande">
        <h1 className="sl-bande-ctx"><Icone nom="recherche" taille={16} />{t('search.title')}</h1>
        {champRecherche}
        <RouteVelo className="sl-bande-route" />
      </div>
      <div className="eb-feuille sl-feuille">
        {pastillesRegime}
        {corps}
      </div>
    </div>
  );
}

// Un commerce trouvé, sur le site : la carte de la liste des commerces (photo, nom, cuisine · quartier), sans le cœur — la
// recherche ne charge pas les favoris. Même destination que la ligne de l'app : la fiche du commerce.
function CarteCommerce({ r, t, lien }) {
  return (
    <Link to={lien.to} state={lien.state} className="rest-card rc">
      <div className="rc-media">
        <VisuelVide nom={r.name} cuisine={r.cuisine} />
        {r.coverImageUrl && <img loading="lazy" decoding="async" {...imgProps(r.coverImageUrl, 480, '(max-width: 640px) 50vw, 280px')} alt="" className="rc-photo" onError={cacherImageCassee} />}
      </div>
      <div className="rc-corps">
        <h4 className="rest-card-name rc-nom"><span className="rest-card-name-text">{r.name}</span>{r.certified && <CertifiedBadge />}</h4>
        <p className="rc-sous">{[r.cuisine && (restaurantTypeLabel(r.cuisine, t) || r.cuisine), r.neighborhood || r.commune].filter(Boolean).join(' · ')}</p>
      </div>
    </Link>
  );
}

function Groupe({ titre, quand, children }) {
  if (!quand) return null;
  return (
    <section className="card recherche-groupe">
      <h3 className="recherche-titre-groupe">{titre}</h3>
      <div className="recherche-lignes">{children}</div>
    </section>
  );
}

// Même dessin que les rangées de Mon compte, pour qu'un résultat se lise comme une destination et
// non comme une carte de plus. Même contrat d'icône aussi : une chaîne est un NOM de tracé
// (Icone.jsx), tout autre nœud est rendu tel quel — ce qui laisse passer l'emoji d'un type de
// cuisine, qui est du contenu et pas de l'interface.
function Ligne({ to, state, image, icone, titre, sous }) {
  return (
    <Link to={to} state={state} className="account-link-row recherche-ligne">
      {image ? (
        <img className="recherche-vignette" {...imgProps(image, 96)} alt="" loading="lazy" decoding="async" />
      ) : (
        <span className="account-link-icon" aria-hidden="true">
          {typeof icone === 'string' ? <Icone nom={icone} taille={22} /> : icone}
        </span>
      )}
      <span className="account-link-text">
        <b>{titre}</b>
        {sous && <span className="small">{sous}</span>}
      </span>
      <span className="account-link-chevron" aria-hidden="true">›</span>
    </Link>
  );
}
