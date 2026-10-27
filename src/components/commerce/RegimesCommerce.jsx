import { useLanguage } from '../../context/LanguageContext';
import { experienceApp } from '../../natif';
import { illustrationCuisine } from '../../menuCategories';
import '../../choix-specialites.css';

/* TOUTE TA CARTE EST… ? (fondateur, 2026-10-27 : « s'il est halal, que ce soit facile pour le restaurant, un bouton clair qu'il
 * voit à l'inscription ; pareil pour végé, vegan ou sans gluten au même endroit ; s'il clique oui, il est dans la catégorie »).
 *
 * Quatre boutons sous la recherche de ChoixSpecialites, donc partout où il est : l'inscription dans l'app et sur le site, la
 * création d'un commerce et Mon commerce › Ce que tu vends. Oui = tout l'établissement (halalAll, vegetarianAll, veganAll,
 * glutenFreeAll ; backend migrations 042 et 094) : le commerce entre dans la catégorie du client (CATEGORIES_CLIENT,
 * specialites.js). Vegan coche aussi Végétarien ; retirer Végétarien retire Vegan. « Sans gluten » est réglementé (UE
 * 828/2014) : la règle s'affiche dès qu'il est coché. */
const BOUTONS = [['halalAll', 'halal', 'halal'], ['vegetarianAll', 'vegetarien', 'vegetarien'], ['veganAll', 'vegan', 'vegan'], ['glutenFreeAll', 'sansGluten', 'sansgluten']];

export default function RegimesCommerce({ valeurs, onChange }) {
  const { t } = useLanguage();
  const app = experienceApp();

  function basculer(cle) {
    const oui = !valeurs[cle];
    const suite = { ...valeurs, [cle]: oui };
    if (cle === 'veganAll' && oui) suite.vegetarianAll = true;
    if (cle === 'vegetarianAll' && !oui) suite.veganAll = false;
    onChange(suite);
  }

  return (
    <div className="cs-regimes" role="group" aria-label={t('regimes.titre')}>
      <p className="cs-titre">{t('regimes.titre')}</p>
      <div className="cs-regimes-boutons">
        {BOUTONS.map(([cle, libelle, dessin]) => (
          <button key={cle} type="button" className={`cs-regime${valeurs[cle] ? ' on' : ''}`} aria-pressed={!!valeurs[cle]} onClick={() => basculer(cle)}>
            <img src={illustrationCuisine(dessin, { plat: !app })} alt="" width="30" height="30" decoding="async" draggable="false" />
            <span>{t(`regimes.${libelle}`)}</span>
          </button>
        ))}
      </div>
      <p className="cs-aide">{valeurs.glutenFreeAll ? t('regimes.regleGluten') : t('regimes.aide')}</p>
    </div>
  );
}
