import { useLanguage } from '../context/LanguageContext';
import { useAuth } from '../context/AuthContext';
import { useLancement } from '../launch';
import Icone from './Icone';

// LE CALENDRIER D'OUVERTURE, dit pareil à tout le monde (fondateur, 2026-10-01), sans aucune date : l'à emporter payé sur
// place au bouton « Ouvrir l'à emporter » (fondateur, 2026-10-31), puis la livraison et le paiement en ligne au bouton GO
// (fondateur, 2026-10-18), « bientôt » tant qu'on n'a pas appuyé.
// Avant, le tableau de bord d'un restaurateur ne montrait qu'« Ouverture 5 octobre » — la date d'activation des paiements
// Stripe —, qu'on lisait comme l'ouverture des commandes. Ce bandeau dit où on en est selon le rôle, puis disparaît de
// lui-même au GO (useLancement relit l'état du serveur).
//   role : 'restaurant' | 'driver' | 'client' | 'admin'
export default function BandeauOuverture({ role = 'client', style }) {
  const { t } = useLanguage();
  const { user } = useAuth();
  const { go, emporter } = useLancement();
  // En simulation (Admin › Simulation), tout est ouvert : annoncer une ouverture à venir contredirait ce qu'on teste.
  if (user?.simulation) return null;
  if (go) return null;
  const cle = role === 'driver' ? 'driver' : emporter ? `${role}PickupOpen` : role;
  return (
    <div className="bandeau-ouverture" role="status" style={style}>
      <span className="bandeau-ouverture-icone" aria-hidden="true"><Icone nom="horloge" taille={18} /></span>
      <span>
        <b>{t('ouverture.title')}</b>{' '}
        {t(`ouverture.${cle}`)}
      </span>
    </div>
  );
}
