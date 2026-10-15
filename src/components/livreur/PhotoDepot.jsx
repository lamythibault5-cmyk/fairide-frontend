import { useRef, useState } from 'react';
import { apiUpload } from '../../api';
import Icone from '../Icone';
import { useLanguage } from '../../context/LanguageContext';

/* DÉPOSÉE DEVANT LA PORTE : LA PHOTO REMPLACE LE CODE (comparaison avec Uber Eats, 15 oct. 2026 ; backend
 * POST /orders/:id/deliver-photo, migration 040).
 *
 * Le client qui choisit « Déposer devant la porte » n'est pas là pour donner son code : le livreur restait bloqué devant
 * la porte. Pour cette consigne seulement — jamais avec de l'alcool, que le serveur refuse aussi —, il photographie le sac
 * déposé et la course se termine. Le champ du code reste au-dessus : si le client ouvre quand même, le code marche.
 * L'appareil photo s'ouvre directement (capture), la photo part au serveur et nulle part ailleurs : le livreur ne la garde
 * pas, le client la voit dans Mes commandes, elle est effacée après 30 jours. */
export default function PhotoDepot({ order, token, toast, onLivree }) {
  const { t } = useLanguage();
  const entree = useRef(null);
  const [envoi, setEnvoi] = useState(false);
  if (order.deliveryInstructions !== 'deposer' || order.containsAlcohol) return null;

  async function envoyer(e) {
    const fichier = e.target.files?.[0];
    e.target.value = '';
    if (!fichier) return;
    setEnvoi(true);
    try {
      await apiUpload(`/orders/${order.id}/deliver-photo`, { file: fichier, token, fieldName: 'photo' });
      toast(t('dashDriver.toastDelivered'));
      onLivree();
    } catch (err) {
      toast(err.message, 'erreur');
    } finally {
      setEnvoi(false);
    }
  }

  return (
    <div className="paiement-encart" style={{ marginTop: 8 }}>
      <p className="small" style={{ margin: '0 0 8px' }}>{t('dashDriver.doorDropHint')}</p>
      <input ref={entree} type="file" accept="image/*" capture="environment" style={{ display: 'none' }} onChange={envoyer} />
      <button type="button" className="btn-outline" style={{ minHeight: 44 }} disabled={envoi} onClick={() => entree.current?.click()}>
        <Icone nom="porte" taille={16} className="icone-texte" /> {envoi ? '…' : t('dashDriver.doorDropButton')}
      </button>
    </div>
  );
}
