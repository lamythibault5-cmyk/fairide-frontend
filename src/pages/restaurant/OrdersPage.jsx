import InterrupteurService from '../../components/commerce/InterrupteurService';
import { useSiteLarge } from '../../hooks/useSiteLarge';
import RupturesDuJour from '../../components/commerce/RupturesDuJour';
import { fusionnerCommande } from '../../components/commerce/majLocale';
import { useActionOptimiste } from '../../actionOptimiste';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { Link, useOutletContext, useSearchParams } from 'react-router-dom';
import TirerPourActualiser from '../../components/TirerPourActualiser';
import { api, apiUpload } from '../../api';
import { useAuth } from '../../context/AuthContext';
import { useToast } from '../../context/ToastContext';
import OrderReceipt from '../../components/OrderReceipt';
import PastilleCouverts from '../../components/commerce/PastilleCouverts';
import TicketPapier from '../../components/TicketPapier';
import { imprimerTicketPapier } from '../../impressionPapier';
import { serviceGoodcomDisponible, imprimerSurGoodcom } from '../../goodcomWebPrinter';
import ConfirmDialog from '../../components/ConfirmDialog';
import Modale from '../../components/Modale';
import ReasonDialog from '../../components/admin/ReasonDialog';
import { BandeauAllergie, BadgeAlcool, VerificationAge } from '../../components/conformite/CommandeConformite';
import {
  DeliveryTiming, ProgressBar, RouteSuivi, statusLabel, deliveryInstructionLabel, orderTypeColor, orderTypeLabel,
  ORDER_STAGES, orderStageKey, orderStagePriority, stageColors as couleursEtapes
} from '../../orderStatus';
import { useLanguage, getLocale } from '../../context/LanguageContext';
import { euros } from '../../prixPlat';
import Icone from '../../components/Icone';
import EtatVide from '../../components/EtatVide';
import ErrorCard from '../../components/ErrorCard';
import { SkeletonCards } from '../../components/Skeleton';
import { BandeauCommerce, FeuilleCommerce, SegmentGlisse } from '../../components/commerce/BandeauCommerce';
import { RouteVelo } from '../../components/TeteListe';
import { vibrer } from '../../gestes';
import { experienceApp, estNatif } from '../../natif';
import { raisonFermeture } from '../../components/commerce/raisonFermeture';
import MiseEnLigne, { RouteMiseEnLigne, EtapesMiseEnLigne } from '../../components/commerce/MiseEnLigne';
import useMiseEnLigne from '../../components/commerce/useMiseEnLigne';
import AlerteBandeau from '../../components/commerce/AlerteBandeau';
import { useModeEquipe } from '../../modeEquipe';
import AnneauDelai from '../../components/commerce/AnneauDelai';
import LigneAlarme from '../../components/commerce/LigneAlarme';
import ListePlats from '../../components/commerce/ListePlats';
import LivreurCommande from '../../components/commerce/LivreurCommande';
import { heurePrete, ouEstLeClient, prenom } from '../../components/commerce/clientCommande';
import { telephoneLisible } from '../../validation';

// Le SITE (pas l'app) montre les commandes en tableau à trois colonnes (2026-10-16, maquettes/site-ordinateur/site-ordinateur.html › Espace
// commerce, lot « pro ») : Nouvelles, En préparation, Prêtes. L'app garde sa liste, inchangée.
const SITE = !experienceApp();
const COLONNES = [
  { cle: 'nouv', etapes: ['nouveau'], icone: 'cloche', titre: 'sitePro.colNouvelles', vide: 'sitePro.videNouvelles' },
  { cle: 'prep', etapes: ['attenteConfirmationLivreur', 'preparation'], icone: 'horloge', titre: 'sitePro.colPreparation', vide: 'sitePro.videColonne' },
  { cle: 'pret', etapes: ['attenteLivreur', 'pretClient', 'enLivraison'], icone: 'valider', titre: 'sitePro.colPretes', vide: 'sitePro.videColonne' }
];
// La nouvelle commande la plus pressée d'abord : échéance d'acceptation la plus proche (à défaut, la plus ancienne).
const echeance = (o) => Number(o.acceptDeadline ? new Date(o.acceptDeadline).getTime() : new Date(o.createdAt).getTime() + 15 * 60000) || 0;

// Où en est le ticket de la commande sur le terminal Fairide (backend : GET /orders/restaurant/:id → print).
// « #012 » : même forme que le ticket imprimé et la fenêtre « nouvelle commande » (NouvelleCommandeModale).
const numeroCommande = (o) => `#${String(o.orderNumber).padStart(3, '0')}`;

function EtatImpression({ p, t }) {
  if (!p) return null;
  const raison = p.lastError ? t(`terminal.printer_${p.lastError}`, {}) : '';
  const raisonLisible = raison && !raison.startsWith('terminal.') ? raison : t('terminal.printer_unknown');
  if (p.failed > 0 && !p.pending) return <span className="print-etat erreur"><Icone nom="alerte" taille={16} className="icone-texte" />{' '}{t('ordersResto.printFailedState', { reason: raisonLisible })}</span>;
  if (p.pending > 0) return <span className={`print-etat ${p.lastError ? 'erreur' : 'attente'}`}>{p.lastError ? `${t('ordersResto.printWaitingReason', { reason: raisonLisible })}` : `${t('ordersResto.printWaiting')}`}</span>;
  if (p.printed > 0) return <span className="print-etat ok"><Icone nom="imprimante" taille={16} className="icone-texte" />{' '}{p.printed > 1 ? t('ordersResto.printedN', { n: p.printed }) : t('ordersResto.printedOnce')}</span>;
  return null;
}

// Code de retrait d'une livraison, en grand, tant que le livreur n'est pas passé. Le commerce n'a rien à taper ni à
// toucher : il vérifie que le livreur montre le même code, et lui remet la commande. Le serveur n'envoie le code
// qu'une fois un livreur assigné (routes/orders.js, GET /restaurant/:id).
function CodeRetrait({ order, t }) {
  if (order.orderType !== 'delivery' || !order.driverId || !order.pickupCode || !['preparation', 'pret'].includes(order.status)) return null;
  return (
    <div style={{ marginTop: 10, border: '1px solid var(--line)', borderRadius: 'var(--radius-chip)', padding: '8px 12px' }}>
      <div className="small">{t('ordersResto.pickupCodeLabel')}</div>
      <div style={{ fontWeight: 700, fontSize: 28, letterSpacing: 6, color: 'var(--ink)' }}>{order.pickupCode}</div>
      <div className="small" style={{ color: 'var(--ink-soft)' }}>{t('ordersResto.pickupCodeHelp')}</div>
    </div>
  );
}

// L'anneau du temps qui reste pour accepter vit dans components/commerce/AnneauDelai.jsx (partagé avec la feuille
// « Nouvelle commande » depuis l'audit design 2, 2026-10-19).

