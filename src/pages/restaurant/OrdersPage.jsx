import InterrupteurService from '../../components/commerce/InterrupteurService';
import RupturesDuJour from '../../components/commerce/RupturesDuJour';
import { useCallback, useEffect, useMemo, useState } from 'react';
import { createPortal } from 'react-dom';
import { Link, useOutletContext, useSearchParams } from 'react-router-dom';
import { api, apiUpload } from '../../api';
import { useAuth } from '../../context/AuthContext';
import { useToast } from '../../context/ToastContext';
import OrderReceipt from '../../components/OrderReceipt';
import TicketPapier from '../../components/TicketPapier';
import { imprimerTicketPapier } from '../../impressionPapier';
import { serviceGoodcomDisponible, imprimerSurGoodcom } from '../../goodcomWebPrinter';
import ConfirmDialog from '../../components/ConfirmDialog';
import ReasonDialog from '../../components/admin/ReasonDialog';
import { BandeauAllergie, BadgeAlcool, VerificationAge } from '../../components/conformite/CommandeConformite';
import { buildTicketBytes, COLUMNS_58MM } from '../../escposTicket';
import * as btPrinter from '../../bluetoothPrinter';
import {
  DeliveryTiming, EcheanceAcceptation, ProgressBar, RouteSuivi, statusLabel, deliveryInstructionLabel, formatOrderItem, orderTypeColor, orderTypeLabel,
  ORDER_STAGES, orderStageKey, orderStagePriority, stageColors as couleursEtapes
} from '../../orderStatus';
import { useLanguage, getLocale } from '../../context/LanguageContext';
import { euros } from '../../prixPlat';
import Icone from '../../components/Icone';
import EtatVide from '../../components/EtatVide';
import { BandeauCommerce, FeuilleCommerce, SegmentGlisse } from '../../components/commerce/BandeauCommerce';
import { vibrer } from '../../gestes';
import { experienceApp } from '../../natif';
import MiseEnLigne from '../../components/commerce/MiseEnLigne';
import AlerteBandeau from '../../components/commerce/AlerteBandeau';
import { useModeEquipe } from '../../modeEquipe';

// Le SITE (pas l'app) montre les commandes en tableau à trois colonnes (2026-10-16, mockups/site-ordinateur.html › Espace
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

// LE TEMPS QUI RESTE POUR ACCEPTER, EN ANNEAU (2026-10-16, mockups/tous-les-ecrans.html › Commandes) : il se vide de
// l'arrivée de la commande jusqu'à son échéance (acceptDeadline, la même que EcheanceAcceptation), rouge sous 5 minutes.
function AnneauDelai({ order, t }) {
  const [maintenant, setMaintenant] = useState(() => Date.now());
  useEffect(() => {
    const id = setInterval(() => setMaintenant(Date.now()), 10000);
    return () => clearInterval(id);
  }, []);
  const fin = new Date(order.acceptDeadline).getTime();
  const debut = new Date(order.createdAt).getTime();
  const reste = Math.max(0, fin - maintenant);
  const total = Math.max(60000, Number.isFinite(debut) ? fin - debut : 15 * 60000);
  const min = Math.ceil(reste / 60000);
  return (
    <span className={`ec-anneau${min <= 5 ? ' ec-anneau--presse' : ''}`} style={{ '--ec-p': Math.min(1, reste / total) }}
      role="img" aria-label={t('ecranCommerce.resteAccepter', { n: min })}>
      <b>{min}</b><small>{t('ecranCommerce.min')}</small>
    </span>
  );
}

