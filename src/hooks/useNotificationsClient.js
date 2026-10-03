import { useCallback, useEffect, useState } from 'react';
import { api } from '../api';
import { useAuth } from '../context/AuthContext';

// Notifications du client (plan de test NOT-9) : GET /me/notifications, écrites côté serveur par un déclencheur sur les
// commandes (migrations/016). Relu toutes les 30 s tant que la page est ouverte — le suivi de commande fait déjà de même.
// Rien pour un commerçant, un livreur ou l'admin : ils ont leurs propres alertes.
export default function useNotificationsClient() {
  const { token, role, user } = useAuth();
  const actif = !!token && role === 'client' && !user?.isAdmin;
  const [etat, setEtat] = useState({ unread: 0, items: [] });

  const relire = useCallback(() => {
    if (!actif) return Promise.resolve();
    return api('/me/notifications', { token }).then(setEtat).catch(() => {});
  }, [actif, token]);

  useEffect(() => {
    if (!actif) { setEtat({ unread: 0, items: [] }); return undefined; }
    relire();
    const id = setInterval(relire, 30000);
    return () => clearInterval(id);
  }, [actif, relire]);

  const marquerLues = useCallback(async (ids) => {
    if (!actif) return;
    await api('/me/notifications/read', { method: 'PATCH', token, body: ids ? { ids } : {} }).catch(() => {});
    setEtat((e) => ({ unread: ids ? Math.max(0, e.unread - ids.length) : 0, items: e.items.map((n) => (!ids || ids.includes(n.id) ? { ...n, read: true } : n)) }));
  }, [actif, token]);

  return { ...etat, actif, relire, marquerLues };
}
