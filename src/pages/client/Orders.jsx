import { Fragment, useEffect, useState } from 'react';
import useRevalidation from '../../useRevalidation';
import EtatVide from '../../components/EtatVide';
import { useSearchParams } from 'react-router-dom';
import { api } from '../../api';
import { useAuth } from '../../context/AuthContext';
import { useToast } from '../../context/ToastContext';
import { usePreviewMode } from '../../context/PreviewModeContext';
import { useLanguage } from '../../context/LanguageContext';
import { DeliveryTiming, ProchaineEtape, ProgressBar, deliveryInstructionLabel, statusLabel, orderTypeColor, orderTypeLabel } from '../../orderStatus';
import { SkeletonCards } from '../../components/Skeleton';
import { StarsInput } from '../../components/Stars';
import DriverBadge from '../../components/DriverBadge';
import DeliveryTrackingMap from '../../components/DeliveryTrackingMap';
import Icone from '../../components/Icone';
import VendeurLivraison from '../../components/conformite/VendeurLivraison';

// `pourboireSeul` : l'avis est déjà envoyé, il ne reste que le pourboire. Sans ce mode, un client qui
// abandonnait le paiement du pourboire (ou dont l'envoi échouait après l'avis) ne pouvait plus jamais le
// laisser : le formulaire ne se rouvre pas sur une commande notée, et le renvoyer butait sur « avis déjà
// envoyé » avant d'atteindre le pourboire.
function ReviewForm({ order, token, toast, onDone, t, pourboireSeul = false }) {
  const [foodRating, setFoodRating] = useState(5);
  const [foodComment, setFoodComment] = useState('');
  const [deliveryRating, setDeliveryRating] = useState(order.driverName ? 5 : 0);
  const [deliveryComment, setDeliveryComment] = useState('');
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
              foodRating, foodComment: foodComment.trim(),
              deliveryRating: order.driverName ? deliveryRating : undefined,
              deliveryComment: order.driverName ? deliveryComment.trim() : undefined
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
          onDone();
        } else {
          window.location.href = pay.checkoutUrl;
        }
        return;
      }
      toast(t('review.toastThanks'));
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
        <input value={foodComment} onChange={(e) => setFoodComment(e.target.value)} placeholder={t('review.foodCommentPlaceholder')} style={{ marginTop: 6 }} />
      </div>}
      {order.driverName && !pourboireSeul && (
        <div style={{ marginBottom: 10 }}>
          <div className="small" style={{ marginBottom: 4 }}>{t('review.deliveryRatingLabel')}</div>
          <StarsInput value={deliveryRating} onChange={setDeliveryRating} />
          <input value={deliveryComment} onChange={(e) => setDeliveryComment(e.target.value)} placeholder={t('review.deliveryCommentPlaceholder')} style={{ marginTop: 6 }} />
        </div>
      )}
      {order.driverName && (
        <div style={{ marginBottom: 12 }}>
          <div className="small" style={{ marginBottom: 4, fontWeight: 600 }}>{t('review.tipPrompt', { name: order.driverName })}</div>
          <div className="row" style={{ gap: 6, flexWrap: 'wrap' }}>
            {[0, 1, 2, 3].map((amount) => (
              <button
                key={amount}
                type="button"
                className={tipChoice === amount && !tipInput.trim() ? 'btn-gold' : 'btn-ghost'}
                onClick={() => { setTipChoice(amount); setTipInput(''); }}
                style={{ padding: '6px 12px', fontSize: 13 }}
              >
                {amount === 0 ? t('review.tipNone') : `${amount}€`}
              </button>
            ))}
            <input aria-label={t('review.tipOtherPlaceholder')}
              type="number"
              min="0"
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
  const { token, role } = useAuth();
  const toast = useToast();
  const { previewMode } = usePreviewMode();
  const { t } = useLanguage();

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
      toast(t('orders.toastCancelled'));
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

  if (loading) return <div><h1 className="page-title">{titre}</h1><SkeletonCards count={3} /></div>;
  if (listeAffichee.length === 0) {
    return (
      <div>
        <h1 className="page-title">{titre}</h1>
        {/* Le vide occupe toute la page ici : une ligne grise dans un cadre en pointillés y
            ressemblait à une panne. On nomme ce qui manque, et on donne le seul geste qui le
            remplit — parcourir les commerces. */}
        <EtatVide
          icone="sac"
          titre={t('orders.empty')}
          texte={t('orders.emptyHint')}
          actionVers="/restaurants"
          actionTexte={t('orders.emptyAction')}
        />
      </div>
    );
  }

  return (
    <div>
      <h1 className="page-title">{titre}</h1>
      {listeAffichee.map((o) => (
        <Fragment key={o.id}>
        <div className={`card order-type-${orderTypeColor(o)}`}>
          <div className="commande-entete">
            <b>{o.restaurantName}</b>
            <span className={`status-badge status-${o.status}`}>{statusLabel(o.status, o.orderType, t, true)}</span>
          </div>
          <div className={`order-type-badge order-type-badge-${orderTypeColor(o)}`}>{orderTypeLabel(o, t)}</div>
          <ProgressBar status={o.status} orderType={o.orderType} />
          <DeliveryTiming order={o} />
          <ProchaineEtape order={o} />
          {/* UN ARTICLE PAR LIGNE, avec sa quantité dans une case.
              Les articles étaient aplatis en une seule chaîne par .join(', ') : « 2× Maxi Frites
              (Sauce andalouse), 1× L'Ardenne Menu (L'Ardenne, Maxi Frites, Coca Cola 33cl) ». Sur
              une commande de trois plats à options, cela donnait un paragraphe gris de cinq lignes
              où il fallait chercher les virgules pour savoir ce qu'on avait commandé. La capture
              « Past Orders » met une ligne par article, la quantité dans une case à gauche, et les
              options en gris dessous. C'est la même information, lisible d'un coup d'oeil. */}
          {o.items.length > 0 && (
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
          {o.orderType === 'pickup' && (
            <div className="small">{t('orders.pickupAt', { name: o.restaurantName, address: o.restaurantAddress ? `, ${o.restaurantAddress}` : '' })}</div>
          )}
          {o.orderType === 'delivery' && (
            <div className="small"><Icone nom="position" taille={14} /> {o.address}</div>
          )}
          {o.deliveryInstructions && (
            <div className="small">{deliveryInstructionLabel(o.deliveryInstructions, t)}{o.deliveryNote ? ` · ${o.deliveryNote}` : ''}</div>
          )}
          {o.driverName && (
            <div style={{ margin: '6px 0' }}><DriverBadge name={o.driverName} phone={o.driverPhone} photoUrl={o.driverPhotoUrl} size={40} /></div>
          )}
          <VendeurLivraison order={o} token={token} onUpdated={(maj) => setOrders((prev) => prev.map((x) => (x.id === maj.id ? maj : x)))} />
          {o.status === 'livraison' && o.restaurantLat && o.deliveryLat && (
            <div style={{ margin: '10px 0' }}>
              <DeliveryTrackingMap
                restaurantLat={o.restaurantLat} restaurantLng={o.restaurantLng}
                deliveryLat={o.deliveryLat} deliveryLng={o.deliveryLng}
                driverLat={o.driverLat} driverLng={o.driverLng}
                lastUpdatedAt={o.driverLocationUpdatedAt}
              />
              <div className="small" style={{ marginTop: 4, textAlign: 'center' }}>
                {o.driverLat ? t('orders.driverLiveLocation') : t('orders.driverWaitingLocation')}
              </div>
            </div>
          )}
          {o.paid && o.deliveryCode && o.status !== 'livre' && o.status !== 'refuse' && (
            <div style={{ background: 'var(--cream-dim)', borderRadius: 10, padding: '10px 14px', textAlign: 'center', margin: '8px 0' }}>
              <div className="small" style={{ marginBottom: 2 }}>
                {o.orderType === 'pickup' && t('orders.codeShowRestaurant')}
                {o.orderType === 'delivery' && t('orders.codeGiveDriver')}
              </div>
              <div style={{ fontWeight: 700, fontSize: 26, letterSpacing: 6, color: 'var(--ink)' }}>{o.deliveryCode}</div>
            </div>
          )}
          <div className="row" style={{ justifyContent: 'space-between', marginTop: 8 }}>
            <span className="small">{o.paymentMode === 'on_site' ? (o.pickupNoShow ? t('orders.noShow') : t('orders.payOnSite')) : o.paid ? t('orders.paid') : t('orders.paymentPending')}</span>
            <b>{o.total.toFixed(2)}€</b>
          </div>
          {o.status === 'nouveau' && (
            <>
              <button
                className="btn-ghost"
                style={{ marginTop: 8, color: 'var(--red)' }}
                disabled={cancellingId === o.id}
                onClick={() => cancelOrder(o.id)}
              >
                {cancellingId === o.id ? '...' : t('orders.cancelOrder')}
              </button>
              <div className="small" style={{ marginTop: 4 }}>{t('orders.cancelHint')}</div>
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
          {reviewingId === o.id && (
            <ReviewForm
              order={o} token={token} toast={toast} t={t} pourboireSeul={!!o.reviewed}
              onDone={() => { setReviewingId(null); setOrders((prev) => prev.map((x) => (x.id === o.id ? { ...x, reviewed: true } : x))); }}
            />
          )}
        </div>
        </Fragment>
      ))}
    </div>
  );
}
