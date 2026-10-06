import { useEffect, useRef, useState } from 'react';
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
  const champ = useRef(null);
  const derniereBascule = useRef(0);
  /* SUR TÉLÉPHONE, L'ŒIL NE MONTRAIT PAS TOUJOURS LE MOT DE PASSE (fondateur, 2026-10-06).
     Deux causes possibles, toutes deux fermées ici :
     - un toucher produit parfois DEUX activations (toucher puis clic synthétisé) : la bascule s'annulait aussitôt.
       Une seconde activation dans les 350 ms est ignorée ;
     - certains navigateurs (remplissage automatique, gestion des mots de passe) remettent le champ en « password »
       après que React l'a passé en « text » : le type est réappliqué directement sur l'élément à chaque bascule.
     Le focus reste sur le champ (preventDefault à l'appui) pour que le clavier ne se ferme pas. */
  useEffect(() => { if (champ.current) champ.current.type = visible ? 'text' : 'password'; }, [visible]);
  const basculer = (e) => {
    if (e && e.preventDefault) e.preventDefault();
    const maintenant = Date.now();
    if (maintenant - derniereBascule.current < 350) return;
    derniereBascule.current = maintenant;
    setVisible((v) => !v);
  };
  return (
    <div className="password-input">
      <input ref={champ} id={id} type={visible ? 'text' : 'password'} value={value} onChange={onChange} onBlur={onBlur} placeholder={placeholder}
        className={invalid ? 'input-invalid' : undefined} autoComplete={autoComplete} />
      <button type="button" className="password-eye" onPointerDown={(e) => e.preventDefault()} onMouseDown={(e) => e.preventDefault()} onClick={basculer} aria-pressed={visible}
        aria-label={visible ? t('auth.hidePassword') : t('auth.showPassword')} title={visible ? t('auth.hidePassword') : t('auth.showPassword')}>
        {visible ? <OeilBarre /> : <OeilOuvert />}
      </button>
    </div>
  );
}
