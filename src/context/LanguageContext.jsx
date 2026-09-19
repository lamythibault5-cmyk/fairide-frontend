import { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react';
import { translations, SUPPORTED_LANGUAGES, DEFAULT_LANGUAGE } from '../i18n/translations';
import { changerLangue, ecouterLangue } from '../i18n/historiqueLangue';

const LanguageContext = createContext(null);
export const LOCALES = { fr: 'fr-BE', en: 'en-GB', nl: 'nl-BE' };
// Locale courante lisible hors composant (fonctions de formatage de date appelées au rendu) : mise à
// jour par le fournisseur à chaque rendu, donc toujours celle de la langue affichée.
let localeCourante = LOCALES.fr;
let langueCourante = 'fr';
export function getLocale() { return localeCourante; }
// Langue courante lisible hors composant — pour des tables de libellés (ERP admin) indexées par langue.
export function getLanguage() { return langueCourante; }

function resolve(dict, path) {
  return path.split('.').reduce((node, key) => (node == null ? undefined : node[key]), dict);
}

// `initial` vient de l'ADRESSE, lue dans main.jsx : /nl/… affiche le néerlandais, point. Le choix
// n'est plus lu dans localStorage au démarrage — deux sources de vérité pour une même question
// donnaient une page néerlandaise servie sous une adresse française, c'est-à-dire exactement le
// doublon que l'adressage par langue existe pour supprimer. Le stockage garde le choix, mais il ne
// sert plus qu'à aiguiller un retour par la racine (voir src/i18n/routing.js).
export function LanguageProvider({ children, initial = DEFAULT_LANGUAGE }) {
  const [language, setLanguageState] = useState(initial);

  // index.html porte lang="fr" en dur : sans cette synchronisation, un visiteur passé en néerlandais ou
  // en anglais restait annoncé comme lisant du français. Les lecteurs d'écran appliquent alors la
  // prononciation française à du texte néerlandais, et les moteurs de recherche classent mal la page.
  useEffect(() => {
    document.documentElement.lang = language;
    // Page sans titre propre (connexion…) : le titre par défaut suit la langue changée sur place.
    const defaut = translations[language]?.seo?.defaultTitle;
    if (defaut && SUPPORTED_LANGUAGES.some((l) => translations[l]?.seo?.defaultTitle === document.title)) document.title = defaut;
  }, [language]);

  // CHANGER DE LANGUE TRADUIT SUR PLACE : l'adresse prend le préfixe de la nouvelle langue (la page
  // néerlandaise garde son adresse à elle, pour l'indexation), mais sans rechargement ni navigation.
  // Un visiteur au milieu d'une inscription ou d'une commande garde ce qu'il a saisi, sa position dans
  // la page et son panier (voir src/i18n/historiqueLangue.js).
  useEffect(() => ecouterLangue(setLanguageState), []);
  const setLanguage = useCallback((lang) => {
    if (!SUPPORTED_LANGUAGES.includes(lang) || lang === language) return;
    changerLangue(lang);
    setLanguageState(lang);
  }, [language]);

  // t('landing.title1') → chaîne traduite. Si absente de la langue active, retombe sur le français
  // (source complète) puis sur la clé elle-même — évite un écran vide pour une clé pas encore traduite.
  const t = useCallback((key, vars) => {
    let value = resolve(translations[language], key);
    if (value === undefined) value = resolve(translations[DEFAULT_LANGUAGE], key);
    if (value === undefined) return key;
    if (typeof value === 'string' && vars) {
      return Object.entries(vars).reduce((s, [k, v]) => s.split(`{${k}}`).join(v), value);
    }
    return value;
  }, [language]);

  // Locale Intl pour les dates, heures et montants : un néerlandophone lit « maandag 7 oktober »,
  // pas « lundi 7 octobre ». Belgique dans les trois cas (formats de date et d'euro belges).
  const locale = LOCALES[language] || LOCALES[DEFAULT_LANGUAGE];
  localeCourante = locale;
  langueCourante = language;

  /* Objet mémoïsé, et ce n'est pas de la coquetterie : LanguageProvider est le fournisseur le PLUS
     EXTERNE (voir main.jsx). Un objet neuf à chaque rendu faisait repasser pour « changée » une
     valeur identique, et tout ce qui appelle useLanguage() — c'est-à-dire la moitié de l'application
     — se rendait à nouveau, y compris quand seule une couche interne avait bougé.
     `setLanguage` et `t` sont déjà des useCallback, donc la dépendance se réduit à ce qui change
     vraiment : la langue. C'est ce qui rend cette mémoïsation sûre ici, là où elle ne le serait pas
     dans un fournisseur dont les fonctions sont recréées à chaque passage. */
  const value = useMemo(
    () => ({ language, locale, setLanguage, t, languages: SUPPORTED_LANGUAGES }),
    [language, locale, setLanguage, t]
  );

  return (
    <LanguageContext.Provider value={value}>
      {children}
    </LanguageContext.Provider>
  );
}

export function useLanguage() {
  return useContext(LanguageContext);
}
