import { allerAuPaiement, experienceApp } from '../../natif';
import SousEcran from '../../components/SousEcran';

/* DANS L'APPLICATION (2026-10-15), la carte d'une commande en cours se lit dans l'ordre où l'on en a besoin : le code à
 * donner au livreur (ou à montrer au commerce) juste sous la progression, plus en bas sous la carte ; l'avis et le
 * pourboire, et « Signaler un problème », s'ouvrent dans une feuille au lieu de s'insérer dans la carte. */
const APPLI = experienceApp();
import { Fragment, useEffect, useRef, useState } from 'react';
import { vibrer } from '../../gestes';
import useRevalidation from '../../useRevalidation';
import EtatVide from '../../components/EtatVide';
import ErreurChargement from '../../components/ErreurChargement';
import InfosRetrait, { AideCommande } from '../../components/client/InfosRetrait';
import BandeauOuverture from '../../components/BandeauOuverture';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { useCart } from '../../context/CartContext';
import { preparerNouvelleCommande } from '../../recommander';
import SignalerProbleme from '../../components/client/SignalerProbleme';
import SansLivreur from '../../components/client/SansLivreur';
import LivreurALaPorte from '../../components/client/LivreurALaPorte';
import ClocheNotifications from '../../components/client/ClocheNotifications';
import ReglageNotifications from '../../components/ReglageNotifications';
import { RappelEmail } from '../../components/EmailConfirmation';
import ConfirmDialog from '../../components/ConfirmDialog';
import { api, API_BASE } from '../../api';
import { ouvrirPdf, nomRecu } from '../../pdf';
import { useAuth } from '../../context/AuthContext';
import { useToast } from '../../context/ToastContext';
import { usePreviewMode } from '../../context/PreviewModeContext';
import { useLanguage, getLocale } from '../../context/LanguageContext';
import { DeliveryTiming, ProchaineEtape, RouteSuivi, titreSuivi, deliveryInstructionLabel, statusLabel, orderTypeLabel, formatOrderItem } from '../../orderStatus';
import { SkeletonCards } from '../../components/Skeleton';
import TirerPourActualiser from '../../components/TirerPourActualiser';
import { StarsInput, StarsDisplay } from '../../components/Stars';
import DriverBadge from '../../components/DriverBadge';
import DeliveryTrackingMap from '../../components/DeliveryTrackingMap';
import Icone from '../../components/Icone';
import VendeurLivraison from '../../components/conformite/VendeurLivraison';
import Modale from '../../components/Modale';
import { euros } from '../../prixPlat';
import { BandeauCommande, FeuilleCommande } from '../../components/EcranCommande';
import '../../ecran-liste.css';

// La photo de la commande (Cloudinary) : une vignette carrée légère, ou la photo entière ajustée à l'écran.
function vignettePhoto(url, taille, carre = true) {
  if (!url || !url.includes('/image/upload/')) return url;
  return url.replace('/image/upload/', carre ? `/image/upload/c_fill,w_${taille},h_${taille},f_auto,q_auto/` : `/image/upload/c_limit,w_${taille},f_auto,q_auto/`);
}
const heureCourte = (ms) => new Date(ms).toLocaleTimeString(getLocale(), { hour: '2-digit', minute: '2-digit' });

// `pourboireSeul` : l'avis est déjà envoyé, il ne reste que le pourboire. Sans ce mode, un client qui
// abandonnait le paiement du pourboire (ou dont l'envoi échouait après l'avis) ne pouvait plus jamais le
// laisser : le formulaire ne se rouvre pas sur une commande notée, et le renvoyer butait sur « avis déjà
// envoyé » avant d'atteindre le pourboire.
function ReviewForm({ order, token, toast, onDone, t, pourboireSeul = false }) {
  // Aucune étoile au départ (audit du 19/10, AO-21) : un seul toucher sur « Envoyer » publiait un 5 étoiles que le client
  // n'avait pas choisi. L'envoi attend une note (bouton désactivé tant qu'il n'y en a pas).
  const [foodRating, setFoodRating] = useState(0);
  const [foodComment, setFoodComment] = useState('');
  const [tipChoice, setTipChoice] = useState(0);
  const [tipInput, setTipInput] = useState('');
  const [saving, setSaving] = useState(false);

  async function submit() {
    setSaving(true);
    try {
      if (!pourboireSeul) {
        try {
          await api(`/orders/${order.id}/review`, {
            method: 'POST', token,
            body: {
              // Plus de note de la livraison (CODE-13, DEC-21) : le livreur est un indépendant, la plateforme ne l'évalue pas.
              foodRating, foodComment: foodComment.trim()
            }
          });
        } catch (e) {
          // 409 = avis déjà enregistré (second envoi après un pourboire qui a échoué) : on passe au pourboire.
          if (e.status !== 409) throw e;
        }
      }
      // « 2,50 » est lu comme 2,50 € (audit du 19/10, CROSS-62) : Number('2,50') donnait NaN, et le pourboire tombait sans un mot.
      const tip = tipInput.trim() ? +(Number(tipInput.trim().replace(',', '.')) || 0).toFixed(2) : tipChoice;
      // L'avis envoyé se lit tout de suite sous la commande (AO-22), sans attendre la relecture des 15 s.
      const avis = pourboireSeul ? {} : { myReview: { foodRating, foodComment: foodComment.trim(), restaurantReply: '' } };
      if (order.driverName && tip > 0) {
        await api(`/orders/${order.id}/tip`, { method: 'PATCH', token, body: { tip } });
        const pay = await api(`/payments/tip-checkout/${order.id}`, { method: 'POST', token });
        if (pay.simulated) {
          toast(t('review.toastThanksTip'));
          // Pourboire acquis : le bouton « Laisser un pourboire » ne doit pas rester affiché (plan de test SIM-9).
          onDone({ tipPaid: true, ...avis });
        } else {
          await allerAuPaiement(pay.checkoutUrl, { retour: '/orders' });
        }
        return;
      }
      toast(t('review.toastThanks'), 'succes');
      onDone(avis);
    } catch (e) {
      toast(e.message, 'erreur');
    } finally {
      setSaving(false);
    }
  }

  return (
    <div style={{ background: 'var(--cream-dim)', borderRadius: 10, padding: 14, marginTop: 8 }}>
      {!pourboireSeul && <div style={{ marginBottom: 10 }}>
        <div className="small" style={{ marginBottom: 4 }}>{t('review.foodRatingLabel')}</div>
        <StarsInput value={foodRating} onChange={setFoodRating} ariaLabel={t('review.foodRatingLabel')} />
        {/* 1 000 caractères : la même limite que le serveur (routes/reviews.js LONGUEUR_MAX_AVIS). Nommé (audit du 19/10, CROSS-88). */}
        <input maxLength={1000} value={foodComment} onChange={(e) => setFoodComment(e.target.value)} placeholder={t('review.foodCommentPlaceholder')} aria-label={t('review.foodCommentPlaceholder')} style={{ marginTop: 6 }} />
      </div>}
      {/* Pourboire déjà laissé en payant la commande : on ne le redemande pas. */}
      {order.driverName && order.tipPaid && (
        <p className="small" style={{ margin: '0 0 12px' }}>{t('review.tipAlreadyPaid', { name: order.driverName, amount: euros(order.tipAmount) })}</p>
      )}
      {order.driverName && !order.tipPaid && (
        <div style={{ marginBottom: 12 }}>
          <div className="small" style={{ marginBottom: 4, fontWeight: 600 }}>{t('review.tipPrompt', { name: order.driverName })}</div>
          <div className="row" style={{ gap: 6, flexWrap: 'wrap' }}>
            {[0, 1, 2, 3].map((amount) => (
              <button
                key={amount}
                type="button"
                className={tipChoice === amount && !tipInput.trim() ? 'btn-teal' : 'btn-ghost'}
                aria-pressed={tipChoice === amount && !tipInput.trim()}
                onClick={() => { setTipChoice(amount); setTipInput(''); }}
                style={{ padding: '6px 12px', fontSize: 13 }}
              >
                {amount === 0 ? t('review.tipNone') : `${amount}€`}
              </button>
            ))}
            <input aria-label={t('review.tipOtherPlaceholder')}
              type="text"
              inputMode="decimal"
              autoComplete="off"
              placeholder={t('review.tipOtherPlaceholder')}
              value={tipInput}
              onChange={(e) => setTipInput(e.target.value)}
              style={{ width: 110, padding: '6px 10px', fontSize: 13 }}
            />
          </div>
        </div>
      )}
      <button className="btn-teal" disabled={saving || (!pourboireSeul && foodRating < 1)} onClick={submit}>{saving ? '...' : t('review.send')}</button>
    </div>
  );
}

