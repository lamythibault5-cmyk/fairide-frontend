import { useLanguage } from '../../context/LanguageContext';
import Icone from '../Icone';
import useFenetreDemande from './useFenetreDemande';
import '../../ecran-demandes.css';

/* LES DEUX PORTES VERS « LEQUEL ? » (fondateur, 2026-10-26, version B, réponse 2 du questionnaire).
 *
 * Recherche sans résultat : c'est là que le client a le plus envie de demander — il vient de taper le nom. La carte lui
 * propose de le demander, avec le mot tapé déjà dans la fenêtre. Seule action de l'écran : le bouton est lime.
 *
 * Fin de la liste des restaurants (« Il manque ton restaurant ? ») : après « À découvrir », là où l'on se dit qu'il manque
 * le sien. Écran de navigation, sans lime (design.md, règle 4 : un écran qui se parcourt n'a pas de lime) — bouton en contour. */
export function CarteDemanderRecherche({ requete }) {
  const { t } = useLanguage();
  const { ouvrir, fenetre } = useFenetreDemande();
  return (
    <div className="dm-carte dm-carte--recherche">
      <div className="dm-carte-tete">
        <span className="dm-carte-rond" aria-hidden="true"><Icone nom="commerce" taille={22} /></span>
        <div>
          <h3>{t('demandes.rechercheTitre')}</h3>
          <p>{t('demandes.rechercheTexte')}</p>
        </div>
      </div>
      <button type="button" className="btn-gold dm-carte-bouton" onClick={() => ouvrir(requete)}>{t('demandes.demanderCeRestaurant')}</button>
      {fenetre}
    </div>
  );
}

export function FinDeListeDemande() {
  const { t } = useLanguage();
  const { ouvrir, fenetre } = useFenetreDemande();
  return (
    <div className="dm-carte dm-carte--fin">
      <span className="dm-carte-rond" aria-hidden="true"><Icone nom="commerce" taille={22} /></span>
      <h3>{t('demandes.finTitre')}</h3>
      <p>{t('demandes.finTexte')}</p>
      <button type="button" className="btn-outline dm-carte-bouton" onClick={() => ouvrir('')}>
        <Icone nom="megaphone" taille={18} />{t('demandes.finBouton')}
      </button>
      {fenetre}
    </div>
  );
}
