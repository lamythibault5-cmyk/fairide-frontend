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

// Dans une feuille de l'application (Mon compte › Langue) : trois rangées pleines, comme les choix de l'accueil, au lieu des
// trois pastilles de l'en-tête du site, petites et perdues dans une feuille.
const NOMS = { fr: 'Français', en: 'English', nl: 'Nederlands' };
export function ListeLangues() {
  const { language, setLanguage, languages } = useLanguage();
  return (
    <div role="radiogroup" aria-label="Langue / Taal / Language">
      {languages.map((l) => (
        <button key={l} type="button" role="radio" aria-checked={l === language} className={`bv-option${l === language ? ' on' : ''}`} onClick={() => setLanguage(l)}>
          {/* Chaque nom dans sa langue, prononcé comme tel (audit du 19/10, CROSS-108). */}
          <span lang={l}>{NOMS[l] || l}</span>
        </button>
      ))}
    </div>
  );
}
