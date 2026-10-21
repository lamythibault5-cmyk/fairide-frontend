import { useEffect, useState } from 'react';
import { useLanguage, getLocale } from '../../context/LanguageContext';

// LE TEMPS QUI RESTE POUR ACCEPTER, EN ANNEAU (2026-10-16, mockups/tous-les-ecrans.html › Commandes) : il se vide de
// l'arrivée de la commande jusqu'à son échéance (acceptDeadline, la même que EcheanceAcceptation), rouge sous 5 minutes.
// Partagé par les cartes de Commandes (OrdersPage) et la feuille « Nouvelle commande » (NouvelleCommandeModale) depuis
// l'audit design 2 (2026-10-19) : sur une commande qui attend, c'est lui qui dit le délai — plus de phrase d'échéance.
export default function AnneauDelai({ order }) {
  const { t } = useLanguage();
  const [maintenant, setMaintenant] = useState(() => Date.now());
  useEffect(() => {
    const id = setInterval(() => setMaintenant(Date.now()), 10000);
    return () => clearInterval(id);
  }, []);
  if (!order?.acceptDeadline) return null;
  const fin = new Date(order.acceptDeadline).getTime();
  // Depuis le paiement, comme le délai du serveur (acceptation.js) : un client resté 10 min sur la page de paiement
  // donnait un anneau déjà entamé (audit du 19/10, shop-227). La création reste le repli des anciennes commandes.
  const debut = new Date(order.paidAt || order.createdAt).getTime();
  const reste = Math.max(0, fin - maintenant);
  const total = Math.max(60000, Number.isFinite(debut) ? fin - debut : 15 * 60000);
  const min = Math.ceil(reste / 60000);
  /* COMMANDE PROGRAMMÉE (audit du 19/10, shop-221) : l'échéance tombe 30 min avant l'heure prévue, parfois des jours plus
     tard, et l'anneau affichait « 2850 min ». Au-delà d'une heure, il dit le jour et l'heure limite, sans compte à rebours. */
  if (min > 60) {
    const d = new Date(fin);
    const auj = d.toDateString() === new Date(maintenant).toDateString();
    const quand = auj
      ? d.toLocaleTimeString(getLocale(), { hour: '2-digit', minute: '2-digit' })
      : d.toLocaleString(getLocale(), { weekday: 'short', hour: '2-digit', minute: '2-digit' });
    return <span className="ec-anneau-date">{t('ecranCommerce.aAccepterAvant', { time: quand })}</span>;
  }
  return (
    <span className={`ec-anneau${min <= 5 ? ' ec-anneau--presse' : ''}`} style={{ '--ec-p': Math.min(1, reste / total) }}
      role="img" aria-label={t('ecranCommerce.resteAccepter', { n: min })}>
      <b>{min}</b><small>{t('ecranCommerce.min')}</small>
    </span>
  );
}
