import { useState } from 'react';
import { createPortal } from 'react-dom';
import { useLocation, useNavigate } from 'react-router-dom';
import { useAuth } from '../../context/AuthContext';
import FenetreDemande from './FenetreDemande';

/* Ouvrir la fenêtre depuis n'importe quel écran. Sans compte, on passe d'abord par la connexion (une demande compte une
 * personne), et Auth.jsx ramène ici après. `onDemande` : l'écran rafraîchit ses nombres. */
export default function useFenetreDemande(onDemande) {
  const { user } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();
  const [requete, setRequete] = useState(null);
  const ouvrir = (texte = '') => {
    if (!user) { navigate('/login?audience=client', { state: { from: location.pathname + location.search } }); return; }
    setRequete(texte);
  };
  const fenetre = requete !== null
    ? createPortal(<FenetreDemande requete={requete} onFermer={() => setRequete(null)} onDemande={onDemande} />, document.body)
    : null;
  return { ouvrir, fenetre };
}
