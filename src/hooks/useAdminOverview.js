import { useEffect, useState } from 'react';
import { api } from '../api';
import { useAuth } from '../context/AuthContext';

// Compteurs « à traiter » de l'ERP (GET /admin/overview), partagés entre la barre latérale et l'accueil :
// une seule requête toutes les 60 s quel que soit le nombre de composants abonnés.
//
// L'état est { overview, error, loadedAt } : l'accueil peut ainsi montrer une carte d'erreur avec
// « Réessayer » quand /admin/overview échoue, au lieu d'un « Chargement... » éternel — la barre
// latérale, elle, se contente de ne pas afficher de pastilles.
let cache = null;
let erreur = null;
let chargeA = null;
let derniereRequete = 0;
let enCours = null;
const abonnes = new Set();
const INTERVALLE_MS = 60 * 1000;

function etat() { return { overview: cache, error: erreur, loadedAt: chargeA }; }
function diffuser() { const e = etat(); for (const fn of abonnes) fn(e); }

async function rafraichir(token, force = false) {
  if (!token) return undefined;
  if (!force && Date.now() - derniereRequete < INTERVALLE_MS && cache) return undefined;
  if (enCours) return enCours;
  enCours = api('/admin/overview', { token })
    .then((o) => { cache = o; erreur = null; chargeA = Date.now(); derniereRequete = Date.now(); diffuser(); })
    .catch((e) => { erreur = e.message || 'Erreur'; derniereRequete = Date.now(); diffuser(); })
    .finally(() => { enCours = null; });
  return enCours;
}

export default function useAdminOverview() {
  const { token, user } = useAuth();
  const [s, setS] = useState(etat);
  useEffect(() => {
    if (!user?.isAdmin) return undefined;
    abonnes.add(setS);
    rafraichir(token);
    const timer = setInterval(() => rafraichir(token), INTERVALLE_MS);
    return () => { abonnes.delete(setS); clearInterval(timer); };
  }, [token, user?.isAdmin]);
  return { overview: s.overview, error: s.error, loadedAt: s.loadedAt, refresh: () => rafraichir(token, true) };
}
