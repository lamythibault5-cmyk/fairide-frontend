import { useEffect, useMemo, useRef, useState } from 'react';
import Icone from '../../components/Icone';
import { Link, useLocation, useNavigate } from 'react-router-dom';
import { api } from '../../api';
import { CHEMIN_LISTE, CHEMIN_PLATS_RECHERCHE, jetonListe } from '../../resumeCarte';
import { MENTIONS_ALIMENTAIRES, platBio, platVegan, platHalal, platSansGluten, restoBio, restoVegan, restoHalal, restoSansGluten } from '../../dietary';
import { useAuth } from '../../context/AuthContext';
import { COMMUNES, COMMUNES_SUGGEREES, illustrationCuisine, restaurantTypeLabel } from '../../menuCategories';
import { CATEGORIES_CLIENT, categoriesClient, chercherSpecialites, cuisinesCommerce, iconeSpecialite, libelleCategorie, specialite } from '../../specialites';
import { ecrireEtatEcran } from '../../etatEcran';
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
import { normaliserRecherche } from '../../normaliserRecherche';
import { CarteDemanderRecherche } from '../../components/demandes/CartesDemander';
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
  { to: '/aide?sujet=adresse', titre: t('search.deliveryAddress'), sous: t('search.deliveryAddressSub'), mots: 'adresse livraison livrer domicile rue changer' },
  { to: '/aide?sujet=commande', titre: t('search.orderIssue'), sous: t('search.orderIssueSub'), mots: 'probleme souci commande retard erreur manquant froid remboursement suivi livreur' },
  { to: '/aide?sujet=bug', titre: t('search.reportBug'), sous: t('search.reportBugSub'), mots: 'bug bogue erreur plante marche pas probleme technique error crash fout probleem werkt niet' },
  { to: '/aide?sujet=avis', titre: t('search.feedback'), sous: t('search.feedbackSub'), mots: 'avis suggestion idee amelioration retour' },
  { to: '/aide', titre: t('search.helpContact'), sous: t('search.helpContactSub'), mots: 'aide contact question support telephone email joindre' }
];

