import { useCallback, useEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
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

// LE SITE SUR UN TÉLÉPHONE : une seule pastille « FR ⌄ » à côté de « Connexion » (fondateur, 2026-11-02 : les langues
// n'étaient plus que tout en bas du pied de page, à 4 000 px de l'en-tête, et personne ne les trouvait). Elle ouvre une
// liste Fairride (carte blanche, comme les suggestions d'adresse), pas la roue native du téléphone (fondateur, même jour).
// La liste est posée dans <body> : .hero est en overflow: hidden et en will-change: transform, elle y serait coupée.
// Montrée sous 900px seulement, là où LanguageSwitcher est masqué (styles.css).
export function LangueCompacte() {
  const { language, setLanguage, languages } = useLanguage();
  const [pos, setPos] = useState(null);
  const bouton = useRef(null);
  const liste = useRef(null);
  const fermer = useCallback(() => setPos(null), []);

  useEffect(() => {
    if (!pos) return undefined;
    liste.current?.querySelector('[aria-checked="true"]')?.focus();
    const dehors = (e) => { if (!liste.current?.contains(e.target) && !bouton.current?.contains(e.target)) fermer(); };
    const touche = (e) => { if (e.key === 'Escape') { fermer(); bouton.current?.focus(); } };
    // L'en-tête s'efface au défilement : la liste ne doit pas rester seule en l'air.
    document.addEventListener('pointerdown', dehors);
    document.addEventListener('keydown', touche);
    window.addEventListener('scroll', fermer, { passive: true });
    window.addEventListener('resize', fermer);
    return () => {
      document.removeEventListener('pointerdown', dehors);
      document.removeEventListener('keydown', touche);
      window.removeEventListener('scroll', fermer);
      window.removeEventListener('resize', fermer);
    };
  }, [pos, fermer]);

  const basculer = () => {
    if (pos) return fermer();
    const r = bouton.current.getBoundingClientRect();
    setPos({ top: r.bottom + 8, right: window.innerWidth - r.right });
  };
  const choisir = (l) => { setLanguage(l); fermer(); bouton.current?.focus(); };

  return (
    <>
      <button ref={bouton} type="button" className="langue-compacte" aria-haspopup="menu" aria-expanded={!!pos} aria-label="Langue / Taal / Language" onClick={basculer}>
        <span aria-hidden="true">{LABELS[language]}</span>
        <svg aria-hidden="true" width="10" height="10" viewBox="0 0 10 10"><path d="M2 3.5 5 6.5 8 3.5" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" /></svg>
      </button>
      {pos && createPortal(
        <div ref={liste} className="langue-liste" role="menu" aria-label="Langue / Taal / Language" style={{ top: pos.top, right: pos.right }}>
          {languages.map((l) => (
            <button key={l} type="button" role="menuitemradio" aria-checked={l === language} lang={l} onClick={() => choisir(l)}>
              {NOMS[l] || l}
              {l === language && <svg aria-hidden="true" width="16" height="16" viewBox="0 0 16 16"><path d="M3.5 8.5 6.5 11.5 12.5 5" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" /></svg>}
            </button>
          ))}
        </div>,
        document.body,
      )}
    </>
  );
}
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
