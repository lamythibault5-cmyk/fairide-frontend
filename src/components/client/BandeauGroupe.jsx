import { useState } from 'react';
import { Link } from 'react-router-dom';
import Icone from '../Icone';
import { useLanguage } from '../../context/LanguageContext';
import { groupeEnCours, quitterGroupe } from '../../commandeGroupee';
import '../../ecran-equipe-groupe.css';

/* « Tu choisis ta part de la commande groupée » — sur la carte du commerce et dans le panier, tant qu'un groupe est en
 * cours dans cet onglet (commandeGroupee.js). Sans lui, un invité finissait par payer sa part lui-même au lieu de
 * l'envoyer au groupe. `restaurantId` : seulement sur la carte du commerce du groupe. `onQuitter` : prévient la page
 * (la fiche du commerce remontre alors son bouton « Commande groupée »).
 * Le dessin (2026-10-16) : un encart à filet iris, compact, l'icône des personnes, puis « Envoyer au groupe » en pastille
 * iris et « Quitter le groupe » en texte — jamais de lime : le panier et la fiche ont déjà la leur. */
export default function BandeauGroupe({ restaurantId = null, onQuitter }) {
  const { t } = useLanguage();
  const [groupe, setGroupe] = useState(() => groupeEnCours());
  if (!groupe || (restaurantId && String(groupe.restaurantId) !== String(restaurantId))) return null;
  return (
    <div className="eg-note eg-bandeau" role="status">
      <Icone nom="personnes" taille={18} />
      <span className="eg-bandeau-texte">{t('groupOrder.bannerText', { name: groupe.hostFirstName || '' })}</span>
      <div className="eg-actions">
        <Link to={`/groupe/${groupe.code}`} className="eg-bouton-iris eg-bouton-plein">{t('groupOrder.bannerSend')}</Link>
        <button type="button" className="eg-discret" onClick={() => { quitterGroupe(); setGroupe(null); onQuitter?.(); }}>{t('groupOrder.bannerLeave')}</button>
      </div>
    </div>
  );
}
