import { useEffect, useMemo, useRef, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { api } from '../../api';
import { useAuth } from '../../context/AuthContext';
import { COMMUNES, RESTAURANT_TYPES } from '../../menuCategories';
import usePageMeta from '../../hooks/usePageMeta';

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

// Les accents ne comptent pas : « creme » trouve « crème », « ixelles » trouve « Ixelles ».
function normaliser(texte) {
  return (texte || '').toString().normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase().trim();
}
function contient(texte, requete) {
  return normaliser(texte).includes(requete);
}

// Réponses du centre d'aide, avec les mots par lesquels on les cherche vraiment. Le titre seul ne
// suffirait pas : personne ne tape « moyens de paiement », on tape « carte » ou « bancontact ».
const SUJETS_AIDE = [
  { to: '/aide?sujet=paiement', titre: 'Moyens de paiement', sous: 'Carte bancaire, Stripe, solde Fairide', mots: 'paiement payer carte bancaire visa mastercard bancontact stripe apple pay google pay solde argent rembourser remboursement' },
  { to: '/aide?sujet=titres-restaurant', titre: 'Titres-restaurant', sous: 'Monizze, Edenred, Sodexo', mots: 'titres restaurant ticket cheque repas monizze edenred sodexo pluxee' },
  { to: '/aide', titre: 'Adresse de livraison', sous: 'Celle qui pré-remplit tes commandes', mots: 'adresse livraison livrer domicile rue changer' },
  { to: '/aide', titre: 'Un souci avec une commande ?', sous: 'Suivi, retard, erreur, remboursement', mots: 'probleme souci commande retard erreur manquant froid remboursement suivi livreur' },
  { to: '/aide?sujet=bug', titre: 'Signaler un bug', sous: 'Quelque chose ne marche pas', mots: 'bug bogue erreur plante marche pas probleme technique' },
  { to: '/aide?sujet=avis', titre: 'Donner mon avis sur Fairide', sous: 'Ce qui te plaît, ce qui manque', mots: 'avis suggestion idee amelioration retour' },
  { to: '/aide', titre: 'Aide et contact', sous: 'Toutes les réponses, et nous écrire', mots: 'aide contact question support telephone email joindre' }
];

const RUBRIQUES_COMPTE = [
  { to: '/orders', titre: 'Mes commandes', sous: 'Livraisons, à emporter et sur place', mots: 'commande commandes historique suivi', connecte: true },
  { to: '/orders?type=dine_in', titre: 'Mes réservations', sous: 'Tes tables réservées', mots: 'reservation reservations table reserver', connecte: true },
  { to: '/favorites', titre: 'Mes favoris', sous: 'Les commerces que tu as enregistrés', mots: 'favoris favori coeur enregistre', connecte: true },
  { to: '/invoices', titre: 'Mes factures', sous: 'Les reçus de tes commandes payées', mots: 'facture factures recu recus justificatif', connecte: true },
  { to: '/account', titre: 'Mon compte', sous: 'Profil, adresse, mot de passe, langue', mots: 'compte profil mot de passe email telephone langue adresse parrainage code promo supprimer', connecte: true },
  { to: '/map', titre: 'Carte des commerces', sous: 'Trouver un commerce autour de toi', mots: 'carte plan autour de moi proche geolocalisation', connecte: true },
  { to: '/notre-histoire', titre: 'Notre histoire', sous: 'Pourquoi Fairide existe', mots: 'histoire mission valeurs commission equitable fairide qui sommes nous', connecte: false }
];

// Libellés lisibles des statuts de commande, pour le sous-titre des résultats.
const STATUTS = { nouveau: 'nouvelle', preparation: 'en préparation', pret: 'prête', livraison: 'en livraison', livre: 'livrée', refuse: 'refusée', annule: 'annulée' };

const MAX_PAR_GROUPE = 6;

export default function SearchPage() {
  const { user, token } = useAuth();
  const navigate = useNavigate();
  usePageMeta({ title: 'Recherche — Fairide', path: '/recherche' });

  const [requete, setRequete] = useState('');
  const [restaurants, setRestaurants] = useState([]);
  const [commandes, setCommandes] = useState([]);
  const [chargement, setChargement] = useState(true);
  const champ = useRef(null);

  // Le curseur est dans le champ à l'arrivée : on vient ici pour taper, pas pour lire. Sur téléphone
  // le clavier s'ouvre du même coup.
  useEffect(() => { champ.current?.focus(); }, []);

  useEffect(() => {
    api('/restaurants').then(setRestaurants).catch(() => {}).finally(() => setChargement(false));
    if (token) api('/orders/mine', { token }).then(setCommandes).catch(() => {});
  }, [token]);

  const q = normaliser(requete);
  const actif = q.length >= 2;

  const resultats = useMemo(() => {
    if (!actif) return null;
    const commerces = restaurants
      .filter((r) => contient(r.name, q) || contient(r.cuisine, q) || contient(r.desc, q) || contient(r.neighborhood, q))
      .slice(0, MAX_PAR_GROUPE);

    // Un plat par ligne, avec son commerce : on cherche « tiramisu », on veut savoir OÙ il y en a.
    const plats = [];
    for (const r of restaurants) {
      for (const p of r.menu || []) {
        if (p.available === false) continue;
        if (contient(p.name, q) || contient(p.desc || p.description, q)) {
          plats.push({ restaurant: r, plat: p });
          if (plats.length >= MAX_PAR_GROUPE) break;
        }
      }
      if (plats.length >= MAX_PAR_GROUPE) break;
    }

    const cuisines = RESTAURANT_TYPES.filter((c) => contient(c.value, q)).slice(0, MAX_PAR_GROUPE);
    const communes = COMMUNES.filter((c) => contient(c, q)).slice(0, MAX_PAR_GROUPE);
    const aide = SUJETS_AIDE.filter((s) => contient(s.titre, q) || contient(s.sous, q) || contient(s.mots, q)).slice(0, MAX_PAR_GROUPE);
    const rubriques = RUBRIQUES_COMPTE
      .filter((s) => (!s.connecte || user) && (contient(s.titre, q) || contient(s.sous, q) || contient(s.mots, q)))
      .slice(0, MAX_PAR_GROUPE);
    const mesCommandes = commandes
      .filter((o) => contient(o.restaurantName || o.restaurant?.name, q) || (o.items || []).some((i) => contient(i.name, q)) || contient(String(o.id).slice(0, 8), q))
      .slice(0, MAX_PAR_GROUPE);

    const total = commerces.length + plats.length + cuisines.length + communes.length + aide.length + rubriques.length + mesCommandes.length;
    return { commerces, plats, cuisines, communes, aide, rubriques, mesCommandes, total };
  }, [actif, q, restaurants, commandes, user]);

  // Entrée sur un texte qui n'a qu'un résultat : on y va. Sur plusieurs, on ne devine pas.
  function soumettre(e) {
    e.preventDefault();
    if (!resultats || resultats.total !== 1) return;
    const r = resultats;
    if (r.commerces[0]) return navigate(`/restaurants/${r.commerces[0].id}`);
    if (r.plats[0]) return navigate(`/restaurants/${r.plats[0].restaurant.id}`);
    if (r.cuisines[0]) return navigate('/restaurants', { state: { cuisine: r.cuisines[0].value } });
    if (r.communes[0]) return navigate('/restaurants', { state: { commune: r.communes[0] } });
    if (r.aide[0]) return navigate(r.aide[0].to);
    if (r.rubriques[0]) return navigate(r.rubriques[0].to);
    if (r.mesCommandes[0]) return navigate('/orders');
    return undefined;
  }

  const prix = (p) => (typeof p.price === 'number' ? `${p.price.toFixed(2)}€` : p.price ? `${Number(p.price).toFixed(2)}€` : '');

  return (
    <div>
      <h2 className="section-title" style={{ marginTop: 0 }}>Recherche</h2>

      <form className="recherche-champ" onSubmit={soumettre} role="search">
        <span className="recherche-loupe" aria-hidden="true">🔍</span>
        <input
          ref={champ}
          type="search"
          value={requete}
          onChange={(e) => setRequete(e.target.value)}
          placeholder="Un plat, un commerce, une commune, une question…"
          aria-label="Rechercher sur Fairide"
          autoComplete="off"
          enterKeyHint="search"
        />
        {requete && (
          <button type="button" className="recherche-effacer" onClick={() => { setRequete(''); champ.current?.focus(); }} aria-label="Effacer">✕</button>
        )}
      </form>

      {/* Avant la première lettre, on montre par où commencer : les cuisines et les communes, qui sont
          ce qu'on cherche le plus, plus le chemin vers l'aide. Une page vide avec un champ ne dit
          rien de ce qu'il accepte. */}
      {!actif && (
        <>
          <div className="card">
            <h3 className="recherche-titre-groupe">Par envie</h3>
            <div className="recherche-pastilles">
              {RESTAURANT_TYPES.slice(0, 14).map((c) => (
                <Link key={c.value} to="/restaurants" state={{ cuisine: c.value }} className="pill recherche-pastille">
                  <span aria-hidden="true">{c.emoji}</span> {c.value}
                </Link>
              ))}
            </div>
          </div>
          <div className="card">
            <h3 className="recherche-titre-groupe">Par commune</h3>
            <div className="recherche-pastilles">
              {COMMUNES.map((c) => (
                <Link key={c} to="/restaurants" state={{ commune: c }} className="pill recherche-pastille">{c}</Link>
              ))}
            </div>
          </div>
          <div className="card">
            <h3 className="recherche-titre-groupe">Une question ?</h3>
            <div className="recherche-pastilles">
              {SUJETS_AIDE.slice(0, 4).map((s) => (
                <Link key={s.to + s.titre} to={s.to} className="pill recherche-pastille">{s.titre}</Link>
              ))}
            </div>
          </div>
        </>
      )}

      {actif && chargement && <p className="small">Recherche…</p>}

      {actif && !chargement && resultats.total === 0 && (
        <div className="card">
          <p style={{ margin: '0 0 6px', fontWeight: 600 }}>Rien pour « {requete} ».</p>
          <p className="small" style={{ margin: 0 }}>
            Essaie un autre mot, le nom d'une commune, ou pose ta question dans <Link to="/aide">l'aide</Link>.
          </p>
        </div>
      )}

      {actif && !chargement && resultats.total > 0 && (
        <>
          <Groupe titre="Commerces" quand={resultats.commerces.length}>
            {resultats.commerces.map((r) => (
              <Ligne key={r.id} to={`/restaurants/${r.id}`} image={r.coverImageUrl} icone="🏪" titre={r.name}
                sous={[r.cuisine, r.commune].filter(Boolean).join(' · ')} />
            ))}
          </Groupe>
          <Groupe titre="Plats" quand={resultats.plats.length}>
            {resultats.plats.map(({ restaurant, plat }) => (
              <Ligne key={`${restaurant.id}-${plat.id || plat.name}`} to={`/restaurants/${restaurant.id}`} image={plat.imageUrl} icone={plat.healthy ? '🥗' : '🍽️'}
                titre={plat.name} sous={`${restaurant.name}${prix(plat) ? ` · ${prix(plat)}` : ''}`} />
            ))}
          </Groupe>
          <Groupe titre="Types de cuisine" quand={resultats.cuisines.length}>
            {resultats.cuisines.map((c) => (
              <Ligne key={c.value} to="/restaurants" state={{ cuisine: c.value }} icone={c.emoji} titre={c.value} sous="Voir les commerces de ce type" />
            ))}
          </Groupe>
          <Groupe titre="Communes" quand={resultats.communes.length}>
            {resultats.communes.map((c) => (
              <Ligne key={c} to="/restaurants" state={{ commune: c }} icone="📍" titre={c} sous="Voir les commerces de cette commune" />
            ))}
          </Groupe>
          <Groupe titre="Mes commandes" quand={resultats.mesCommandes.length}>
            {resultats.mesCommandes.map((o) => (
              <Ligne key={o.id} to="/orders" icone="📦" titre={o.restaurantName || o.restaurant?.name || 'Commande'}
                sous={[STATUTS[o.status] || o.status, o.total != null ? `${Number(o.total).toFixed(2)}€` : null].filter(Boolean).join(' · ')} />
            ))}
          </Groupe>
          <Groupe titre="Aide" quand={resultats.aide.length}>
            {resultats.aide.map((s) => <Ligne key={s.to + s.titre} to={s.to} icone="🛟" titre={s.titre} sous={s.sous} />)}
          </Groupe>
          <Groupe titre="Mon compte" quand={resultats.rubriques.length}>
            {resultats.rubriques.map((s) => <Ligne key={s.to} to={s.to} icone="👤" titre={s.titre} sous={s.sous} />)}
          </Groupe>
        </>
      )}
    </div>
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
// non comme une carte de plus.
function Ligne({ to, state, image, icone, titre, sous }) {
  return (
    <Link to={to} state={state} className="account-link-row recherche-ligne">
      {image ? (
        <img className="recherche-vignette" src={image} alt="" loading="lazy" />
      ) : (
        <span className="account-link-icon" aria-hidden="true">{icone}</span>
      )}
      <span className="account-link-text">
        <b>{titre}</b>
        {sous && <span className="small">{sous}</span>}
      </span>
      <span className="account-link-chevron" aria-hidden="true">›</span>
    </Link>
  );
}