export default function OrdersPage() {
  const { t } = useLanguage();
  const { token } = useAuth();
  const toast = useToast();
  const { orders, restaurant, restoId, loadDashboard, communs, alerte, onConnect, connecting, lectureSeule } = useOutletContext();
  // Membre de l'équipe (modeEquipe.js) : la mise en ligne du commerce et le terminal sont l'affaire du propriétaire.
  const membreEquipe = useModeEquipe();

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
  // Commande dont une action (accepter, refuser, prête) est en cours : pas de double envoi sur un double appui.
  const [actionEnCours, setActionEnCours] = useState(null);
  const [aRefuser, setARefuser] = useState(null);
  // Commande à emporter payée sur place que le client n'est pas venu chercher (confirmation avant de la clore).
  const [pasVenu, setPasVenu] = useState(null);
  const [clotureEnCours, setClotureEnCours] = useState(false);
  const [pickupCodeInputs, setPickupCodeInputs] = useState({});
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
  const [paperColumns] = useState(() => Number(localStorage.getItem('fairide.paperColumns')) || COLUMNS_58MM);
  const [btName, setBtName] = useState(btPrinter.connectedDeviceName());
  const [printing, setPrinting] = useState(false);

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
  async function imprimerSurTerminal(order, copies = 1) {
    setEnvoiTicket(order.id);
    try {
      await api(`/orders/${order.id}/print`, { method: 'POST', token, body: { copies } });
      toast(copies > 1 ? t('ordersResto.toastTicketSentN', { n: copies }) : terminalEnLigne ? t('ordersResto.ticketSentTerminal') : t('ordersResto.ticketQueuedOffline'));
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
  async function printBluetooth(order, { silencieux = false, copies = 1 } = {}) {
    setPrinting(true);
    try {
      if (!btPrinter.connectedDeviceName()) setBtName(await btPrinter.connect());
      const octets = buildTicketBytes(order, restaurant, { columns: paperColumns });
      for (let i = 0; i < Math.max(1, copies); i++) {
        if (i > 0) await new Promise((r) => setTimeout(r, 600));
        await btPrinter.printBytes(octets);
      }
      setBtName(btPrinter.connectedDeviceName());
      setImpressions((m) => ({ ...m, [order.id]: (m[order.id] || 0) + Math.max(1, copies) }));
      if (!silencieux) toast(copies > 1 ? t('ordersResto.toastTicketSentN', { n: copies }) : t('ordersResto.toastTicketSent'));
      return true;
    } catch (e) {
      // Refuser le sélecteur d'appareils lève une NotFoundError : ce n'est pas une panne, inutile
      // d'alarmer le restaurateur qui vient simplement de fermer la fenêtre.
      if (e?.name !== 'NotFoundError') toast(e.message || t('ordersResto.printFailed'));
      setBtName(btPrinter.connectedDeviceName());
      return false;
    } finally {
      setPrinting(false);
    }
  }

  // Ce qui demande une action ou une surveillance en premier, ce qui est déjà réglé en dernier —
  // pour que le restaurateur voie toujours ce qui compte sans avoir à chercher dans la liste.
  //
  // Les commandes closes (terminées, refusées, annulées) passent dans un historique replié : le serveur
  // renvoie TOUT l'historique du commerce, et au bout de quelques semaines la liste de service n'était plus
  // qu'une longue traîne de commandes livrées sous les deux qui comptaient.
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

  async function orderAction(orderId, action, body) {
    if (actionEnCours) return;
    setActionEnCours(orderId);
    try {
      await api(`/orders/${orderId}/${action}`, { method: 'PATCH', token, body });
      await loadDashboard(restoId);
    } catch (e) {
      toast(e.message, 'erreur');
    } finally {
      setActionEnCours(null);
    }
  }

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
  async function confirmTakeaway(order, ageVerifie = false) {
    const orderId = order.id;
    const code = (pickupCodeInputs[orderId] || '').trim();
    if (!code) { toast(t('ordersResto.toastAskCustomerCode')); return; }
    if (order.containsAlcohol && order.orderType === 'pickup' && !ageVerifie) { setAgeAVerifier(order); return; }
    setConfirmingPickup(orderId);
    try {
      await api(`/orders/${orderId}/confirm-takeaway`, { method: 'PATCH', token, body: { code, ...(ageVerifie ? { ageCheck: 'verified' } : {}) } });
      setPickupCodeInputs((prev) => { const next = { ...prev }; delete next[orderId]; return next; });
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
        for (let i = 0; i < n; i++) await imprimerSurGoodcom(r.lines, r.columns);
        setImpressions((m) => ({ ...m, [order.id]: (m[order.id] || 0) + n }));
        toast(n > 1 ? t('ordersResto.toastTicketSentN', { n }) : t('ordersResto.ticketSentTerminal'));
        return;
      }
      imprimerTicketPapier(r.lines, r.columns, `Fairide ${order.orderNumber ? `#${String(order.orderNumber).padStart(3, '0')}` : String(order.id).slice(0, 8)}`);
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
  /* UNE COMMANDE (nouveau style, 2026-10-16, « La commande qui sonne ») : l'étape en pastille (la cloche bouge tant
     qu'elle attend), l'anneau du temps pour accepter, le client et le numéro en grand, la route où le vélo passe d'étape
     en étape (RouteSuivi : une fois acceptée, il roule jusqu'à « Préparation »), les articles ; puis le temps de
     préparation à faire glisser et « Accepter ». Lime pour la plus urgente des nouvelles commandes seulement (une couleur
     décisive par écran), iris pour les suivantes. Toucher la carte ouvre le détail, comme avant. */
  const premiereNouvelle = enCours.find((o) => o.status === 'nouveau')?.id;
  const carteCommande = (o) => {
    const stageKey = orderStageKey(o);
    const stage = ORDER_STAGES.find((s) => s.key === stageKey);
    const stageColor = stageColors[stageKey];
    const nouvelle = o.status === 'nouveau';
    return (
    <div
      className={`ec-commande order-type-${orderTypeColor(o)}${nouvelle ? ' ec-commande--nouvelle' : ''}`}
      key={o.id}
      style={{ borderLeft: `5px solid ${stageColor}` }}
      onClick={() => setSelectedOrder(o)}
    >
      <div className="ec-cmd-l1">
        {/* Étape en texte foncé, la couleur sur la pastille seule (audit du 15/10/2026) : le libellé était écrit dans la couleur
            de l'étape sur un fond de cette même couleur, en 11 px (« En préparation » lime sur lime : contraste 1,3:1). */}
        <span key={stageKey} className={`etape-pastille ec-saute${nouvelle ? ' ec-sonne' : ''}`} style={{ '--etape-couleur': stageColor }}>
          <Icone nom={stage.icon} taille={16} className="icone-texte" /> {t(`orderStatus.stage_${stage.key}`)}
        </span>
        {['nouveau', 'preparation', 'pret'].includes(o.status) && !o.preparedPhoto && (
          <label className="btn-ghost order-print-btn" title={t('ordersResto.photoHelp')} aria-label={t('ordersResto.photoBtn')} onClick={(e) => e.stopPropagation()}>
            {photoEnCours === o.id ? '…' : <Icone nom="apercu" taille={16} className="icone-texte" />}
            <input type="file" accept="image/*" capture="environment" hidden disabled={photoEnCours === o.id} onChange={(e) => { photographier(o, e.target.files?.[0]); e.target.value = ''; }} />
          </label>
        )}
        {o.preparedPhoto && (
          <a className="btn-ghost order-print-btn" href={o.preparedPhoto.url} target="_blank" rel="noreferrer" title={t('ordersResto.photoDone', { time: new Date(o.preparedPhoto.at).toLocaleTimeString(getLocale(), { hour: '2-digit', minute: '2-digit' }) })} onClick={(e) => e.stopPropagation()}><Icone nom="apercu" taille={16} className="icone-texte" />✓</a>
        )}
        <button type="button" className="btn-ghost order-print-btn" title={btName ? t('ordersResto.printTicket') : t('ordersResto.printDeliveryNote')} aria-label={t('ordersResto.printTicket')}
          disabled={envoiTicket === o.id} onClick={(e) => { e.stopPropagation(); if (aTerminal) imprimerSurTerminal(o); else if (btName) printBluetooth(o); else { setSelectedOrder(o); } }}><Icone nom="imprimante" taille={16} className="icone-texte" /></button>
        {nouvelle && o.acceptDeadline && <AnneauDelai order={o} t={t} />}
      </div>
      <div className="ec-cmd-l2">
        <span className="ec-cmd-client">
          <b>{o.clientName}{o.isTraining && <span className="pill" style={{ marginLeft: 6 }}>{t('ordersResto.trainingBadge')}</span>}</b>
          {o.clientPhone && <span><Icone nom="telephone" taille={14} className="icone-texte" />{' '}{o.clientPhone}</span>}
        </span>
        {/* Le numéro du ticket imprimé et de la fenêtre « nouvelle commande », en grand : c'est lui qu'on annonce en cuisine. */}
        {o.orderNumber ? <span className="commande-numero">{numeroCommande(o)}</span> : <span className={`status-badge status-${o.status}`}>{statusLabel(o.status, o.orderType, t)}</span>}
      </div>
      <div className="row" style={{ gap: 6 }}>
        <span className={`order-type-badge order-type-badge-${orderTypeColor(o)}`}>{orderTypeLabel(o, t)}</span>
        {/* Paiement bien distinct (fondateur, 2026-10-07) : à payer sur place (encadré orange) ou déjà payé en ligne (vert). */}
        {o.paymentMode === 'on_site' ? (
          <span className="small paiement-badge paiement-sur-place" style={{ fontWeight: 700, color: o.pickupNoShow ? 'var(--red)' : undefined }}>
            {o.pickupNoShow ? t('ordersResto.noShowBadge') : `${t('ordersResto.payOnSiteBadge', { amount: euros(o.total) })}`}
          </span>
        ) : (
          <span className="small paiement-badge paiement-en-ligne" style={{ fontWeight: 700 }}><Icone nom="valider" taille={16} className="icone-texte" />{' '}{t('ordersResto.paidOnlineBadge')}</span>
        )}
      </div>
      {o.print && <div style={{ margin: '4px 0' }}><EtatImpression p={o.print} t={t} /></div>}
      <div className="ec-route-blanc"><RouteSuivi status={o.status} orderType={o.orderType} /></div>
      <p className="ec-cmd-articles">{o.items.map(formatOrderItem).join(', ')}</p>
      {o.orderType === 'delivery' && <div className="small"><Icone nom="position" taille={16} className="icone-texte" />{' '}{o.address}</div>}
      <DeliveryTiming order={o} />
      <EcheanceAcceptation order={o} />
      <BandeauAllergie order={o} />
      <BadgeAlcool order={o} />
      {o.orderType === 'delivery' && o.driverName && ['preparation', 'pret'].includes(o.status) && (
        <div className="small" style={{ fontWeight: 600 }}>{t('ordersResto.driverAssigned', { name: o.driverName })}</div>
      )}
      {nouvelle && (
        <div className="ec-cmd-actions" onClick={(e) => e.stopPropagation()}>
          {/* Temps de préparation en plus, annoncé à l'acceptation (RES-10) : l'heure estimée du client recule d'autant. */}
          <p className="ec-feuille-titre">{t('ordersResto.extraPrepLabel')}</p>
          <SegmentGlisse libelle={t('ordersResto.extraPrepLabel')} valeur={tempsEnPlus[o.id] || 0}
            onChange={(v) => { vibrer(8); setTempsEnPlus((p) => ({ ...p, [o.id]: v })); }}
            options={[{ value: 0, label: t('ordersResto.extraPrepNone') }, ...[10, 20, 30].map((m) => ({ value: m, label: t('ordersResto.extraPrepMinutes', { n: m }) }))]} />
          <button type="button" className={`ec-bouton ${o.id === premiereNouvelle ? 'ec-bouton--lime' : 'ec-bouton--iris'}`} disabled={actionEnCours === o.id}
            onClick={() => { vibrer(14); if (o.allergyRequest) setAllergieAConfirmer(o); else orderAction(o.id, 'accept', { extraMinutes: tempsEnPlus[o.id] || 0 }); }}>
            {actionEnCours === o.id ? '…' : t('ordersResto.accept')}
          </button>
          <button type="button" className="ec-bouton ec-bouton--texte" disabled={actionEnCours === o.id} onClick={() => setARefuser(o)}>{t('ordersResto.refuse')}</button>
        </div>
      )}
      {/* Iris et non lime : avec plusieurs commandes en préparation, l'écran alignait autant de boutons lime. */}
      {o.status === 'preparation' && (
        <div onClick={(e) => e.stopPropagation()}>
          <button type="button" className="ec-bouton ec-bouton--iris" disabled={actionEnCours === o.id} onClick={() => orderAction(o.id, 'ready')}>{t('ordersResto.markReady')}</button>
        </div>
      )}
      {o.paymentMode === 'on_site' && ['preparation', 'pret'].includes(o.status) && (
        <div className="row" style={{ marginTop: 8 }} onClick={(e) => e.stopPropagation()}>
          <button className="btn-ghost btn-sm" style={{ color: 'var(--red)' }} onClick={() => setPasVenu(o)}><Icone nom="interdit" taille={16} className="icone-texte" />{' '}{t('ordersResto.customerNoShow')}</button>
        </div>
      )}
      {o.status === 'pret' && o.orderType === 'pickup' && (
        <div className="row" style={{ marginTop: 10, gap: 8 }} onClick={(e) => e.stopPropagation()}>
          <input aria-label={t('ordersResto.phCustomerCode')}
            placeholder={t('ordersResto.phCustomerCode')}
            // Codes à chiffres : pavé numérique sur téléphone, Entrée valide (simulation du 30/09).
            inputMode="numeric" autoComplete="off"
            onKeyDown={(e) => { if (e.key === 'Enter') confirmTakeaway(o); }}
            style={{ maxWidth: 140 }}
            value={pickupCodeInputs[o.id] || ''}
            onChange={(e) => setPickupCodeInputs((prev) => ({ ...prev, [o.id]: e.target.value }))}
          />
          <button className="btn-teal btn-sm" disabled={confirmingPickup === o.id} onClick={() => confirmTakeaway(o)}>
            {confirmingPickup === o.id ? '...' : t('ordersResto.validateOrder')}
          </button>
        </div>
      )}
      {/* RETRAIT SANS RIEN TAPER (simulation du 10 oct. 2026) : le commerce compare à l'œil le code que le livreur lui
          montre avec celui-ci ; c'est le livreur qui confirme le retrait de son côté (PATCH /orders/:id/picked-up). */}
      <CodeRetrait order={o} t={t} />
      {/* Le livreur est arrivé et attend (LIV-8) : le commerce le voit, avec depuis quand. */}
      {o.courierWaitingSince && ['preparation', 'pret'].includes(o.status) && (
        <p className="small" style={{ marginTop: 8, marginBottom: 0, fontWeight: 700 }}>{t('ordersResto.courierWaiting', { min: Math.max(0, Math.floor((Date.now() - o.courierWaitingSince) / 60000)) })}</p>
      )}
      {o.status === 'pret' && o.orderType === 'delivery' && !o.driverId && (
        <p className="small" style={{ marginTop: 8, marginBottom: 0 }}>{t('ordersResto.waitingDriver')}</p>
      )}
    </div>
    );
  };

  // Les fenêtres (détail, refus avec motif, allergie, client pas venu, contrôle d'âge), communes au tableau du site et à la liste de l'app.
  const fenetres = (
    <>
        {selectedOrder && createPortal(
          <div className="modal-overlay no-print" onClick={() => setSelectedOrder(null)}>
            <div className="modal-box" onClick={(e) => e.stopPropagation()}>
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
              {selectedOrder.items.map((i) => (
                <div key={i.itemId} className="row" style={{ justifyContent: 'space-between', padding: '4px 0', alignItems: 'flex-start' }}>
                  <span>
                    {i.qty}× {i.name}{i.discount > 0 ? <Icone nom="etiquette" taille={16} className="icone-texte" /> : ''}
                    {i.options?.length > 0 && <span className="small" style={{ display: 'block' }}>{i.options.map((o) => o.name).join(', ')}</span>}
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
              {selectedOrder.clientPhone && <p className="small" style={{ margin: '4px 0' }}><Icone nom="telephone" taille={16} className="icone-texte" />{' '}{selectedOrder.clientPhone}</p>}
              <BandeauAllergie order={selectedOrder} />
              <BadgeAlcool order={selectedOrder} />
              {selectedOrder.deliveryInstructions && <p className="small" style={{ margin: '4px 0' }}><Icone nom="cle" taille={16} className="icone-texte" />{' '}{deliveryInstructionLabel(selectedOrder.deliveryInstructions, t)}</p>}
              {selectedOrder.deliveryNote && <p className="small" style={{ margin: '4px 0' }}><Icone nom="document" taille={16} className="icone-texte" />{' '}{selectedOrder.deliveryNote}</p>}
              {selectedOrder.orderType === 'delivery' && selectedOrder.driverName && <p className="small" style={{ margin: '4px 0' }}>{t('ordersResto.driverLine', { name: selectedOrder.driverName, phone: selectedOrder.driverPhone ? ` · ${selectedOrder.driverPhone}` : '' })}</p>}
              {selectedOrder.status === 'pret' && selectedOrder.orderType === 'pickup' && (
                <div className="row" style={{ marginTop: 10, gap: 8 }}>
                  <input aria-label={t('ordersResto.phCustomerCode')}
                    placeholder={t('ordersResto.phCustomerCode')}
                    style={{ maxWidth: 140 }}
                    value={pickupCodeInputs[selectedOrder.id] || ''}
                    onChange={(e) => setPickupCodeInputs((prev) => ({ ...prev, [selectedOrder.id]: e.target.value }))}
                  />
                  <button className="btn-teal btn-sm" disabled={confirmingPickup === selectedOrder.id} onClick={() => confirmTakeaway(selectedOrder)}>
                    {confirmingPickup === selectedOrder.id ? '...' : t('ordersResto.validateOrder')}
                  </button>
                </div>
              )}
              <CodeRetrait order={selectedOrder} t={t} />
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
                    <Exemplaires valeur={exemplaires} onChange={setExemplaires} t={t} />
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
                    <button className="btn-teal" disabled={printing} onClick={() => (btName ? printBluetooth(selectedOrder, { copies: exemplaires }) : printReceipt(selectedOrder, exemplaires))}>
                      {printing ? t('ordersResto.printing') : impressions[selectedOrder.id] ? t('ordersResto.printAgain') : t('ordersResto.printTicket')}
                    </button>
                    <button className="btn-outline" onClick={() => voirApercu(selectedOrder)}>{apercu?.orderId === selectedOrder.id ? t('ordersResto.hidePreview') : t('ordersResto.showPreview')}</button>
                    <button className="btn-ghost" onClick={() => setSelectedOrder(null)}>{t('ordersResto.close')}</button>
                  </div>
                  <p className="small" style={{ margin: '8px 0 0', color: 'var(--ink-faint)' }}>{t('ordersResto.noTerminalHint')}{!membreEquipe && <> <Link to="/dashboard/terminal">{t('ordersResto.terminalSettings')}</Link></>}</p>
                </>
              )}
              {apercu?.orderId === selectedOrder.id && <div style={{ marginTop: 12 }}><TicketPapier lines={apercu.lines} columns={apercu.columns} /></div>}
            </div>
          </div>,
          document.body
        )}
        {/* Portail séparé du modal (lui-même marqué no-print) : c'est ce qui garantit que le reçu reste
            visible à l'impression même si le modal et le reste de la page sont masqués (voir OrderReceipt.jsx
            et .receipt-print dans styles.css — un enfant ne peut jamais annuler le display:none d'un ancêtre). */}
        {selectedOrder && createPortal(<OrderReceipt order={selectedOrder} restaurant={restaurant} />, document.body)}
        <ConfirmDialog open={!!pasVenu} danger
          title={t('ordersResto.confirmNoShowTitle')}
          message={t('ordersResto.confirmNoShowText', { name: pasVenu?.clientName || '' })}
          confirmLabel={t('ordersResto.customerNoShow')}
          loading={clotureEnCours}
          onCancel={() => setPasVenu(null)}
          onConfirm={signalerPasVenu} />
        {/* Motif obligatoire : le serveur le refuse sans (MOTIF_REQUIS) et le transmet au client, dans son suivi et
            dans l'e-mail de refus. Avant, le client apprenait le refus sans savoir pourquoi. */}
        <ReasonDialog open={!!aRefuser} danger
          title={t('ordersResto.confirmRefuseTitle')}
          message={`${t('ordersResto.confirmRefuseText', { name: aRefuser?.clientName || '' })} ${t('ordersResto.refuseReasonHint')}`}
          label={t('ordersResto.refuseReasonLabel')}
          placeholder={t('ordersResto.refuseReasonPlaceholder')}
          confirmLabel={t('ordersResto.refuse')}
          onCancel={() => setARefuser(null)}
          onConfirm={(motif) => { const o = aRefuser; setARefuser(null); orderAction(o.id, 'refuse', { reason: motif }); }} />
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

  /* LE TABLEAU DU SITE (2026-10-16, mockups/site-ordinateur.html › Espace commerce). Trois colonnes : Nouvelles (la plus
     pressée en tête, bordure rouge qui bat, seule à porter « Accepter » en lime ; les suivantes en iris), En préparation,
     Prêtes (prête, livreur en route). La colonne dit l'étape : la pastille ne reste que là où elle précise (livreur attendu,
     client attendu, en route). Mêmes gestes que la liste de l'app : photo, ticket, temps en plus, allergie à confirmer,
     refus avec motif (ReasonDialog), prête, client pas venu, code du client, code de retrait, contrôle d'âge. Toucher la
     carte ouvre le détail. Quand la feuille est étroite (téléphone), les colonnes s'empilent (site-pro.css). */
  const nouvellesTriees = enCours.filter((o) => orderStageKey(o) === 'nouveau').sort((a, b) => echeance(a) - echeance(b));
  const plusPressee = nouvellesTriees.find((o) => o.status === 'nouveau')?.id;
  const colonnes = COLONNES.map((c) => ({ ...c, liste: c.cle === 'nouv' ? nouvellesTriees : enCours.filter((o) => c.etapes.includes(orderStageKey(o))) }));
  const carteTableau = (o) => {
    const stageKey = orderStageKey(o);
    const stage = ORDER_STAGES.find((s) => s.key === stageKey);
    const nouvelle = o.status === 'nouveau';
    const pressee = o.id === plusPressee;
    const pastille = !['nouveau', 'preparation'].includes(stageKey);
    return (
      <article key={o.id} className={`sp-cmd${pressee ? ' sp-cmd--pressee' : ''}`} onClick={() => setSelectedOrder(o)}>
        <div className="sp-cmd-l1">
          <div className="sp-cmd-qui">
            <div className="sp-cmd-tete">
              {o.orderNumber ? <span className="sp-cmd-num">{numeroCommande(o)}</span> : <span className={`status-badge status-${o.status}`}>{statusLabel(o.status, o.orderType, t)}</span>}
              <span className={`order-type-badge order-type-badge-${orderTypeColor(o)}`}>{orderTypeLabel(o, t)}</span>
            </div>
            <b className="sp-cmd-client">{o.clientName}{o.isTraining && <span className="pill" style={{ marginLeft: 6 }}>{t('ordersResto.trainingBadge')}</span>}</b>
            {o.clientPhone && <span className="sp-cmd-tel"><Icone nom="telephone" taille={13} className="icone-texte" />{' '}{o.clientPhone}</span>}
          </div>
          <div className="sp-cmd-outils" onClick={(e) => e.stopPropagation()}>
            {['nouveau', 'preparation', 'pret'].includes(o.status) && !o.preparedPhoto && (
              <label className="sp-outil" title={t('ordersResto.photoHelp')} aria-label={t('ordersResto.photoBtn')}>
                {photoEnCours === o.id ? '…' : <Icone nom="apercu" taille={16} />}
                <input type="file" accept="image/*" capture="environment" hidden disabled={photoEnCours === o.id} onChange={(e) => { photographier(o, e.target.files?.[0]); e.target.value = ''; }} />
              </label>
            )}
            {o.preparedPhoto && (
              <a className="sp-outil" href={o.preparedPhoto.url} target="_blank" rel="noreferrer" title={t('ordersResto.photoDone', { time: new Date(o.preparedPhoto.at).toLocaleTimeString(getLocale(), { hour: '2-digit', minute: '2-digit' }) })}><Icone nom="apercu" taille={16} />✓</a>
            )}
            <button type="button" className="sp-outil" title={btName ? t('ordersResto.printTicket') : t('ordersResto.printDeliveryNote')} aria-label={t('ordersResto.printTicket')}
              disabled={envoiTicket === o.id} onClick={() => { if (aTerminal) imprimerSurTerminal(o); else if (btName) printBluetooth(o); else setSelectedOrder(o); }}><Icone nom="imprimante" taille={16} /></button>
            {nouvelle && o.acceptDeadline && <AnneauDelai order={o} t={t} />}
          </div>
        </div>
        {pastille && (
          <span className="etape-pastille sp-cmd-etape" style={{ '--etape-couleur': stageColors[stageKey] }}>
            <Icone nom={stage.icon} taille={14} className="icone-texte" /> {t(`orderStatus.stage_${stage.key}`)}
          </span>
        )}
        <p className="sp-cmd-art">{o.items.map(formatOrderItem).join(', ')}</p>
        <div className="sp-cmd-paiement">
          {o.paymentMode === 'on_site' ? (
            <span className="small paiement-badge paiement-sur-place" style={{ fontWeight: 700, color: o.pickupNoShow ? 'var(--red)' : undefined }}>
              {o.pickupNoShow ? t('ordersResto.noShowBadge') : t('ordersResto.payOnSiteBadge', { amount: euros(o.total) })}
            </span>
          ) : (
            <span className="small paiement-badge paiement-en-ligne" style={{ fontWeight: 700 }}><Icone nom="valider" taille={14} className="icone-texte" />{' '}{t('ordersResto.paidOnlineBadge')}</span>
          )}
          {o.print && <EtatImpression p={o.print} t={t} />}
        </div>
        {o.orderType === 'delivery' && o.address && <div className="small sp-cmd-info"><Icone nom="position" taille={14} className="icone-texte" />{' '}{o.address}</div>}
        <DeliveryTiming order={o} />
        <EcheanceAcceptation order={o} />
        <BandeauAllergie order={o} />
        <BadgeAlcool order={o} />
        {o.orderType === 'delivery' && o.driverName && ['preparation', 'pret'].includes(o.status) && (
          <div className="small" style={{ fontWeight: 600 }}>{t('ordersResto.driverAssigned', { name: o.driverName })}</div>
        )}
        {nouvelle && (
          <div className="sp-cmd-actions" onClick={(e) => e.stopPropagation()}>
            <SegmentGlisse libelle={t('ordersResto.extraPrepLabel')} valeur={tempsEnPlus[o.id] || 0}
              onChange={(v) => setTempsEnPlus((p) => ({ ...p, [o.id]: v }))}
              options={[{ value: 0, label: t('ordersResto.extraPrepNone') }, ...[10, 20, 30].map((m) => ({ value: m, label: t('ordersResto.extraPrepMinutes', { n: m }) }))]} />
            <div className="sp-cmd-boutons">
              <button type="button" className={`ec-bouton ${pressee ? 'ec-bouton--lime' : 'ec-bouton--iris'}`} disabled={actionEnCours === o.id}
                onClick={() => { if (o.allergyRequest) setAllergieAConfirmer(o); else orderAction(o.id, 'accept', { extraMinutes: tempsEnPlus[o.id] || 0 }); }}>
                {actionEnCours === o.id ? '…' : t('ordersResto.accept')}
              </button>
              <button type="button" className="ec-bouton sp-bouton-contour" disabled={actionEnCours === o.id} onClick={() => setARefuser(o)}>{t('ordersResto.refuse')}</button>
            </div>
          </div>
        )}
        {o.status === 'preparation' && (
          <div className="sp-cmd-boutons" onClick={(e) => e.stopPropagation()}>
            <button type="button" className="ec-bouton ec-bouton--iris" disabled={actionEnCours === o.id} onClick={() => orderAction(o.id, 'ready')}>{t('ordersResto.markReady')}</button>
          </div>
        )}
        {o.status === 'pret' && o.orderType === 'pickup' && (
          <div className="sp-cmd-code" onClick={(e) => e.stopPropagation()}>
            <input aria-label={t('ordersResto.phCustomerCode')} placeholder={t('ordersResto.phCustomerCode')} inputMode="numeric" autoComplete="off"
              onKeyDown={(e) => { if (e.key === 'Enter') confirmTakeaway(o); }}
              value={pickupCodeInputs[o.id] || ''}
              onChange={(e) => setPickupCodeInputs((prev) => ({ ...prev, [o.id]: e.target.value }))} />
            <button type="button" className="btn-teal btn-sm" disabled={confirmingPickup === o.id} onClick={() => confirmTakeaway(o)}>
              {confirmingPickup === o.id ? '...' : t('ordersResto.validateOrder')}
            </button>
          </div>
        )}
        <CodeRetrait order={o} t={t} />
        {o.courierWaitingSince && ['preparation', 'pret'].includes(o.status) && (
          <p className="small" style={{ margin: '8px 0 0', fontWeight: 700 }}>{t('ordersResto.courierWaiting', { min: Math.max(0, Math.floor((Date.now() - o.courierWaitingSince) / 60000)) })}</p>
        )}
        {o.status === 'pret' && o.orderType === 'delivery' && !o.driverId && (
          <p className="small" style={{ margin: '8px 0 0' }}>{t('ordersResto.waitingDriver')}</p>
        )}
        {o.paymentMode === 'on_site' && ['preparation', 'pret'].includes(o.status) && (
          <div onClick={(e) => e.stopPropagation()}>
            <button type="button" className="btn-ghost btn-sm sp-pas-venu" onClick={() => setPasVenu(o)}><Icone nom="interdit" taille={14} className="icone-texte" />{' '}{t('ordersResto.customerNoShow')}</button>
          </div>
        )}
      </article>
    );
  };
  const etatTerminal = terminaux ? (aTerminal ? (terminalEnLigne ? t('sitePro.terminalEnLigne') : t('sitePro.terminalHorsLigne')) : t('sitePro.terminalAucun')) : null;

  if (SITE) return (
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
        {restaurant && <InterrupteurService surBandeau restaurant={restaurant} restoId={restoId} token={token} toast={toast} loadDashboard={loadDashboard} />}
        {restaurant && !membreEquipe && <MiseEnLigne surBandeau restaurant={restaurant} restoId={restoId} token={token} onConnect={onConnect} connecting={connecting}
          onChange={() => loadDashboard(restoId)} lectureSeule={lectureSeule} />}
      </BandeauCommerce>
      <FeuilleCommerce>
        {communs}
        <div className="sp-cadre">
        {enCours.length === 0 && <div className="sp-vide-etroit"><EtatVide icone="commandes" titre={orders.length === 0 ? t('ordersResto.noneYet') : t('ordersResto.noneCurrent')} /></div>}
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
            <RupturesDuJour restaurant={restaurant} restoId={restoId} token={token} toast={toast} loadDashboard={loadDashboard} />
          </div>
        )}
        {closes.length > 0 && (
          <details className="service-historique sp-historique">
            <summary>{t('ordersResto.history', { n: closes.length })}</summary>
            <div className="sp-historique-grille">{closes.map(carteTableau)}</div>
          </details>
        )}
        </div>
      </FeuilleCommerce>
      {fenetres}
    </div>
  );

  return (
    <div className="no-print">
      {/* LE BANDEAU (2026-10-16) : le nom, le résumé du service, l'interrupteur ouvert / en pause et l'état du terminal.
          Plus de carte de présentation du terminal ici : elle reste dans Mon compte › Terminal Fairide. */}
      <BandeauCommerce>
        <div className="ec-b-haut">
          <span><b>{restaurant?.name}</b></span>
          <span>{t('ordersResto.summary', { current: enCours.length, today: duJour })}</span>
        </div>
        {restaurant && <InterrupteurService surBandeau restaurant={restaurant} restoId={restoId} token={token} toast={toast} loadDashboard={loadDashboard} />}
        {terminaux && !membreEquipe && <span className="ec-terminal"><Link to="/dashboard/terminal">{aTerminal ? (terminalEnLigne ? t('ordersResto.terminalOnline') : t('ordersResto.terminalOffline')) : t('ordersResto.terminalNone')}</Link></span>}
      </BandeauCommerce>
      <FeuilleCommerce>
        {communs}
        {enCours.length === 0 && <EtatVide icone="commandes" titre={orders.length === 0 ? t('ordersResto.noneYet') : t('ordersResto.noneCurrent')} />}
        {enCours.map(carteCommande)}
        {/* Rupture du jour, sous les commandes (le geste reste à portée pendant le service). */}
        {restaurant && (
          <div className="ec-ruptures">
            <RupturesDuJour restaurant={restaurant} restoId={restoId} token={token} toast={toast} loadDashboard={loadDashboard} />
          </div>
        )}
        {closes.length > 0 && (
          <details className="service-historique">
            <summary>{t('ordersResto.history', { n: closes.length })}</summary>
            {closes.map(carteCommande)}
          </details>
        )}
      </FeuilleCommerce>

      {fenetres}
    </div>
  );
}

// Sélecteur du nombre d'exemplaires d'un ticket (1 à 5) : « − 2 + », assez grand pour le doigt.
function Exemplaires({ valeur, onChange, t }) {
  return (
    <span className="exemplaires" role="group" aria-label={t('ordersResto.copiesLabel')}>
      <span className="small">{t('ordersResto.copiesLabel')}</span>
      <button type="button" className="btn-ghost" disabled={valeur <= 1} onClick={() => onChange(Math.max(1, valeur - 1))} aria-label="−">−</button>
      <b aria-live="polite">{valeur}</b>
      <button type="button" className="btn-ghost" disabled={valeur >= 5} onClick={() => onChange(Math.min(5, valeur + 1))} aria-label="+">+</button>
    </span>
  );
}
