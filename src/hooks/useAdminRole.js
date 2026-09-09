import { useEffect, useState } from 'react';
import { api } from '../api';
import { useAuth } from '../context/AuthContext';

// Rôle du membre connecté dans l'équipe Fairide (GET /admin/team/me), partagé entre la barre latérale,
// l'accueil et Équipe & accès : une seule requête par session quel que soit le nombre de composants
// abonnés (même modèle que useAdminOverview). Tant que rien n'est chargé — ou si la requête échoue —
// `role` vaut null et les appelants montrent tout : le serveur reste le seul vrai garde-fou.
let cache = null; // { email, name, role, isOwner, allowedModules, since }
let jetonCharge = null;
let enCours = null;
const abonnes = new Set();

function diffuser() { for (const fn of abonnes) fn(cache); }

async function charger(token, force = false) {
  if (!token) return undefined;
  if (!force && jetonCharge === token && cache) return undefined;
  if (enCours) return enCours;
  enCours = api('/admin/team/me', { token })
    .then((me) => { cache = me; jetonCharge = token; diffuser(); })
    .catch(() => { cache = null; jetonCharge = token; diffuser(); })
    .finally(() => { enCours = null; });
  return enCours;
}

export function invalidateAdminRole() { cache = null; jetonCharge = null; }

export default function useAdminRole() {
  const { token, user } = useAuth();
  const [me, setMe] = useState(cache);
  const [loading, setLoading] = useState(!cache && !!user?.isAdmin);
  useEffect(() => {
    if (!user?.isAdmin) { setLoading(false); return undefined; }
    const maj = (v) => { setMe(v); setLoading(false); };
    abonnes.add(maj);
    const p = charger(token);
    if (!p) setLoading(false);
    return () => { abonnes.delete(maj); };
  }, [token, user?.isAdmin]);
  return {
    me,
    role: me?.role || null,
    isOwner: !!me?.isOwner,
    allowedModules: me?.allowedModules || null,
    loading,
    refresh: () => charger(token, true)
  };
}