const rubriquesCompte = (t) => [
  { to: '/orders', titre: t('search.myOrders'), sous: t('search.myOrdersSub'), mots: 'commande commandes historique suivi order orders history tracking bestelling bestellingen geschiedenis', connecte: true },
  { to: '/favorites', titre: t('search.myFavourites'), sous: t('search.myFavouritesSub'), mots: 'favoris favori coeur enregistre', connecte: true },
  // « Demande ton restaurant » (2026-10-26) : retrouver ses demandes, ou en faire une, depuis la recherche.
  { to: '/demandes', titre: t('demandes.mesTitre'), sous: t('demandes.rowSous'), mots: 'demande demandes demander restaurant manque manquant ajouter proposer suggerer request aanvraag', connecte: true },
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

  /* LA RECHERCHE RETROUVÉE AU RETOUR (2026-10-26, etatEcran.js) : ouvrir un résultat puis revenir effaçait le texte tapé.
     Le texte et les filtres vivent dans l'entrée d'historique de la page ; l'onglet Recherche, lui, ouvre toujours une page
     neuve (nouvelle entrée, DashboardSidebar.jsx). */
  const location = useLocation();
  const sauvee = location.state?.recherche || {};
  const [requete, setRequete] = useState(sauvee.requete || '');
  const [bio, setBio] = useState(!!sauvee.bio);
  const [vegan, setVegan] = useState(!!sauvee.vegan);
  // Halal et sans gluten (backend migration 042) : déclarés par le commerce, voir dietary.js.
  const [halal, setHalal] = useState(!!sauvee.halal);
  const [sansGluten, setSansGluten] = useState(!!sauvee.sansGluten);
  useEffect(() => {
    ecrireEtatEcran(location.key, 'recherche', { requete, bio, vegan, halal, sansGluten });
  }, [location.key, requete, bio, vegan, halal, sansGluten]);
  const [restaurants, setRestaurants] = useState([]);
  // Les plats de chaque commerce (id du commerce → plats) : la liste n'a plus les cartes (resumeCarte.js, 2026-10-24). Lus à la
  // première recherche (champ touché, mot tapé ou filtre), pas à l'ouverture : toucher une famille n'en a pas besoin.
  const [platsParCommerce, setPlatsParCommerce] = useState(null);
  const platsDemandes = useRef(false);
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
    return api(CHEMIN_LISTE, { token: jetonListe(user, token) }).then(setRestaurants).catch(() => setEchec(true)).finally(() => setChargement(false));
  };
  useEffect(() => {
    chargerCommerces();
    if (token) api('/orders/mine', { token }).then(setCommandes).catch(() => {});
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [token]);

  const chargerPlats = () => {
    if (platsDemandes.current) return;
    platsDemandes.current = true;
    api(CHEMIN_PLATS_RECHERCHE)
      .then((l) => setPlatsParCommerce(new Map((Array.isArray(l) ? l : []).map((x) => [x.id, Array.isArray(x.plats) ? x.plats : []]))))
      .catch(() => { platsDemandes.current = false; }); // réessayé à la prochaine recherche
  };

  const q = normaliser(requete);
  // « PAR ENVIE » : LES CATÉGORIES DE LA BANDE (categoriesClient, specialites.js) qui ont au moins un commerce — les 14 premiers
  // types d'avant s'affichaient même vides. Toutes tant que la liste n'est pas lue, pour ne pas sauter.
  const categories = useMemo(() => categoriesClient(restaurants), [restaurants]);
  const famillesTuiles = restaurants.length ? categories.liste : CATEGORIES_CLIENT;
  // LES COMMUNES, MÊME RÈGLE (fondateur, 2026-10-25) : seulement celles où il y a au moins un commerce — les 19
  // s'affichaient toutes et la plupart menaient à une liste vide. Une commune de la périphérie apparaît dès qu'un commerce
  // y est (la liste filtre sur `r.commune` exact). Les 19 tant que la liste n'est pas lue, pour ne pas sauter. Plus de pastilles
  // « Par commune » depuis le 2026-10-27 : elles ne servent plus qu'aux résultats d'une commune tapée.
  const communesLues = new Set(restaurants.map((r) => r.commune).filter(Boolean));
  const communesTrouvables = restaurants.length ? COMMUNES_SUGGEREES.filter((c) => communesLues.has(c)) : COMMUNES;
  const filtreRegime = bio || vegan || halal || sansGluten;
  const actif = q.length >= 2 || filtreRegime;
  const platOk = (p) => (!bio || platBio(p)) && (!vegan || platVegan(p)) && (!halal || platHalal(p)) && (!sansGluten || platSansGluten(p));
  const restoOk = (r) => (!bio || restoBio(r)) && (!vegan || restoVegan(r)) && (!halal || restoHalal(r)) && (!sansGluten || restoSansGluten(r));

  // eslint-disable-next-line react-hooks/exhaustive-deps
  useEffect(() => { if (actif) chargerPlats(); }, [actif]);

  const resultats = useMemo(() => {
    if (!actif) return null;
    // Le type de cuisine se cherche aussi dans la langue affichée (« Italian », « Italiaans ») : audit du 19/10, discovery-22.
    // Et par les mots de tous les jours depuis le 2026-10-22 (specialites.js) : « congo » trouve les commerces congolais, par
    // n'importe laquelle de leurs spécialités.
    const specialitesTrouvees = q.length < 2 ? [] : chercherSpecialites(requete, t);
    const parSpecialite = new Set(specialitesTrouvees.map((x) => x.value));
    const texteOk = (r) => q.length < 2 || contient(r.name, q) || cuisinesCommerce(r).some((c) => contient(c, q) || contient(restaurantTypeLabel(c, t), q) || parSpecialite.has(specialite(c)?.value))
      || contient(r.desc, q) || contient(r.neighborhood, q);
    const commerces = restaurants
      .filter((r) => restoOk(r) && texteOk(r))
      .slice(0, filtreRegime && q.length < 2 ? 30 : MAX_PAR_GROUPE);

    // Un plat par ligne, avec son commerce : on cherche « tiramisu », on veut savoir OÙ il y en a.
    const plats = [];
    for (const r of restaurants) {
      // `menu` : une réponse sans `?vue` (ancien serveur) ; sinon les plats lus à part.
      for (const p of (Array.isArray(r.menu) ? r.menu : platsParCommerce?.get(r.id)) || []) {
        if (p.available === false) continue;
        if (!platOk(p)) continue;
        if (q.length < 2 || contient(p.name, q) || contient(p.desc || p.description, q)) {
          plats.push({ restaurant: r, plat: p });
          if (plats.length >= MAX_PAR_GROUPE) break;
        }
      }
      if (plats.length >= MAX_PAR_GROUPE) break;
    }

    // Seulement les spécialités qu'au moins un commerce porte (cases vides cachées, 2026-10-22) : sinon « Péruvien » menait à
    // une liste vide.
    const portees = new Set(restaurants.flatMap((r) => cuisinesCommerce(r).map((c) => specialite(c)?.value)));
    const cuisines = specialitesTrouvees.filter((x) => portees.has(x.value)).slice(0, MAX_PAR_GROUPE);
    // Seulement les communes qui ont un commerce, comme les pastilles (2026-10-25) : « Uccle » ne mène plus à une liste vide.
    const communes = q.length < 2 ? [] : communesTrouvables.filter((c) => contient(c, q)).slice(0, MAX_PAR_GROUPE);
    const aide = q.length < 2 ? [] : sujetsAide(t).filter((s) => contient(s.titre, q) || contient(s.sous, q) || contient(s.mots, q)).slice(0, MAX_PAR_GROUPE);
    const rubriques = rubriquesCompte(t)
      .filter((s) => q.length >= 2 && (!s.connecte || user) && (contient(s.titre, q) || contient(s.sous, q) || contient(s.mots, q)))
      .slice(0, MAX_PAR_GROUPE);
    const mesCommandes = commandes
      .filter((o) => q.length >= 2 && (contient(o.restaurantName || o.restaurant?.name, q) || (o.items || []).some((i) => contient(i.name, q)) || contient(String(o.id).slice(0, 8), q)))
      .slice(0, MAX_PAR_GROUPE);

    const total = commerces.length + plats.length + cuisines.length + communes.length + aide.length + rubriques.length + mesCommandes.length;
    return { commerces, plats, cuisines, communes, aide, rubriques, mesCommandes, total };
  }, [actif, q, restaurants, platsParCommerce, commandes, user, bio, vegan, halal, sansGluten]); // eslint-disable-line react-hooks/exhaustive-deps

  // Récemment (app seulement, voir recherchesRecentes.js) : le mot est retenu quand il a servi — Entrée, ou un résultat touché.
  const [recentes, setRecentes] = useState(() => (experienceApp() ? lireRecherches() : []));
  const retenir = () => { if (experienceApp() && q.length >= 2) setRecentes(retenirRecherche(requete)); };

  // Entrée sur un texte qui n'a qu'un résultat : on y va. Sur plusieurs, on ne devine pas.
  function soumettre(e) {
    e.preventDefault();
    retenir();
    if (!resultats || resultats.total !== 1) return;
    const r = resultats;
    const versFiche = (commerce) => { const l = lienFiche(user, commerce); return navigate(l.to, { state: l.state }); };
    if (r.commerces[0]) return versFiche(r.commerces[0]);
    if (r.plats[0]) return versFiche(r.plats[0].restaurant);
    if (r.cuisines[0]) return navigate('/restaurants', { state: { categorie: categories.deSpecialite(r.cuisines[0].value) } });
    if (r.communes[0]) return navigate('/restaurants', { state: { commune: r.communes[0] } });
    if (r.aide[0]) return navigate(r.aide[0].to);
    if (r.rubriques[0]) return navigate(r.rubriques[0].to);
    if (r.mesCommandes[0]) return navigate('/orders');
    return undefined;
  }

  const prix = (p) => (typeof p.price === 'number' ? euros(p.price) : p.price ? euros(Number(p.price)) : '');

  /* LE SITE (fondateur, 2026-10-16, maquettes/site-ordinateur/site-ordinateur.html, « Le cadre ») : le titre et le champ sur un bandeau iris,
   * avec la route et le vélo, et ce qu'on trouve dans la feuille blanche dessous — les commerces en cartes (grille), les
   * plats sur deux colonnes à partir de 1 100 px. Mêmes résultats, même ordre, mêmes liens. L'app garde son écran tel quel. */
  const site = !experienceApp();
  const champRecherche = (
      <form className={`recherche-champ${site ? ' sl-cherche' : ''}`} onSubmit={soumettre} role="search">
        <span className="recherche-loupe" aria-hidden="true"><Icone nom="recherche" taille={20} /></span>
        <input
          ref={champ}
          onFocus={chargerPlats}
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
      {/* Avant la première lettre, on montre par où commencer : les cuisines, qui sont
          ce qu'on cherche le plus, plus le chemin vers l'aide. Une page vide avec un champ ne dit
          rien de ce qu'il accepte. */}
      {/* DANS L'APP (fondateur, 2026-10-17, « Search » de maquettes/commerces-marque/commerces-marque.html) : les envies en tuiles, les régimes en
          pastilles dessous, puis les communes et l'aide comme avant. Le site garde ses pastilles. Depuis le 2026-10-21 (piste A
          de maquettes/recherche-couleurs), chaque tuile montre l'illustration en couleur de la cuisine sur son fond pastel, au
          lieu de l'icône iris dans un carré blanc sur lavande : la grille paraissait sans vie, et dix cuisines partageaient la
          même icône. */}
      {!actif && !site && (
        <>
          <h3 className="recherche-titre-app">{t('search.byCraving')}</h3>
          <div className="recherche-tuiles">
            {famillesTuiles.map((f) => (
              <Link key={f.cle} to="/restaurants" state={{ famille: f.cle }} className="recherche-tuile" style={{ '--tuile-fond': f.fond }}>
                <img className="recherche-tuile-illu" src={illustrationCuisine(f.illustration)} alt="" width="52" height="52" decoding="async" draggable="false" />
                <span>{libelleCategorie(f.cle, t)}</span>
              </Link>
            ))}
          </div>
          {/* Bio, Vegan, Halal, Sans gluten : masqués pour le moment (MENTIONS_ALIMENTAIRES, dietary.js). */}
          {MENTIONS_ALIMENTAIRES && (
          <div className="recherche-pastilles recherche-regimes-app" role="group" aria-label={t('search.dietFilters')}>
            <button type="button" className={`pill recherche-pastille${bio ? ' active' : ''}`} aria-pressed={bio} onClick={() => setBio((v) => !v)}>{t('search.filterBio')}</button>
            <button type="button" className={`pill recherche-pastille${vegan ? ' active' : ''}`} aria-pressed={vegan} onClick={() => setVegan((v) => !v)}>{t('search.filterVegan')}</button>
            <button type="button" className={`pill recherche-pastille${halal ? ' active' : ''}`} aria-pressed={halal} onClick={() => setHalal((v) => !v)}>{t('search.filterHalal')}</button>
            <button type="button" className={`pill recherche-pastille${sansGluten ? ' active' : ''}`} aria-pressed={sansGluten} onClick={() => setSansGluten((v) => !v)}>{t('search.filterGlutenFree')}</button>
          </div>
          )}
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
          {/* Plus de pastilles « Par commune » (fondateur, 2026-10-27 : « retire complètement les boutons des communes »,
              app et site) : taper une commune la trouve toujours (le groupe « communes » des résultats). */}
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
            {/* SUR LE SITE AUSSI, LES TUILES PASTEL (fondateur, 2026-10-21, version B de maquettes/site-illustrations) : les
                mêmes que dans l'app, avec l'illustration 2D (sans relief) au lieu de la 3D. */}
            <div className="recherche-tuiles recherche-tuiles--site">
              {famillesTuiles.map((f) => (
                <Link key={f.cle} to="/restaurants" state={{ famille: f.cle }} className="recherche-tuile" style={{ '--tuile-fond': f.fond }}>
                  <img className="recherche-tuile-illu" src={illustrationCuisine(f.illustration, { plat: true })} alt="" width="40" height="40" decoding="async" draggable="false" />
                  <span>{libelleCategorie(f.cle, t)}</span>
                </Link>
              ))}
            </div>
            {MENTIONS_ALIMENTAIRES && (
            <div className="recherche-pastilles recherche-regimes-site">
              <button type="button" className={`pill recherche-pastille${bio ? ' active' : ''}`} aria-pressed={bio} onClick={() => setBio((v) => !v)}>{t('search.filterBio')}</button>
              <button type="button" className={`pill recherche-pastille${vegan ? ' active' : ''}`} aria-pressed={vegan} onClick={() => setVegan((v) => !v)}>{t('search.filterVegan')}</button>
              <button type="button" className={`pill recherche-pastille${halal ? ' active' : ''}`} aria-pressed={halal} onClick={() => setHalal((v) => !v)}>{t('search.filterHalal')}</button>
              <button type="button" className={`pill recherche-pastille${sansGluten ? ' active' : ''}`} aria-pressed={sansGluten} onClick={() => setSansGluten((v) => !v)}>{t('search.filterGlutenFree')}</button>
            </div>
            )}
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
        <>
          <div className="card">
            <p style={{ margin: '0 0 6px', fontWeight: 600 }}>{t('search.nothingFor', { q: requete })}</p>
            <p className="small" style={{ margin: 0 }}>
              {t('search.tryOther')} <Link to="/aide">{t('search.theHelp')}</Link>.
            </p>
          </div>
          {/* « Demande ton restaurant » (fondateur, 2026-10-26) : le client vient de taper le nom qu'il cherche ; il peut le
              demander, le mot tapé déjà dans la fenêtre « Lequel ? ». Avant, il repartait et on n'apprenait rien. */}
          <CarteDemanderRecherche requete={requete} />
        </>
      )}

      {actif && !chargement && resultats.total > 0 && (
        <>
          {site && resultats.commerces.length > 0 && (
            <section className="sl-res-commerces">
              <h3 className="recherche-titre-groupe">{t('search.businesses')}</h3>
              <div className="rest-grid sl-grille">
                {resultats.commerces.map((r) => <CarteCommerce key={r.id} r={r} t={t} lien={lienFiche(user, r, r.name)} />)}
              </div>
            </section>
          )}
          {!site && (
            <Groupe titre={t('search.businesses')} quand={resultats.commerces.length}>
              {resultats.commerces.map((r) => (
                <Ligne key={r.id} {...lienFiche(user, r, r.name)} image={r.coverImageUrl} icone="commerce" titre={r.name}
                  sous={[r.cuisine && (restaurantTypeLabel(r.cuisine, t) || r.cuisine), r.commune].filter(Boolean).join(' · ')} />
              ))}
            </Groupe>
          )}
          <Groupe titre={t('search.dishes')} quand={resultats.plats.length}>
            {resultats.plats.map(({ restaurant, plat }, i) => (
              <Ligne key={`${restaurant.id}-${plat.id || plat.name}-${i}`} {...lienFiche(user, restaurant, restaurant.name)} image={plat.imageUrl} icone="restaurants"
                titre={plat.name} sous={`${restaurant.name}${prix(plat) ? ` · ${prix(plat)}` : ''}`} />
            ))}
          </Groupe>
          <Groupe titre={t('search.cuisineTypes')} quand={resultats.cuisines.length}>
            {resultats.cuisines.map((c) => (
              // Plus de rangée de spécialités sous la bande (2026-10-27) : la ligne ouvre la catégorie où elle se trouve, et le dit.
              <Ligne key={c.value} to="/restaurants" state={{ categorie: categories.deSpecialite(c.value) }} icone={<Icone nom={iconeSpecialite(c.value)} taille={20} />} titre={restaurantTypeLabel(c.value, t) || c.value}
                sous={t('search.seeCategory', { categorie: libelleCategorie(categories.deSpecialite(c.value), t) })} />
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

  /* LE VÉLO (fondateur, 2026-10-24, version A de maquettes/commandes-recherche, « site pareil que l'app ») : la route sous le
     champ, dans l'app comme sur le site. Il avance quand on fait défiler, et d'un cran par lettre tapée, comme s'il partait
     chercher ; effacer le ramène. */
  const route = <RouteVelo className="sl-bande-route" roule avance={Math.min(requete.trim().length, 9) * 9} />;

  /* L'APP (fondateur, 2026-10-17, « Search » de maquettes/commerces-marque/commerces-marque.html) : le titre et le champ sur le bandeau iris,
     comme Favoris et Mon compte, le reste dans la feuille blanche. Pas de « bleu sur bleu » : dans l'app, aucun en-tête iris
     ne se pose au-dessus (le site, lui, garde son écran ci-dessous). */
  if (!site) {
    return (
      <div className="ecran-bandeau recherche-app">
        <div className="eb-bandeau">
          <h1 className="eb-titre">{t('search.title')}</h1>
          {champRecherche}
          {route}
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
        {route}
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
