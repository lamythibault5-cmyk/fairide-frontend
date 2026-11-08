import { useLanguage } from '../../context/LanguageContext';
import AppelerFairide, { TELEPHONE_FAIRIDE } from '../livreur/AppelerFairide';
import Icone from '../Icone';

/* JOINDRE FAIRRIDE DEPUIS LE COMMERCE (revue des frictions du commerce, 2026-11-08). « Appeler Fairride » n'existait que sur
 * les écrans du livreur (AppelerFairide.jsx) : un commerce face à une réclamation, une commande annulée faute de réponse ou
 * un livreur qui ne vient pas cherchait le numéro dans les mentions légales. Même numéro (fairideCompanyInfo.supportPhone
 * côté serveur, « joignable par message et par WhatsApp »), même composant pour l'appel, plus WhatsApp (wa.me veut le
 * numéro sans « + » ni espaces).
 *   - plein (défaut) : le groupe de Mon commerce, titre, une ligne, « Appeler » et « Écrire sur WhatsApp » ;
 *   - `compact` : deux liens discrets sous une carte qui a un problème (réclamation, commande annulée d'office, livreur
 *     attendu), sans voler la place du geste principal ni le lime. */
const chiffres = TELEPHONE_FAIRIDE.replace(/[^0-9]/g, '');

export default function JoindreFairride({ compact = false }) {
  const { t } = useLanguage();
  const whatsapp = `https://wa.me/${chiffres}`;
  if (compact) {
    return (
      <p className="small ec-joindre" onClick={(e) => e.stopPropagation()} style={{ margin: '8px 0 0', display: 'flex', flexWrap: 'wrap', alignItems: 'center', gap: '4px 14px' }}>
        <a href={`tel:+${chiffres}`} style={{ display: 'inline-flex', alignItems: 'center', gap: 6, minHeight: 44, fontWeight: 700 }}>
          <Icone nom="telephone" taille={16} className="icone-texte" />{t('ordersResto.helpCall')}
        </a>
        <a href={whatsapp} target="_blank" rel="noopener noreferrer" style={{ display: 'inline-flex', alignItems: 'center', minHeight: 44, fontWeight: 700 }}>
          {t('ordersResto.helpWhatsapp')}
        </a>
      </p>
    );
  }
  return (
    <>
      <p className="ec-feuille-titre">{t('ordersResto.helpTitle')}</p>
      <div className="card" style={{ display: 'grid', gap: 8 }}>
        <p className="small" style={{ margin: 0 }}>{t('ordersResto.helpSub')}</p>
        {/* AppelerFairide porte aussi « Écrire sur WhatsApp » depuis le 2026-11-08 (écrans du livreur) : pas de second lien. */}
        <AppelerFairide />
      </div>
    </>
  );
}
