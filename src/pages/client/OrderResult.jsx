import { useEffect, useRef, useState } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import { api } from '../../api';
import { suivre } from '../../analytics';
import { useAuth } from '../../context/AuthContext';
import { useCart } from '../../context/CartContext';
import { useLanguage } from '../../context/LanguageContext';
import Icone from '../../components/Icone';

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
    // Paiement abandonné : la commande restée impayée est annulée tout de suite. Le serveur retient le
    // solde Fairide et le bon cadeau DÈS la création de la commande ; sans cette annulation, ils restaient
    // bloqués jusqu'au ménage des commandes impayées (45 min, orderTimeouts.js côté serveur) — et le client,
    // qui retrouve son panier ici et repasse commande, ne voyait plus son solde.
    // Seulement si elle est bien IMPAYÉE : un client peut annuler une commande payée tant que le commerce ne
    // l'a pas acceptée (remboursement), et un retour arrière vers cette page ne doit pas le faire à sa place.
    if (orderId && token) {
      api('/orders/mine', { token })
        .then((orders) => {
          const o = orders.find((x) => String(x.id) === String(orderId));
          if (o && !o.paid && o.status === 'nouveau') return api(`/orders/${orderId}/cancel`, { method: 'PATCH', token });
          return null;
        })
        .catch(() => {});
    }
  }, [success, orderId, token]);

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
          // Statistiques (sans donnée personnelle) : la commande est finalisée, par mode.
          suivre('commande_finalisee', { mode: order.orderType === 'pickup' ? 'emporter' : order.orderType === 'dine_in' ? 'reservation' : 'livraison' });
          if (order.orderType === 'pickup') suivre('commande_emporter');
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

  // L'icône, et non plus un emoji de 40px. Un emoji est rendu par la police du système : le même
  // 🎉 est bombé et multicolore sur Windows, plat et gris sur macOS — et c'était ici l'élément
  // principal de la page, celui qui annonce au client si sa commande est passée ou non. Un tracé
  // posé dans un rond gris, c'est la forme que l'application donne déjà à ses écrans vides
  // (components/EtatVide.jsx), et celle des écrans de confirmation de l'application de référence.
  const view = {
    checking: { icone: 'horloge', title: t('orderResult.checkingTitle'), text: t('orderResult.checkingText') },
    paid: { icone: 'bouclier', title: t('orderResult.successTitle'), text: t('orderResult.successText') },
    pending: { icone: 'horloge', title: t('orderResult.pendingTitle'), text: t('orderResult.pendingText') },
    failed: {
      icone: 'interdit',
      // /order-cancelled est une annulation volontaire du client, pas un échec technique : on garde le
      // texte d'origine, moins alarmant, et on réserve failedText au paiement qui n'a pas abouti.
      title: success ? t('orderResult.failedTitle') : t('orderResult.cancelTitle'),
      text: success ? t('orderResult.failedText') : t('orderResult.cancelText')
    }
  }[state];

  return (
    <div className="center-page">
      <span className="etat-vide-icone" aria-hidden="true"><Icone nom={view.icone} taille={34} /></span>
      <h2 className="etat-vide-titre">{view.title}</h2>
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
