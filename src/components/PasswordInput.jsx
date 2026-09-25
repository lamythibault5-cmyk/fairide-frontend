import { useState } from 'react';
import { useLanguage } from '../context/LanguageContext';

// Champ mot de passe avec un œil pour afficher/masquer ce qu'on tape. Utilisé partout où un mot de passe
// est saisi. Il n'y a plus de champ de confirmation en face : voir le commentaire d'Auth.jsx — voir ce
// qu'on tape vérifie mieux qu'un second champ rempli à l'aveugle.
//
// L'œil est un TRACÉ, plus un emoji. « 👁️ » et « 🙈 » s'affichaient en emoji couleur, rendus par la
// police système : un globe oculaire brunâtre sur Windows, un singe ailleurs, dans les deux cas un objet
// qui n'appartient à aucune interface. Deux icônes au trait, à la couleur du texte secondaire, se lisent
// comme un contrôle et suivent le thème.
function OeilOuvert() {
  return (
    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8"
      strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <path d="M2 12s3.6-7 10-7 10 7 10 7-3.6 7-10 7-10-7-10-7Z" />
      <circle cx="12" cy="12" r="3" />
    </svg>
  );
}

function OeilBarre() {
  return (
    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8"
      strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <path d="M10.6 5.1A10.9 10.9 0 0 1 12 5c6.4 0 10 7 10 7a18.3 18.3 0 0 1-2.9 3.8M6.6 6.6A18.3 18.3 0 0 0 2 12s3.6 7 10 7a10.8 10.8 0 0 0 4.2-.8" />
      <path d="M9.9 9.9a3 3 0 0 0 4.2 4.2" />
      <path d="M3 3l18 18" />
    </svg>
  );
}

export default function PasswordInput({ id, value, onChange, onBlur, placeholder, invalid = false, autoComplete = 'new-password' }) {
  const { t } = useLanguage();
  const [visible, setVisible] = useState(false);
  return (
    <div className="password-input">
      <input id={id} type={visible ? 'text' : 'password'} value={value} onChange={onChange} onBlur={onBlur} placeholder={placeholder}
        className={invalid ? 'input-invalid' : undefined} autoComplete={autoComplete} />
      {/* onMouseDown preventDefault : le champ garde le focus (le clavier du téléphone ne se ferme pas, la page
          ne se décale pas sous le doigt entre l'appui et le relâchement). */}
      <button type="button" className="password-eye" onMouseDown={(e) => e.preventDefault()} onClick={() => setVisible((v) => !v)} aria-pressed={visible}
        aria-label={visible ? t('auth.hidePassword') : t('auth.showPassword')} title={visible ? t('auth.hidePassword') : t('auth.showPassword')}>
        {visible ? <OeilBarre /> : <OeilOuvert />}
      </button>
    </div>
  );
}
