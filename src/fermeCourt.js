import { useEffect, useState, useSyncExternalStore } from 'react';
import { getLocale } from './context/LanguageContext';
import { statutOuverture, dayLabel } from './openingHours';

/* « FERMÉ », EN PETIT, LÀ OÙ L'ON EN A BESOIN (fondateur, 2026-10-25, version B + C de maquettes/ferme-couverts).
 * Un commerce fermé disait « Ce commerce est fermé pour le moment : compose ton panier, il est gardé 24 heures… » dans un
 * toast de 150 signes, posé sur la photo du plat dès son ouverture, pendant 11 secondes (« trop gros, trop dans la figure »).
 * Il n'y a plus de toast : la fiche du plat le dit en une ligne au-dessus de « Ajouter » (FichePlat), et la barre du panier
 * en sous-titre (FloatingCart), tant que le commerce du panier est fermé.
 *
 * fermeCourt() rend { detail } : « ouvre à 11:30 », « ouvre demain à 11:30 », « ouvre lundi à 11:30 », ou null quand on ne
 * sait pas quand il rouvre (fermé par son interrupteur, fermeture exceptionnelle) — on dit alors « Fermé pour le moment ».
 * null tout court : le commerce est ouvert. */
export function fermeCourt(restaurant, now, t) {
  if (!restaurant) return null;
  const s = statutOuverture(restaurant, now);
  if (s.isOpen) return null;
  if (s.fermeParLeCommerce || !s.opensAt) return { detail: null };
  const heure = s.opensAt.toLocaleTimeString(getLocale(), { hour: '2-digit', minute: '2-digit' });
  if (s.opensToday) return { detail: t('fermeCourt.opensAt', { time: heure }) };
  const demain = new Date(now.getTime() + 86400000).toDateString() === s.opensAt.toDateString();
  if (demain || s.fermePourLaJournee) return { detail: t('fermeCourt.opensTomorrow', { time: heure }) };
  // « ouvre lundi » / « opent maandag » en minuscule, « opens Monday » avec sa majuscule.
  const jour = dayLabel(s.opensDayKey, t);
  return { detail: t('fermeCourt.opensDay', { day: getLocale().startsWith('en') ? jour : jour.toLowerCase(), time: heure }) };
}

// « Fermé · ouvre à 11:30 » / « Fermé pour le moment » : la ligne de la barre du panier.
export function fermeCourtTexte(f, t) {
  if (!f) return '';
  return f.detail ? `${t('fermeCourt.closed')} · ${f.detail}` : t('fermeCourt.closedForNow');
}

/* LE COMMERCE DU PANIER, POUR LA BARRE. FloatingCart est posée au-dessus des pages et ne connaît que l'identifiant du
 * commerce ; les deux pages où elle s'affiche en entier (la fiche du commerce et la liste) l'ont déjà en main : elles le
 * déposent ici, et le retirent en partant. Pas de nouvel appel au serveur. */
let commerce = null;
const abonnes = new Set();
export function poserCommercePanier(r) {
  if (commerce === r) return;
  commerce = r;
  abonnes.forEach((f) => f());
}
// En partant, une page ne retire que SON commerce : la liste peut se démonter après que la fiche a posé le sien.
export function retirerCommercePanier(r) {
  if (commerce === r) poserCommercePanier(null);
}
const sAbonner = (f) => { abonnes.add(f); return () => abonnes.delete(f); };
export function useCommercePanier() {
  return useSyncExternalStore(sAbonner, () => commerce, () => null);
}

// L'heure, relue toutes les 30 s comme la fiche du commerce : la ligne disparaît d'elle-même à l'ouverture.
export function useMaintenant(actif = true) {
  const [now, setNow] = useState(() => new Date());
  useEffect(() => {
    if (!actif) return undefined;
    setNow(new Date());
    const id = setInterval(() => setNow(new Date()), 30000);
    return () => clearInterval(id);
  }, [actif]);
  return now;
}
