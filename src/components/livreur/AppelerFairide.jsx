import { useLanguage } from '../../context/LanguageContext';
import Icone from '../Icone';

// Le numéro de Fairide : le même que la page Contact (ContactSection.jsx) et que le serveur (fairideCompanyInfo.supportPhone,
// qui le renvoie avec l'alerte et passe avant celui-ci s'il change).
const TELEPHONE_FAIRIDE = '+32 474 20 07 13';

/* « Appeler Fairide », pour un livreur en difficulté (audit du 19/10, courier-13). L'écran promettait « Elle va t'appeler »
 * alors que rien ne garantit un rappel : il dit maintenant que l'équipe est prévenue et donne le numéro, en lien tel:. */
export default function AppelerFairide({ numero }) {
  const { t } = useLanguage();
  const n = numero || TELEPHONE_FAIRIDE;
  return (
    <a href={`tel:${n.replace(/\s+/g, '')}`} className="btn-outline"
      style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8, minHeight: 48, borderRadius: 'var(--radius-pill)', textDecoration: 'none', fontWeight: 700 }}>
      <Icone nom="telephone" taille={18} /> {t('dashDriver.callFairide', { phone: n })}
    </a>
  );
}
