import { createContext, useCallback, useContext, useEffect, useState } from 'react';
import { translations, SUPPORTED_LANGUAGES, DEFAULT_LANGUAGE } from '../i18n/translations';
import { cheminLocalise, cheminSansPrefixe, memoriserLangue } from '../i18n/routing';

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
  }, [language]);

  // CHANGER DE LANGUE EST DÉSORMAIS UNE NAVIGATION, pas un échange de textes sur place : la page
  // néerlandaise est à une autre adresse, il faut donc s'y rendre. On garde la page courante et on
  // ne change que le préfixe, pour que le visiteur reste là où il était.
  //
  // Rechargement complet et non navigation interne : `basename` est figé à la construction du
  // routeur (voir main.jsx), le remonter en place reviendrait à reconstruire tout l'arbre avec ses
  // contextes — session, panier, mode aperçu — pour un geste qui change de document de toute façon.
  const setLanguage = useCallback((lang) => {
    if (!SUPPORTED_LANGUAGES.includes(lang) || lang === language) return;
    memoriserLangue(lang);
    const applicatif = cheminSansPrefixe(window.location.pathname);
    const cible = `${cheminLocalise(applicatif, lang)}${window.location.search}${window.location.hash}`;
    window.location.assign(cible);
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

  return (
    <LanguageContext.Provider value={{ language, locale, setLanguage, t, languages: SUPPORTED_LANGUAGES }}>
      {children}
    </LanguageContext.Provider>
  );
}

export function useLanguage() {
  return useContext(LanguageContext);
}
