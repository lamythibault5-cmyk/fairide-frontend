import { useEffect, useState } from 'react';
import { useLanguage } from '../../context/LanguageContext';
import { ATTENTE_PORTE_MIN } from '../../conformite';

// « TON LIVREUR EST À TA PORTE » (simulation du 10 oct. 2026). Quand le livreur signale le client injoignable
// (PATCH /orders/:id/client-absent), le serveur pose client_absent_reported_at et envoie un e-mail — mais l'écran de
// suivi du client ne changeait pas d'un pixel : celui qui avait l'appli ouverte ne voyait rien. On affiche donc ici un
// bandeau iris plein, impossible à rater, avec le temps d'attente restant et le numéro du livreur.
// Iris et pas lime : l'écran des commandes garde son seul accent lime pour l'action décisive (règle n° 3 de styles.css).
export default function LivreurALaPorte({ order }) {
  const { t } = useLanguage();
  const [maintenant, setMaintenant] = useState(() => Date.now());
  const actif = order.status === 'livraison' && !!order.clientAbsentReportedAt;
  useEffect(() => {
    if (!actif) return undefined;
    const id = setInterval(() => setMaintenant(Date.now()), 15000);
    return () => clearInterval(id);
  }, [actif]);
  if (!actif) return null;
  const reste = Math.max(0, Math.ceil((order.clientAbsentReportedAt + ATTENTE_PORTE_MIN * 60000 - maintenant) / 60000));
  return (
    <div role="alert" style={{ background: 'var(--iris)', color: '#fff', borderRadius: 'var(--radius)', padding: '14px 16px', margin: '10px 0' }}>
      <div style={{ fontWeight: 700, fontSize: 17 }}>{t('orders.courierAtDoorTitle')}</div>
      <div style={{ fontSize: 14, marginTop: 4 }}>{reste > 0 ? t('orders.courierAtDoorText', { min: reste }) : t('orders.courierAtDoorLate')}</div>
      {order.driverPhone && (
        <a href={`tel:${order.driverPhone}`} className="btn-hero-ghost" style={{ display: 'inline-block', marginTop: 10, textDecoration: 'none' }}>
          {t('orders.courierAtDoorCall')}
        </a>
      )}
    </div>
  );
}
