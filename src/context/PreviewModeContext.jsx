import { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react';

const PreviewModeContext = createContext(null);
const STORAGE_KEY = 'fairide_preview_mode';

// Permet à un restaurateur d'explorer l'app comme un vrai client (liste des restos, favoris, commandes,
// carte, panier flottant...) depuis son propre compte, sans en créer un second. Persisté en sessionStorage
// (survit à un rafraîchissement de page, mais pas à la fermeture de l'onglet) plutôt qu'en state React
// pur — naviguer entre /dashboard/preview et /restaurants recharge des composants différents, perdre le
// mode aperçu à chaque clic rendrait la fonctionnalité inutilisable.
export function PreviewModeProvider({ children }) {
  const [previewMode, setPreviewMode] = useState(() => sessionStorage.getItem(STORAGE_KEY) === '1');

  /* useCallback sans dépendance : ces deux fonctions ne lisent aucune variable du rendu, seulement
     setPreviewMode (stable) et sessionStorage. Leur identité peut donc rester la même pour toute la
     vie du fournisseur — ce qui est la condition pour que la valeur ci-dessous soit mémoïsable. */
  const enterPreview = useCallback(() => {
    sessionStorage.setItem(STORAGE_KEY, '1');
    setPreviewMode(true);
  }, []);

  const exitPreview = useCallback(() => {
    sessionStorage.removeItem(STORAGE_KEY);
    setPreviewMode(false);
  }, []);

  // La déconnexion termine l'aperçu (audit du 19/10, shop-415) : le compte suivant, dans le même onglet ou la même app,
  // démarrait en mode aperçu avec la barre d'onglets du client. AuthContext annonce la déconnexion par cet événement.
  useEffect(() => {
    window.addEventListener('fairide:deconnexion', exitPreview);
    return () => window.removeEventListener('fairide:deconnexion', exitPreview);
  }, [exitPreview]);

  // Sans cette mémoïsation, chaque rendu d'un fournisseur EXTÉRIEUR (langue, toast, session) faisait
  // passer une valeur neuve mais identique, et re-rendait tout ce qui appelle usePreviewMode().
  const value = useMemo(() => ({ previewMode, enterPreview, exitPreview }), [previewMode, enterPreview, exitPreview]);

  return (
    <PreviewModeContext.Provider value={value}>
      {children}
    </PreviewModeContext.Provider>
  );
}

export function usePreviewMode() {
  return useContext(PreviewModeContext);
}
