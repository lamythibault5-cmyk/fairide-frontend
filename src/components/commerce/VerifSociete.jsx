import { useLanguage } from '../../context/LanguageContext';

// Une ligne sous le numéro d'entreprise, aux deux inscriptions (site et appli) : ce que le registre TVA européen
// (VIES) a répondu. Avant, le résultat était lu puis jeté : un numéro inconnu ne disait rien et un numéro trouvé
// remplissait la raison sociale sans dire quelle société avait été reconnue (audit du 19/10, shop-2). Rien ne bloque :
// « non trouvé » est normal pour une société toute récente, « indisponible » laisse continuer.
// verif = réponse de /restaurants/lookup/company ({ valid: true|false|null, legalName, address }) ou null.
export default function VerifSociete({ verif, className = 'small', style }) {
  const { t } = useLanguage();
  if (!verif) return null;
  let texte = null;
  if (verif.valid === true) {
    texte = t('auth.companyVerified', { name: verif.legalName || '-', address: verif.address || '' })
      // VIES ne donne pas toujours l'adresse : pas de virgule qui pend en fin de ligne.
      .replace(/,\s*$/, '');
  } else if (verif.valid === false) texte = t('auth.companyNotFound');
  else if (verif.error === 'indisponible') texte = t('auth.companyCheckUnavailable');
  if (!texte) return null;
  return <p className={className} style={style} aria-live="polite">{texte}</p>;
}
