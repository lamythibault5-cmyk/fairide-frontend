import { createContext, useCallback, useContext, useState } from 'react';
import { translations, SUPPORTED_LANGUAGES, DEFAULT_LANGUAGE } from '../i18n/translations';

const LanguageContext = createContext(null);
const STORAGE_KEY = 'fairide_language';

// Persisté dans localStorage (pas sessionStorage) pour que le choix survive aussi bien à un
// changement de page qu'à une fermeture/réouverture du navigateur.
function loadLanguage() {
  try {
    const stored = localStorage.getItem(STORAGE_KEY);
    if (stored && SUPPORTED_LANGUAGES.includes(stored)) return stored;
  } catch {
    // stockage indisponible — reste sur la langue par défaut
  }
  return DEFAULT_LANGUAGE;
}

function resolve(dict, path) {
  return path.split('.').reduce((node, key) => (node == null ? undefined : node[key]), dict);
}

export function LanguageProvider({ children }) {
  const [language, setLanguageState] = useState(loadLanguage);

  const setLanguage = useCallback((lang) => {
    if (!SUPPORTED_LANGUAGES.includes(lang)) return;
    setLanguageState(lang);
    try {
      localStorage.setItem(STORAGE_KEY, lang);
    } catch {
      // stockage indisponible — le choix reste actif pour la session en cours
    }
  }, []);

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

  return (
    <LanguageContext.Provider value={{ language, setLanguage, t, languages: SUPPORTED_LANGUAGES }}>
      {children}
    </LanguageContext.Provider>
  );
}

export function useLanguage() {
  return useContext(LanguageContext);
}
