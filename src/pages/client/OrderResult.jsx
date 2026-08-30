import { useEffect, useRef, useState } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import { api } from '../../api';
import { useAuth } from '../../context/AuthContext';
import { useCart } from '../../context/CartContext';
import { useLanguage } from '../../context/LanguageContext';

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

export default function OrderResult({ success }) {
  const [params] = useSearchParams();
  const orderId = params.get('order');
  const { token } = useAuth();
  const cart = useCart();
  const { t } = useLanguage();

  // 'checking' | 'paid' | 'pending' | 'failed'
  // Sans identifiant de commande dans l'URL, il n'y a rien à vérifier : on retombe sur l'annonce
  // portée par la route elle-même (/order-success vs /order-cancelled), comme avant.
  const [state, setState] = useState(() => {
    if (!orderId) return success ? 'paid' : 'failed';
    return success ? 'checking' : 'failed';
  });

  const cartRef = useRef(cart);
  cartRef.current = cart;

  // Arrivée sur /order-cancelled : le client a explicitement renoncé au paiement. On lui rend son
  // panier immédiatement, sans rien interroger — il n'y a rien à vérifier, l'issue est connue.
  useEffect(() => {
    if (success) return;
    cartRef.current.restoreStashed();
  }, [success]);

  useEffect(() => {
    if (!orderId || !success || !token) return;
    let polls = 0;
    let timer = null;
    let cancelled = false;

    async function check() {
      polls += 1;
      try {
        // /orders/mine plutôt qu'un GET /orders/:id : c'est l'endpoint dont on est certain qu'il
        // existe (déjà utilisé par Orders.jsx), et il est déjà filtré sur le client connecté — donc
        // impossible de consulter la commande de quelqu'un d'autre en changeant l'id dans l'URL.
        const orders = await api('/orders/mine', { token });
        if (cancelled) return;
        const order = orders.find((o) => o.id === orderId || String(o.id) === String(orderId));
        if (order?.paid) {
          setState('paid');
          // Paiement confirmé : la copie du panier mise de côté avant la redirection n'a plus lieu
          // d'être. (Le panier visible, lui, a déjà été vidé au départ — voir stashForPayment.)
          cartRef.current.discardStashed();
          return;
        }
        if (order && (order.status === 'annule' || order.status === 'refuse')) {
          setState('failed');
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

  const view = {
    checking: { emoji: '⏳', title: t('orderResult.checkingTitle'), text: t('orderResult.checkingText') },
    paid: { emoji: '🎉', title: t('orderResult.successTitle'), text: t('orderResult.successText') },
    pending: { emoji: '⏳', title: t('orderResult.pendingTitle'), text: t('orderResult.pendingText') },
    failed: {
      emoji: '😕',
      // /order-cancelled est une annulation volontaire du client, pas un échec technique : on garde le
      // texte d'origine, moins alarmant, et on réserve failedText au paiement qui n'a pas abouti.
      title: success ? t('orderResult.failedTitle') : t('orderResult.cancelTitle'),
      text: success ? t('orderResult.failedText') : t('orderResult.cancelText')
    }
  }[state];

  return (
    <div className="center-page">
      <div style={{ fontSize: 40 }}>{view.emoji}</div>
      <h2>{view.title}</h2>
      <p className="small">
        {view.text}
        {orderId && <><br />{t('orderResult.orderNumber', { id: String(orderId).slice(0, 8) })}</>}
      </p>
      {/* Pendant la vérification, aucun bouton : on ne veut pas qu'un client quitte la page à la
          seconde où le webhook est sur le point d'arriver. */}
      {state !== 'checking' && (
        <div className="row" style={{ gap: 10, justifyContent: 'center' }}>
          <Link to="/orders" className="btn-primary" style={{ textDecoration: 'none', display: 'inline-block' }}>
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
