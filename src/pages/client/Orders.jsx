import { allerAuPaiement, experienceApp } from '../../natif';
import SousEcran from '../../components/SousEcran';

/* DANS L'APPLICATION (2026-10-15), la carte d'une commande en cours se lit dans l'ordre où l'on en a besoin : le code à
 * donner au livreur (ou à montrer au commerce) juste sous la progression, plus en bas sous la carte ; l'avis et le
 * pourboire, et « Signaler un problème », s'ouvrent dans une feuille au lieu de s'insérer dans la carte. */
const APPLI = experienceApp();
import { Fragment, useEffect, useState } from 'react';
import useRevalidation from '../../useRevalidation';
import EtatVide from '../../components/EtatVide';
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
import { api } from '../../api';
import { useAuth } from '../../context/AuthContext';
import { useToast } from '../../context/ToastContext';
import { usePreviewMode } from '../../context/PreviewModeContext';
import { useLanguage, getLocale } from '../../context/LanguageContext';
import { DeliveryTiming, ProchaineEtape, RouteSuivi, titreSuivi, deliveryInstructionLabel, statusLabel, orderTypeLabel, formatOrderItem } from '../../orderStatus';
import { SkeletonCards } from '../../components/Skeleton';
import { StarsInput } from '../../components/Stars';
import DriverBadge from '../../components/DriverBadge';
import DeliveryTrackingMap from '../../components/DeliveryTrackingMap';
import Icone from '../../components/Icone';
import VendeurLivraison from '../../components/conformite/VendeurLivraison';
import { euros } from '../../prixPlat';
import { BandeauCommande, FeuilleCommande } from '../../components/EcranCommande';
import '../../ecran-liste.css';

// `pourboireSeul` : l'avis est déjà envoyé, il ne reste que le pourboire. Sans ce mode, un client qui
// abandonnait le paiement du pourboire (ou dont l'envoi échouait après l'avis) ne pouvait plus jamais le
// laisser : le formulaire ne se rouvre pas sur une commande notée, et le renvoyer butait sur « avis déjà
// envoyé » avant d'atteindre le pourboire.
function ReviewForm({ order, token, toast, onDone, t, pourboireSeul = false }) {
  const [foodRating, setFoodRating] = useState(5);
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
      const tip = tipInput.trim() ? +Number(tipInput).toFixed(2) : tipChoice;
      if (order.driverName && tip > 0) {
        await api(`/orders/${order.id}/tip`, { method: 'PATCH', token, body: { tip } });
        const pay = await api(`/payments/tip-checkout/${order.id}`, { method: 'POST', token });
        if (pay.simulated) {
          toast(t('review.toastThanksTip'));
          // Pourboire acquis : le bouton « Laisser un pourboire » ne doit pas rester affiché (plan de test SIM-9).
          onDone({ tipPaid: true });
        } else {
          await allerAuPaiement(pay.checkoutUrl, { retour: '/orders' });
        }
        return;
      }
      toast(t('review.toastThanks'), 'succes');
      onDone();
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
        <StarsInput value={foodRating} onChange={setFoodRating} />
        {/* 1 000 caractères : la même limite que le serveur (routes/reviews.js LONGUEUR_MAX_AVIS). */}
        <input maxLength={1000} value={foodComment} onChange={(e) => setFoodComment(e.target.value)} placeholder={t('review.foodCommentPlaceholder')} style={{ marginTop: 6 }} />
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
                onClick={() => { setTipChoice(amount); setTipInput(''); }}
                style={{ padding: '6px 12px', fontSize: 13 }}
              >
                {amount === 0 ? t('review.tipNone') : `${amount}€`}
              </button>
            ))}
            <input aria-label={t('review.tipOtherPlaceholder')}
              type="number"
              min="0.5"
              step="0.5"
              placeholder={t('review.tipOtherPlaceholder')}
              value={tipInput}
              onChange={(e) => setTipInput(e.target.value)}
              style={{ width: 110, padding: '6px 10px', fontSize: 13 }}
            />
          </div>
        </div>
      )}
      <button className="btn-teal" disabled={saving} onClick={submit}>{saving ? '...' : t('review.send')}</button>
    </div>
  );
}

