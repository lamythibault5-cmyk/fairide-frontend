import { useCallback, useEffect, useSyncExternalStore } from 'react';
import { api } from '../api';
import { useAuth } from '../context/AuthContext';

// Notifications du client (plan de test NOT-9) : GET /me/notifications, écrites côté serveur par un déclencheur sur les
// commandes (migrations/016). Relu toutes les 30 s tant que la page est ouverte — le suivi de commande fait déjà de même.
// Rien pour un commerçant, un livreur ou l'admin : ils ont leurs propres alertes.
//
// UN SEUL ÉTAT POUR TOUTE L'APPLI (retour d'Owen, 2026-10-21 : « quand j'ouvre mes notifications il y a toujours une
// pastille sur Commandes »). La pastille de l'onglet (DashboardSidebar) et la cloche (ClocheNotifications) avaient chacune
// leur copie du hook : ouvrir la cloche marquait lu dans SA copie, et la pastille de l'onglet gardait son chiffre jusqu'à
// sa propre relecture, 30 s plus tard. L'état vit donc ici, au niveau du module, partagé par tous les abonnés, avec une
// seule relecture toutes les 30 s au lieu d'une par composant.
const VIDE = { unread: 0, items: [] };
let etat = VIDE;
let jeton = null;
let minuterie = null;
let utilisateurs = 0;
const abonnes = new Set();

function publier(suivant) {
  etat = suivant;
  abonnes.forEach((f) => f());
}

function relireAvec(token) {
  if (!token) return Promise.resolve();
  return api('/me/notifications', { token })
    // Une réponse arrivée après une déconnexion ou un changement de compte ne doit pas réafficher l'ancien chiffre.
    .then((r) => { if (token === jeton) publier(r); })
    .catch(() => {});
}

function sAbonner(f) {
  abonnes.add(f);
  return () => abonnes.delete(f);
}
const lire = () => etat;

export default function useNotificationsClient() {
  const { token, role, user } = useAuth();
  const actif = !!token && role === 'client' && !user?.isAdmin;
  const courant = useSyncExternalStore(sAbonner, lire, lire);

  // Le premier composant actif lance la relecture, le dernier qui part l'arrête ; un autre compte repart de zéro.
  useEffect(() => {
    if (!actif) return undefined;
    if (jeton !== token) {
      jeton = token;
      publier(VIDE);
      clearInterval(minuterie);
      minuterie = null;
    }
    utilisateurs += 1;
    if (!minuterie) {
      relireAvec(token);
      minuterie = setInterval(() => relireAvec(jeton), 30000);
    }
    return () => {
      utilisateurs -= 1;
      if (utilisateurs === 0) {
        clearInterval(minuterie);
        minuterie = null;
        // Déconnexion ou changement de rôle : le compte suivant ne doit pas voir la pastille du précédent.
        jeton = null;
        publier(VIDE);
      }
    };
  }, [actif, token]);

  const relire = useCallback(() => (actif ? relireAvec(token) : Promise.resolve()), [actif, token]);

  // Sans `ids` : TOUT est marqué lu côté serveur. La cloche n'affiche que les 50 dernières, mais le serveur compte toutes
  // les non-lues : marquer seulement celles de la liste laissait une pastille à vie au-delà de 50.
  const marquerLues = useCallback(async (ids) => {
    if (!actif) return;
    publier({ unread: ids ? Math.max(0, etat.unread - ids.length) : 0, items: etat.items.map((n) => (!ids || ids.includes(n.id) ? { ...n, read: true } : n)) });
    await api('/me/notifications/read', { method: 'PATCH', token, body: ids ? { ids } : {} }).catch(() => {});
  }, [actif, token]);

  return { ...(actif ? courant : VIDE), actif, relire, marquerLues };
}
