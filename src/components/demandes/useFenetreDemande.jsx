import { useState } from 'react';
import { createPortal } from 'react-dom';
import { useLocation, useNavigate } from 'react-router-dom';
import { useAuth } from '../../context/AuthContext';
import FenetreDemande from './FenetreDemande';

/* Ouvrir la fenêtre depuis n'importe quel écran. Sans compte, on passe d'abord par la connexion (une demande compte une
 * personne), et Auth.jsx ramène ici après. `onDemande` : l'écran rafraîchit ses nombres.
 *
 * UNE SEULE PAGE POUR VOIR ET DEMANDER (fondateur, 2026-11-12, maquettes/accueil-plein, réponse 9 bis) : la fenêtre est aussi
 * la page « Demandés près de toi ». `mode` dit comment elle s'ouvre :
 *   - 'demander' (par défaut : « Le tien ? », « Il en manque un ? », la carte de fin, la recherche sans résultat) : le champ
 *     prêt, clavier levé ;
 *   - 'voir' (« Voir les N », le titre de la rangée, le rappel dans « Tous ») : la liste, clavier baissé.
 * `categorie` (« Il en manque un ? » au bout d'une rangée par envie) : la liste s'ouvre sur cette catégorie. */
export default function useFenetreDemande(onDemande) {
  const { user } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();
  const [ouverte, setOuverte] = useState(null); // { requete, mode, categorie }
  const ouvrir = (texte = '', { mode = 'demander', categorie = '' } = {}) => {
    if (!user) { navigate('/login?audience=client', { state: { from: location.pathname + location.search } }); return; }
    setOuverte({ requete: texte || '', mode, categorie });
  };
  const fenetre = ouverte !== null
    ? createPortal(<FenetreDemande requete={ouverte.requete} mode={ouverte.mode} categorie={ouverte.categorie}
      onFermer={() => setOuverte(null)} onDemande={onDemande} />, document.body)
    : null;
  return { ouvrir, fenetre };
}
