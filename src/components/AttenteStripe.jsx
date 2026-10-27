import { useLanguage } from '../context/LanguageContext';
import { useAttenteStripe } from '../ouvrirStripe';
import { EcranAttente } from './Skeleton';

// L'écran d'attente pendant l'ouverture de Stripe (ouvrirStripe.js), monté une seule fois dans App.jsx.
export default function AttenteStripe() {
  const { t } = useLanguage();
  const visible = useAttenteStripe();
  return visible ? <EcranAttente titre={t('attenteStripe.titre')} /> : null;
}
