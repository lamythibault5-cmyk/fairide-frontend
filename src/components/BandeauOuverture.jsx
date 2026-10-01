import { useLanguage, getLocale } from '../context/LanguageContext';
import { OUVERTURE_EMPORTER, OUVERTURE_LIVRAISON, dateOuvertureEmporter, dateOuvertureLivraison } from '../launch';
import Icone from './Icone';

// LE CALENDRIER D'OUVERTURE, dit pareil à tout le monde (fondateur, 2026-10-01) : à emporter le 1er novembre,
// livraison le 10 novembre. Avant, le tableau de bord d'un restaurateur ne montrait qu'« Ouverture 5 octobre » —
// la date d'activation des paiements Stripe —, qu'on lisait comme l'ouverture des commandes. Ce bandeau donne
// les deux vraies dates selon le rôle, puis disparaît de lui-même une fois tout ouvert. Les dates viennent de
// launch.js, miroir des verrous serveur : une seule source à changer.
//   role : 'restaurant' | 'driver' | 'client' | 'admin'
export default function BandeauOuverture({ role = 'client', style }) {
  const { t } = useLanguage();
  const maintenant = Date.now();
  const emporterOuvert = maintenant >= OUVERTURE_EMPORTER.getTime();
  const livraisonOuverte = maintenant >= OUVERTURE_LIVRAISON.getTime();
  if (livraisonOuverte) return null;
  const locale = getLocale();
  const dates = { pickup: dateOuvertureEmporter(locale), delivery: dateOuvertureLivraison(locale) };
  const cle = role === 'driver' ? 'driver' : emporterOuvert ? `${role}PickupOpen` : role;
  return (
    <div className="bandeau-ouverture" role="status" style={style}>
      <span className="bandeau-ouverture-icone" aria-hidden="true"><Icone nom="horloge" taille={18} /></span>
      <span>
        <b>{t('ouverture.title')}</b>{' '}
        {t(`ouverture.${cle}`, dates)}
      </span>
    </div>
  );
}
