import { createContext, useCallback, useContext, useRef, useState } from 'react';

const ToastContext = createContext(null);

export function ToastProvider({ children }) {
  const [message, setMessage] = useState('');
  const [erreur, setErreur] = useState(false);
  const [show, setShow] = useState(false);
  const timer = useRef(null);

  /* `ton` est facultatif : toast('…') se comporte exactement comme avant, toast('…', 'erreur') met
   * le message en rouge.
   *
   * LA PASSE GLOBALE A FINI PAR ÊTRE FAITE (2026-09-21). Le mécanisme existait depuis longtemps mais
   * quatre appels sur 755 s'en servaient : autrement dit, en pratique, toutes les erreurs de
   * l'application s'affichaient en NOIR, du même noir que « Plat ajouté au panier ». Rien ne
   * distinguait un succès d'un échec.
   * 353 appels ont été teintés d'un coup, selon deux formes vérifiables et rien d'autre :
   *   - toast(e.message) / toast(err.message) — les 341 ont été contrôlés un par un comme étant
   *     dans un bloc catch ;
   *   - toast(t('…errXxx')) / toast(t('…xxxError')) — sur le DERNIER segment de la clé seulement,
   *     ce qui écarte 'account.referral.toastCopied', un message de succès que « ref-err-al »
   *     faisait passer pour une erreur.
   * Délibérément laissé de côté : toast(pay.message), qui porte un message de SUCCÈS venu de l'API.
   * Restent en noir les erreurs annoncées par une phrase écrite à la main ; elles se teintent au cas
   * par cas, il n'y a pas de motif fiable pour les reconnaître.
   *
   * Le rouge est --red, la couleur d'ÉTAT du projet. Surtout pas le lime : c'est l'accent de la
   * marque, et s'en servir pour signaler une erreur brouillerait les deux (CLAUDE.md). */
  const toast = useCallback((msg, ton = '') => {
    setMessage(msg);
    setErreur(ton === 'erreur');
    setShow(true);
    clearTimeout(timer.current);
    /* PLUS COURT QU'AVANT (demande du fondateur, 2026-09-21) : 5,2 à 9 s, c'est devenu 3,2 à 5,5 s.
     * Le calcul reste proportionnel à la longueur du texte — une phrase de quinze mots ne se lit pas
     * dans le temps de « Plat ajouté » — mais les deux bornes descendent d'environ deux secondes.
     * La borne haute compte : un message posé neuf secondes recouvre le mobilier du bas et on finit
     * par attendre qu'il parte.
     * Réserve honnête : un toast est un canal éphémère, et raccourcir une ERREUR joue contre celui
     * qui lit lentement ou qui n'était pas en train de regarder l'écran. 3,2 s reste au-dessus du
     * seuil habituel des messages transitoires, mais si une erreur t'échappe à l'usage, c'est ce
     * chiffre-ci qu'il faut remonter — il n'est écrit qu'ici. */
    const duree = Math.max(3200, Math.min(5500, 1400 + String(msg || '').length * 32));
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
