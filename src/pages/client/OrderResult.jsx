import { useEffect, useRef, useState } from 'react';
import { Link, useLocation, useNavigate, useSearchParams } from 'react-router-dom';
import ProtectedRoute from '../../components/ProtectedRoute';
import { api } from '../../api';
import { vibrer } from '../../gestes';
import { suivre } from '../../analytics';
import { useAuth } from '../../context/AuthContext';
import { useCart } from '../../context/CartContext';
import { useLanguage } from '../../context/LanguageContext';
import Icone from '../../components/Icone';
import { BandeauCommande, FeuilleCommande } from '../../components/EcranCommande';
import InfosRetrait from '../../components/client/InfosRetrait';
import { formatOrderItem, orderTypeLabel, heureArrivee } from '../../orderStatus';
import { ListeAttente, RouteArretsAttente } from '../../components/client/AttenteCommande';
import { etapesAttente, lignesCochees, titreAttente, useEtatAttente } from '../../attenteCommande';
import { euros } from '../../prixPlat';
import { oublierSaisiePaiement } from '../../saisiePaiement';
import { RappelCodeAmi } from '../../components/CodeAmi';
import QuiDoitQuoi from '../../components/client/QuiDoitQuoi';

// Page d'arrivée après le retour du prestataire de paiement.
//
// Avant : purement décorative — elle lisait ?order= dans l'URL et affichait 🎉 sans condition, sans
// jamais interroger le serveur. Un webhook encore en vol, un paiement refusé, ou même une URL tapée à
// la main affichaient donc « Merci pour ta commande ! » à un client dont la commande n'était pas payée
// et que le restaurant ne verrait jamais. C'est le pire mensonge possible à ce moment du parcours.
//
// Maintenant : on relit l'état réel de la commande et on n'annonce le succès que si le serveur dit
// `paid`. Le webhook de paiement peut mettre quelques secondes à arriver après la redirection, donc on
// laisse un court délai de grâce avant de conclure quoi que ce soit — d'où le sondage ci-dessous.
const POLL_INTERVAL_MS = 2000;
const MAX_POLLS = 10; // ~20 s, au-delà on affiche « en cours de vérification » plutôt que de mentir

/* RETOUR DE STRIPE SANS SESSION (audit du 19/10, checkout-07). Dans l'application, Stripe s'ouvre dans le navigateur
 * intégré ; à la fin du paiement il revient sur https://fairride.be/order-success. Quand le téléphone ne rend pas ce lien à
 * l'application (iOS tant que le fichier d'association n'a pas l'identifiant d'équipe Apple ; Android quand la redirection
 * arrive sans geste de l'utilisateur), la page se chargeait DANS ce navigateur, où il n'y a pas de session : l'écran de
 * connexion s'affichait juste après avoir payé. Désormais ces deux adresses s'ouvrent sans compte : elles disent de
 * retourner dans l'application, avec un bouton qui l'ouvre sur Android (lien « intent », geste de l'utilisateur, même
 * adresse, que l'application lit dans appUrlOpen — natif.js). Fermer le navigateur ramène aussi à « Mes commandes ».
 * Sur le site, un client dont la session a expiré peut se reconnecter et revenir ici (state.from). */
function RetourSansSession({ success }) {
  const { t } = useLanguage();
  const location = useLocation();
  const android = typeof navigator !== 'undefined' && /Android/i.test(navigator.userAgent || '');
  const lienAppli = `intent://fairride.be${location.pathname}${location.search}#Intent;scheme=https;package=be.fairide.app;end`;
  return (
    <div className="center-page">
      <span className="etat-vide-icone" aria-hidden="true"><Icone nom={success ? 'bouclier' : 'interdit'} taille={34} /></span>
      <h2 className="etat-vide-titre">{t('orderResult.noSessionTitle')}</h2>
      <p className="small">{t(success ? 'orderResult.noSessionTextSuccess' : 'orderResult.noSessionTextCancel')}</p>
      <div className="row" style={{ gap: 10, justifyContent: 'center', flexWrap: 'wrap' }}>
        {android && <a href={lienAppli} className="btn-teal" style={{ textDecoration: 'none', display: 'inline-block' }}>{t('orderResult.openApp')}</a>}
        <Link to="/login" state={{ from: location.pathname + location.search }} className="btn-outline" style={{ textDecoration: 'none', display: 'inline-block' }}>{t('orderResult.loginToSee')}</Link>
      </div>
    </div>
  );
}

