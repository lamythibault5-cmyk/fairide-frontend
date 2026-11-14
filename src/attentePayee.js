import { useEffect, useState } from 'react';
import { api } from './api';

/* L'ATTENTE AU COMMERCE PAYÉE : EN PAUSE, ET C'EST LE SERVEUR QUI LE DIT (Owen, 14/11/2026 : « I'd actually prefer to remove
 * the paid waiting time for the moment, I'm still figuring it out »). Le serveur a un interrupteur (attenteComptoir.js,
 * paramètre attente_payee_active) et l'annonce dans GET /couriers/options › pricing.waiting :
 *   { active: false }                                  en pause : aucun écran ne promet ni ne montre une attente payée ;
 *   { active: true, graceMin, perMinute, cap }         payée : les montants viennent d'ici, jamais d'une constante du front.
 * Sans réponse (hors ligne, serveur d'avant) : en pause. Ne rien promettre est toujours vrai ; promettre à tort ne l'est pas.
 * Lu une fois par ouverture de l'app (un échec n'est pas gardé : la lecture suivante réessaie).
 * Qui s'en sert : IncidentsCourse.jsx (« J'attends au commerce » n'envoie la position et n'affiche la paie que si elle est
 * active) et ReglesCoursePage.jsx (le bloc « Au commerce »). */
let lecture = null;
export function lireAttentePayee() {
  if (!lecture) {
    lecture = api('/couriers/options')
      .then((o) => {
        const w = o?.pricing?.waiting;
        const complet = w?.active === true && [w.graceMin, w.perMinute, w.cap].every((n) => Number.isFinite(Number(n)));
        return complet ? { graceMin: Number(w.graceMin), perMinute: Number(w.perMinute), cap: Number(w.cap) } : null;
      })
      .catch(() => { lecture = null; return null; });
  }
  return lecture;
}

// null tant qu'on ne sait pas et quand elle est en pause ; sinon { graceMin, perMinute, cap }.
export default function useAttentePayee() {
  const [attente, setAttente] = useState(null);
  useEffect(() => {
    let vivant = true;
    lireAttentePayee().then((a) => { if (vivant) setAttente(a); });
    return () => { vivant = false; };
  }, []);
  return attente;
}
