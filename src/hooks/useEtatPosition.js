import { useCallback, useEffect, useState } from 'react';
import { etatPosition } from '../natif';

/* L'état de l'autorisation, relu au retour dans l'app ou l'onglet et quand le navigateur le signale. Rend [etat, verifier] ;
 * verifier() rend le nouvel état. Partagé par la carte des
 * courses (components/livreur/PositionRequise.jsx) et l'interrupteur « Disponible » du tableau de bord (driver/Dashboard.jsx). */
export default function useEtatPosition() {
  const [etat, setEtat] = useState('verification');
  const verifier = useCallback(async () => { const e = await etatPosition(); setEtat(e); return e; }, []);
  useEffect(() => {
    verifier();
    const auRetour = () => { if (document.visibilityState === 'visible') verifier(); };
    document.addEventListener('visibilitychange', auRetour);
    window.addEventListener('focus', auRetour);
    return () => { document.removeEventListener('visibilitychange', auRetour); window.removeEventListener('focus', auRetour); };
  }, [verifier]);
  // Sur le site, la question du navigateur ne déclenche ni focus ni visibilitychange : la position autorisée, la liste restait
  // cachée jusqu'au rechargement de la page (audit du 19/10, LIVE-26). L'API Permissions prévient du changement ; là où elle
  // n'existe pas, rien ne change.
  useEffect(() => {
    let statut = null;
    let fini = false;
    if (typeof navigator.permissions?.query !== 'function') return undefined;
    navigator.permissions.query({ name: 'geolocation' }).then((p) => {
      if (fini || !p?.addEventListener) return;
      statut = p;
      p.addEventListener('change', verifier);
    }).catch(() => {});
    return () => { fini = true; statut?.removeEventListener('change', verifier); };
  }, [verifier]);
  return [etat, verifier];
}
