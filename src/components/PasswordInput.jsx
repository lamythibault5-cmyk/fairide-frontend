import { useState } from 'react';
import { useLanguage } from '../context/LanguageContext';

// Champ mot de passe avec un œil pour afficher/masquer ce qu'on tape. Utilisé partout où un mot de passe
// est saisi ; pour une création, il se double d'un champ de confirmation (voir Auth.jsx, Account.jsx).
export default function PasswordInput({ id, value, onChange, placeholder, invalid = false, autoComplete = 'new-password' }) {
  const { t } = useLanguage();
  const [visible, setVisible] = useState(false);
  return (
    <div className="password-input">
      <input id={id} type={visible ? 'text' : 'password'} value={value} onChange={onChange} placeholder={placeholder}
        className={invalid ? 'input-invalid' : undefined} autoComplete={autoComplete} />
      {/* onMouseDown preventDefault : le champ garde le focus (le clavier du téléphone ne se ferme pas, la page
          ne se décale pas sous le doigt entre l'appui et le relâchement). */}
      <button type="button" className="password-eye" onMouseDown={(e) => e.preventDefault()} onClick={() => setVisible((v) => !v)} aria-pressed={visible}
        aria-label={visible ? t('auth.hidePassword') : t('auth.showPassword')} title={visible ? t('auth.hidePassword') : t('auth.showPassword')}>
        {visible ? '🙈' : '👁️'}
      </button>
    </div>
  );
}
