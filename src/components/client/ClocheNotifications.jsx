import { useState } from 'react';
import { useLanguage, getLocale } from '../../context/LanguageContext';
import useNotificationsClient from '../../hooks/useNotificationsClient';
import Icone from '../Icone';

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
    if (suivante && unread > 0) marquerLues(items.filter((n) => !n.read).map((n) => n.id));
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
              {t(`orders.bell_${n.kind}`, { name: n.restaurantName })}
              <span style={{ opacity: 0.7 }}> · {new Date(n.createdAt).toLocaleString(getLocale(), { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' })}</span>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
