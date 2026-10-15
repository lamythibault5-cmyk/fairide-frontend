import { createContext, useCallback, useContext, useRef, useState } from 'react';
import { useLanguage } from './LanguageContext';
import Icone from '../components/Icone';

const ToastContext = createContext(null);

export function ToastProvider({ children }) {
  const { t } = useLanguage();
  const [message, setMessage] = useState('');
  const [ton, setTon] = useState('');
  const [show, setShow] = useState(false);
  const timer = useRef(null);

  /* `ton` est facultatif : toast('…') se comporte exactement comme avant ; toast('…', 'erreur') met le message en rouge ;
   * toast('…', 'succes') le précède d'une coche verte (audit UX du 15/10/2026).
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
   *
   * SECONDE PASSE (audit UX du 15/10/2026) : 28 messages de saisie à corriger écrits en toutes lettres (« Code requis »,
   * « Complète ton adresse… ») passent en rouge, relus un par un ; 86 confirmations (« Plat mis à jour », « Commande passée
   * et payée ») reçoivent le ton « succes », relues une par une elles aussi. Ce qui n'est ni l'un ni l'autre (« Ton panier
   * est vide », « Refuser n'a aucune conséquence ») reste neutre.
   *
   * Le rouge est --red, la couleur d'ÉTAT du projet ; la coche est --green, réservée à « validé » / « signé ». Surtout pas le
   * lime : c'est l'accent de la marque, et s'en servir pour un état brouillerait les deux (CLAUDE.md). */
  const toast = useCallback((msg, tonDemande = '') => {
    setMessage(msg);
    setTon(tonDemande === 'erreur' || tonDemande === 'succes' ? tonDemande : '');
    setShow(true);
    clearTimeout(timer.current);
    /* PLUS COURT QU'AVANT (demande du fondateur, 2026-09-21) : 5,2 à 9 s, c'est devenu 3,2 à 5,5 s.
     * Le calcul reste proportionnel à la longueur du texte — une phrase de quinze mots ne se lit pas
     * dans le temps de « Plat ajouté » — mais les deux bornes descendent d'environ deux secondes.
     * Réserve honnête : un toast est un canal éphémère, et raccourcir une ERREUR joue contre celui qui lit lentement. Une
     * erreur garde donc 2 s de plus, et se ferme aussi à la croix (audit du 15/10/2026). */
    const duree = Math.max(3200, Math.min(5500, 1400 + String(msg || '').length * 32)) + (tonDemande === 'erreur' ? 2000 : 0);
    timer.current = setTimeout(() => setShow(false), duree);
  }, []);
  const fermer = () => { clearTimeout(timer.current); setShow(false); };

  return (
    <ToastContext.Provider value={toast}>
      {children}
      <div className={`toast${show ? ' show' : ''}${ton === 'erreur' ? ' toast-erreur' : ''}${ton === 'succes' ? ' toast-succes' : ''}`} role={ton === 'erreur' ? 'alert' : 'status'}>
        {ton === 'succes' && <span className="toast-coche" aria-hidden="true"><Icone nom="valider" taille={16} /></span>}
        <span>{message}</span>
        {ton === 'erreur' && <button type="button" className="toast-fermer" onClick={fermer} aria-label={t('common.close')}>×</button>}
      </div>
    </ToastContext.Provider>
  );
}

export function useToast() {
  return useContext(ToastContext);
}
