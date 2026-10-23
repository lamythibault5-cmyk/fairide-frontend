import { useState } from 'react';
import Icone from './Icone';
import { useLanguage } from '../context/LanguageContext';
import { CHOIX_THEME, choixTheme, definirTheme } from '../theme';

// Les icônes des trois choix : le téléphone (automatique), le soleil, la lune.
const ICONES = { auto: 'mobile', clair: 'soleil', sombre: 'lune' };

/* CLAIR, SOMBRE OU COMME LE TÉLÉPHONE (fondateur, 2026-10-23) — dans l'app seulement (le site reste clair). Mon compte ›
 * Apparence. Mêmes options que la langue (ListeLangues) : le choix s'applique tout de suite, sans enregistrer. */
export default function ChoixApparence({ onChange }) {
  const { t } = useLanguage();
  const [choix, setChoix] = useState(choixTheme);
  const choisir = (c) => { definirTheme(c); setChoix(c); onChange?.(c); };
  return (
    <div role="radiogroup" aria-label={t('account.appearance')}>
      {CHOIX_THEME.map((c) => (
        <button key={c} type="button" role="radio" aria-checked={c === choix} className={`bv-option${c === choix ? ' on' : ''}`} onClick={() => choisir(c)}>
          <span className="bv-tuile"><Icone nom={ICONES[c]} taille={20} /></span>
          <span>{t(`account.appearance_${c}`)}{c === 'auto' && <small>{t('account.appearance_autoSub')}</small>}</span>
        </button>
      ))}
    </div>
  );
}
