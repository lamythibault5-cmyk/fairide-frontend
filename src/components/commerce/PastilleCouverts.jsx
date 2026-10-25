import { useLanguage } from '../../context/LanguageContext';
import Icone from '../Icone';

/* COUVERTS ET SERVIETTES, CÔTÉ COMMERCE (fondateur, 2026-10-25, maquettes/ferme-couverts ; backend migration 089).
 * Le client les demande au paiement, éteint par défaut. Demandés : pastille iris, la cuisine en ajoute. Pas demandés :
 * « Sans couverts » écrit en gris, pour qu'elle n'en mette pas par habitude (question 6 des réponses). Une commande d'avant
 * la colonne (utensils null) ne montre rien : on ne sait pas. Le ticket imprimé dit la même chose (ticketTerminal.js). */
export default function PastilleCouverts({ order }) {
  const { t } = useLanguage();
  if (order?.utensils !== true && order?.utensils !== false) return null;
  return (
    <span className={`pastille-couverts${order.utensils ? ' oui' : ''}`}>
      <Icone nom="restaurants" taille={14} />
      {t(order.utensils ? 'couverts.yes' : 'couverts.no')}
    </span>
  );
}
