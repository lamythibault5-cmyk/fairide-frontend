import { Link } from 'react-router-dom';
import { useLanguage } from '../context/LanguageContext';

// « Tickets et imprimante » dans Mon compte (restaurateur) : l'explication complète, au calme, hors du feu
// du service — comment les tickets sont imprimés, avec quoi, comment réimprimer, corriger ou créer un
// ticket, et quoi faire quand ça ne sort pas. La page Commandes garde les commandes, pas le mode d'emploi.
export default function TicketHelp() {
  const { t } = useLanguage();
  const bloc = (titre, lignes) => (
    <>
      <h4 className="paiement-titre">{titre}</h4>
      <ol className="paiement-etapes">{lignes.map((l, i) => <li key={i}>{l}</li>)}</ol>
    </>
  );
  return (
    <div className="ticket-help">
      <p className="small" style={{ margin: '0 0 8px' }}>{t('ticketHelp.intro')}</p>
      {bloc(t('ticketHelp.howTitle'), [t('ticketHelp.how1'), t('ticketHelp.how2'), t('ticketHelp.how3'), t('ticketHelp.how4')])}
      {bloc(t('ticketHelp.autoTitle'), [t('ticketHelp.auto1'), t('ticketHelp.auto2')])}
      {bloc(t('ticketHelp.editTitle'), [t('ticketHelp.edit1'), t('ticketHelp.edit2'), t('ticketHelp.edit3')])}
      {bloc(t('ticketHelp.deviceTitle'), [t('ticketHelp.device1'), t('ticketHelp.device2'), t('ticketHelp.device3')])}
      {bloc(t('ticketHelp.troubleTitle'), [t('ticketHelp.trouble1'), t('ticketHelp.trouble2'), t('ticketHelp.trouble3'), t('ticketHelp.trouble4')])}
      <div className="paiement-encart" style={{ marginTop: 8 }}>
        <b>{t('ticketHelp.contentTitle')}</b>
        <p className="small" style={{ margin: '4px 0 0' }}>{t('ticketHelp.contentText')}</p>
      </div>
      <p className="small" style={{ margin: '12px 0 0' }}><Link to="/dashboard/orders">{t('ticketHelp.goOrders')}</Link></p>
    </div>
  );
}
