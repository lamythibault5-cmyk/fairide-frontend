import { useLayoutEffect, useRef } from 'react';
import { Navigate, useLocation, useNavigationType } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { usePreviewMode } from '../context/PreviewModeContext';
import { espaceApresConnexion } from '../routePrefetch';
import { oublierCheminsAvant } from '../i18n/historiqueLangue';
import { retourIosSurEcran } from '../natif';

/* LE RETOUR ARRIÈRE NE SORT PAS DE SON ESPACE (fondateur, 2026-10-27, test du commerce sur iPhone : « je viens de faire un
 * swipe back sur un écran restaurant et je suis maintenant sur la page d'accueil client »).
 *
 * L'historique garde ce qu'on a vu AVANT la connexion : dans l'app, un visiteur arrive sur la liste des commerces (Home.jsx),
 * touche « Se connecter », et la connexion remplace /login par son espace — la liste reste juste derrière. Le glisser-retour
 * d'iOS (WebKit, allowsBackForwardNavigationGestures), le Retour d'Android ou celui du navigateur y ramenaient un commerce ou
 * un livreur, sur des écrans de client qui ne sont pas les siens. On ne peut pas effacer l'historique du navigateur ; on
 * remplace donc, à l'arrivée par un retour (POP), une de ces pages de visiteur par l'accueil de l'espace. Un pas de retour de
 * plus et il n'y a plus rien derrière : l'app se réduit (Android) ou le geste ne fait rien (iOS), comme sur un premier écran.
 *
 * Seulement au retour arrière : un commerce peut ouvrir une fiche ou la liste exprès (Aperçu client, lien partagé). Pas en
 * mode aperçu, où le commerce parcourt justement la vue client. Les fiches de commerce (/restaurants/:id) ne sont pas
 * visées : on y revient légitimement depuis l'aperçu. */
const PAGES_VISITEUR = new Set(['/', '/restaurants', '/map', '/recherche', '/bienvenue', '/login']);

export default function GardeRetourEspace() {
  const { user, role } = useAuth();
  const { previewMode } = usePreviewMode();
  const { pathname } = useLocation();
  const type = useNavigationType();
  /* Et dans l'app, le retour ne recule que vers un écran de l'app (natif.js, retourIosSurEcran, 2026-10-30). Un changement
   * de compte efface « l'écran d'avant » : un commerce ou un livreur qui se connecte, une déconnexion, une autre casquette.
   * Pas un visiteur qui devient client : il reprend sa commande là où il l'avait laissée. */
  const compte = user ? `${user.id}:${role}` : '';
  const compteAvant = useRef(compte);
  useLayoutEffect(() => {
    const avant = compteAvant.current;
    compteAvant.current = compte;
    if (avant !== compte && !(avant === '' && role === 'client')) oublierCheminsAvant();
    retourIosSurEcran(pathname);
  }, [compte, role, pathname]);
  if (type !== 'POP' || !user || previewMode || (role !== 'restaurant' && role !== 'driver')) return null;
  const chemin = pathname.replace(/^\/(nl|en)(?=\/|$)/, '').replace(/(.)\/$/, '$1') || '/';
  if (!PAGES_VISITEUR.has(chemin)) return null;
  return <Navigate to={espaceApresConnexion(user)} replace />;
}