export default function Orders() {
  const [orders, setOrders] = useState([]);
  const [searchParams] = useSearchParams();
  const [loading, setLoading] = useState(true);
  const [reviewingId, setReviewingId] = useState(null);
  const [cancellingId, setCancellingId] = useState(null);
  // Annuler une commande passe par une confirmation (audit du 15/10/2026) : un toucher l'annulait aussitôt.
  const [aAnnuler, setAAnnuler] = useState(null);
  const { token, role } = useAuth();
  const toast = useToast();
  const { previewMode } = usePreviewMode();
  const { t } = useLanguage();
  // Le code à donner au livreur ou à montrer au commerce : sous la progression dans l'app, plus bas sur le site.
  const codeDeRemise = (o) => (o.paid && o.deliveryCode && o.status !== 'livre' && o.status !== 'refuse' ? (
    <div className="suivi-code">
      <div className="suivi-code-lib">
        {o.orderType === 'pickup' && t('orders.codeShowRestaurant')}
        {o.orderType === 'delivery' && t('orders.codeGiveDriver')}
      </div>
      <div className="suivi-code-valeur">{o.deliveryCode}</div>
    </div>
  ) : null);
  const cart = useCart();
  const navigate = useNavigate();
  // Signalements déjà envoyés, par commande (plan de test USR-10) — affichés à la place du bouton.
  const [signalements, setSignalements] = useState({});
  // « Commander à nouveau » qui viderait le panier d'un autre commerce : demandé d'abord (plan de test USR-9).
  const [aRecommander, setARecommander] = useState(null);
  // Site : les commandes passées dont le détail est ouvert sous leur ligne du tableau.
  const [ouvertes, setOuvertes] = useState(() => new Set());
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
    api('/orders/mine', { token }).then(setOrders).catch((e) => { if (!isPreviewingRestaurant) toast(e.message, 'erreur'); }).finally(() => setLoading(false));
    const interval = setInterval(() => {
      api('/orders/mine', { token }).then(setOrders).catch(() => {});
    }, 15000);
    return () => clearInterval(interval);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);
  // Retour sur l'onglet après une absence : relecture immédiate des commandes.
  useRevalidation(() => api('/orders/mine', { token }).then(setOrders), { actif: !(previewMode && role === 'restaurant') });

  // Le client peut annuler tant que le restaurant n'a pas accepté la commande (statut « nouveau »), payée
  // ou non : le paiement est alors remboursé. Dès la préparation, plus d'annulation en ligne.
  async function cancelOrder(orderId) {
    setCancellingId(orderId);
    try {
      const updated = await api(`/orders/${orderId}/cancel`, { method: 'PATCH', token });
      setOrders((prev) => prev.map((x) => (x.id === orderId ? updated : x)));
      toast(t('orders.toastCancelled'), 'succes');
    } catch (e) {
      toast(e.message, 'erreur');
    } finally {
      setCancellingId(null);
    }
  }

  // Commande en ligne créée mais jamais payée : le commerce ne la voit pas (il ne reçoit que les commandes payées).
  const impayeeEnLigne = (o) => o.status === 'nouveau' && !o.paid && o.paymentMode !== 'on_site';
  const [payingId, setPayingId] = useState(null);
  // Même chemin que « Commander et payer » au checkout : une nouvelle session Stripe pour CETTE commande.
  async function payerMaintenant(o) {
    setPayingId(o.id);
    try {
      const pay = await api(`/payments/checkout/${o.id}`, { method: 'POST', token });
      if (pay.simulated) {
        cart.discardStashed();
        setOrders(await api('/orders/mine', { token }));
        toast(t('checkout.toastOrderPaid'), 'succes');
        setPayingId(null);
      } else {
        await allerAuPaiement(pay.checkoutUrl, { retour: '/orders' });
      }
    } catch (e) {
      toast(e.message, 'erreur');
      setPayingId(null);
    }
  }
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

  if (loading) return <div><h1 className="page-title">{titre}</h1><SkeletonCards count={3} /></div>;
  /* AUCUNE COMMANDE (fondateur, 2026-10-17, « My orders » de mockups/commerces-marque.html) : le même bandeau que Mes favoris,
     le calendrier d'ouverture posé dessus en note translucide, le vélo qui attend dans la feuille blanche. */
  if (listeAffichee.length === 0) {
    return (
      <div className="ecran-bandeau commandes-vide">
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

  /* LES MORCEAUX D'UNE COMMANDE. Ils étaient écrits d'un seul tenant dans la carte ; la carte de l'app les remet dans le même
   * ordre qu'avant (rien n'y change), le site les range autrement (2026-10-16, mockups/site-ordinateur.html, section 6). */
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
  const blocDetails = (o) => (
    <>
      {o.orderType === 'pickup' && !estPassee(o) && (
        <div className="small suivi-lieu">{t('orders.pickupAt', { name: o.restaurantName, address: o.restaurantAddress ? `, ${o.restaurantAddress}` : '' })}</div>
      )}
      {o.orderType === 'delivery' && !estPassee(o) && (
        <div className="small suivi-lieu"><Icone nom="position" taille={14} /> {o.address}</div>
      )}
      {/* Motif donné par le commerce quand il refuse la commande (obligatoire depuis le 2026-10-02). */}
      {o.status === 'refuse' && o.refusalReason && (
        <div className="small">{t('orders.refusalReason', { reason: o.refusalReason })}</div>
      )}
      {o.deliveryInstructions && (
        <div className="small">{deliveryInstructionLabel(o.deliveryInstructions, t)}{o.deliveryNote ? ` · ${o.deliveryNote}` : ''}</div>
      )}
      <LivreurALaPorte order={o} />
      {o.driverName && (
        <div style={{ margin: '6px 0' }}><DriverBadge name={o.driverName} phone={o.driverPhone} photoUrl={o.driverPhotoUrl} size={40} /></div>
      )}
      <VendeurLivraison order={o} token={token} onUpdated={(maj) => setOrders((prev) => prev.map((x) => (x.id === maj.id ? maj : x)))} />
      <SansLivreur order={o} token={token} toast={toast} onUpdated={(maj) => setOrders((prev) => prev.map((x) => (x.id === maj.id ? maj : x)))} />
      {o.deliveryIncident && <p className="small" style={{ marginTop: 8 }}>{t(`orders.noCourier_incident_${o.deliveryIncident}`)}</p>}
    </>
  );
  // La carte du trajet, pendant la livraison seulement. Plus haute sur le site, où elle tient sa propre colonne.
  const blocCarte = (o) => (o.status === 'livraison' && o.restaurantLat && o.deliveryLat ? (
    <div style={{ margin: '10px 0' }}>
      <DeliveryTrackingMap
        restaurantLat={o.restaurantLat} restaurantLng={o.restaurantLng}
        deliveryLat={o.deliveryLat} deliveryLng={o.deliveryLng}
        driverLat={o.driverLat} driverLng={o.driverLng}
        lastUpdatedAt={o.driverLocationUpdatedAt}
        {...(APPLI ? {} : { height: 320 })}
      />
      <div className="small" style={{ marginTop: 4, textAlign: 'center' }}>
        {o.driverLat ? t('orders.driverLiveLocation') : t('orders.driverWaitingLocation')}
      </div>
    </div>
  ) : null);
  // Pourboire payé avec la commande : débité en plus du total (backend pourboireCommande.js).
  const debite = (o) => o.total + (o.tipPaid && o.tipAtCheckout > 0 ? o.tipAtCheckout : 0);
  // `avecMontant` : le tableau des commandes passées du site a déjà sa colonne Total.
  const blocTotal = (o, avecMontant = true) => (
    <>
      {avecMontant && (
        <div className="suivi-total">
          <span className="small">{o.paymentMode === 'on_site' ? (o.pickupNoShow ? t('orders.noShow') : t('orders.payOnSite')) : o.paid ? t('orders.paid') : t('orders.paymentPending')}</span>
          <b>{euros(debite(o))}</b>
        </div>
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
  );
  // `avecRecommander` : sur le site, « Commander à nouveau » est déjà sur la ligne du tableau.
  const blocActions = (o, avecRecommander = true) => (
    <>
      {/* PAIEMENT NON TERMINÉ (audit du 15/10/2026). Revenu de Stripe sans payer (bouton Retour, navigateur de l'appli
          fermé), le client trouvait ici « le commerce doit encore confirmer » et un seul bouton Annuler, et son panier
          avait disparu. Deux choix, faits par lui et non devinés : payer cette commande-ci, ou l'annuler et retrouver son
          panier. Rien n'est annulé tout seul : Stripe peut confirmer un paiement quelques secondes après la fermeture. */}
      {impayeeEnLigne(o) && (
        <div className="paiement-non-termine">
          <p className="small" style={{ margin: '0 0 10px' }}>{t('orders.unpaidText')}</p>
          <div className="row" style={{ gap: 8, flexWrap: 'wrap' }}>
            <button type="button" className="btn-gold" disabled={payingId === o.id || cancellingId === o.id} onClick={() => payerMaintenant(o)}>
              {payingId === o.id ? '…' : t('orders.payNow')}
            </button>
            <button type="button" className="btn-outline" disabled={payingId === o.id || cancellingId === o.id} onClick={() => revenirAuPanier(o)}>
              {cancellingId === o.id ? '…' : t('orders.backToCart')}
            </button>
          </div>
        </div>
      )}
      {o.status === 'nouveau' && !impayeeEnLigne(o) && (
        <>
          <button
            className="btn-ghost"
            style={{ marginTop: 8, color: 'var(--red)' }}
            disabled={cancellingId === o.id}
            onClick={() => setAAnnuler(o)}
          >
            {cancellingId === o.id ? '...' : t('orders.cancelOrder')}
          </button>
          <div className="small" style={{ marginTop: 4 }}>{t(o.paymentMode === 'on_site' ? 'orders.cancelHintOnSite' : 'orders.cancelHint')}</div>
        </>
      )}
      {['preparation', 'pret', 'livraison'].includes(o.status) && (
        <div className="small" style={{ marginTop: 6 }}>{t('orders.cancelLocked')}</div>
      )}

      {o.status === 'livre' && !o.reviewed && reviewingId !== o.id && (
        <button className="btn-ghost" style={{ marginTop: 8 }} onClick={() => setReviewingId(o.id)}>{t('orders.leaveReview')}</button>
      )}
      {o.status === 'livre' && o.reviewed && (
        <div className="small" style={{ marginTop: 8, color: 'var(--teal-deep)' }}>{t('orders.reviewSent')}</div>
      )}
      {o.status === 'livre' && o.reviewed && o.driverName && !o.tipPaid && reviewingId !== o.id && (
        <button className="btn-ghost" style={{ marginTop: 8 }} onClick={() => setReviewingId(o.id)}>{t('orders.leaveTip')}</button>
      )}
      {reviewingId === o.id && (() => {
        const formulaire = (
          <ReviewForm
            order={o} token={token} toast={toast} t={t} pourboireSeul={!!o.reviewed}
            onDone={(maj = {}) => { setReviewingId(null); setOrders((prev) => prev.map((x) => (x.id === o.id ? { ...x, reviewed: true, ...maj } : x))); }}
          />
        );
        return APPLI ? <SousEcran titre={o.reviewed ? t('orders.leaveTip') : t('orders.leaveReview')} onFermer={() => setReviewingId(null)}>{formulaire}</SousEcran> : formulaire;
      })()}
      {/* Signaler un problème (USR-10) : commande payée et terminée ; « jamais reçue » aussi pendant la livraison. */}
      {o.paid && ['livre', 'livraison'].includes(o.status) && (
        <SignalerProbleme order={o} token={token} toast={toast} signalement={signalements[o.id]}
          onSignale={(s) => setSignalements((prev) => ({ ...prev, [o.id]: s }))} />
      )}
      {/* Commander à nouveau (USR-9) : une commande close, refaite avec la carte d'aujourd'hui. */}
      {avecRecommander && ['livre', 'annule', 'refuse'].includes(o.status) && (o.items || []).length > 0 && (
        <button type="button" className="btn-outline" style={{ marginTop: 8, marginLeft: 8 }} onClick={() => recommander(o)}>{t('orders.reorder')}</button>
      )}
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
      <RouteSuivi status={o.status} orderType={o.orderType} />
    </div>
  );

  // L'APPLICATION : la page d'avant, telle quelle — chaque commande dans sa carte, les morceaux dans leur ordre d'origine.
  if (APPLI) {
    return (
      <div>
        <h1 className="page-title">{titre}</h1>
        {notifications}
        {enCours.length > 0 && passees.length > 0 && <h2 className="suivi-section">{t('orders.sectionCurrent')}</h2>}
        {[...enCours, ...passees].map((o, rang) => (
          <Fragment key={o.id}>
          {rang === enCours.length && passees.length > 0 && <h2 className="suivi-section">{t('orders.sectionPast')}</h2>}
          <div className={`card suivi-carte${estPassee(o) ? ' est-passee' : ' suivi-carte--bandeau'}`}>
            {estPassee(o) ? (
              <div className="suivi-tete">
                <span className="suivi-tete-texte">
                  <b className="suivi-resto">{o.restaurantName}</b>
                  <span className="suivi-sous">{orderTypeLabel(o, t)} · {quand(o.createdAt)}</span>
                </span>
                <span className={`status-badge status-${o.status}`}>{statusLabel(o.status, o.orderType, t, true)}</span>
              </div>
            ) : enteteSuivi(o)}
            {codeDeRemise(o)}
            {o.status !== 'livre' && <ProchaineEtape order={o} />}
            {blocArticles(o)}
            {blocDetails(o)}
            {blocCarte(o)}
            {blocTotal(o)}
            {blocActions(o)}
          </div>
          </Fragment>
        ))}
        {dialogues}
      </div>
    );
  }

  /* LE SITE (2026-10-16, « Proposition » de mockups/site-ordinateur.html, section 6). La commande en cours EST le bandeau
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
          <div className="sc-suivi-code">{codeDeRemise(o)}</div>
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
            <RouteSuivi status={vedette.status} orderType={vedette.orderType} />
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
                            <span className="sc-tuile" aria-hidden="true"><Icone nom={o.orderType === 'pickup' ? 'sac' : 'scooter'} taille={18} /></span>
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
