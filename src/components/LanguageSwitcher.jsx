import { useLanguage } from '../context/LanguageContext';

const LABELS = { fr: 'FR', en: 'EN', nl: 'NL' };

export default function LanguageSwitcher() {
  const { language, setLanguage, languages } = useLanguage();
  return (
    <div className="lang-switcher">
      {languages.map((l) => (
        <button
          key={l}
          type="button"
          className={l === language ? 'active' : ''}
          onClick={() => setLanguage(l)}
        >
          {LABELS[l]}
        </button>
      ))}
    </div>
  );
}
