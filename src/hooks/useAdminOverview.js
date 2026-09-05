import { useEffect, useState } from 'react';
import { api } from '../api';
import { useAuth } from '../context/AuthContext';

// Compteurs « à traiter » de l'ERP (GET /admin/overview), partagés entre la barre latérale et l'accueil :
// une seule requête toutes les 60 s quel que soit le nombre de composants abonnés.
let cache = null;
let derniereRequete = 0;
let enCours = null;
const abonnes = new Set();
const INTERVALLE_MS = 60 * 1000;

function diffuser() { for (const fn of abonnes) fn(cache); }

async function rafraichir(token, force = false) {
  if (!token) return;
  if (!force && Date.now() - derniereRequete < INTERVALLE_MS && cache) return;
  if (enCours) return enCours;
  enCours = api('/admin/overview', { token })
    .then((o) => { cache = o; derniereRequete = Date.now(); diffuser(); })
    .catch(() => { /* pastilles absentes plutôt qu'une erreur bloquante */ })
    .finally(() => { enCours = null; });
  return enCours;
}

export default function useAdminOverview() {
  const { token, user } = useAuth();
  const [overview, setOverview] = useState(cache);
  useEffect(() => {
    if (!user?.isAdmin) return undefined;
    abonnes.add(setOverview);
    rafraichir(token);
    const timer = setInterval(() => rafraichir(token), INTERVALLE_MS);
    return () => { abonnes.delete(setOverview); clearInterval(timer); };
  }, [token, user?.isAdmin]);
  return { overview, refresh: () => rafraichir(token, true) };
}
