import { createContext, useCallback, useContext, useRef, useState } from 'react';

const ToastContext = createContext(null);

export function ToastProvider({ children }) {
  const [message, setMessage] = useState('');
  const [erreur, setErreur] = useState(false);
  const [show, setShow] = useState(false);
  const timer = useRef(null);

  /* `ton` est facultatif : toast('…') se comporte exactement comme avant, toast('…', 'erreur') met
   * le message en rouge. Les quelque cent appels existants n'ont pas bougé — un ton par défaut
   * permet de teinter les messages au fur et à mesure, sans passe globale hasardeuse.
   *
   * Le rouge est --red, la couleur d'ÉTAT du projet. Surtout pas le lime : c'est l'accent de la
   * marque, et s'en servir pour signaler une erreur brouillerait les deux (CLAUDE.md). */
  const toast = useCallback((msg, ton = '') => {
    setMessage(msg);
    setErreur(ton === 'erreur');
    setShow(true);
    clearTimeout(timer.current);
    // Au moins 5 s, davantage pour un message long : le temps de lire une erreur avant qu'elle ne disparaisse.
    const duree = Math.max(5200, Math.min(9000, 2200 + String(msg || '').length * 45));
    timer.current = setTimeout(() => setShow(false), duree);
  }, []);

  return (
    <ToastContext.Provider value={toast}>
      {children}
      <div className={`toast${show ? ' show' : ''}${erreur ? ' toast-erreur' : ''}`} role={erreur ? 'alert' : 'status'}>{message}</div>
    </ToastContext.Provider>
  );
}

export function useToast() {
  return useContext(ToastContext);
}
