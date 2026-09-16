// État de l'abonnement push pour le navigateur courant, et les deux gestes qui le changent.
//
// Séparé de useNewOrderAlert : ce dernier réagit à la liste des commandes déjà chargée dans la page,
// celui-ci ne parle qu'au navigateur et au serveur. Les mélanger obligerait le premier, appelé à
// chaque rafraîchissement de la liste, à porter un état qui ne bouge que deux fois dans une session.

import { useCallback, useEffect, useState } from 'react';
import { abonner, abonnementCourant, desabonner, estSupporte } from '../push';
import { api } from '../api';

export default function usePushNotifications(token) {
  const [supporte] = useState(() => estSupporte());
  const [disponible, setDisponible] = useState(false); // le serveur a-t-il des clés VAPID
  const [abonne, setAbonne] = useState(false);
  const [occupe, setOccupe] = useState(false);

  useEffect(() => {
    if (!supporte) return undefined;
    let vivant = true;
    (async () => {
      const { enabled } = await api('/push/key').catch(() => ({ enabled: false }));
      if (!vivant) return;
      setDisponible(!!enabled);
      // Ne pas se fier à la permission seule : elle peut être accordée sans qu'aucun abonnement
      // n'existe (permission donnée sur un autre onglet, abonnement révoqué depuis). Ce qui compte
      // est la présence d'un abonnement sur CE navigateur.
      const courant = await abonnementCourant();
      if (vivant) setAbonne(!!courant);
    })();
    return () => { vivant = false; };
  }, [supporte]);

  const activer = useCallback(async () => {
    setOccupe(true);
    try {
      const issue = await abonner(token);
      if (issue === 'ok') setAbonne(true);
      return issue;
    } finally {
      setOccupe(false);
    }
  }, [token]);

  const desactiver = useCallback(async () => {
    setOccupe(true);
    try {
      await desabonner(token);
      setAbonne(false);
    } finally {
      setOccupe(false);
    }
  }, [token]);

  return { supporte, disponible, abonne, occupe, activer, desactiver };
}