export default function OrdersPage() {
  const { t } = useLanguage();
  /* Le tableau à trois colonnes, sur un ORDINATEUR seulement. Sur un téléphone, le site montre les commandes comme l'app
     (fondateur, 2026-10-25, maquettes/une-action/panier-et-site, réponse 11) : le bandeau compact (le nom, l'interrupteur, la
     ligne de l'alarme dont les réglages ouvrent le son, la sonnerie et les notifications, le terminal), puis « À traiter »
     d'abord et « Accepter » en bas de l'écran. Le tableau, sur un téléphone, mettait trois colonnes l'une sous l'autre. */
  const siteLarge = useSiteLarge(900);
  const tableau = SITE && siteLarge;
  const { token } = useAuth();
  const toast = useToast();
  const { orders, restaurant, restoId, loadDashboard, communs, alerte, onConnect, connecting, lectureSeule, ordersLoaded, etatCommandes, statsService, modifierRestaurant, modifierCommandes } = useOutletContext();
  // Membre de l'équipe (modeEquipe.js) : la mise en ligne du commerce et le terminal sont l'affaire du propriétaire.
  const membreEquipe = useModeEquipe();
  /* AVANT LA MISE EN LIGNE, L'ACCUEIL EST LE GUIDE (fondateur, 2026-10-27 : « quand ils arrivent, un guide clair, ils n'ont
     qu'à le suivre pour prendre des commandes en étant en règle »). Commandes est devenu l'accueil du commerce ; tant qu'il
     n'est pas visible des clients, il n'y a aucune commande à montrer, et « Rien en cours · Activer le son » ne disait pas
     quoi faire. Le téléphone (app et site) montre donc les étapes de Mon commerce (EditPage) : la route sur le bandeau, la
     prochaine étape et SON bouton lime, le reste dessous. Une fois en ligne, l'écran du service revient. */
  const etapes = useMiseEnLigne({ restaurant, restoId, token, onConnect, connecting, onChange: () => loadDashboard(restoId), lectureSeule });

  /* ÉCRAN ALLUMÉ PENDANT LE SERVICE (audit UX du 15/10/2026). Une tablette de comptoir qui se met en veille ne sonne plus
     et ne voit plus les commandes : après 15 minutes elles sont annulées (acceptation.js), et le commerce mis en pause.
     Seulement sur cette page (pas tout le tableau de bord : un téléphone laissé sur « Ma carte » viderait sa batterie),
     redemandé au retour sur l'onglet — le navigateur relâche le verrou dès que la page est cachée. Sans l'API (anciens
     navigateurs), rien ne change. */
  useEffect(() => {
    if (!('wakeLock' in navigator)) return undefined;
    let verrou = null;
    let actif = true;
    const prendre = async () => {
      if (!actif || document.visibilityState !== 'visible') return;
      try { verrou = await navigator.wakeLock.request('screen'); } catch { /* refusé (économie d'énergie) : sans effet */ }
    };
    prendre();
    document.addEventListener('visibilitychange', prendre);
    return () => {
      actif = false;
      document.removeEventListener('visibilitychange', prendre);
      verrou?.release?.().catch(() => {});
    };
  }, []);

  // On garde la commande choisie, mais on affiche toujours sa dernière version (sondage de 15 s, actions) :
  // un instantané restait « Prête » avec son champ de code après validation, et un second clic échouait.
  const [commandeChoisie, setSelectedOrder] = useState(null);
  // ?commande=<id> : ouvre cette commande dès qu'elle est chargée (fenêtre « nouvelle commande », lien d'un e-mail).
  const [params, setParams] = useSearchParams();
  const commandeDemandee = params.get('commande');
  useEffect(() => {
    if (!commandeDemandee || !orders.length) return;
    const o = orders.find((x) => x.id === commandeDemandee);
    if (o) { setSelectedOrder(o); setParams({}, { replace: true }); }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [commandeDemandee, orders.length]);
  const selectedOrder = commandeChoisie ? (orders.find((o) => o.id === commandeChoisie.id) || commandeChoisie) : null;
  // Commandes dont une action (accepter, refuser, prête) est en cours : pas de double envoi sur un double appui. UN VERROU PAR
  // COMMANDE (audit du 19/10, shop-214) : le verrou global ignorait en silence « Accepter » sur une autre commande pendant
  // l'envoi de la première. La référence bloque les doubles appuis avant le rendu suivant, l'état désactive les boutons.
  const verrous = useRef(new Set());
  const [actionsEnCours, setActionsEnCours] = useState(() => new Set());
  const [aRefuser, setARefuser] = useState(null);
  // Refus ou annulation en cours d'envoi : la fenêtre du motif reste ouverte jusqu'à la réponse, le motif tapé n'est plus
  // perdu sur une coupure (shop-222).
  const [motifEnvoi, setMotifEnvoi] = useState(false);
  // Commande déjà acceptée que le commerce doit annuler (friteuse en panne, dernier plat parti) : audit du 19/10, shop-207.
  const [aAnnuler, setAAnnuler] = useState(null);
  // Commande à emporter que le client n'est pas venu chercher (confirmation avant de la clore).
  const [pasVenu, setPasVenu] = useState(null);
  const [clotureEnCours, setClotureEnCours] = useState(false);
  const [confirmingPickup, setConfirmingPickup] = useState(null);
  // Conformité : commande avec demande d'allergie à confirmer (A1), remise d'alcool à contrôler (B6).
  const [allergieAConfirmer, setAllergieAConfirmer] = useState(null);
  // Minutes de préparation ajoutées à l'acceptation, par commande (RES-10).
  const [tempsEnPlus, setTempsEnPlus] = useState({});
  const [ageAVerifier, setAgeAVerifier] = useState(null);
  const stageColors = useMemo(() => couleursEtapes(restoId), [restoId]);
  // Largeur de papier retenue par le restaurateur : sa valeur ne change pas d'une commande à l'autre,
  // la redemander à chaque ticket serait une friction inutile.
  // Fondateur (2026-09-22) : les commandes se voient, s'acceptent et s'impriment sur le TERMINAL Fairide (tout-en-un,
  // configuré par l'équipe). Plus de réglages Bluetooth / iOS / Android ici : la page garde les commandes et, en
  // secours, l'impression par la boîte d'impression de l'appareil (« Imprimer le bon de livraison »).
  // L'imprimante Bluetooth (escposTicket.js) n'est plus branchée ici (audit du 19/10, shop-226) : plus rien ne la connectait
  // depuis le terminal Fairide, et son ticket imprimait le nom complet et le téléphone du client, sans l'allergie.

  // Nombre d'impressions déjà faites par commande (session) : affiché dans le détail, pour savoir si le
  // ticket est déjà sorti et pouvoir le réimprimer sans hésiter quand la première sortie a raté.
  const [impressions, setImpressions] = useState({});
  // Terminal Fairide : s'il y en a un d'associé, « Imprimer » envoie le ticket au terminal (file d'impression) ;
  // sinon on garde le secours (Bluetooth, boîte d'impression de l'appareil).
  const [terminaux, setTerminaux] = useState(null);
  const [envoiTicket, setEnvoiTicket] = useState(null);
  const [apercu, setApercu] = useState(null); // { orderId, lines, columns }
  const chargerTerminaux = useCallback(() => {
    if (!restoId) return;
    api(`/restaurants/${restoId}/terminals`, { token }).then((d) => setTerminaux(d.terminals || [])).catch(() => setTerminaux([]));
  }, [restoId, token]);
  useEffect(() => { chargerTerminaux(); }, [chargerTerminaux]);
  const terminauxActifs = (terminaux || []).filter((x) => !x.revokedAt);
  const aTerminal = terminauxActifs.length > 0;
  const terminalEnLigne = terminauxActifs.some((x) => x.online);

  // Envoie le ticket au terminal : première impression, ou réimpression d'un ticket mal sorti (papier froissé,
  // encre pâle…). Tracé côté serveur (réimpression = job à part, jamais confondu avec l'impression automatique).
  // Nombre d'exemplaires d'une (ré)impression (fondateur, 2026-10-01) : un pour la cuisine, un pour le comptoir, un pour
  // le livreur… 1 à 5, choisi juste à côté du bouton.
  const [exemplaires, setExemplaires] = useState(1);
  // Une livraison sort toujours au moins deux tickets (sac du client + cuisine, backend impressions.js) : le sélecteur part
  // de 2, et le message compte les tickets vraiment envoyés (audit du 19/10, shop-228 : « Ticket envoyé » pour deux).
  const minExemplaires = (o) => (o?.orderType === 'delivery' ? 2 : 1);
  const idChoisi = commandeChoisie?.id;
  useEffect(() => { setExemplaires(minExemplaires(commandeChoisie)); /* eslint-disable-next-line react-hooks/exhaustive-deps */ }, [idChoisi]);
  async function imprimerSurTerminal(order, copies = 1) {
    setEnvoiTicket(order.id);
    try {
      const r = await api(`/orders/${order.id}/print`, { method: 'POST', token, body: { copies } });
      const n = r?.jobIds?.length || copies;
      toast(n > 1 ? t('ordersResto.toastTicketSentN', { n }) : terminalEnLigne ? t('ordersResto.ticketSentTerminal') : t('ordersResto.ticketQueuedOffline'));
      loadDashboard(restoId);
    } catch (e) { toast(e.message, 'erreur'); } finally { setEnvoiTicket(null); }
  }
  async function voirApercu(order) {
    if (apercu?.orderId === order.id) { setApercu(null); return; }
    try {
      const r = await api(`/orders/${order.id}/ticket?columns=32`, { token });
      setApercu({ orderId: order.id, lines: r.lines, columns: r.columns });
    } catch (e) { toast(e.message, 'erreur'); }
  }

  // OUVERT / EN PAUSE, EN TÊTE DE LA PAGE DE SERVICE (2026-09-23). La case « Restaurant ouvert » vivait
  // au milieu du formulaire de Mon commerce, sous les horaires, et ne prenait effet qu'au clic sur
  // Enregistrer : en plein coup de feu, personne n'allait la chercher là. C'est le geste de la tablette
  // Uber Eats (« Mettre en pause les commandes ») : un appui, effet immédiat. Même champ `open` côté
  // serveur — fermé, le commerce refuse les nouvelles commandes (routes/orders.js) et sort de la liste
  // publique ; les commandes déjà reçues continuent normalement.

  // Ce qui demande une action ou une surveillance en premier, ce qui est déjà réglé en dernier —
  // pour que le restaurateur voie toujours ce qui compte sans avoir à chercher dans la liste.
  //
  // Les commandes closes (terminées, refusées, annulées) passent dans un historique replié : le serveur
  // renvoie TOUT l'historique du commerce, et au bout de quelques semaines la liste de service n'était plus
  // qu'une longue traîne de commandes livrées sous les deux qui comptaient.
  /* L'HISTORIQUE À LA DEMANDE (audit du 19/10, shop-213). Le tableau ne reçoit plus que les commandes en cours et celles
     closes depuis 24 h ; les plus anciennes arrivent 20 par 20 quand on ouvre l'historique (GET ?vue=historique), et rien
     n'est dessiné tant qu'il est replié — avant, des milliers de cartes se reconstruisaient à chaque sondage de 15 s. */
  const [histOuvert, setHistOuvert] = useState(false);
  const [hist, setHist] = useState({ liste: [], plus: false, charge: false, enCours: false, erreur: null });
  async function chargerHistorique(suite = false) {
    if (!restoId) return;
    setHist((h) => ({ ...h, enCours: true, erreur: null }));
    const avant = suite && hist.liste.length ? hist.liste[hist.liste.length - 1].createdAt : null;
    try {
      const r = await api(`/orders/restaurant/${restoId}?vue=historique${avant ? `&avant=${avant}` : ''}`, { token });
      setHist((h) => ({ liste: suite ? [...h.liste, ...(r?.orders || [])] : (r?.orders || []), plus: !!r?.more, charge: true, enCours: false, erreur: null }));
    } catch (e) { setHist((h) => ({ ...h, enCours: false, erreur: e.message })); }
  }
  const { enCours, closes, duJour } = useMemo(() => {
    const finies = ['terminee', 'annulee'];
    const tri = [...orders].sort((a, b) => orderStagePriority(a) - orderStagePriority(b));
    const aujourdhui = new Date().toDateString();
    return {
      enCours: tri.filter((o) => !finies.includes(orderStageKey(o))),
      closes: orders.filter((o) => finies.includes(orderStageKey(o))),
      duJour: orders.filter((o) => o.status !== 'refuse' && o.status !== 'annule' && new Date(o.createdAt).toDateString() === aujourdhui).length
    };
  }, [orders]);

  /* « PRÊTE » BOUGE AU TOUCHER (2026-10-23, app lente : la carte attendait l'appel PUIS le rechargement complet du tableau
   * avant de passer dans « Prêtes »). Elle y passe tout de suite, l'appel suit ; la réponse (la commande telle que le serveur
   * l'a écrite) remplace la devinette, un refus la remet « En préparation » avec le message d'erreur (actionOptimiste.js).
   * Rien n'est remboursé ni annoncé au client avant la réponse : c'est le serveur qui prévient (e-mail, livreur), seulement
   * s'il a accepté. La relecture des commandes part ensuite en arrière-plan. */
  const agirOptimiste = useActionOptimiste();
  /* UN SEUL « PRÊTE » PAR COMMANDE (revue du 24/10). « Prête » n'est pas un réglage qu'on bascule : un second toucher, pendant
   * que le premier est en route ou juste après, partait en second PATCH /ready, que le serveur refuse (« déjà prête ») ; le
   * refus remettait un instant la carte « En préparation ». On ignore donc un toucher tant que le précédent est en vol, et
   * celui sur une commande que l'écran montre déjà prête. */
  const pretesEnVol = useRef(new Set());
  function marquerPrete(orderId) {
    if (pretesEnVol.current.has(orderId)) return;
    if (orders.find((o) => o.id === orderId)?.status === 'pret') return;
    pretesEnVol.current.add(orderId);
    agirOptimiste(`prete:${orderId}`, {
      appliquer: () => {
        const avant = orders.find((o) => o.id === orderId)?.status;
        modifierCommandes?.((liste) => liste.map((o) => (o.id === orderId ? { ...o, status: 'pret' } : o)));
        return avant;
      },
      envoyer: () => api(`/orders/${orderId}/ready`, { method: 'PATCH', token }),
      // Seulement si elle est encore « pret » d'après nous : une relecture entre-temps a pu lui donner un autre état réel.
      annuler: (avant) => modifierCommandes?.((liste) => liste.map((o) => (o.id === orderId && o.status === 'pret' && avant ? { ...o, status: avant } : o))),
      confirmer: (maj) => modifierCommandes?.((liste) => fusionnerCommande(liste, maj)),
      rafraichir: () => loadDashboard(restoId, { fiche: false, annexes: false, silencieux: true })
    }).finally(() => pretesEnVol.current.delete(orderId));
  }

  // Rend { ok, code } : les fenêtres de motif ne se ferment qu'en cas de succès (shop-222).
  async function orderAction(orderId, action, body) {
    if (action === 'ready') { marquerPrete(orderId); return { ok: true }; }
    if (verrous.current.has(orderId)) return { ok: false };
    verrous.current.add(orderId);
    setActionsEnCours(new Set(verrous.current));
    try {
      const maj = await api(`/orders/${orderId}/${action}`, { method: 'PATCH', token, body });
      // Commande acceptée : le retour « succès » du téléphone (gestes.js, App polish du 2026-10-19).
      if (action === 'accept') vibrer('succes');
      /* ACCEPTER RESTE CONFIRMÉ PAR LE SERVEUR (paiement, allergie, délai : il peut refuser), mais l'écran n'attend plus en
       * plus le rechargement complet (2026-10-23, app lente) : la commande renvoyée par PATCH /accept prend sa place dans la
       * liste tout de suite (« En préparation », l'alarme se tait), et la relecture des commandes suit en arrière-plan. Le
       * refus garde, lui, son rechargement complet avant de fermer la fenêtre du motif. */
      if (action === 'accept' && modifierCommandes) {
        modifierCommandes((liste) => fusionnerCommande(liste, maj));
        loadDashboard(restoId, { fiche: false, annexes: false, silencieux: true });
        return { ok: true };
      }
      await loadDashboard(restoId);
      return { ok: true };
    } catch (e) {
      toast(e.message, 'erreur');
      // La carte n'attendait plus (acceptée sur un autre appareil, statut changé) : on relit tout de suite au lieu de laisser
      // jusqu'à 15 s un bouton qui répondra la même erreur (shop-214).
      loadDashboard(restoId, { fiche: false, annexes: false, silencieux: true });
      return { ok: false, code: e.code };
    } finally {
      verrous.current.delete(orderId);
      setActionsEnCours(new Set(verrous.current));
    }
  }
  // Refus d'une commande qui attend : il dit le statut qu'il voyait (shop-208), le serveur refuse si elle vient d'être
  // acceptée ailleurs. Annulation d'une commande acceptée (shop-207) : sans statut attendu.
  async function envoyerMotif(o, motif, { annulation = false } = {}) {
    setMotifEnvoi(true);
    const r = await orderAction(o.id, 'refuse', annulation ? { reason: motif } : { reason: motif, expectedStatus: 'nouveau' });
    setMotifEnvoi(false);
    if (r.ok || r.code === 'STATUS_CHANGED') {
      if (annulation) { setAAnnuler(null); setSelectedOrder(null); } else setARefuser(null);
    }
  }
  const motifsRefus = [t('ordersResto.refuseReason1'), t('ordersResto.refuseReason2'), t('ordersResto.refuseReason3')];

  async function signalerPasVenu() {
    if (!pasVenu) return;
    setClotureEnCours(true);
    try {
      await api(`/orders/${pasVenu.id}/pickup-no-show`, { method: 'PATCH', token });
      toast(t('ordersResto.toastNoShow'));
      setPasVenu(null);
      setSelectedOrder(null);
      loadDashboard(restoId);
    } catch (e) {
      toast(e.message, 'erreur');
    } finally {
      setClotureEnCours(false);
    }
  }

  // `ageVerifie` : la pièce d'identité a été contrôlée (commande avec alcool, backlog B6). Sans elle, on
  // ouvre d'abord la vérification — le serveur refuserait de toute façon (AGE_A_VERIFIER).
  // Plus de code client à taper (fondateur, 2026-10-20, après le test chez Maestro Pizza) : « Remis au client » envoie la
  // remise sans `code`, le serveur l'accepte (routes/orders.js confirm-takeaway, qui dit le prix de ce choix).
  async function confirmTakeaway(order, ageVerifie = false) {
    const orderId = order.id;
    if (order.containsAlcohol && order.orderType === 'pickup' && !ageVerifie) { setAgeAVerifier(order); return; }
    setConfirmingPickup(orderId);
    try {
      await api(`/orders/${orderId}/confirm-takeaway`, { method: 'PATCH', token, body: ageVerifie ? { ageCheck: 'verified' } : {} });
      toast(t('ordersResto.toastTakeawayDone'), 'succes');
      loadDashboard(restoId);
    } catch (e) {
      toast(e.message, 'erreur');
    } finally {
      setConfirmingPickup(null);
    }
  }

  async function refuserRemiseAge(order) {
    try {
      await api(`/orders/${order.id}/age-refused`, { method: 'PATCH', token, body: { reason: 'refused_age' } });
      toast(t('conformite.ageRefusedDone'));
      setAgeAVerifier(null);
      setSelectedOrder(null);
      loadDashboard(restoId);
    } catch (e) { toast(e.message, 'erreur'); }
  }

  // Impression depuis CET appareil (boîte d'impression du système) : le même ticket que le terminal, en colonne de
  // 58 mm. Secours sans terminal, ou pour un double sur une autre imprimante.
  async function printReceipt(order, copies = 1) {
    try {
      const r = await api(`/orders/${order.id}/ticket?columns=32`, { token });
      // Sur un terminal Goodcom (service d'impression détecté) : directement sur son imprimante, sans boîte de dialogue,
      // autant de fois que d'exemplaires demandés.
      if (await serviceGoodcomDisponible()) {
        const n = Math.max(1, copies);
        // L'erreur du terminal est dite dans la langue choisie, comme sur la page Terminal (audit du 24/10) : son texte à
        // elle (« Délai dépassé », « Service d'impression Goodcom injoignable ») est en français et arrivait tel quel au toast.
        const traduireEchec = (e) => { throw Object.assign(new Error(t('terminal.webDirectFail', { reason: t(`terminal.printer_${e?.code || 'unknown'}`) })), { code: e?.code }); };
        for (let i = 0; i < n; i++) await imprimerSurGoodcom(r.lines, r.columns).catch(traduireEchec);
        setImpressions((m) => ({ ...m, [order.id]: (m[order.id] || 0) + n }));
        toast(n > 1 ? t('ordersResto.toastTicketSentN', { n }) : t('ordersResto.ticketSentTerminal'));
        return;
      }
      // Dans l'appli (iPhone, Android) sans terminal Goodcom : la WebView n'a pas de boîte d'impression, print() ne fait
      // rien, et l'écran comptait quand même « Ticket déjà imprimé 1 fois » (audit du 19/10, shop-211). On le dit, sans compter.
      if (estNatif()) { toast(t('ordersResto.printNoPrinterApp'), 'erreur'); return; }
      imprimerTicketPapier(r.lines, r.columns, `Fairride ${order.orderNumber ? `#${String(order.orderNumber).padStart(3, '0')}` : String(order.id).slice(0, 8)}`);
      setImpressions((m) => ({ ...m, [order.id]: (m[order.id] || 0) + 1 }));
    } catch (e) { toast(e.message, 'erreur'); }
  }

  // Photo de la commande avant la remise (fondateur, 2026-10-08) : numéro de commande et produits dans le cadre.
  const [photoEnCours, setPhotoEnCours] = useState(null);
  async function photographier(o, fichier) {
    if (!fichier) return;
    setPhotoEnCours(o.id);
    try {
      await apiUpload(`/orders/${o.id}/photo`, { file: fichier, token, fieldName: 'photo' });
      toast(t('ordersResto.photoToast'));
      await loadDashboard(restoId, { fiche: false, annexes: false, silencieux: true });
    } catch (e) { toast(e.message, 'erreur'); } finally { setPhotoEnCours(null); }
  }
  /* UNE COMMANDE (nouveau style, 2026-10-16, « La commande qui sonne » ; revue à l'audit design 2, 2026-10-19).
     La pastille porte l'étape et SA couleur (plus de liseré coloré à gauche : la couleur reste sur la pastille, et seule une
     commande qui attend est bordée de rouge). En tête : le client et le numéro qu'on annonce en cuisine, puis une ligne
     « Livraison · Molenbeek, 1,2 km · payée en ligne » (et « prête vers 19:52 » une fois acceptée), les plats (quantité en
     iris, notes du client visibles). Une commande qui attend n'a ni route ni phrase d'échéance : l'anneau dit le temps qui
     reste. Le temps de préparation reste sur la carte ; « Accepter » et « Refuser » de la plus pressée sont dans la barre
     au-dessus des onglets (app), les suivantes gardent les leurs, en iris. Une fois le livreur trouvé, il apparaît comme une
     personne (LivreurCommande). À emporter prête : le numéro et le prénom du client à côté de « Remis au client » (plus de
     code à taper depuis le 2026-10-20), « Client pas venu » dessous. Toucher la carte ouvre le détail, comme avant. */
  const nouvellesTriees = enCours.filter((o) => orderStageKey(o) === 'nouveau').sort((a, b) => echeance(a) - echeance(b));
  const plusPressee = nouvellesTriees.find((o) => o.status === 'nouveau')?.id;
  /* UN SEUL LIME À L'ÉCRAN (fondateur, 2026-10-27, réponse 3 A de maquettes/ecrans-pro ; design.md, règle 4). Tant qu'une commande
     attend, le lime est à « Accepter » ; sinon au geste de la première carte, dans l'ordre de l'écran (« Marquer prêt » d'une
     commande en préparation, puis « Remis au client » d'une commande à emporter prête). Les autres gestes sont en contour iris :
     trois boutons pleins de couleur se disputaient l'écran (Accepter lime, Marquer prêt et Remis au client iris). */
  const prochaine = plusPressee ? null
    : (enCours.find((o) => o.status === 'preparation') || enCours.find((o) => o.status === 'pret' && o.orderType === 'pickup'))?.id;
  const boutonGeste = (o) => `ec-bouton ${o.id === prochaine ? 'ec-bouton--lime' : 'ec-bouton--contour'}`;
  /* LA CARTE AU CLAVIER (audit du 19/10, CROSS-85) : toucher la carte ouvre le détail, mais une div n'est ni atteignable à la
     tabulation ni activable par Entrée. Elle entre dans l'ordre de tabulation et s'ouvre par Entrée ou Espace — seulement
     quand c'est la carte elle-même qui a le focus, pas l'un de ses boutons (Accepter, imprimer…). Un groupe nommé, pas role="button" :
     la carte contient des boutons, et un bouton dans un bouton n'est pas permis. */
  const ouvrirAuClavier = (o) => ({
    tabIndex: 0,
    role: 'group',
    'aria-label': t('ordersResto.orderOf', { name: o.clientName }),
    onKeyDown: (e) => {
      if (e.target !== e.currentTarget || (e.key !== 'Enter' && e.key !== ' ')) return;
      e.preventDefault();
      setSelectedOrder(o);
    }
  });
  const boutonPhoto = (o, classe, taille) => (
    <>
      {['nouveau', 'preparation', 'pret'].includes(o.status) && !o.preparedPhoto && (
        <label className={classe} title={t('ordersResto.photoHelp')} aria-label={t('ordersResto.photoBtn')} onClick={(e) => e.stopPropagation()}>
          {photoEnCours === o.id ? '…' : <Icone nom="photo" taille={taille} className="icone-texte" />}
          {/* sr-only plutôt que hidden (audit du 19/10, CROSS-95) : un champ caché n'entrait pas dans la tabulation, la photo
              de la commande prête n'était pas atteignable au clavier. */}
          <input type="file" accept="image/*" capture="environment" className="sr-only" aria-label={t('ordersResto.photoBtn')} disabled={photoEnCours === o.id} onChange={(e) => { photographier(o, e.target.files?.[0]); e.target.value = ''; }} />
        </label>
      )}
      {o.preparedPhoto && (
        <a className={classe} href={o.preparedPhoto.url} target="_blank" rel="noreferrer" title={t('ordersResto.photoDone', { time: new Date(o.preparedPhoto.at).toLocaleTimeString(getLocale(), { hour: '2-digit', minute: '2-digit' }) })} onClick={(e) => e.stopPropagation()}><Icone nom="photo" taille={taille} className="icone-texte" />✓</a>
      )}
    </>
  );
  // « Livraison · Molenbeek, 1,2 km · payée en ligne · prête vers 19:52 » : ce qu'il faut savoir d'un coup d'œil.
  const sousTitre = (o) => {
    const pret = ['preparation'].includes(o.status) ? heurePrete(o) : null;
    return [orderTypeLabel(o, t), ouEstLeClient(o), o.paymentMode !== 'on_site' && o.paid ? t('serviceCommerce.payeeEnLigne') : '', pret ? t('serviceCommerce.preteVers', { time: pret }) : '']
      .filter(Boolean).join(' · ');
  };
  /* LA REMISE AU COMPTOIR (à emporter, prête). Jusqu'au 2026-10-20, un champ où taper le code du client, puis « Valider la
     commande ». Au vrai test chez Maestro Pizza, c'était un geste de trop en plein service (fondateur) : il ne reste qu'un
     bouton, « Remis au client », et juste à côté le numéro de commande et le prénom du client — ce que le client annonce au
     comptoir (son numéro ou son nom) et ce que porte le ticket du sac, pour remettre le bon sac à la bonne personne. Le
     contrôle d'âge de l'alcool ne change pas (confirmTakeaway ouvre VerificationAge). « Client pas venu » reste dessous.
     « CLIENT PAS VENU » (audit du 19/10, shop-204 / LIVE-03 et shop-206) : il était offert dès l'acceptation, juste sous
     « Marquer prêt », et un appui de travers fermait au client le paiement sur place partout. Il n'apparaît plus qu'une fois
     la commande prête et l'heure noShowFrom passée (le serveur la calcule : 30 min après « prête » ou l'heure annoncée au
     client) ; avant, une ligne dit à partir de quand. Il vaut aussi pour une commande payée en ligne (close sans
     remboursement, elle reste due), qui n'avait aucune issue. */
  const boutonPasVenu = (o) => {
    if (o.status !== 'pret' || o.orderType !== 'pickup' || !o.noShowFrom) return null;
    if (Date.now() < o.noShowFrom) {
      const heure = new Date(o.noShowFrom).toLocaleTimeString(getLocale(), { hour: '2-digit', minute: '2-digit' });
      return <p className="small" style={{ margin: '6px 0 0', color: 'var(--ink-soft)' }}>{t('ordersResto.noShowFromHint', { time: heure })}</p>;
    }
    return <button type="button" className="ec-pas-venu" onClick={() => setPasVenu(o)}><Icone nom="interdit" taille={16} />{t('ordersResto.customerNoShow')}</button>;
  };
  // Payée sur place puis refusée ou annulée : plus rien « à encaisser » (audit du 19/10, LIVE-10, côté commerce). La ligne de
  // raison (ligneRaison) dit ce qui s'est passé ; « Client pas venu » garde son badge rouge.
  const rienAEncaisser = (o) => ['refuse', 'annule'].includes(o.status);
  // Pourquoi une commande de l'historique s'est fermée (audit du 19/10, shop-203) : motif du refus, délai dépassé, faute de
  // livreur… Le badge « Client pas venu » dit déjà le sien.
  const ligneRaison = (o) => {
    const r = o.pickupNoShow ? null : raisonFermeture(o);
    return r?.cle ? <p className="small" style={{ margin: '4px 0 0', color: 'var(--ink-soft)' }}>{t(r.cle, { client: o.clientName || '', ...r.valeurs })}</p> : null;
  };
  const qui = (o) => (
    <span className="ec-remise-qui">
      {o.orderNumber ? <span className="commande-numero">{numeroCommande(o)}</span> : null}
      <b>{prenom(o.clientName)}</b>
    </span>
  );
  const remiseClient = (o) => (
    <div className="ec-remise-client" onClick={(e) => e.stopPropagation()}>
      <div className="ec-remise-ligne">
        {qui(o)}
        <button type="button" className={boutonGeste(o)} disabled={confirmingPickup === o.id} onClick={() => confirmTakeaway(o)}>
          {confirmingPickup === o.id ? '…' : t('ordersResto.handedToCustomer')}
        </button>
      </div>
      {boutonPasVenu(o)}
    </div>
  );
  const carteCommande = (o, { barre = false } = {}) => {
    const stageKey = orderStageKey(o);
    const stage = ORDER_STAGES.find((s) => s.key === stageKey);
    const stageColor = stageColors[stageKey];
    const nouvelle = o.status === 'nouveau';
    const close = ['terminee', 'annulee'].includes(stageKey);
    // La plus pressée a ses boutons dans la barre au-dessus des onglets (app) : la carte garde le temps de préparation.
    const dansLaBarre = barre && o.id === plusPressee;
    return (
    <div className={`ec-commande${nouvelle ? ' ec-commande--nouvelle' : ''}`} key={o.id} onClick={() => setSelectedOrder(o)} {...ouvrirAuClavier(o)}>
      <div className="ec-cmd-l1">
        {/* Étape en texte foncé, la couleur sur la pastille seule (audit du 15/10/2026). */}
        <span key={stageKey} className={`etape-pastille ec-saute${nouvelle ? ' ec-sonne' : ''}`} style={{ '--etape-couleur': stageColor }}>
          <Icone nom={stage.icon} taille={16} className="icone-texte" /> {t(`orderStatus.stage_${stage.key}`)}
        </span>
        {boutonPhoto(o, 'btn-ghost order-print-btn', 18)}
        <button type="button" className="btn-ghost order-print-btn" title={t('ordersResto.printDeliveryNote')} aria-label={t('ordersResto.printTicket')}
          disabled={envoiTicket === o.id} onClick={(e) => { e.stopPropagation(); if (aTerminal) imprimerSurTerminal(o); else { setSelectedOrder(o); } }}><Icone nom="imprimante" taille={16} className="icone-texte" /></button>
        {nouvelle && o.acceptDeadline && <AnneauDelai order={o} />}
      </div>
      <div className="ec-cmd-l2">
        <span className="ec-cmd-client">
          <b>{o.clientName}{o.isTraining && <span className="pill" style={{ marginLeft: 6 }}>{t('ordersResto.trainingBadge')}</span>}</b>
          {/* Le serveur n'envoie le numéro que pendant le service (shop-224) : un appui l'appelle. */}
          {o.clientPhone && <a href={`tel:${o.clientPhone}`} onClick={(e) => e.stopPropagation()}><Icone nom="telephone" taille={14} className="icone-texte" />{' '}{telephoneLisible(o.clientPhone)}</a>}
        </span>
        {/* Le numéro du ticket imprimé et de la fenêtre « nouvelle commande », en grand : c'est lui qu'on annonce en cuisine. */}
        {o.orderNumber ? <span className="commande-numero">{numeroCommande(o)}</span> : <span className={`status-badge status-${o.status}`}>{statusLabel(o.status, o.orderType, t)}</span>}
      </div>
      <p className="ec-cmd-sous">{sousTitre(o)}</p>
      {/* Paiement sur place : encadré, c'est de l'argent à encaisser (fondateur, 2026-10-07). */}
      {o.paymentMode === 'on_site' && (!rienAEncaisser(o) || o.pickupNoShow) && (
        <span className={`small paiement-badge paiement-sur-place${o.pickupNoShow ? ' est-pas-venu' : ''}`} style={{ fontWeight: 700, color: o.pickupNoShow ? 'var(--red)' : undefined }}>
          {o.pickupNoShow ? t('ordersResto.noShowBadge') : t('ordersResto.payOnSiteBadge', { amount: euros(o.total) })}
        </span>
      )}
      {o.print && <div style={{ margin: '4px 0' }}><EtatImpression p={o.print} t={t} /></div>}
      {!nouvelle && !close && <div className="ec-route-blanc"><RouteSuivi status={o.status} orderType={o.orderType} /></div>}
      <ListePlats items={o.items} />
      <PastilleCouverts order={o} />
      {close && <DeliveryTiming order={o} />}
      <BandeauAllergie order={o} />
      <BadgeAlcool order={o} />
      {nouvelle && (
        <div className="ec-cmd-actions" onClick={(e) => e.stopPropagation()}>
          {/* Temps de préparation en plus, annoncé à l'acceptation (RES-10) : l'heure estimée du client recule d'autant. */}
          <p className="ec-feuille-titre">{t('ordersResto.extraPrepLabel')}</p>
          <SegmentGlisse libelle={t('ordersResto.extraPrepLabel')} valeur={tempsEnPlus[o.id] || 0}
            onChange={(v) => { vibrer('choix'); setTempsEnPlus((p) => ({ ...p, [o.id]: v })); }}
            options={[{ value: 0, label: t('ordersResto.extraPrepNone') }, ...[10, 20, 30].map((m) => ({ value: m, label: t('ordersResto.extraPrepMinutes', { n: m }) }))]} />
          {/* Sur un téléphone, ceux de la plus pressée sont dans la barre du bas : cachés ici par le CSS (.ec-cmd-boutons-barre),
              mais gardés pour une tablette plus large, où la barre ne s'affiche pas. */}
          {(
            <div className={dansLaBarre ? 'ec-cmd-boutons-barre' : undefined}>
              <button type="button" className={`ec-bouton ${o.id === plusPressee ? 'ec-bouton--lime' : 'ec-bouton--contour'}`} disabled={actionsEnCours.has(o.id)} onClick={() => accepter(o)}>
                {actionsEnCours.has(o.id) ? '…' : t('ordersResto.accept')}
              </button>
              <button type="button" className="ec-bouton ec-bouton--texte" disabled={actionsEnCours.has(o.id)} onClick={() => setARefuser(o)}>{t('ordersResto.refuse')}</button>
            </div>
          )}
        </div>
      )}
      {/* Lime pour la première seulement, contour iris pour les autres (`prochaine`, plus haut). */}
      {o.status === 'preparation' && (
        <div onClick={(e) => e.stopPropagation()}>
          <button type="button" className={boutonGeste(o)} disabled={actionsEnCours.has(o.id)} onClick={() => orderAction(o.id, 'ready')}>{t('ordersResto.markReady')}</button>
        </div>
      )}
      {o.status === 'pret' && o.orderType === 'pickup' && remiseClient(o)}
      {close && ligneRaison(o)}
      {/* RETRAIT SANS RIEN TAPER (simulation du 10 oct. 2026) : le commerce compare à l'œil le code que le livreur lui
          montre avec celui-ci ; c'est le livreur qui confirme le retrait de son côté (PATCH /orders/:id/picked-up). */}
      <CodeRetrait order={o} t={t} />
      {/* Le livreur, une personne : qui vient, s'il est là (et depuis quand), son pourboire. */}
      <LivreurCommande order={o} />
      {o.status === 'pret' && o.orderType === 'delivery' && !o.driverId && (
        <p className="small" style={{ marginTop: 8, marginBottom: 0 }}>{t('ordersResto.waitingDriver')}</p>
      )}
    </div>
    );
  };
  // Accepter : une demande d'allergie se confirme d'abord (A1), comme dans la feuille « Nouvelle commande ».
  function accepter(o) {
    vibrer('valider');
    if (o.allergyRequest) setAllergieAConfirmer(o);
    else orderAction(o.id, 'accept', { extraMinutes: tempsEnPlus[o.id] || 0 });
  }

  // Les fenêtres (détail, refus avec motif, allergie, client pas venu, contrôle d'âge), communes au tableau du site et à la liste de l'app.
  const fenetres = (
    <>
        {/* Une vraie fenêtre (Modale) et non plus un fond fait main (audit du 19/10, CROSS-06) : Échap la ferme, le focus y
            entre et revient à la carte, et le Retour d'Android ferme le détail au lieu de quitter la page des commandes. */}
        {selectedOrder && (
          <Modale classe="no-print" ariaLabel={t('ordersResto.orderOf', { name: selectedOrder.clientName })} onFermer={() => setSelectedOrder(null)}>
              <div className="row" style={{ justifyContent: 'space-between', marginBottom: 8 }}>
                <h3 style={{ margin: 0 }}>{t('ordersResto.orderOf', { name: selectedOrder.clientName })}</h3>
                {selectedOrder.orderNumber ? <span className="commande-numero">{numeroCommande(selectedOrder)}</span> : <span className={`status-badge status-${selectedOrder.status}`}>{statusLabel(selectedOrder.status, selectedOrder.orderType, t)}</span>}
              </div>
              <div className={`order-type-badge order-type-badge-${orderTypeColor(selectedOrder)}`} style={{ marginBottom: 8 }}>{orderTypeLabel(selectedOrder, t)}</div>
              {(() => {
                const sk = orderStageKey(selectedOrder);
                const stg = ORDER_STAGES.find((s) => s.key === sk);
                const col = stageColors[sk];
                return (
                  <span className="etape-pastille" style={{ '--etape-couleur': col, marginBottom: 8 }}>
                    <Icone nom={stg.icon} taille={16} className="icone-texte" /> {t(`orderStatus.stage_${stg.key}`)}
                  </span>
                );
              })()}
              <ProgressBar status={selectedOrder.status} orderType={selectedOrder.orderType} />
              <DeliveryTiming order={selectedOrder} />
              <div className="divider" />
              <h4 style={{ margin: '0 0 6px' }}>{t('ordersResto.items')}</h4>
              {/* Clé par position : le même plat deux fois (options différentes) faisait une clé en double. La note du client
                  sur un plat (« sans oignon ») manquait ici, alors que la carte et le ticket la portent (shop-219). */}
              {selectedOrder.items.map((i, n) => (
                <div key={`${i.itemId}-${n}`} className="row" style={{ justifyContent: 'space-between', padding: '4px 0', alignItems: 'flex-start' }}>
                  <span>
                    {i.qty}× {i.name}{i.discount > 0 ? <Icone nom="etiquette" taille={16} className="icone-texte" /> : ''}
                    {i.options?.length > 0 && <span className="small" style={{ display: 'block' }}>{i.options.map((o) => o.name).join(', ')}</span>}
                    {i.note && <span className="small" style={{ display: 'block', fontStyle: 'italic' }}>« {i.note} »</span>}
                  </span>
                  <span>{euros((i.price * i.qty - (i.discount || 0)))}</span>
                </div>
              ))}
              <div className="divider" />
              <div className="breakdown">
                <div className="line"><span>{t('ordersResto.subtotal')}</span><span>{euros(selectedOrder.subtotal)}</span></div>
                {selectedOrder.promoDiscount > 0 && <div className="line"><span>{t('ordersResto.promo', { label: selectedOrder.promoLabel })}</span><span>-{euros(selectedOrder.promoDiscount)}</span></div>}
                {selectedOrder.orderType === 'delivery' && <div className="line"><span>{t('ordersResto.delivery')}</span><span>{euros(selectedOrder.deliveryFee)}</span></div>}
                {selectedOrder.serviceFee > 0 && <div className="line"><span>{t('ordersResto.serviceFee')}</span><span>{euros((selectedOrder.serviceFee + (selectedOrder.serviceFeeVat || 0)))}</span></div>}
                {selectedOrder.balanceUsed > 0 && <div className="line"><span>{t('ordersResto.balanceUsed')}</span><span>-{euros(selectedOrder.balanceUsed)}</span></div>}
                <div className="line total"><span>{selectedOrder.paymentMode === 'on_site' ? `${t('ordersResto.toCollectOnSite')}` : t('ordersResto.totalPaid')}</span><span>{euros(selectedOrder.total)}</span></div>
              </div>
              <div className="divider" />
              <h4 style={{ margin: '0 0 6px' }}>{selectedOrder.orderType === 'pickup' ? t('ordersResto.takeaway') : t('ordersResto.delivery')}</h4>
              {selectedOrder.orderType === 'delivery' && <p className="small" style={{ margin: '4px 0' }}><Icone nom="position" taille={16} className="icone-texte" />{' '}{selectedOrder.address}</p>}
              {selectedOrder.orderType === 'pickup' && <p className="small" style={{ margin: '4px 0' }}>{t('ordersResto.pickupInfo')}</p>}
              {selectedOrder.clientPhone && <p className="small" style={{ margin: '4px 0' }}><a href={`tel:${selectedOrder.clientPhone}`}><Icone nom="telephone" taille={16} className="icone-texte" />{' '}{telephoneLisible(selectedOrder.clientPhone)}</a></p>}
              <BandeauAllergie order={selectedOrder} />
              <PastilleCouverts order={selectedOrder} />
              <BadgeAlcool order={selectedOrder} />
              {selectedOrder.deliveryInstructions && <p className="small" style={{ margin: '4px 0' }}><Icone nom="cle" taille={16} className="icone-texte" />{' '}{deliveryInstructionLabel(selectedOrder.deliveryInstructions, t)}</p>}
              {selectedOrder.deliveryNote && <p className="small" style={{ margin: '4px 0' }}><Icone nom="document" taille={16} className="icone-texte" />{' '}{selectedOrder.deliveryNote}</p>}
              {selectedOrder.orderType === 'delivery' && selectedOrder.driverName && <p className="small" style={{ margin: '4px 0' }}>{t('ordersResto.driverLine', { name: selectedOrder.driverName, phone: selectedOrder.driverPhone ? ` · ${selectedOrder.driverPhone}` : '' })}</p>}
              {selectedOrder.status === 'pret' && selectedOrder.orderType === 'pickup' && (
                <div className="row" style={{ marginTop: 10, gap: 12, alignItems: 'center' }}>
                  {/* Même remise que sur la carte : plus de code à taper (2026-10-20), le numéro et le prénom à côté. */}
                  {qui(selectedOrder)}
                  <button className="btn-teal btn-sm" disabled={confirmingPickup === selectedOrder.id} onClick={() => confirmTakeaway(selectedOrder)}>
                    {confirmingPickup === selectedOrder.id ? '...' : t('ordersResto.handedToCustomer')}
                  </button>
                </div>
              )}
              {boutonPasVenu(selectedOrder)}
              <CodeRetrait order={selectedOrder} t={t} />
              {/* Le détail d'une commande qui attend n'avait ni « Accepter » ni « Refuser » (audit du 19/10, shop-202) : il fallait
                  le fermer et retrouver la carte. Mêmes gestes que la carte (temps en plus choisi sur la carte, allergie à confirmer). */}
              {selectedOrder.status === 'nouveau' && (
                <div className="row" style={{ marginTop: 12, gap: 8, flexWrap: 'wrap' }}>
                  <button type="button" className="btn-teal" disabled={actionsEnCours.has(selectedOrder.id)} onClick={() => accepter(selectedOrder)}>
                    {actionsEnCours.has(selectedOrder.id) ? '…' : t('ordersResto.accept')}
                  </button>
                  <button type="button" className="btn-outline" disabled={actionsEnCours.has(selectedOrder.id)} onClick={() => setARefuser(selectedOrder)}>{t('ordersResto.refuse')}</button>
                </div>
              )}
              {/* ANNULER UNE COMMANDE DÉJÀ ACCEPTÉE (audit du 19/10, shop-207) : le serveur le permettait (PATCH /refuse depuis
                  « en préparation » ou « prête », motif obligatoire, remboursement, livreur prévenu), aucun écran ne l'offrait.
                  Ici seulement, dans le détail, pas sur la carte : c'est un geste rare, à ne pas toucher par erreur en service. */}
              {['preparation', 'pret'].includes(selectedOrder.status) && (
                <button type="button" className="btn-danger-ghost" style={{ marginTop: 12 }} disabled={actionsEnCours.has(selectedOrder.id)} onClick={() => setAAnnuler(selectedOrder)}>
                  {t('ordersResto.cancelAccepted')}
                </button>
              )}
              <div className="divider" />
              {/* UN bouton d'impression (2026-09-23). Le terminal Fairide imprime les tickets de lui-même
                  (fondateur, 2026-09-22) ; ici ne reste que le secours : l'imprimante Bluetooth si elle est
                  connectée, sinon la boîte d'impression de l'appareil. « Modifier le ticket » et le texte
                  d'explication qui précédaient les boutons sont partis. */}
              {aTerminal ? (
                <>
                  <div className="row" style={{ gap: 8, alignItems: 'center', flexWrap: 'wrap', marginBottom: 8 }}>
                    <b className="small">{t('ordersResto.ticketTitle')}</b>
                    {selectedOrder.print ? <EtatImpression p={selectedOrder.print} t={t} /> : <span className="small" style={{ color: 'var(--ink-faint)' }}>{t('ordersResto.notPrintedYet')}</span>}
                  </div>
                  {selectedOrder.print?.printed > 0 && <p className="small" style={{ margin: '0 0 8px', color: 'var(--ink-soft)' }}>{t('ordersResto.reprintHelp')}</p>}
                  <div className="row" style={{ marginTop: 4, gap: 8, flexWrap: 'wrap', alignItems: 'center' }}>
                    <Exemplaires valeur={exemplaires} onChange={setExemplaires} t={t} min={minExemplaires(selectedOrder)} />
                    <button className="btn-teal" disabled={envoiTicket === selectedOrder.id} onClick={() => imprimerSurTerminal(selectedOrder, exemplaires)}>
                      {envoiTicket === selectedOrder.id ? t('ordersResto.printing') : selectedOrder.print?.printed > 0 ? t('ordersResto.reprintTerminal') : t('ordersResto.printTerminal')}
                    </button>
                    <button className="btn-outline" onClick={() => voirApercu(selectedOrder)}>{apercu?.orderId === selectedOrder.id ? t('ordersResto.hidePreview') : t('ordersResto.showPreview')}</button>
                    <button className="btn-ghost" onClick={() => printReceipt(selectedOrder, exemplaires)}>{t('ordersResto.printFromDevice')}</button>
                    <button className="btn-ghost" onClick={() => setSelectedOrder(null)}>{t('ordersResto.close')}</button>
                  </div>
                </>
              ) : (
                <>
                  {impressions[selectedOrder.id] > 0 && (
                    <p className="small" style={{ margin: '0 0 8px' }}><Icone nom="valider" taille={16} className="icone-texte" />{' '}{t('ordersResto.printedTimes', { n: impressions[selectedOrder.id] })}</p>
                  )}
                  <div className="row" style={{ marginTop: 4, gap: 8, flexWrap: 'wrap', alignItems: 'center' }}>
                    <Exemplaires valeur={exemplaires} onChange={setExemplaires} t={t} />
                    <button className="btn-teal" onClick={() => printReceipt(selectedOrder, exemplaires)}>
                      {impressions[selectedOrder.id] ? t('ordersResto.printAgain') : t('ordersResto.printTicket')}
                    </button>
                    <button className="btn-outline" onClick={() => voirApercu(selectedOrder)}>{apercu?.orderId === selectedOrder.id ? t('ordersResto.hidePreview') : t('ordersResto.showPreview')}</button>
                    <button className="btn-ghost" onClick={() => setSelectedOrder(null)}>{t('ordersResto.close')}</button>
                  </div>
                  <p className="small" style={{ margin: '8px 0 0', color: 'var(--ink-faint)' }}>{t(estNatif() ? 'ordersResto.noTerminalHintApp' : 'ordersResto.noTerminalHint')}{!membreEquipe && <> <Link to="/dashboard/terminal">{t('ordersResto.terminalSettings')}</Link></>}</p>
                </>
              )}
              {apercu?.orderId === selectedOrder.id && <div style={{ marginTop: 12 }}><TicketPapier lines={apercu.lines} columns={apercu.columns} /></div>}
          </Modale>
        )}
        {/* Portail séparé du modal (lui-même marqué no-print) : c'est ce qui garantit que le reçu reste
            visible à l'impression même si le modal et le reste de la page sont masqués (voir OrderReceipt.jsx
            et .receipt-print dans styles.css — un enfant ne peut jamais annuler le display:none d'un ancêtre). */}
        {selectedOrder && createPortal(<OrderReceipt order={selectedOrder} restaurant={restaurant} />, document.body)}
        <ConfirmDialog open={!!pasVenu} danger
          title={t('ordersResto.confirmNoShowTitle')}
          message={t(pasVenu?.paymentMode === 'on_site' ? 'ordersResto.confirmNoShowText' : 'ordersResto.confirmNoShowTextOnline', { name: pasVenu?.clientName || '' })}
          confirmLabel={t('ordersResto.customerNoShow')}
          loading={clotureEnCours}
          onCancel={() => setPasVenu(null)}
          onConfirm={signalerPasVenu} />
        {/* Motif obligatoire : le serveur le refuse sans (MOTIF_REQUIS) et le transmet au client, dans son suivi et
            dans l'e-mail de refus. Avant, le client apprenait le refus sans savoir pourquoi. */}
        <ReasonDialog open={!!aRefuser} danger
          title={t('ordersResto.confirmRefuseTitle')}
          message={`${t(aRefuser?.paymentMode === 'on_site' ? 'ordersResto.confirmRefuseTextOnSite' : 'ordersResto.confirmRefuseText', { name: aRefuser?.clientName || '' })} ${t('ordersResto.refuseReasonHint')}`}
          label={t('ordersResto.refuseReasonLabel')}
          placeholder={t('ordersResto.refuseReasonPlaceholder')}
          confirmLabel={t('ordersResto.refuse')}
          suggestions={motifsRefus} loading={motifEnvoi}
          onCancel={() => setARefuser(null)}
          onConfirm={(motif) => envoyerMotif(aRefuser, motif)} />
        {/* Annulation après acceptation (shop-207) : même route et même motif obligatoire que le refus ; le client reçoit
            « a dû annuler ta commande » avec le motif, remboursé s'il avait payé en ligne, et le livreur déjà en route est prévenu. */}
        <ReasonDialog open={!!aAnnuler} danger
          title={t('ordersResto.confirmCancelTitle')}
          message={[
            t(aAnnuler?.paymentMode === 'on_site' ? 'ordersResto.confirmCancelTextOnSite' : 'ordersResto.confirmCancelText', { name: aAnnuler?.clientName || '' }),
            aAnnuler?.driverId ? t('ordersResto.confirmCancelDriver') : '',
            t('ordersResto.refuseReasonHint')
          ].filter(Boolean).join(' ')}
          label={t('ordersResto.refuseReasonLabel')}
          placeholder={t('ordersResto.refuseReasonPlaceholder')}
          confirmLabel={t('ordersResto.cancelAccepted')}
          suggestions={motifsRefus} loading={motifEnvoi}
          onCancel={() => setAAnnuler(null)}
          onConfirm={(motif) => envoyerMotif(aAnnuler, motif, { annulation: true })} />
        {/* A1 : accepter une commande avec demande d'allergie, c'est s'engager à la respecter. */}
        <ConfirmDialog open={!!allergieAConfirmer}
          title={t('conformite.allergyConfirmTitle')}
          message={t('conformite.allergyConfirmText', { request: allergieAConfirmer?.allergyRequest || '' })}
          confirmLabel={t('conformite.allergyConfirmAccept')}
          onCancel={() => setAllergieAConfirmer(null)}
          onConfirm={() => { const o = allergieAConfirmer; setAllergieAConfirmer(null); orderAction(o.id, 'accept', { allergyAck: true, extraMinutes: tempsEnPlus[o.id] || 0 }); }} />
        {/* B6 : pas de remise d'alcool sans pièce d'identité contrôlée. Refus → commande close, tâche admin. */}
        <VerificationAge order={ageAVerifier} onFermer={() => setAgeAVerifier(null)}
          onVerifie={() => { const o = ageAVerifier; setAgeAVerifier(null); confirmTakeaway(o, true); }}
          onRefuse={() => refuserRemiseAge(ageAVerifier)} />
    </>
  );

  /* LE TABLEAU DU SITE (2026-10-16, maquettes/site-ordinateur/site-ordinateur.html › Espace commerce). Trois colonnes : Nouvelles (la plus
     pressée en tête, bordure rouge qui bat, seule à porter « Accepter » en lime ; les suivantes en iris), En préparation,
     Prêtes (prête, livreur en route). La colonne dit l'étape : la pastille ne reste que là où elle précise (livreur attendu,
     client attendu, en route). Mêmes gestes que la liste de l'app : photo, ticket, temps en plus, allergie à confirmer,
     refus avec motif (ReasonDialog), prête, client pas venu, « Remis au client », code de retrait, contrôle d'âge. Toucher la
     carte ouvre le détail. Quand la feuille est étroite (téléphone), les colonnes s'empilent (site-pro.css). */
  const colonnes = COLONNES.map((c) => ({ ...c, liste: c.cle === 'nouv' ? nouvellesTriees : enCours.filter((o) => c.etapes.includes(orderStageKey(o))) }));
  const carteTableau = (o) => {
    const stageKey = orderStageKey(o);
    const stage = ORDER_STAGES.find((s) => s.key === stageKey);
    const nouvelle = o.status === 'nouveau';
    const pressee = o.id === plusPressee;
    const pastille = !['nouveau', 'preparation'].includes(stageKey);
    return (
      <article key={o.id} className={`sp-cmd${pressee ? ' sp-cmd--pressee' : ''}`} onClick={() => setSelectedOrder(o)} {...ouvrirAuClavier(o)}>
        <div className="sp-cmd-l1">
          <div className="sp-cmd-qui">
            <div className="sp-cmd-tete">
              {o.orderNumber ? <span className="sp-cmd-num">{numeroCommande(o)}</span> : <span className={`status-badge status-${o.status}`}>{statusLabel(o.status, o.orderType, t)}</span>}
              <span className={`order-type-badge order-type-badge-${orderTypeColor(o)}`}>{orderTypeLabel(o, t)}</span>
            </div>
            <b className="sp-cmd-client">{o.clientName}{o.isTraining && <span className="pill" style={{ marginLeft: 6 }}>{t('ordersResto.trainingBadge')}</span>}</b>
            {o.clientPhone && <a className="sp-cmd-tel" href={`tel:${o.clientPhone}`} onClick={(e) => e.stopPropagation()}><Icone nom="telephone" taille={13} className="icone-texte" />{' '}{telephoneLisible(o.clientPhone)}</a>}
          </div>
          <div className="sp-cmd-outils" onClick={(e) => e.stopPropagation()}>
            {boutonPhoto(o, 'sp-outil', 16)}
            <button type="button" className="sp-outil" title={t('ordersResto.printDeliveryNote')} aria-label={t('ordersResto.printTicket')}
              disabled={envoiTicket === o.id} onClick={() => { if (aTerminal) imprimerSurTerminal(o); else setSelectedOrder(o); }}><Icone nom="imprimante" taille={16} /></button>
            {nouvelle && o.acceptDeadline && <AnneauDelai order={o} />}
          </div>
        </div>
        {pastille && (
          <span className="etape-pastille sp-cmd-etape" style={{ '--etape-couleur': stageColors[stageKey] }}>
            <Icone nom={stage.icon} taille={14} className="icone-texte" /> {t(`orderStatus.stage_${stage.key}`)}
          </span>
        )}
        <ListePlats items={o.items} />
        <PastilleCouverts order={o} />
        <div className="sp-cmd-paiement">
          {o.paymentMode === 'on_site' && rienAEncaisser(o) && !o.pickupNoShow ? null : o.paymentMode === 'on_site' ? (
            <span className={`small paiement-badge paiement-sur-place${o.pickupNoShow ? ' est-pas-venu' : ''}`} style={{ fontWeight: 700, color: o.pickupNoShow ? 'var(--red)' : undefined }}>
              {o.pickupNoShow ? t('ordersResto.noShowBadge') : t('ordersResto.payOnSiteBadge', { amount: euros(o.total) })}
            </span>
          ) : (
            <span className="small paiement-badge paiement-en-ligne" style={{ fontWeight: 700 }}><Icone nom="valider" taille={14} className="icone-texte" />{' '}{t('ordersResto.paidOnlineBadge')}</span>
          )}
          {o.print && <EtatImpression p={o.print} t={t} />}
        </div>
        {o.orderType === 'delivery' && o.address && <div className="small sp-cmd-info"><Icone nom="position" taille={14} className="icone-texte" />{' '}{o.address}</div>}
        {/* Une commande qui attend : ni heure estimée ni phrase d'échéance, l'anneau dit le temps qui reste (audit design 2). */}
        {!nouvelle && <DeliveryTiming order={o} />}
        <BandeauAllergie order={o} />
        <BadgeAlcool order={o} />
        {nouvelle && (
          <div className="sp-cmd-actions" onClick={(e) => e.stopPropagation()}>
            <SegmentGlisse libelle={t('ordersResto.extraPrepLabel')} valeur={tempsEnPlus[o.id] || 0}
              onChange={(v) => setTempsEnPlus((p) => ({ ...p, [o.id]: v }))}
              options={[{ value: 0, label: t('ordersResto.extraPrepNone') }, ...[10, 20, 30].map((m) => ({ value: m, label: t('ordersResto.extraPrepMinutes', { n: m }) }))]} />
            <div className="sp-cmd-boutons">
              <button type="button" className={`ec-bouton ${pressee ? 'ec-bouton--lime' : 'ec-bouton--iris'}`} disabled={actionsEnCours.has(o.id)}
                onClick={() => accepter(o)}>
                {actionsEnCours.has(o.id) ? '…' : t('ordersResto.accept')}
              </button>
              <button type="button" className="ec-bouton sp-bouton-contour" disabled={actionsEnCours.has(o.id)} onClick={() => setARefuser(o)}>{t('ordersResto.refuse')}</button>
            </div>
          </div>
        )}
        {o.status === 'preparation' && (
          <div className="sp-cmd-boutons" onClick={(e) => e.stopPropagation()}>
            <button type="button" className="ec-bouton ec-bouton--iris" disabled={actionsEnCours.has(o.id)} onClick={() => orderAction(o.id, 'ready')}>{t('ordersResto.markReady')}</button>
          </div>
        )}
        {o.status === 'pret' && o.orderType === 'pickup' && remiseClient(o)}
        <CodeRetrait order={o} t={t} />
        <LivreurCommande order={o} />
        {o.status === 'pret' && o.orderType === 'delivery' && !o.driverId && (
          <p className="small" style={{ margin: '8px 0 0' }}>{t('ordersResto.waitingDriver')}</p>
        )}
        {['terminee', 'annulee'].includes(stageKey) && ligneRaison(o)}
      </article>
    );
  };
  // L'historique affiché : les closes des dernières 24 h (déjà là, à jour à chaque sondage) puis les pages plus anciennes.
  const historique = (() => {
    const vus = new Set();
    return [...closes, ...hist.liste].filter((o) => (vus.has(o.id) ? false : vus.add(o.id))).sort((a, b) => b.createdAt - a.createdAt);
  })();
  const nbHistorique = Math.max(statsService?.historyCount || 0, closes.length);
  const basculerHistorique = (e) => {
    const ouvert = e.currentTarget.open;
    setHistOuvert(ouvert);
    if (ouvert && !hist.charge && !hist.enCours) chargerHistorique();
  };
  const suiteHistorique = (
    <>
      {hist.erreur && <p className="small" role="alert" style={{ color: 'var(--red)' }}>{hist.erreur} <button type="button" className="btn-ghost btn-sm" onClick={() => chargerHistorique(hist.liste.length > 0)}>{t('ordersResto.retry')}</button></p>}
      {hist.enCours && <p className="small" style={{ color: 'var(--ink-soft)' }}>…</p>}
      {!hist.enCours && hist.plus && <button type="button" className="btn-outline btn-sm" style={{ marginTop: 8 }} onClick={() => chargerHistorique(true)}>{t('ordersResto.historyMore')}</button>}
    </>
  );
  /* LA LISTE EST-ELLE À JOUR ? (audit du 19/10, CROSS-31 et shop-217). Jamais reçue après deux essais : la carte d'échec avec « Réessayer »,
     plus « Pas encore de commande » ; pas encore reçue : un squelette. Deux relectures ratées d'affilée : une ligne dit de
     quand date la liste — l'alarme ne peut pas sonner pour une commande que l'écran ne reçoit pas. */
  const heureMaj = etatCommandes?.derniereMaj ? new Date(etatCommandes.derniereMaj).toLocaleTimeString(getLocale(), { hour: '2-digit', minute: '2-digit' }) : '';
  const etatListe = !ordersLoaded
    ? (etatCommandes?.erreur && etatCommandes.echecs >= 2
      ? <ErrorCard titre={t('ordersResto.loadFailedTitle')} message={etatCommandes.erreur} onRetry={() => loadDashboard(restoId)} />
      : <SkeletonCards count={2} />)
    : etatCommandes?.echecs >= 2
      ? <p className="small ec-liste-ancienne" role="status"><Icone nom="alerte" taille={16} className="icone-texte" />{' '}{t('ordersResto.staleList', { time: heureMaj })}</p>
      : null;
  const etatTerminal = terminaux ? (aTerminal ? (terminalEnLigne ? t('sitePro.terminalEnLigne') : t('sitePro.terminalHorsLigne')) : t('sitePro.terminalAucun')) : null;

  if (tableau) return (
    <div className="no-print sp-page">
      {/* LE BANDEAU (site) : le nom et le résumé, « Commandes », les réglages du service en pastilles claires (son, terminal,
          alarme, notifications), l'interrupteur ouvert / en pause, puis la prochaine étape avant la mise en ligne. */}
      <BandeauCommerce>
        <div className="sp-b-ligne">
          <div className="sp-b-titres">
            <div className="ec-b-haut"><span><b>{restaurant?.name}</b>{' · '}{t('ordersResto.summary', { current: enCours.length, today: duJour })}</span></div>
            <h1 className="ec-b-titre">{t('sitePro.commandes')}</h1>
          </div>
          {/* Le terminal se règle chez le propriétaire : un membre de l'équipe n'a pas la page (DashboardLayout le ramène ici). */}
          {alerte && <AlerteBandeau {...alerte} terminal={membreEquipe ? null : etatTerminal} />}
        </div>
        {restaurant && <InterrupteurService surBandeau restaurant={restaurant} restoId={restoId} token={token} loadDashboard={loadDashboard} modifierRestaurant={modifierRestaurant} />}
        {restaurant && !membreEquipe && <MiseEnLigne surBandeau restaurant={restaurant} restoId={restoId} token={token} onConnect={onConnect} connecting={connecting}
          onChange={() => loadDashboard(restoId)} lectureSeule={lectureSeule} />}
      </BandeauCommerce>
      <FeuilleCommerce>
        {communs}
        <div className="sp-cadre">
        {etatListe}
        {ordersLoaded && enCours.length === 0 && <div className="sp-vide-etroit"><EtatVide icone="commandes" titre={orders.length === 0 && !nbHistorique ? t('ordersResto.noneYet') : t('ordersResto.noneCurrent')} /></div>}
        <div className={`sp-tableau${enCours.length === 0 ? ' sp-tableau--vide' : ''}`} role="group" aria-label={t('sitePro.tableau')}>
          {colonnes.map((c) => (
            <section key={c.cle} className={`sp-kol sp-kol--${c.cle}`} aria-labelledby={`sp-kol-${c.cle}`}>
              <h2 className="sp-kol-t" id={`sp-kol-${c.cle}`}>
                <span className={`sp-kol-ic${c.cle === 'nouv' && c.liste.length ? ' sp-sonne' : ''}`}><Icone nom={c.icone} taille={18} /></span>
                {t(c.titre)} <span className="sp-kol-n">{c.liste.length}</span>
              </h2>
              {c.liste.length ? c.liste.map(carteTableau) : <p className="sp-kol-vide">{t(c.vide)}</p>}
            </section>
          ))}
        </div>
        {restaurant && (
          <div className="ec-ruptures">
            <RupturesDuJour restaurant={restaurant} restoId={restoId} token={token} toast={toast} loadDashboard={loadDashboard} modifierRestaurant={modifierRestaurant} />
          </div>
        )}
        {nbHistorique > 0 && (
          <details className="service-historique sp-historique" onToggle={basculerHistorique}>
            <summary>{t('ordersResto.history', { n: nbHistorique })}</summary>
            {histOuvert && <><div className="sp-historique-grille">{historique.map(carteTableau)}</div>{suiteHistorique}</>}
          </details>
        )}
        </div>
      </FeuilleCommerce>
      {fenetres}
    </div>
  );

  /* L'APP (audit design 2, section 2, 2026-10-19) : le premier écran est à la commande. Sur le bandeau, une ligne : le nom,
     le résumé du service et l'interrupteur ouvert / en pause ; puis l'alarme en une ligne (LigneAlarme, « Couper » blanc) ;
     l'état du terminal. Dans la feuille : « À traiter » d'abord (la plus pressée en tête), puis les blocs communs (prochaine
     étape…), « En préparation », « Prêtes ». Tant qu'une commande attend, « Accepter #058 » et « Refuser » flottent dans une
     barre au-dessus des onglets (portail dans <body> : la feuille et .page-fade s'animent avec transform, qui casse fixed). */
  if (etapes && restaurant && !restaurant.publicListed && !membreEquipe && enCours.length === 0) return (
    <div className="no-print">
      <BandeauCommerce route={false}>
        <div className="ec-b-haut"><span><b>{restaurant.name}</b></span><span className="ec-chip">{t('ecranCommerce.pasEnLigne')}</span></div>
        <h1 className="ec-b-titre">{t('miseEnLigne.title')}</h1>
        <p className="ec-b-sous">{t('miseEnLigne.progress', { n: etapes.faites, total: etapes.etapes.length })}</p>
        <RouteMiseEnLigne etapes={etapes.etapes} />
      </BandeauCommerce>
      <FeuilleCommerce>
        {communs}
        <EtapesMiseEnLigne etat={etapes} />
      </FeuilleCommerce>
      {fenetres}
    </div>
  );
  const sections = COLONNES.map((c) => ({ ...c, liste: c.cle === 'nouv' ? nouvellesTriees : enCours.filter((o) => c.etapes.includes(orderStageKey(o))) }));
  const titresSections = { nouv: 'serviceCommerce.aTraiter', prep: 'serviceCommerce.enPreparation', pret: 'serviceCommerce.pretes' };
  const enTete = (c) => <p className="ec-section ec-section--service" key={`t-${c.cle}`}>{t(titresSections[c.cle])} <span className="ec-section-n">{c.liste.length}</span></p>;
  const pressee = nouvellesTriees.find((o) => o.id === plusPressee);
  return (
    <div className="no-print">
      <TirerPourActualiser onActualiser={() => loadDashboard(restoId, { silencieux: true })} />
      {/* UN TITRE ET LA ROUTE DU VÉLO (fondateur, 2026-10-27, réponse 2 A de maquettes/ecrans-pro) : le bandeau dit d'abord ce qui
          attend, comme « Chez toi vers 15:41 » chez le client ; le résumé passe dessous, la route du vélo avant l'alarme. Le lien
          du terminal est parti : le terminal se règle dans Mon compte › Mon terminal Fairride (le site garde son état sur le
          tableau, AlerteBandeau). */}
      <BandeauCommerce route={false}>
        <div className="ec-b-haut">
          <span><b>{restaurant?.name}</b></span>
          {restaurant && <InterrupteurService compact restaurant={restaurant} restoId={restoId} token={token} loadDashboard={loadDashboard} modifierRestaurant={modifierRestaurant} />}
        </div>
        <h1 className="ec-b-titre">
          {nouvellesTriees.length ? (nouvellesTriees.length === 1 ? t('alertBar.toHandleOne') : t('alertBar.toHandle', { n: nouvellesTriees.length }))
            : enCours.length ? t('ecransPro.enCours', { n: enCours.length }) : t('ecransPro.rienEnCours')}
        </h1>
        <p className="ec-b-sous">
          {nouvellesTriees.length ? t('ordersResto.summary', { current: enCours.length, today: duJour }) : t('ecransPro.aujourdhui', { n: duJour })}
        </p>
        <RouteVelo roule className="ec-b-route" />
        <LigneAlarme alerte={alerte} />
      </BandeauCommerce>
      <FeuilleCommerce>
        {nouvellesTriees.length > 0 && <>{enTete(sections[0])}{nouvellesTriees.map((o) => carteCommande(o, { barre: true }))}</>}
        {communs}
        {etatListe}
        {ordersLoaded && enCours.length === 0 && <EtatVide icone="commandes" titre={orders.length === 0 && !nbHistorique ? t('ordersResto.noneYet') : t('ordersResto.noneCurrent')} />}
        {sections.slice(1).filter((c) => c.liste.length > 0).map((c) => <div key={c.cle}>{enTete(c)}{c.liste.map((o) => carteCommande(o))}</div>)}
        {/* Rupture du jour, sous les commandes (le geste reste à portée pendant le service). */}
        {restaurant && (
          <div className="ec-ruptures">
            <RupturesDuJour restaurant={restaurant} restoId={restoId} token={token} toast={toast} loadDashboard={loadDashboard} modifierRestaurant={modifierRestaurant} />
          </div>
        )}
        {nbHistorique > 0 && (
          <details className="service-historique" onToggle={basculerHistorique}>
            <summary>{t('ordersResto.history', { n: nbHistorique })}</summary>
            {histOuvert && <>{historique.map((o) => carteCommande(o))}{suiteHistorique}</>}
          </details>
        )}
        {pressee && <div className="ec-espace-barre" aria-hidden="true" />}
      </FeuilleCommerce>
      {pressee && createPortal(
        <div className="ec-barre-accepter no-print" role="group" aria-label={t('serviceCommerce.aTraiter')}>
          <button type="button" className="ec-bouton ec-bouton--lime" disabled={actionsEnCours.has(pressee.id)} onClick={() => accepter(pressee)}>
            {actionsEnCours.has(pressee.id) ? '…' : t('serviceCommerce.accepterNum', { num: numeroCommande(pressee) || '' }).trim()}
          </button>
          <button type="button" className="ec-bouton ec-bouton--contour" disabled={actionsEnCours.has(pressee.id)} onClick={() => setARefuser(pressee)}>{t('ordersResto.refuse')}</button>
        </div>,
        document.body
      )}

      {fenetres}
    </div>
  );
}

// Sélecteur du nombre d'exemplaires d'un ticket (1 à 5) : « − 2 + », assez grand pour le doigt.
function Exemplaires({ valeur, onChange, t, min = 1 }) {
  return (
    <span className="exemplaires" role="group" aria-label={t('ordersResto.copiesLabel')}>
      <span className="small">{t('ordersResto.copiesLabel')}</span>
      <button type="button" className="btn-ghost" disabled={valeur <= min} onClick={() => onChange(Math.max(min, valeur - 1))} aria-label="−">−</button>
      <b aria-live="polite">{valeur}</b>
      <button type="button" className="btn-ghost" disabled={valeur >= 5} onClick={() => onChange(Math.min(5, valeur + 1))} aria-label="+">+</button>
    </span>
  );
}
