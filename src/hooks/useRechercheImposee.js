import { useEffect } from 'react';
import { useLocation } from 'react-router-dom';

/* LA RECHERCHE GLOBALE DE LA CONSOLE MÈNE AUSSI À LA PAGE OUVERTE (2026-10-25). Elle navigue vers la page du résultat avec
 * `state: { presetSearch }` (AdminGlobalSearch.jsx, AdminListTools.jsx). Les pages ne lisaient ce nom qu'à leur ouverture ;
 * déjà sur Commerces avec une autre recherche, la page restait montée (AdminLayout ne la remonte qu'au changement d'adresse)
 * et l'ancienne liste restait affichée. Même défaut qu'au retour de Stripe dans le dossier livreur : une valeur lue une fois.
 * `appliquer` reçoit le nom à chaque navigation qui en porte un. */
export default function useRechercheImposee(appliquer) {
  const location = useLocation();
  const nom = location.state?.presetSearch;
  useEffect(() => { if (nom) appliquer(nom); }, [location.key]); // eslint-disable-line react-hooks/exhaustive-deps
}