export default function Orders() {
  const [orders, setOrders] = useState([]);
  const [searchParams] = useSearchParams();
  const [loading, setLoading] = useState(true);
  const [echec, setEchec] = useState(false);
  const [reviewingId, setReviewingId] = useState(null);
  const [cancellingId, setCancellingId] = useState(null);
  // Annuler une commande passe par une confirmation (audit du 15/10/2026) : un toucher l'annulait aussitôt.
  const [aAnnuler, setAAnnuler] = useState(null);
  const { token, role } = useAuth();
  const toast = useToast();
  const { previewMode } = usePreviewMode();
  const { t } = useLanguage();
  // Ce qui sert à la remise (code à donner au livreur, numéro à montrer au commerce) : sous la progression dans l'app, plus
  // bas sur le site. Pas avant que le commerce accepte (audit design 2, 2026-10-19) : il ne sert qu'à la remise — au comptoir
  // ou à la porte —, et une commande encore « envoyée » peut être refusée.
  // À EMPORTER (fondateur, 2026-10-20, après le test chez Maestro Pizza) : plus de code au comptoir. Le commerce touche
  // « Remis au client » à côté du numéro de commande et du prénom du client : on montre donc le NUMÉRO en grand, et on dit
  // que le nom suffit aussi. La LIVRAISON garde son code à donner au livreur, que lui tape à la porte.
  const codeDeRemise = (o) => {
    if (!o.paid || ['nouveau', 'livre', 'refuse', 'annule'].includes(o.status)) return null;
    if (o.orderType === 'pickup') {
      return (
        <div className="suivi-code">
          {o.orderNumber != null ? (
            <>
              <div className="suivi-code-lib">{t('retrait.numberLabel')}</div>
              <div className="suivi-code-valeur">{`#${String(o.orderNumber).padStart(3, '0')}`}</div>
              <div className="suivi-code-numero">{t('retrait.nameHint')}</div>
            </>
          ) : <div className="suivi-code-numero">{t('retrait.nameOnly')}</div>}
        </div>
      );
    }
    if (o.orderType !== 'delivery' || !o.deliveryCode) return null;
    return (
      <div className="suivi-code">
        <div className="suivi-code-lib">
          {o.driverName ? t('orders.codeGiveDriverName', { name: String(o.driverName).split(' ')[0] }) : t('orders.codeGiveDriver')}
        </div>
        <div className="suivi-code-valeur">{o.deliveryCode}</div>
      </div>
    );
  };
  const cart = useCart();
  const navigate = useNavigate();
  // Signalements déjà envoyés, par commande (plan de test USR-10) — affichés à la place du bouton.
  const [signalements, setSignalements] = useState({});
  // « Commander à nouveau » qui viderait le panier d'un autre commerce : demandé d'abord (plan de test USR-9).
  const [aRecommander, setARecommander] = useState(null);
  // Site : les commandes passées dont le détail est ouvert sous leur ligne du tableau.
  const [ouvertes, setOuvertes] = useState(() => new Set());
  // La photo de la commande par le commerce, ouverte en grand (audit design 2).
  const [photoOuverte, setPhotoOuverte] = useState(null);
  const basculerDetails = (id) => setOuvertes((avant) => { const n = new Set(avant); if (n.has(id)) n.delete(id); else n.add(id); return n; });

  useEffect(() => {
    if (previewMode && role === 'restaurant') return;
    api('/me/problems', { token }).then((liste) => {
      const parCommande = {};
      for (const p of liste) if (!parCommande[p.orderId]) parCommande[p.orderId] = { ...p, responseWithinHours: 24 };
      setSignalements(parCommande);
    }).catch(() => {});
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Refait le panier d'une commande passée avec la carte d'aujourd'hui (voir recommander.js).
  async function recommander(order, confirme = false) {
    try {
      const { restaurant, lignes, manquants } = await preparerNouvelleCommande(order, token);
      if (!lignes.length) { toast(t('orders.reorderNothing'), 'erreur'); return; }
      if (!confirme && cart.hasConflict(restaurant.id)) { setARecommander(order); return; }
      cart.addMany({ restaurantId: restaurant.id, restaurantName: restaurant.name, lignes });
      if (manquants.length) toast(t('orders.reorderMissing', { items: manquants.join(', ') }));
      else toast(t('orders.reorderDone'), 'succes');
      navigate('/panier');
    } catch (e) {
      toast(e.message, 'erreur');
    }
  }

  useEffect(() => {
    // Un restaurateur en mode aperçu n'a pas de vraies commandes client (403 côté API) — liste vide
    // silencieuse plutôt qu'un message d'erreur trompeur, voir MapPage.jsx pour le même filet.
    const isPreviewingRestaurant = previewMode && role === 'restaurant';
    api('/orders/mine', { token }).then(setOrders).catch(() => { if (!isPreviewingRestaurant) setEchec(true); }).finally(() => setLoading(false));
    const interval = setInterval(() => {
      api('/orders/mine', { token }).then((l) => { setOrders(l); setEchec(false); }).catch(() => {});
    }, 15000);
    return () => clearInterval(interval);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);
  // Commande acceptée par le commerce sous les yeux du client (« nouveau » → la suite) : la sensation « succès » du
  // téléphone (audit « Look and feel » 6a, 2026-10-19). Le premier chargement ne vibre pas : rien n'a changé sous ses yeux.
  const statutsVus = useRef(null);
  useEffect(() => {
    const avant = statutsVus.current;
    statutsVus.current = new Map(orders.map((o) => [o.id, o.status]));
    if (avant && orders.some((o) => avant.get(o.id) === 'nouveau' && !['nouveau', 'refuse', 'annule'].includes(o.status))) vibrer('succes');
  }, [orders]);
  // Retour sur l'onglet après une absence : relecture immédiate des commandes.
  useRevalidation(() => api('/orders/mine', { token }).then(setOrders), { actif: !(previewMode && role === 'restaurant') });

  // Le client peut annuler tant que le restaurant n'a pas accepté la commande (statut « nouveau »), payée
  // ou non : le paiement est alors remboursé. Dès la préparation, plus d'annulation en ligne.
  async function cancelOrder(orderId) {
    setCancellingId(orderId);
    try {
      const updated = await api(`/orders/${orderId}/cancel`, { method: 'PATCH', token });
      setOrders((prev) => prev.map((x) => (x.id === orderId ? updated : x)));
      // Payée en ligne : on dit aussi que l'argent revient, et qu'un e-mail le confirme (audit du 19/10, AO-10).
      const rendu = updated?.paid && updated.paymentMode !== 'on_site' && !updated.refundPending;
      toast(t(rendu ? 'orders.toastCancelledRefund' : 'orders.toastCancelled'), 'succes');
    } catch (e) {
      toast(e.message, 'erreur');
    } finally {
      setCancellingId(null);
    }
  }

  // Commande en ligne créée mais jamais payée : le commerce ne la voit pas (il ne reçoit que les commandes payées).
  const impayeeEnLigne = (o) => o.status === 'nouveau' && !o.paid && o.paymentMode !== 'on_site';
  // Créée il y a moins de deux minutes : le paiement peut être en route (navigateur de l'app fermé aussitôt après avoir
  // payé, webhook pas encore arrivé). « Revenir au panier » annulerait la commande et ferait rembourser le paiement : il
  // n'est proposé qu'ensuite ; la liste se relit toute seule toutes les 15 s (audit du 19/10, checkout-19).
  const paiementPeutEtreEnRoute = (o) => Date.now() - Number(o.createdAt || 0) < 2 * 60 * 1000;
  // À payer sur place, mais jamais partie au commerce (carte « le total a changé » laissée en plan) : rien n'est en cours.
  const nonEnvoyee = (o) => o.status === 'nouveau' && !o.paid && o.paymentMode === 'on_site';
  async function envoyerAuCommerce(o) {
    setPayingId(o.id);
    try {
      await api(`/orders/${o.id}/confirm-on-site`, { method: 'POST', token });
      setOrders(await api('/orders/mine', { token }));
      toast(t('checkout.toastOnSiteConfirmed'), 'succes');
    } catch (e) {
      toast(e.message, 'erreur');
    } finally {
      setPayingId(null);
    }
  }
  const [payingId, setPayingId] = useState(null);
  // Même chemin que « Commander et payer » au checkout : une nouvelle session Stripe pour CETTE commande.
  async function payerMaintenant(o) {
    setPayingId(o.id);
    try {
      const pay = await api(`/payments/checkout/${o.id}`, { method: 'POST', token });
      if (pay.simulated) {
        // Entièrement couverte (solde, bon, code) : l'écran de confirmation habituel (audit du 19/10, checkout-06).
        cart.discardStashed();
        navigate(`/order-success?order=${o.id}`);
      } else {
        await allerAuPaiement(pay.checkoutUrl, { retour: '/orders' });
        // Dans l'app, la page reste /orders sous le navigateur de paiement : rien ne la remonte, et « Payer maintenant »
        // restait grisé sur « … » après l'avoir fermé sans payer (audit du 19/10, CROSS-39).
        setPayingId(null);
      }
    } catch (e) {
      toast(e.message, 'erreur');
      setPayingId(null);
    }
  }
  // Retour arrière depuis Stripe sur le site : le navigateur peut rendre la page telle qu'il l'avait gardée (bfcache),
  // bouton encore sur « … » (audit du 19/10, CROSS-40).
  useEffect(() => {
    const surRetour = (e) => { if (e.persisted) setPayingId(null); };
    window.addEventListener('pageshow', surRetour);
    return () => window.removeEventListener('pageshow', surRetour);
  }, []);
  // Annule la commande impayée (le solde et le bon cadeau retenus sont rendus par le serveur) et rend le panier mis de côté
  // pour elle, s'il est encore là — sinon on renvoie au commerce, où le client recompose sa commande.
  async function revenirAuPanier(o) {
    setCancellingId(o.id);
    try {
      const updated = await api(`/orders/${o.id}/cancel`, { method: 'PATCH', token });
      setOrders((prev) => prev.map((x) => (x.id === o.id ? updated : x)));
      if (cart.restoreStashed(o.id)) navigate('/panier');
      else navigate(`/restaurants/${o.restaurantId}`);
    } catch (e) {
      toast(e.message, 'erreur');
    } finally {
      setCancellingId(null);
    }
  }

  // ?type=pickup|delivery restreint la liste à un type de commande.
  const typeFiltre = searchParams.get('type');
  const listeAffichee = typeFiltre ? orders.filter((o) => o.orderType === typeFiltre) : orders;
  const titre = t('orders.title');
  // En cours d'abord, puis l'historique en cartes compactes (refonte du 2026-09-29) : une commande livrée il y a
  // trois semaines prenait autant de place que celle qu'on attend.
  const estPassee = (o) => ['livre', 'annule', 'refuse'].includes(o.status);
  const enCours = listeAffichee.filter((o) => !estPassee(o));
  const passees = listeAffichee.filter(estPassee);
  const quand = (ms) => new Date(ms).toLocaleString(getLocale(), { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' });

  // Mes commandes n'a pas de bandeau dans l'app (le titre, puis les cartes) : le titre, puis des lignes iris pâle (Skeleton.jsx).
  if (loading) return <div><h1 className="page-title">{titre}</h1><SkeletonCards count={3} /></div>;
  // Pas lues (réseau, serveur) : jamais « Rien en route pour l'instant », qui ferait croire la commande perdue.
  if (echec && orders.length === 0) {
    return (
      <div>
        <h1 className="page-title">{titre}</h1>
        <ErreurChargement onReessayer={() => { setEchec(false); setLoading(true); api('/orders/mine', { token }).then(setOrders).catch(() => setEchec(true)).finally(() => setLoading(false)); }} />
      </div>
    );
  }
  /* AUCUNE COMMANDE (fondateur, 2026-10-17, « My orders » de maquettes/commerces-marque/commerces-marque.html) : le même bandeau que Mes favoris,
     le calendrier d'ouverture posé dessus en note translucide, le vélo qui attend dans la feuille blanche. */
  // Tirer pour actualiser (app) : la même relecture que le sondage des 15 s.
  const tirer = <TirerPourActualiser onActualiser={() => api('/orders/mine', { token }).then(setOrders)} />;
  if (listeAffichee.length === 0) {
    return (
      <div className="ecran-bandeau commandes-vide">
        {tirer}
        <div className="eb-bandeau">
          <h1 className="eb-titre">{titre}</h1>
          <p className="eb-sous">{t('orders.bandeauVide')}</p>
          <BandeauOuverture role="client" />
        </div>
        <div className="eb-feuille">
        {/* Juste inscrit, rien commandé : c'est ici qu'on arrive le plus souvent, donc ici que le rappel sert le plus. */}
        <RappelEmail />
        {/* Le vide occupe toute la page ici : une ligne grise dans un cadre en pointillés y
            ressemblait à une panne. On nomme ce qui manque, et on donne le seul geste qui le
            remplit — parcourir les commerces. */}
        <EtatVide
          icone="sac"
          scene="commandes"
          titre={t('orders.empty')}
          texte={t('orders.emptyHint')}
          actionVers="/restaurants"
          actionTexte={t('orders.emptyAction')}
        />
        </div>
      </div>
    );
  }

  /* LES MORCEAUX D'UNE COMMANDE. Ils étaient écrits d'un seul tenant dans la carte ; le site les range à sa façon (2026-10-16,
   * maquettes/site-ordinateur/site-ordinateur.html, section 6), la carte de l'app suit le moment de la commande (audit design 2, plus bas). */
  // UN ARTICLE PAR LIGNE, avec sa quantité dans une case.
  // Les articles étaient aplatis en une seule chaîne par .join(', ') : « 2× Maxi Frites
  // (Sauce andalouse), 1× L'Ardenne Menu (L'Ardenne, Maxi Frites, Coca Cola 33cl) ». Sur
  // une commande de trois plats à options, cela donnait un paragraphe gris de cinq lignes
  // où il fallait chercher les virgules pour savoir ce qu'on avait commandé. La capture
  // « Past Orders » met une ligne par article, la quantité dans une case à gauche, et les
  // options en gris dessous. C'est la même information, lisible d'un coup d'oeil.
  const blocArticles = (o) => (
    <>
      {estPassee(o) && o.items.length > 0 && <p className="suivi-resume">{o.items.map(formatOrderItem).join(', ')}</p>}
      {!estPassee(o) && o.items.length > 0 && (
        <ul className="commande-articles">
          {o.items.map((i, n) => (
            <li key={n}>
              <span className="commande-article-qte">{i.qty}</span>
              <span className="commande-article-texte">
                <b>{i.name}</b>
                {i.options?.length > 0 && <span className="small">{i.options.map((op) => op.name).join(' · ')}</span>}
              </span>
            </li>
          ))}
        </ul>
      )}
    </>
  );
  // Où, et les consignes à la porte : seulement tant que la commande est en cours (une commande passée ne les répète plus).
  const blocLieu = (o) => (
    <>
      {o.orderType === 'pickup' && !estPassee(o) && (
        <div className="small suivi-lieu">{t('orders.pickupAt', { name: o.restaurantName, address: o.restaurantAddress ? `, ${o.restaurantAddress}` : '' })}</div>
      )}
      {o.orderType === 'delivery' && !estPassee(o) && (
        <div className="small suivi-lieu"><Icone nom="position" taille={14} /> {o.address}</div>
      )}
      {o.deliveryInstructions && !estPassee(o) && (
        <div className="small suivi-consignes">{deliveryInstructionLabel(o.deliveryInstructions, t)}{o.deliveryNote ? ` · ${o.deliveryNote}` : ''}</div>
      )}
    </>
  );
  // Commande refusée par le commerce : le motif qu'il a donné (obligatoire depuis le 2026-10-02), et ce qui revient au client.
  // Rien d'autre (audit design 2) : ni « Payée … », ni « le livreur sera nommé ici ».
  const blocRefus = (o) => (o.status === 'refuse' ? (
    <div className="suivi-refus">
      {o.refusalReason && <p>{t('orders.refusalReason', { reason: o.refusalReason })}</p>}
      {/* Remboursement automatique en échec (audit du 19/10, AO-02) : « en cours », pas « en route ». */}
      <p>{o.paid && o.paymentMode !== 'on_site'
        ? (o.refundPending ? t('orderStatus.next_refund_pending') : t('orders.refundLine', { amount: euros(debite(o)) }))
        : t('orders.refundNothing')}</p>
    </div>
  ) : null);
  // Le livreur en une rangée : sa photo (ou son initiale), son prénom, et « Appeler » — un vrai appel, son numéro n'étant donné
  // que pendant la course (backend mapOrder).
  const rangeeLivreur = (o) => (o.driverName && !estPassee(o) ? (
    <div className="suivi-livreur">
      <DriverBadge name={o.driverName} photoUrl={o.driverPhotoUrl} size={40} />
      {o.driverPhone && (
        <a className="suivi-appeler" href={`tel:${String(o.driverPhone).replace(/[^+\d]/g, '')}`}>
          <Icone nom="telephone" taille={16} />{t('retrait.call')}
        </a>
      )}
    </div>
  ) : null);
  const blocDetails = (o) => (
    <>
      {blocLieu(o)}
      {blocRefus(o)}
      <LivreurALaPorte order={o} />
      {o.driverName && !(o.status === 'refuse') && (
        <div style={{ margin: '6px 0' }}><DriverBadge name={o.driverName} phone={o.driverPhone} photoUrl={o.driverPhotoUrl} size={40} /></div>
      )}
      <VendeurLivraison order={o} />
      <SansLivreur order={o} token={token} toast={toast} onUpdated={(maj) => setOrders((prev) => prev.map((x) => (x.id === maj.id ? maj : x)))} />
      {o.deliveryIncident && <p className="small" style={{ marginTop: 8 }}>{t(`orders.noCourier_incident_${o.deliveryIncident}`)}</p>}
    </>
  );
  // La carte du trajet, pendant la livraison seulement. Plus haute sur le site, où elle tient sa propre colonne.
  const blocCarte = (o) => (o.status === 'livraison' && o.restaurantLat && o.deliveryLat ? (
    <div className="suivi-carte-trajet" style={{ margin: '10px 0' }}>
      <DeliveryTrackingMap
        restaurantLat={o.restaurantLat} restaurantLng={o.restaurantLng}
        deliveryLat={o.deliveryLat} deliveryLng={o.deliveryLng}
        driverLat={o.driverLat} driverLng={o.driverLng}
        lastUpdatedAt={o.driverLocationUpdatedAt}
        {...(APPLI ? {} : { height: 320 })}
      />
      <div className="small" style={{ marginTop: 4, textAlign: 'center' }}>
        {/* Plus de 2 min sans nouvelle position (même seuil que la carte) : pas « en direct » (audit du 19/10, AO-17). */}
        {o.driverLat
          ? t(o.driverLocationUpdatedAt && Date.now() - new Date(o.driverLocationUpdatedAt).getTime() > 120000 ? 'orders.driverLastLocation' : 'orders.driverLiveLocation')
          : t('orders.driverWaitingLocation')}
      </div>
    </div>
  ) : null);
  /* LA PHOTO DE LA COMMANDE PAR LE COMMERCE (audit design 2, 2026-10-19). Le commerce la prend avant la remise (ticket et
   * produits dans le cadre, routes/entrainement.js POST /orders/:id/photo) ; le serveur l'envoyait déjà au client
   * (mapOrder.preparedPhoto), aucun écran ne la montrait. Une fois la commande prête et pendant la livraison : « ce qui
   * arrive chez toi ». Toucher la vignette l'ouvre en grand. */
  const blocPhoto = (o) => (o.preparedPhoto?.url && ['pret', 'livraison'].includes(o.status) ? (
    <button type="button" className="suivi-photo" onClick={() => setPhotoOuverte(o)}>
      <img src={vignettePhoto(o.preparedPhoto.url, 112)} alt="" width={56} height={56} loading="lazy" />
      <span><b>{t('orders.photoTitle')}</b>{o.preparedPhoto.at
        ? `, ${t('orders.photoBy', { name: o.restaurantName, time: heureCourte(o.preparedPhoto.at) })}`
        : `, ${t('orders.photoByNoTime', { name: o.restaurantName })}`}</span>
    </button>
  ) : null);
  // Pourboire payé avec la commande : débité en plus du total (backend pourboireCommande.js).
  const debite = (o) => o.total + (o.tipPaid && o.tipAtCheckout > 0 ? o.tipAtCheckout : 0);
  /* CE QUI A ÉTÉ RENDU (audit du 19/10, AO-11). « Payée 25,00 € » restait sous une commande annulée et remboursée, et un
   * remboursement partiel ne se voyait nulle part. Même lecture que « Mes factures » (InvoicesPage.jsx) et que le reçu :
   * refundedAmount = somme d'order_refunds (remboursements automatiques compris, inscrits par le webhook Stripe),
   * refundPending = remboursement automatique en échec. Le statut seul ne suffit pas : une commande annulée n'est pas
   * toujours remboursée (client absent, non récupérée, décision de l'équipe). */
  const etatRemboursement = (o) => {
    if (o.refundPending) return 'en_cours';
    const rendu = Number(o.refundedAmount || 0);
    if (rendu <= 0) return null;
    return rendu >= Number(o.total) - 0.005 ? 'total' : 'partiel';
  };
  const libellePaye = (o) => {
    const etat = etatRemboursement(o);
    if (etat === 'en_cours') return t('invoicesClient.refundPending');
    if (etat === 'total') return t('invoicesClient.refunded');
    return t('orders.paid');
  };
  // `avecMontant` : le tableau des commandes passées du site a déjà sa colonne Total. Commande refusée : pas de « Payée … »,
  // le remboursement est dit par blocRefus.
  const blocTotal = (o, avecMontant = true) => (o.status === 'refuse' ? null : (
    <>
      {/* Payée sur place puis annulée : « À payer sur place 4,50 € » restait affiché sous une commande close (audit du 19/10,
          LIVE-11). Rien n'a été payé, rien n'est à payer : on le dit, sans montant. */}
      {avecMontant && o.paymentMode === 'on_site' && o.status === 'annule' && !o.pickupNoShow ? (
        <div className="suivi-total"><span className="small">{t('orders.payNothing')}</span></div>
      ) : avecMontant && (
        <div className="suivi-total">
          <span className="small">{o.paymentMode === 'on_site' ? (o.pickupNoShow ? t('orders.noShow') : t('orders.payOnSite')) : o.paid ? libellePaye(o) : t('orders.paymentPending')}</span>
          <b>{euros(debite(o))}</b>
        </div>
      )}
      {o.paid && o.paymentMode !== 'on_site' && etatRemboursement(o) === 'partiel' && (
        <div className="small" style={{ textAlign: avecMontant ? 'right' : undefined }}>{t('orders.refundedPart', { amount: euros(o.refundedAmount) })}</div>
      )}
      {o.tipPaid && o.tipAtCheckout > 0 && <div className="small" style={{ textAlign: avecMontant ? 'right' : undefined }}>{t('orders.tipIncluded', { amount: euros(o.tipAtCheckout) })}</div>}
      {o.tipRefunded && o.tipAtCheckout > 0 && <div className="small" style={{ textAlign: avecMontant ? 'right' : undefined }}>{t('orders.tipRefunded', { amount: euros(o.tipAtCheckout) })}</div>}
      {/* Déposée devant la porte : la photo prise par le livreur (lien signé, valable quelques minutes ; effacée après 30 jours). */}
      {o.deliveredPhoto?.url && (
        <a className="small" href={o.deliveredPhoto.url} target="_blank" rel="noopener noreferrer" style={{ display: 'inline-block', marginTop: 6 }}>
          <Icone nom="porte" taille={14} className="icone-texte" /> {t('orders.doorDropPhoto')}
        </a>
      )}
    </>
  ));
  // PAIEMENT NON TERMINÉ (audit du 15/10/2026). Revenu de Stripe sans payer (bouton Retour, navigateur de l'appli fermé), le
  // client trouvait ici « le commerce doit encore confirmer » et un seul bouton Annuler, et son panier avait disparu. Deux
  // choix, faits par lui et non devinés : payer cette commande-ci, ou l'annuler et retrouver son panier. Rien n'est annulé
  // tout seul : Stripe peut confirmer un paiement quelques secondes après la fermeture.
  const blocNonTermine = (o) => (
    <>
      {impayeeEnLigne(o) && (
        <div className="paiement-non-termine">
          <p className="small" style={{ margin: '0 0 10px' }}>{t(paiementPeutEtreEnRoute(o) ? 'orders.checkingPayment' : 'orders.unpaidText')}</p>
          <div className="row" style={{ gap: 8, flexWrap: 'wrap' }}>
            <button type="button" className="btn-gold" disabled={payingId === o.id || cancellingId === o.id} onClick={() => payerMaintenant(o)}>
              {payingId === o.id ? '…' : t('orders.payNow')}
            </button>
            {!paiementPeutEtreEnRoute(o) && (
              <button type="button" className="btn-outline" disabled={payingId === o.id || cancellingId === o.id} onClick={() => revenirAuPanier(o)}>
                {cancellingId === o.id ? '…' : t('orders.backToCart')}
              </button>
            )}
          </div>
        </div>
      )}
      {nonEnvoyee(o) && (
        <div className="paiement-non-termine">
          <p className="small" style={{ margin: '0 0 10px' }}>{t('orders.notSentText')}</p>
          <div className="row" style={{ gap: 8, flexWrap: 'wrap' }}>
            <button type="button" className="btn-gold" disabled={payingId === o.id || cancellingId === o.id} onClick={() => envoyerAuCommerce(o)}>
              {payingId === o.id ? '…' : t('orders.sendToShop')}
            </button>
            <button type="button" className="btn-outline" disabled={payingId === o.id || cancellingId === o.id} onClick={() => revenirAuPanier(o)}>
              {cancellingId === o.id ? '…' : t('orders.backToCart')}
            </button>
          </div>
        </div>
      )}
    </>
  );
  // Annuler, tant que le commerce n'a pas accepté. La règle est dite UNE fois, dans la note au-dessus (ProchaineEtape : « tu peux
  // aussi l'annuler toi-même d'ici là ») ; la phrase qui la répétait sous le bouton est partie (audit design 2).
  const boutonAnnuler = (o) => (o.status === 'nouveau' && !impayeeEnLigne(o) && !nonEnvoyee(o) ? (
    <button type="button" className="btn-ghost suivi-annuler" disabled={cancellingId === o.id} onClick={() => setAAnnuler(o)}>
      {cancellingId === o.id ? '...' : t('orders.cancelOrder')}
    </button>
  ) : null);
  // En route, « le commerce la prépare » était faux (audit du 19/10, AO-15) : une phrase pour la livraison.
  const noteVerrou = (o) => (['preparation', 'pret', 'livraison'].includes(o.status) ? <div className="small" style={{ marginTop: 6 }}>{t(o.status === 'livraison' ? 'orders.cancelLockedOnTheWay' : 'orders.cancelLocked')}</div> : null);
  // LE PIED D'UNE COMMANDE : avis, pourboire, « Signaler un problème » ou « Un souci ? », « Commander à nouveau ». Une rangée
  // alignée sur le texte de la carte (audit design 2 : les deux liens étaient décalés l'un par rapport à l'autre).
  // `avecRecommander` : sur le site, « Commander à nouveau » est déjà sur la ligne du tableau.
  const blocPied = (o, avecRecommander = true) => (
    <>
      {reviewingId === o.id && (() => {
        const formulaire = (
          <ReviewForm
            order={o} token={token} toast={toast} t={t} pourboireSeul={!!o.reviewed}
            onDone={(maj = {}) => { setReviewingId(null); setOrders((prev) => prev.map((x) => (x.id === o.id ? { ...x, reviewed: true, ...maj } : x))); }}
          />
        );
        return APPLI ? <SousEcran titre={o.reviewed ? t('orders.leaveTip') : t('orders.leaveReview')} onFermer={() => setReviewingId(null)}>{formulaire}</SousEcran> : formulaire;
      })()}
      {o.status === 'livre' && o.reviewed && (
        <div className="small" style={{ marginTop: 8, color: 'var(--teal-deep)' }}>{t('orders.reviewSent')}</div>
      )}
      {/* Ce que le client a écrit, et la réponse publique du commerce (audit du 19/10, AO-22) — la même mise en forme que sur
          la page du commerce (RestaurantMenu.jsx). Lecture seule : modifier ou retirer un avis reste à décider. */}
      {o.status === 'livre' && o.myReview && (
        <div className="small" style={{ marginTop: 4 }}>
          <StarsDisplay value={o.myReview.foodRating} />
          {o.myReview.foodComment && <p className="small" style={{ margin: '2px 0 0' }}>{o.myReview.foodComment}</p>}
          {o.myReview.restaurantReply && (
            <div style={{ marginTop: 6, paddingLeft: 10, borderLeft: '2px solid var(--teal)' }}>
              <div className="small" style={{ fontWeight: 700 }}>{t('restaurantMenu.reviewReplyFrom', { name: o.restaurantName })}</div>
              <p className="small" style={{ margin: '2px 0 0' }}>{o.myReview.restaurantReply}</p>
            </div>
          )}
        </div>
      )}
      {/* « Un souci ? » à chaque étape — sauf là où « Signaler un problème » est déjà proposé. */}
      {!(o.paid && ['livre', 'livraison'].includes(o.status)) && <AideCommande order={o} />}
      <div className="suivi-pied">
        {o.status === 'livre' && !o.reviewed && reviewingId !== o.id && (
          <button type="button" className="suivi-lien" onClick={() => setReviewingId(o.id)}>{t('orders.leaveReview')}</button>
        )}
        {o.status === 'livre' && o.reviewed && o.driverName && !o.tipPaid && reviewingId !== o.id && (
          <button type="button" className="suivi-lien" onClick={() => setReviewingId(o.id)}>{t('orders.leaveTip')}</button>
        )}
        {/* Signaler un problème (USR-10) : commande payée et terminée ; « jamais reçue » aussi pendant la livraison. */}
        {o.paid && ['livre', 'livraison'].includes(o.status) && (
          <SignalerProbleme order={o} token={token} toast={toast} signalement={signalements[o.id]}
            onSignale={(s) => setSignalements((prev) => ({ ...prev, [o.id]: s }))} />
        )}
        {/* Le reçu, sur la commande même (audit du 19/10, AO-31) : il n'était que dans « Mes factures ». Commande payée en
            ligne et close, la même règle que Mes factures (InvoicesPage.jsx, aUnRecu). */}
        {o.paid && o.paymentMode !== 'on_site' && !o.isTraining && estPassee(o) && (
          <button type="button" className="suivi-lien" onClick={() => ouvrirPdf(`${API_BASE}/orders/${o.id}/receipt`, token, t('invoicesClient.downloadFailed'), nomRecu(o))}>{t('invoicesClient.viewInvoice')}</button>
        )}
        {/* Commander à nouveau (USR-9) : une commande close, refaite avec la carte d'aujourd'hui. */}
        {avecRecommander && ['livre', 'annule', 'refuse'].includes(o.status) && (o.items || []).length > 0 && (
          <button type="button" className="btn-outline suivi-recommander" onClick={() => recommander(o)}>{t('orders.reorder')}</button>
        )}
      </div>
    </>
  );
  // Le site : les mêmes morceaux qu'avant, dans le même ordre.
  const blocActions = (o, avecRecommander = true) => (
    <>
      {blocNonTermine(o)}
      {/* À emporter : quand, où, itinéraire, appel, ce qu'on paie au comptoir. */}
      <InfosRetrait order={o} compact />
      {boutonAnnuler(o)}
      {noteVerrou(o)}
      {blocPied(o, avecRecommander)}
    </>
  );
  const dialogues = (
    <>
      <ConfirmDialog
        open={!!aAnnuler}
        title={t('orders.cancelConfirmTitle')}
        message={t(aAnnuler?.paymentMode === 'on_site' ? 'orders.cancelConfirmOnSite' : aAnnuler?.paid ? 'orders.cancelConfirmPaid' : 'orders.cancelConfirmBody')}
        confirmLabel={t('orders.cancelOrder')}
        danger
        onCancel={() => setAAnnuler(null)}
        onConfirm={() => { const o = aAnnuler; setAAnnuler(null); cancelOrder(o.id); }}
      />
      <ConfirmDialog
        open={!!aRecommander}
        title={t('orders.reorderConflictTitle')}
        message={t('orders.reorderConflictText', { name: cart.restaurantName })}
        confirmLabel={t('orders.reorder')}
        onCancel={() => setARecommander(null)}
        onConfirm={() => { const o = aRecommander; setARecommander(null); recommander(o, true); }}
      />
      {photoOuverte && (
        APPLI ? (
          <SousEcran titre={t('orders.photoTitle')} onFermer={() => setPhotoOuverte(null)}>
            <img className="suivi-photo-grande" src={vignettePhoto(photoOuverte.preparedPhoto.url, 1200, false)} alt={t('orders.photoAlt', { name: photoOuverte.restaurantName })} />
            {photoOuverte.preparedPhoto.at && <p className="small" style={{ marginTop: 8 }}>{t('orders.photoBy', { name: photoOuverte.restaurantName, time: heureCourte(photoOuverte.preparedPhoto.at) })}</p>}
          </SousEcran>
        ) : (
          <Modale onFermer={() => setPhotoOuverte(null)} titre={t('orders.photoTitle')}>
            <img className="suivi-photo-grande" src={vignettePhoto(photoOuverte.preparedPhoto.url, 1200, false)} alt={t('orders.photoAlt', { name: photoOuverte.restaurantName })} />
          </Modale>
        )
      )}
    </>
  );
  const notifications = (
    <>
      {/* Adresse e-mail pas encore confirmée : le rappel, le plus tôt possible après l'inscription (EmailConfirmation.jsx). */}
      <RappelEmail />
      <ClocheNotifications />
      {/* Le suivi sur le téléphone, même page fermée : acceptée, en route, à la porte… (ReglageNotifications.jsx). */}
      <ReglageNotifications textes={{ aide: t('orders.notifHelp'), actif: t('orders.notifOn') }} />
    </>
  );
  // L'en-tête iris d'une commande en cours (version 1C, RouteSuivi dans orderStatus.jsx).
  const enteteSuivi = (o) => (
    <div className="suivi-bandeau">
      <div className="suivi-bandeau-haut"><span><b>{o.restaurantName}</b> · {orderTypeLabel(o, t)}</span><span>{quand(o.createdAt)}</span></div>
      <h2 className="suivi-bandeau-titre" key={o.status}>{titreSuivi(o, t)}</h2>
      <DeliveryTiming order={o} />
      {/* Pas encore reçue par le commerce (paiement non terminé, ou sur place jamais envoyée) : pas de route qui dirait « Envoyée ». */}
      {!(o.status === 'nouveau' && !o.paid) && <RouteSuivi status={o.status} orderType={o.orderType} />}
    </div>
  );

  /* L'APPLICATION : UNE COMMANDE EN COURS SUIT SON MOMENT (audit design 2, « Proposition » de la section 6, fondateur, 2026-10-19).
   * Pendant « En route », la carte du trajet était à un écran et demi sous le code, une note grise, les articles, l'adresse,
   * les consignes, le livreur et un encadré légal. Maintenant, sous le bandeau iris, seulement ce qui sert à ce moment-là :
   *   - envoyée : une note courte, « Annuler » (pas encore de code : il ne sert qu'à la remise) ;
   *   - en préparation : la note, puis le livreur dès qu'il est nommé, le code ;
   *   - prête : la photo de la commande par le commerce, le livreur, le code ;
   *   - en route : la carte, le livreur avec « Appeler », le code, la photo.
   * Le reste (articles, adresse, consignes, vendeur de la livraison, montant) se replie dans « Détails ». */
  const resumeDetails = (o) => {
    const n = (o.items || []).reduce((s, i) => s + (Number(i.qty) || 1), 0);
    const lieu = o.orderType === 'delivery' ? String(o.address || '').split(',')[0] : '';
    return [n > 0 ? t(n > 1 ? 'ecranCommande.articlesPluriel' : 'ecranCommande.articles', { count: n }) : null, lieu || null, euros(debite(o))].filter(Boolean).join(' · ');
  };
  const carteEnCours = (o) => {
    const livraison = o.orderType === 'delivery';
    const enRoute = o.status === 'livraison';
    // La note « et maintenant ? » : utile tant que la carte n'a rien d'autre à montrer. En route, le code et le livreur disent
    // tout ; en préparation ou prête, la note s'efface dès que le livreur est nommé (sa rangée la remplace).
    const note = !enRoute && !(livraison && o.driverName && ['preparation', 'pret'].includes(o.status)) && <ProchaineEtape order={o} />;
    return (
      <>
        <LivreurALaPorte order={o} />
        {blocNonTermine(o)}
        {enRoute && blocCarte(o)}
        {note}
        {boutonAnnuler(o)}
        {!enRoute && blocPhoto(o)}
        {rangeeLivreur(o)}
        <SansLivreur order={o} token={token} toast={toast} onUpdated={(maj) => setOrders((prev) => prev.map((x) => (x.id === maj.id ? maj : x)))} />
        {o.deliveryIncident && <p className="small" style={{ marginTop: 8 }}>{t(`orders.noCourier_incident_${o.deliveryIncident}`)}</p>}
        {codeDeRemise(o)}
        {enRoute && blocPhoto(o)}
        <InfosRetrait order={o} compact />
        <details className="suivi-details">
          <summary>
            <span className="suivi-details-texte"><b>{t('siteCommande.details')}</b><span>{resumeDetails(o)}</span></span>
            <span className="suivi-details-chevron" aria-hidden="true" />
          </summary>
          <div className="suivi-details-corps">
            {blocArticles(o)}
            {blocLieu(o)}
            <VendeurLivraison order={o} />
            {blocTotal(o)}
            {noteVerrou(o)}
          </div>
        </details>
        {blocPied(o)}
      </>
    );
  };
  // Une commande passée : ce qu'elle était, comment elle s'est terminée, ce qu'on peut encore faire. Sans les consignes à la
  // porte ni l'adresse (audit design 2) ; refusée, le motif et le remboursement seulement.
  const cartePassee = (o) => (
    <>
      <div className="suivi-tete">
        <span className="suivi-tete-texte">
          <b className="suivi-resto">{o.restaurantName}</b>
          <span className="suivi-sous">{orderTypeLabel(o, t)} · {quand(o.createdAt)}</span>
        </span>
        <span className={`status-badge status-${o.status}`}>{statusLabel(o.status, o.orderType, t, true)}</span>
      </div>
      {!['livre', 'refuse'].includes(o.status) && <ProchaineEtape order={o} />}
      {blocArticles(o)}
      {blocRefus(o)}
      {o.status === 'livre' && o.driverName && (
        <div style={{ margin: '6px 0' }}><DriverBadge name={o.driverName} photoUrl={o.driverPhotoUrl} size={40} /></div>
      )}
      {o.deliveryIncident && <p className="small" style={{ marginTop: 8 }}>{t(`orders.noCourier_incident_${o.deliveryIncident}`)}</p>}
      {blocTotal(o)}
      {blocPied(o)}
    </>
  );

  if (APPLI) {
    return (
      <div>
        {tirer}
        <h1 className="page-title">{titre}</h1>
        {notifications}
        {enCours.length > 0 && passees.length > 0 && <h2 className="suivi-section">{t('orders.sectionCurrent')}</h2>}
        {[...enCours, ...passees].map((o, rang) => (
          <Fragment key={o.id}>
          {rang === enCours.length && passees.length > 0 && <h2 className="suivi-section">{t('orders.sectionPast')}</h2>}
          <div className={`card suivi-carte${estPassee(o) ? ' est-passee' : ' suivi-carte--bandeau'}`}>
            {estPassee(o) ? cartePassee(o) : (
              <>
                {enteteSuivi(o)}
                {carteEnCours(o)}
              </>
            )}
          </div>
          </Fragment>
        ))}
        {dialogues}
      </div>
    );
  }

  /* LE SITE (2026-10-16, « Proposition » de maquettes/site-ordinateur/site-ordinateur.html, section 6). La commande en cours EST le bandeau
   * iris de la page (le statut en grand, la route où roule le vélo, 1C) ; dans la feuille blanche, sur un ordinateur, la carte
   * du trajet et le code à donner au livreur tiennent côte à côte, le détail dessous. Une deuxième commande en cours garde
   * sa carte à bandeau. Les commandes passées deviennent un tableau compact (des cartes compactes sur un téléphone) ;
   * « Commander à nouveau » est sur la ligne, le reste (avis, signalement, motif d'un refus…) s'ouvre sous « Détails ».
   * Mêmes données, mêmes actions qu'avant. Styles : site-commande.css. */
  const corpsSite = (o) => {
    const carte = blocCarte(o);
    // Deux colonnes sur ordinateur : la carte du trajet à gauche et tout le reste à droite pendant la livraison ; sinon le
    // suivi (étape, articles, adresse) à gauche, le code, le total et les actions à droite. Sur un téléphone les deux
    // colonnes s'effacent (display: contents) et l'ordre se lit : code, suivi, carte, total, actions.
    const suivi = (
      <>
        <div className="sc-suivi-etape">{o.status !== 'livre' && <ProchaineEtape order={o} />}</div>
        <div className="sc-suivi-articles">{blocArticles(o)}</div>
        <div className="sc-suivi-details">{blocDetails(o)}</div>
      </>
    );
    return (
      <div className={`sc-suivi${carte ? ' avec-carte' : ''}`}>
        <div className="sc-suivi-g">{carte ? <div className="sc-suivi-carte">{carte}</div> : suivi}</div>
        <div className="sc-suivi-d">
          <div className="sc-suivi-code">{codeDeRemise(o)}{blocPhoto(o)}</div>
          {carte && suivi}
          <div className="sc-suivi-total">{blocTotal(o)}</div>
          <div className="sc-suivi-actions">{blocActions(o)}</div>
        </div>
      </div>
    );
  };
  const [vedette, ...autresEnCours] = enCours;
  const nbArticles = (o) => (o.items || []).reduce((n, i) => n + (Number(i.qty) || 1), 0);
  return (
    <div className="ec-page sc-page sc-commandes">
      {vedette ? (
        <header className="ec-bandeau sc-bandeau-suivi">
          <div className="ec-col">
            <h1 className="sc-surtitre">{titre}</h1>
            <div className="ec-haut"><span className="ec-haut-texte"><b>{vedette.restaurantName}</b> · {orderTypeLabel(vedette, t)} · {quand(vedette.createdAt)}</span></div>
            <h2 className="ec-titre sc-titre-suivi" key={vedette.status}>{titreSuivi(vedette, t)}</h2>
            <DeliveryTiming order={vedette} />
            {!(vedette.status === 'nouveau' && !vedette.paid) && <RouteSuivi status={vedette.status} orderType={vedette.orderType} />}
          </div>
        </header>
      ) : <BandeauCommande titre={titre} />}
      <FeuilleCommande>
        <div className="sc-notifs">{notifications}</div>
        {vedette && corpsSite(vedette)}
        {autresEnCours.map((o) => (
          <div key={o.id} className="card suivi-carte suivi-carte--bandeau sc-autre-en-cours">
            {enteteSuivi(o)}
            {corpsSite(o)}
          </div>
        ))}
        {passees.length > 0 && (
          <section className="sc-passees-bloc" aria-labelledby="sc-passees-titre">
            <h2 className="sc-sec-titre" id="sc-passees-titre"><Icone nom="horloge" taille={20} /> {t('orders.sectionPast')}</h2>
            <table className="sc-passees">
              <thead>
                <tr>
                  <th scope="col">{t('siteCommande.colCommerce')}</th>
                  <th scope="col" className="sc-c-date">{t('siteCommande.colDate')}</th>
                  <th scope="col">{t('siteCommande.colArticles')}</th>
                  <th scope="col">{t('siteCommande.colStatut')}</th>
                  <th scope="col" className="sc-num">{t('siteCommande.colTotal')}</th>
                  <th scope="col"><span className="sr-only">{t('siteCommande.colActions')}</span></th>
                </tr>
              </thead>
              <tbody>
                {passees.map((o) => {
                  const ouvert = ouvertes.has(o.id) || reviewingId === o.id;
                  const n = nbArticles(o);
                  return (
                    <Fragment key={o.id}>
                      <tr className={`sc-passee${ouvert ? ' ouverte' : ''}`}>
                        <td className="sc-c-nom">
                          <span className="sc-nom-c">
                            <span className="sc-tuile" aria-hidden="true"><Icone nom={o.orderType === 'pickup' ? 'sac' : 'velo'} taille={18} /></span>
                            <span className="sc-nom-texte"><b>{o.restaurantName}</b><small>{orderTypeLabel(o, t)}<span className="sc-tel-seul"> · {quand(o.createdAt)}</span></small></span>
                          </span>
                        </td>
                        <td className="sc-c-date">{quand(o.createdAt)}</td>
                        <td className="sc-c-art" title={o.items.map(formatOrderItem).join(', ')}>{n > 0 && t(n > 1 ? 'ecranCommande.articlesPluriel' : 'ecranCommande.articles', { count: n })}</td>
                        <td className="sc-c-statut"><span className={`status-badge status-${o.status}`}>{statusLabel(o.status, o.orderType, t, true)}</span></td>
                        <td className="sc-c-total sc-num">{euros(debite(o))}</td>
                        <td className="sc-c-actions">
                          {(o.items || []).length > 0 && <button type="button" className="btn-outline btn-sm" onClick={() => recommander(o)}>{t('orders.reorder')}</button>}
                          <button type="button" className="sc-details" aria-expanded={ouvert} aria-controls={ouvert ? `sc-detail-${o.id}` : undefined}
                            onClick={() => basculerDetails(o.id)}>{t('siteCommande.details')}<span className="sc-chevron" aria-hidden="true" /></button>
                        </td>
                      </tr>
                      {ouvert && (
                        <tr className="sc-passee-detail" id={`sc-detail-${o.id}`}>
                          <td colSpan={6}>
                            <div className="sc-detail">
                              {o.status !== 'livre' && <ProchaineEtape order={o} />}
                              {blocArticles(o)}
                              {blocDetails(o)}
                              {blocTotal(o, false)}
                              {blocActions(o, false)}
                            </div>
                          </td>
                        </tr>
                      )}
                    </Fragment>
                  );
                })}
              </tbody>
            </table>
          </section>
        )}
      </FeuilleCommande>
      {dialogues}
    </div>
  );
}