// La route n'est plus protégée (App.jsx) : sans session, l'écran ci-dessus ; avec, la règle habituelle des pages client.
export default function OrderResult({ success }) {
  const { user } = useAuth();
  if (!user) return <RetourSansSession success={success} />;
  // La clé : /order-cancelled puis /order-success (déjà payée, F23) montent un écran neuf, qui repart de « Confirmation… ».
  return <ProtectedRoute role="client"><ResultatCommande key={success ? 'payee' : 'annulee'} success={success} /></ProtectedRoute>;
}

function ResultatCommande({ success }) {
  const [params] = useSearchParams();
  const orderId = params.get('order');
  const { token, user } = useAuth();
  const cart = useCart();
  const { t } = useLanguage();

  // 'checking' | 'paid' | 'pending' | 'failed' | 'introuvable'
  // Sans identifiant de commande dans l'URL, il n'y a rien à vérifier : on retombe sur l'annonce
  // portée par la route elle-même (/order-success vs /order-cancelled), comme avant.
  const [state, setState] = useState(() => {
    if (!orderId) return success ? 'paid' : 'failed';
    return success ? 'checking' : 'failed';
  });

  // La commande telle que le serveur la renvoie (dès la première lecture, payée ou pas) : son nom et son mode nourrissent la
  // liste de l'attente ; payée, son récapitulatif monte dans la feuille de l'écran de succès.
  const [commande, setCommande] = useState(null);
  const location = useLocation();
  const navigate = useNavigate();
  /* L'ATTENTE PAS À PAS (fondateur, 2026-11-08, maquettes/retours-08-11/attente-v2.html) : pendant la vérification, le bandeau iris
     avec la route de la commande (la même que le suivi : Paiement · Confirmée · Livreur · En route · Livrée) et la liste qui se
     coche. Le paiement confirmé par le serveur coche « Paiement sécurisé vérifié » (le vélo part vers Confirmée), puis
     « Commande envoyée » (le commerce la reçoit au paiement ; le vélo arrive à Confirmée), un pas à la fois ; puis l'écran de
     succès. La même horloge reprend sur le suivi, sans rejouer ces pas (useEtatAttente, clé de la commande).
     `payee` : confirmé, l'écran de succès attend la dernière coche. */
  const [payee, setPayee] = useState(false);
  const indicesAttente = location.state?.attente || {};
  const attente = etapesAttente(commande, t, indicesAttente);
  const suiteAttente = useEtatAttente(commande, { cle: orderId, indices: indicesAttente, etatMax: 2 });
  const vu = suiteAttente.vu;
  useEffect(() => {
    if (!payee || state !== 'checking' || vu < 2) return undefined;
    const id = setTimeout(() => setState('paid'), 700);
    return () => clearTimeout(id);
  }, [payee, state, vu]);

  const cartRef = useRef(cart);
  cartRef.current = cart;

  // Arrivée sur /order-cancelled : le client a explicitement renoncé au paiement. On lui rend son
  // panier immédiatement, sans rien interroger — il n'y a rien à vérifier, l'issue est connue.
  useEffect(() => {
    if (success) return;
    const rendu = cartRef.current.restoreStashed();
    /* DÉJÀ PAYÉE (revue argent du 13/11, F23) : Bancontact validé sur le téléphone pendant que le client touche la flèche
       retour de Stripe. Le serveur ferme la page de paiement, la trouve payée et répond 409 ALREADY_PAID ; l'erreur était
       avalée : l'écran disait « annulé », le panier revenait, et le client repassait commande, payée une deuxième fois. Le
       panier rendu repart donc, comme sur le paiement (Checkout.jsx, même code), et l'écran de confirmation prend le relais.
       Seulement le panier rendu ICI : un retour arrière vers une ancienne page ne vide pas le panier en cours. Déjà payée à
       la lecture (le webhook est arrivé avant ce retour) : la même confirmation. */
    const dejaPayee = (restaurantId) => {
      if (rendu) cartRef.current.clear();
      oublierSaisiePaiement(restaurantId);
      navigate(`/order-success?order=${orderId}`, { replace: true });
    };
    // Paiement abandonné : la commande restée impayée est annulée tout de suite. Le serveur retient le
    // solde Fairide et le bon cadeau DÈS la création de la commande ; sans cette annulation, ils restaient
    // bloqués jusqu'au ménage des commandes impayées (45 min, orderTimeouts.js côté serveur) — et le client,
    // qui retrouve son panier ici et repasse commande, ne voyait plus son solde.
    // Seulement si elle est bien IMPAYÉE : un client peut annuler une commande payée tant que le commerce ne
    // l'a pas acceptée (remboursement), et un retour arrière vers cette page ne doit pas le faire à sa place.
    if (orderId && token) {
      api('/orders/mine?suivi=1', { token })
        .then((orders) => {
          const o = orders.find((x) => String(x.id) === String(orderId));
          if (o?.paid && !['annule', 'refuse'].includes(o.status)) { dejaPayee(o.restaurantId); return null; }
          if (o && !o.paid && o.status === 'nouveau') {
            return api(`/orders/${orderId}/cancel`, { method: 'PATCH', token })
              .catch((e) => { if (e?.code === 'ALREADY_PAID') dejaPayee(o.restaurantId); });
          }
          return null;
        })
        .catch(() => {});
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [success, orderId, token]);

  useEffect(() => {
    if (!orderId || !success || !token) return;
    let polls = 0;
    let timer = null;
    let cancelled = false;

    async function check() {
      polls += 1;
      /* LE SERVEUR DEMANDE À STRIPE (pré-GO 2026-11-06, G21). Seul le webhook faisait passer la commande payée : s'il tardait ou
         ne marchait pas, cet écran disait « en cours » et le commerce ne voyait rien pendant 45 minutes. À l'arrivée, à mi-chemin
         et avant de conclure « en cours », le serveur relit la page de paiement (POST /payments/confirm/:id ; sans effet si le
         webhook est passé). Un serveur d'avant cette route répond 404 : ignoré, le sondage continue comme avant. */
      if (polls === 1 || polls === 4 || polls === MAX_POLLS) {
        await api(`/payments/confirm/${orderId}`, { method: 'POST', token }).catch(() => {});
        if (cancelled) return;
      }
      try {
        // ?suivi=1 : la commande vient d'être passée, elle est dans les récentes (tenir la charge, 2026-11-02).
        // /orders/mine plutôt qu'un GET /orders/:id : c'est l'endpoint dont on est certain qu'il
        // existe (déjà utilisé par Orders.jsx), et il est déjà filtré sur le client connecté — donc
        // impossible de consulter la commande de quelqu'un d'autre en changeant l'id dans l'URL.
        const orders = await api('/orders/mine?suivi=1', { token });
        if (cancelled) return;
        const order = orders.find((o) => o.id === orderId || String(o.id) === String(orderId));
        // Gardée dans tous les cas : son numéro du jour, s'il existe, se lit aussi sous « en cours » ou « échec ».
        if (order) setCommande(order);
        if (order?.paid) {
          // La liste coche « payé » et « envoyée », puis l'écran passe au merci (setState('paid') plus haut, après 700 ms).
          setPayee(true);
          vibrer('succes'); // paiement confirmé : la sensation « succès » du téléphone (audit « Look and feel » 6a)
          // Statistiques (sans donnée personnelle) : la commande est finalisée, par mode.
          suivre('commande_finalisee', { mode: order.orderType === 'pickup' ? 'emporter' : 'livraison' });
          if (order.orderType === 'pickup') suivre('commande_emporter');
          // Paiement confirmé : la copie du panier mise de côté avant la redirection n'a plus lieu
          // d'être. (Le panier visible, lui, a déjà été vidé au départ — voir stashForPayment.)
          cartRef.current.discardStashed();
          return;
        }
        /* Commande absente de MES commandes (lien d'un autre compte, identifiant abîmé) : on le dit tout de suite, au lieu de
           vingt secondes de « Confirmation… » sans bouton puis « elle apparaît dans Mes commandes » (audit du 19/10, CROSS-47).
           Une commande à moi apparaît dès sa création, avant le paiement : son absence n'est pas un retard du webhook. */
        if (!order) { setState('introuvable'); return; }
        if (order && (order.status === 'annule' || order.status === 'refuse')) {
          setState('failed');
          vibrer('erreur'); // le pendant du « succès » d'un paiement confirmé (gestes.js) : il ne se sentait pas
          // Commande annulée ou refusée : on rend au client son panier tel qu'il l'avait composé,
          // pour qu'il puisse réessayer sans tout ressaisir.
          cartRef.current.restoreStashed();
          return;
        }
      } catch {
        // Erreur réseau ponctuelle : on ne conclut rien, le prochain sondage retentera.
      }
      if (cancelled) return;
      if (polls >= MAX_POLLS) setState('pending');
      else timer = setTimeout(check, POLL_INTERVAL_MS);
    }

    check();
    return () => { cancelled = true; clearTimeout(timer); };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [orderId, success, token]);

  // L'icône, et non plus un emoji de 40px. Un emoji est rendu par la police du système : le même
  // 🎉 est bombé et multicolore sur Windows, plat et gris sur macOS — et c'était ici l'élément
  // principal de la page, celui qui annonce au client si sa commande est passée ou non. Un tracé
  // posé dans un rond gris, c'est la forme que l'application donne déjà à ses écrans vides
  // (components/EtatVide.jsx), et celle des écrans de confirmation de l'application de référence.
  const view = {
    checking: { icone: 'horloge', title: t('orderResult.checkingTitle'), text: t('orderResult.checkingText') },
    paid: { icone: 'bouclier', title: t('orderResult.successTitle'), text: t('orderResult.successText') },
    pending: { icone: 'horloge', title: t('orderResult.pendingTitle'), text: t('orderResult.pendingText') },
    introuvable: { icone: 'interdit', title: t('orderResult.notFoundTitle'), text: t('orderResult.notFoundText') },
    failed: {
      icone: 'interdit',
      // /order-cancelled est une annulation volontaire du client, pas un échec technique : on garde le
      // texte d'origine, moins alarmant, et on réserve failedText au paiement qui n'a pas abouti.
      title: success ? t('orderResult.failedTitle') : t('orderResult.cancelTitle'),
      text: success ? t('orderResult.failedText') : t('orderResult.cancelText')
    }
  }[state];

  /* COMMANDE PAYÉE : LE MOMENT DE L'APPLICATION. Depuis le 2026-10-16 (« Proposition » de maquettes/tous-les-ecrans/tous-les-ecrans.html,
     fondateur) : plein écran iris, la coche lime saute ; le récapitulatif (commerce, plats, mode, total débité) monte dans la feuille blanche. Le vélo qui roulait au-dessus de la coche est parti le
     2026-10-27 (fondateur : « trop de choses dans l'en-tête »). Mêmes textes, mêmes deux actions ;
     « Voir mes commandes » reste la seule action lime. Les autres états (vérification, attente, échec) restent sobres.
     Sur le site, sur un ordinateur (site-commande.css) : le bandeau va d'un bord à l'autre, la feuille passe en deux colonnes
     — le récapitulatif à gauche, les deux actions dans un cadre à droite. */
  /* LE NUMÉRO DU JOUR (« #012 »), JAMAIS L'IDENTIFIANT (revue des frictions client, 2026-11-08). « Commande n°3f9a1c2e » (les
   * premiers caractères de l'identifiant) ne correspondait à rien de ce que le commerce ou l'aide voient : sans numéro, rien. */
  const numero = commande?.orderNumber != null ? `#${String(commande.orderNumber).padStart(3, '0')}` : null;

  if (state === 'paid') {
    // Comme Mes commandes : le pourboire payé avec la commande est débité en plus du total (backend pourboireCommande.js).
    // Payée sur place : rien n'est débité — le montant à payer au comptoir est dit dans le bloc du retrait (InfosRetrait).
    const surPlace = commande?.paymentMode === 'on_site';
    const debite = commande && !surPlace ? Number(commande.total) + (commande.tipPaid && commande.tipAtCheckout > 0 ? Number(commande.tipAtCheckout) : 0) : null;
    const lieu = commande?.orderType === 'pickup' ? commande.restaurantAddress : commande?.address;
    /* LE TITRE NOMME LE COMMERCE, ET LE CLIENT S'IL EST CONNU (revue des frictions client, 2026-11-08) : « Maestro a ta commande,
     * Owen. » plutôt qu'un « Merci pour ta commande ! » qu'on lit partout. Dessous, en grand, l'heure : « Chez toi vers 12:52 »
     * (« Prête vers » à emporter), la même estimation que le paiement montrait (Checkout.jsx, « Dès que possible ») et que le
     * suivi reprend (heureArrivee). Pas d'heure pour une commande programmée : le bloc du retrait ou la ligne du mode la dit. */
    const prenomClient = String(user?.firstName || user?.name || '').trim().split(/\s+/)[0];
    const titre = !commande ? view.title
      : prenomClient ? t('orderResult.successTitleNom', { restaurant: commande.restaurantName, name: prenomClient })
        : t('orderResult.successTitleResto', { restaurant: commande.restaurantName });
    const heure = commande ? heureArrivee(commande) : null;
    const [avantHeure, apresHeure] = heure ? t(commande.orderType === 'pickup' ? 'orderStatus.grand.pretVers' : 'orderStatus.grand.arriveVers', { time: '\u0000' }).split('\u0000') : [];
    return (
      <div className="ec-page ec-merci sc-page">
        <BandeauCommande className="ec-merci-bandeau">
          {/* LA SORTIE EN HAUT À GAUCHE (fondateur, 2026-10-27 : « trop dur de savoir comment sortir de la page »). Le ‹ des autres
              écrans de la commande, posé sur le bandeau sans lui ajouter de hauteur. Il mène à la liste en REMPLAÇANT cette page
              (l'écran d'avant est le paiement, où l'on ne revient pas) ; le Retour d'Android le touche (data-retour-natif). */}
          <Link to="/restaurants" replace className="ec-rond ec-merci-rond" data-retour-natif aria-label={t('ecranCommande.retourCommerces')} title={t('ecranCommande.retourCommerces')}>
            <Icone nom="retour" taille={18} />
          </Link>
          <span className="ec-coche-merci" aria-hidden="true"><Icone nom="valider" taille={30} /></span>
          <h1 className="ec-titre">{titre}</h1>
          {heure && !heure.late && <p className="ec-merci-heure">{avantHeure}<b>{heure.time}</b>{apresHeure}</p>}
          {/* À emporter avec un numéro : il est déjà en grand dans le cadre du comptoir, juste dessous. */}
          {numero && commande?.orderType !== 'pickup' && <p className="ec-sous">{t('orderResult.orderNumber', { id: numero })}</p>}
        </BandeauCommande>
        <FeuilleCommande>
          {/* Site sur ordinateur (site-commande.css) : le récapitulatif à gauche, les deux actions à droite. Ailleurs, ces deux
              enveloppes sont en `display: contents` : la feuille reste une colonne. */}
          <div className="sc-merci-grille">
          <div className="sc-merci-texte">
          <p className="ec-merci-texte">{surPlace ? t('orderResult.successTextOnSite') : view.text}
            {/* La garantie, une petite ligne sous ce qui rassure (elle ouvrait le texte sur l'échec). */}
            {!surPlace && commande && <small className="ec-merci-garantie">{t('orderResult.successGarantie')}</small>}</p>
          {/* À emporter : le NUMÉRO de commande à montrer au comptoir, puis tout le retrait. Plus de code depuis le 2026-10-20
              (fondateur, après le test chez Maestro Pizza) : le commerce touche « Remis au client » à côté de ce numéro et du
              prénom du client. Le numéro est posé à la réception par le commerce ; tant qu'il manque, le nom suffit. */}
          {commande?.orderType === 'pickup' && (
            <div className="suivi-code">
              {numero ? (
                <>
                  <div className="suivi-code-lib">{t('retrait.numberLabel')}</div>
                  <div className="suivi-code-valeur">{numero}</div>
                  <div className="suivi-code-numero">{t('retrait.nameHint')}</div>
                </>
              ) : <div className="suivi-code-numero">{t('retrait.nameOnly')}</div>}
            </div>
          )}
          {commande && (
            <div className="ec-recap">
              <div className="ec-recap-ligne">
                <Icone nom="commerce" taille={20} />
                <span className="ec-recap-texte"><b>{commande.restaurantName}</b>
                  {commande.items?.length > 0 && <small>{commande.items.map(formatOrderItem).join(' · ')}</small>}</span>
                {/* À emporter payé en ligne : le montant débité est dit aussi (audit du 19/10, checkout-14) ; en livraison, il
                    est sur la ligne du mode, juste dessous. */}
                {commande.orderType === 'pickup' && debite != null && <b className="ec-recap-montant">{euros(debite)}</b>}
              </div>
              {commande.orderType !== 'pickup' && <div className="ec-recap-ligne">
                <Icone nom={commande.orderType === 'pickup' ? 'sac' : 'maison'} taille={20} />
                <span className="ec-recap-texte"><b>{orderTypeLabel(commande, t)}</b>{lieu && <small>{lieu}</small>}</span>
                {debite != null && <b className="ec-recap-montant">{euros(debite)}</b>}
              </div>}
            </div>
          )}
          <InfosRetrait order={commande} />
          {/* L'ADRESSE DU REÇU (fondateur, 2026-11-06, G52) : l'adresse n'est pas prouvée à l'inscription, et une faute de frappe
              envoyait les reçus à un inconnu sans que personne le voie. Payée en ligne seulement : c'est elle qui a un reçu. */}
          {commande && !surPlace && user?.email && (
            <p className="small ec-merci-recu">{t('orderResult.recuEnvoye', { email: user.email })} · <Link to="/account">{t('orderResult.recuChanger')}</Link></p>
          )}
          {/* Le code ami, une fois par téléphone, au moment où l'on est content (maquettes/parrainage-visible, question 5). */}
          {/* Commande groupée payée par l'hôte : ce que chacun lui doit (maquettes/bienvenue-partage) ; sinon le rappel du code ami. */}
          {commande?.groupCode ? <QuiDoitQuoi commande={commande} /> : commande && <RappelCodeAmi />}
          </div>
          <div className="sc-merci-actions">
          {/* Le bouton dit ce qu'on veut faire juste après avoir payé : suivre CETTE commande (elle s'ouvre en tête de Mes commandes,
              en suivi). Fondateur, 2026-10-25, maquettes/une-action. */}
          <Link to="/orders" className="btn-gold ec-merci-bouton">{t('orderResult.trackOrder')}</Link>
          <Link to="/restaurants" className="btn-ghost ec-merci-retour">{t('ecranCommande.retourCommerces')}</Link>
          </div>
          </div>
        </FeuilleCommande>
      </div>
    );
  }

  // Vérification en cours : le bandeau iris avec la route (un arrêt par étape, le vélo sur l'étape en cours) et la liste.
  // Toujours aucun bouton : on ne veut pas qu'un client quitte la page à la seconde où la confirmation arrive.
  if (state === 'checking') {
    return (
      <div className="ec-page sc-page at-page">
        <BandeauCommande haut={commande?.restaurantName ? <><b>{commande.restaurantName}</b> · {orderTypeLabel(commande, t)}</> : null}>
          <h1 className="ec-titre" key={Math.min(vu, 2)} aria-live="polite">{titreAttente(commande, t, vu, attente.enLigne)}</h1>
          {/* La même route que le suivi : ici, au plus jusqu'à « Confirmée » (le commerce a la commande). */}
          <RouteArretsAttente arrets={suiteAttente.arrets} position={suiteAttente.position} />
        </BandeauCommande>
        <FeuilleCommande>
          <ListeAttente etapes={attente.etapes} coches={lignesCochees(vu, attente.enLigne)} />
          <p className="small at-note">{t('attente.neFermePas')}</p>
        </FeuilleCommande>
      </div>
    );
  }

  return (
    <div className="center-page">
      <span className="etat-vide-icone" aria-hidden="true"><Icone nom={view.icone} taille={34} /></span>
      <h2 className="etat-vide-titre">{view.title}</h2>
      <p className="small">
        {view.text}
        {numero && <><br />{t('orderResult.orderNumber', { id: numero })}</>}
      </p>
      {/* Pendant la vérification, aucun bouton : on ne veut pas qu'un client quitte la page à la
          seconde où le webhook est sur le point d'arriver. */}
      {state !== 'checking' && (
        <div className="row" style={{ gap: 10, justifyContent: 'center', flexWrap: 'wrap' }}>
          {/* Paiement annulé ou refusé : la commande n'est pas passée et le panier est rendu — l'action principale y ramène
              (audit du 19/10, checkout-15). */}
          {state === 'failed' && cart.count > 0 && (
            <Link to="/panier" className="btn-teal" style={{ textDecoration: 'none', display: 'inline-block' }}>
              {t('orderResult.backToCart')}
            </Link>
          )}
          <Link to="/orders" className={state === 'failed' && cart.count > 0 ? 'btn-outline' : 'btn-teal'} style={{ textDecoration: 'none', display: 'inline-block' }}>
            {t('orderResult.viewOrders')}
          </Link>
          <Link to="/restaurants" className="btn-outline" style={{ textDecoration: 'none', display: 'inline-block' }}>
            {t('orderResult.backToRestaurants')}
          </Link>
        </div>
      )}
    </div>
  );
}
