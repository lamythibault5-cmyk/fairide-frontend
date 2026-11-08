import { useLanguage } from '../../context/LanguageContext';
import Icone from '../Icone';

// Le numéro de Fairide : le même que la page Contact (ContactSection.jsx) et que le serveur (fairideCompanyInfo.supportPhone,
// qui le renvoie avec l'alerte et passe avant celui-ci s'il change). C'est aussi le numéro WhatsApp de l'équipe (le serveur le
// dit « joignable par message et par WhatsApp », e-mail de bienvenue).
// Exporté pour le commerce (JoindreFairride.jsx, 2026-11-08) : un seul endroit où le numéro est écrit côté front.
export const TELEPHONE_FAIRIDE = '+32 474 20 07 13';

/* « Appeler Fairide », pour un livreur en difficulté (audit du 19/10, courier-13). L'écran promettait « Elle va t'appeler »
 * alors que rien ne garantit un rappel : il dit maintenant que l'équipe est prévenue et donne le numéro, en lien tel:.
 * « ÉCRIRE SUR WHATSAPP » À CÔTÉ (Owen, 2026-11-08) : au bord de la route, un message se lit quand l'équipe est déjà au
 * téléphone avec quelqu'un d'autre. Le numéro de la commande est déjà écrit (`commande`), pour que l'équipe la retrouve. */
export default function AppelerFairide({ numero, commande = null }) {
  const { t } = useLanguage();
  const n = numero || TELEPHONE_FAIRIDE;
  const chiffres = n.replace(/[^\d]/g, '');
  const ref = commande != null && commande !== '' ? `#${String(commande).padStart(3, '0')}` : null;
  const message = ref ? t('dashDriver.whatsappMessageCommande', { ref }) : t('dashDriver.whatsappMessage');
  const style = { display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8, minHeight: 48, borderRadius: 'var(--radius-pill)', textDecoration: 'none', fontWeight: 700 };
  return (
    <div style={{ display: 'grid', gap: 8 }}>
      <a href={`tel:${n.replace(/\s+/g, '')}`} className="btn-outline" style={style}>
        <Icone nom="telephone" taille={18} /> {t('dashDriver.callFairide', { phone: n })}
      </a>
      <a href={`https://wa.me/${chiffres}?text=${encodeURIComponent(message)}`} target="_blank" rel="noopener noreferrer" className="btn-outline" style={style}>
        <Icone nom="bulle" taille={18} /> {t('dashDriver.whatsappFairide')}
      </a>
    </div>
  );
}
