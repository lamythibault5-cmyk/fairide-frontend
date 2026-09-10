import { useCallback, useEffect, useState } from 'react';
import { api } from '../api';
import { useAuth } from '../context/AuthContext';
import '../inbox.css';

// Compteur de messages non lus de « Mon compte › Messages » (GET /inbox/unread), partagé entre la nav
// du haut, la barre latérale, le toast de Layout et la rubrique elle-même : une seule requête toutes les
// 60 s quel que soit le nombre de composants abonnés, plus un rafraîchissement au retour sur l'onglet.
// Réservé aux comptes non admin connectés — l'admin lit ses conversations dans l'ERP.
//
// La feuille inbox.css est importée ici plutôt que dans chaque consommateur : le hook est le point
// d'entrée commun de la fonctionnalité (nav, section, badge).
let cache = { unread: 0, loadedAt: null };
let derniereRequete = 0;
let enCours = null;
const abonnes = new Set();
const INTERVALLE_MS = 60 * 1000;
const MIN_ENTRE_DEUX_MS = 10 * 1000;

function diffuser() { for (const fn of abonnes) fn(cache); }

async function rafraichir(token, force = false) {
  if (!token) return undefined;
  if (!force && Date.now() - derniereRequete < MIN_ENTRE_DEUX_MS && cache.loadedAt) return undefined;
  if (enCours) return enCours;
  derniereRequete = Date.now();
  enCours = api('/inbox/unread', { token })
    .then((r) => { cache = { unread: Number(r?.unread) || 0, loadedAt: Date.now() }; diffuser(); })
    .catch(() => { /* compteur inchangé : le prochain passage réessaiera */ })
    .finally(() => { enCours = null; });
  return enCours;
}

// Après une lecture ou un envoi, le compteur est immédiatement mis à jour localement (sans attendre le
// serveur) puis confirmé par une vraie requête.
export function poserNonLus(n) {
  cache = { unread: Math.max(0, Number(n) || 0), loadedAt: Date.now() };
  diffuser();
}

export default function useInbox() {
  const { token, user } = useAuth();
  const actif = !!token && !!user && !user.isAdmin;
  const [s, setS] = useState(cache);
  useEffect(() => {
    if (!actif) return undefined;
    abonnes.add(setS);
    setS(cache);
    rafraichir(token);
    const timer = setInterval(() => rafraichir(token), INTERVALLE_MS);
    const auRetour = () => { if (document.visibilityState === 'visible') rafraichir(token); };
    window.addEventListener('focus', auRetour);
    document.addEventListener('visibilitychange', auRetour);
    return () => {
      abonnes.delete(setS); clearInterval(timer);
      window.removeEventListener('focus', auRetour);
      document.removeEventListener('visibilitychange', auRetour);
    };
  }, [token, actif]);
  const refresh = useCallback(() => rafraichir(token, true), [token]);
  return { unread: actif ? s.unread : 0, loadedAt: s.loadedAt, refresh };
}
