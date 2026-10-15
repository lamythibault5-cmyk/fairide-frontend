import { useState } from 'react';
import { Link } from 'react-router-dom';
import { useLanguage } from '../../context/LanguageContext';
import { groupeEnCours, quitterGroupe } from '../../commandeGroupee';

/* « Tu choisis ta part de la commande groupée » — sur la carte du commerce et dans le panier, tant qu'un groupe est en
 * cours dans cet onglet (commandeGroupee.js). Sans lui, un invité finissait par payer sa part lui-même au lieu de
 * l'envoyer au groupe. `restaurantId` : seulement sur la carte du commerce du groupe. */
export default function BandeauGroupe({ restaurantId = null }) {
  const { t } = useLanguage();
  const [groupe, setGroupe] = useState(() => groupeEnCours());
  if (!groupe || (restaurantId && String(groupe.restaurantId) !== String(restaurantId))) return null;
  return (
    <div className="paiement-encart" role="status" style={{ margin: '0 0 12px' }}>
      <p className="small" style={{ margin: '0 0 8px' }}>{t('groupOrder.bannerText', { name: groupe.hostFirstName || '' })}</p>
      <div className="row" style={{ gap: 8, flexWrap: 'wrap' }}>
        <Link to={`/groupe/${groupe.code}`} className="btn-teal">{t('groupOrder.bannerSend')}</Link>
        <button type="button" className="btn-ghost" onClick={() => { quitterGroupe(); setGroupe(null); }}>{t('groupOrder.bannerLeave')}</button>
      </div>
    </div>
  );
}
