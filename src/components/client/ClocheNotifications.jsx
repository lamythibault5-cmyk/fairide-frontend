import { useState } from 'react';
import { useLanguage, getLocale } from '../../context/LanguageContext';
import useNotificationsClient from '../../hooks/useNotificationsClient';
import Icone from '../Icone';

// La bonne phrase pour une commande payée au comptoir ou retirée (audit du 19/10, LIVE-10) : la cloche disait « payée et
// envoyée », « tu es remboursé » ou « livrée » pour une commande à emporter payée sur place. Le serveur joint le mode de
// paiement et le type de la commande (GET /me/notifications) ; sans eux (ancienne réponse), la phrase d'avant.
function varianteCloche(n) {
  if (n.paymentMode === 'on_site' && ['order_paid', 'status_refuse'].includes(n.kind)) return '_surPlace';
  if (n.orderType === 'pickup' && n.kind === 'status_livre') return '_emporter';
  return '';
}

// Cloche du client en tête de « Mes commandes » (plan de test NOT-9) : l'historique des événements de ses commandes
// (payée, acceptée, prête, livreur en route, livrée, annulée…), les non-lus comptés, marqués lus à l'ouverture.
export default function ClocheNotifications() {
  const { t } = useLanguage();
  const { unread, items, actif, marquerLues } = useNotificationsClient();
  const [ouverte, setOuverte] = useState(false);
  if (!actif) return null;

  function basculer() {
    const suivante = !ouverte;
    setOuverte(suivante);
    // Tout, pas seulement les 50 listées : le serveur compte toutes les non-lues (voir useNotificationsClient).
    if (suivante && unread > 0) marquerLues();
  }

  return (
    <div style={{ marginBottom: 12 }}>
      <button type="button" className="btn-outline" aria-expanded={ouverte} onClick={basculer} style={{ display: 'inline-flex', alignItems: 'center', gap: 6 }}>
        <Icone nom="cloche" taille={16} /> {t('orders.bellTitle')}
        {unread > 0 && <span className="nav-badge tone-warn" aria-label={t('orders.bellUnread', { n: unread })}>{unread}</span>}
      </button>
      {ouverte && (
        <ul className="card" style={{ listStyle: 'none', margin: '8px 0 0', padding: 12 }}>
          {items.length === 0 && <li className="small">{t('orders.bellEmpty')}</li>}
          {items.map((n) => (
            <li key={n.id} className="small" style={{ padding: '6px 0', borderBottom: '1px solid var(--line)', fontWeight: n.read ? 400 : 700 }}>
              {t(`orders.bell_${n.kind}${varianteCloche(n)}`, { name: n.restaurantName })}
              <span style={{ opacity: 0.7 }}> · {new Date(n.createdAt).toLocaleString(getLocale(), { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' })}</span>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
