import { useLanguage, getLocale } from '../context/LanguageContext';
import { useAuth } from '../context/AuthContext';
import { OUVERTURE_EMPORTER, dateOuvertureEmporter, useLancement } from '../launch';
import Icone from './Icone';

// LE CALENDRIER D'OUVERTURE, dit pareil à tout le monde (fondateur, 2026-10-01) : à emporter le 1er novembre, puis la
// livraison et le paiement en ligne au bouton GO de l'équipe (fondateur, 2026-10-18 : plus de date promise, « bientôt »).
// Avant, le tableau de bord d'un restaurateur ne montrait qu'« Ouverture 5 octobre » — la date d'activation des paiements
// Stripe —, qu'on lisait comme l'ouverture des commandes. Ce bandeau dit où on en est selon le rôle, puis disparaît de
// lui-même au GO (useLancement relit l'état du serveur).
//   role : 'restaurant' | 'driver' | 'client' | 'admin'
export default function BandeauOuverture({ role = 'client', style }) {
  const { t } = useLanguage();
  const { user } = useAuth();
  const { go } = useLancement();
  // En simulation (Admin › Simulation), tout est ouvert : annoncer une ouverture à venir contredirait ce qu'on teste.
  if (user?.simulation) return null;
  if (go) return null;
  const emporterOuvert = Date.now() >= OUVERTURE_EMPORTER.getTime();
  const cle = role === 'driver' ? 'driver' : emporterOuvert ? `${role}PickupOpen` : role;
  return (
    <div className="bandeau-ouverture" role="status" style={style}>
      <span className="bandeau-ouverture-icone" aria-hidden="true"><Icone nom="horloge" taille={18} /></span>
      <span>
        <b>{t('ouverture.title')}</b>{' '}
        {t(`ouverture.${cle}`, { pickup: dateOuvertureEmporter(getLocale()) })}
      </span>
    </div>
  );
}
