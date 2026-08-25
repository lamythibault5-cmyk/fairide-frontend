import { createContext, useContext, useState } from 'react';

const PreviewModeContext = createContext(null);
const STORAGE_KEY = 'fairide_preview_mode';

// Permet à un restaurateur d'explorer l'app comme un vrai client (liste des restos, favoris, commandes,
// carte, panier flottant...) depuis son propre compte, sans en créer un second. Persisté en sessionStorage
// (survit à un rafraîchissement de page, mais pas à la fermeture de l'onglet) plutôt qu'en state React
// pur — naviguer entre /dashboard/preview et /restaurants recharge des composants différents, perdre le
// mode aperçu à chaque clic rendrait la fonctionnalité inutilisable.
export function PreviewModeProvider({ children }) {
  const [previewMode, setPreviewMode] = useState(() => sessionStorage.getItem(STORAGE_KEY) === '1');

  function enterPreview() {
    sessionStorage.setItem(STORAGE_KEY, '1');
    setPreviewMode(true);
  }

  function exitPreview() {
    sessionStorage.removeItem(STORAGE_KEY);
    setPreviewMode(false);
  }

  return (
    <PreviewModeContext.Provider value={{ previewMode, enterPreview, exitPreview }}>
      {children}
    </PreviewModeContext.Provider>
  );
}

export function usePreviewMode() {
  return useContext(PreviewModeContext);
}
