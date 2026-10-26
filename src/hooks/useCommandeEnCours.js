import { useEffect, useSyncExternalStore } from 'react';
import { api } from '../api';
import { useAuth } from '../context/AuthContext';
import useRevalidation from '../useRevalidation';

// Les commandes du client pour la bande « commande en cours » (SuiviCommande.jsx), sur tous les écrans sauf Mes commandes.
//
// UN SEUL ÉTAT POUR TOUTE L'APPLI, comme l'ancienne cloche : la Layout le monte une fois, et il ne relit /orders/mine que si
// c'est utile. Toutes les 15 s (la cadence de Mes commandes) tant qu'une commande est en cours ; sinon rien de régulier :
// une relecture à l'arrivée, à chaque changement d'écran (une commande vient peut-être d'être passée) et au retour dans
// l'app (useRevalidation). Un client sans commande en cours ne coûte donc presque rien au serveur.
const VIDE = { commandes: [] };
let etat = VIDE;
let jeton = null;
let minuterie = null;
let derniereLecture = 0;
const abonnes = new Set();

const EN_COURS = ['nouveau', 'preparation', 'pret', 'livraison'];
// Une commande « nouveau » non payée n'est pas encore partie au commerce (paiement en ligne pas fini, ou sur place jamais
// envoyée : même règle que titreSuivi dans orderStatus.jsx) : rien à suivre.
export function commandeSuivie(o) {
  return EN_COURS.includes(o.status) && !(o.status === 'nouveau' && o.paid === false);
}

function publier(commandes) {
  etat = { commandes };
  abonnes.forEach((f) => f());
  // Une commande en cours : relecture toutes les 15 s. Plus aucune : on arrête.
  const enCours = commandes.some(commandeSuivie);
  if (enCours && !minuterie) minuterie = setInterval(() => relireAvec(jeton), 15000);
  if (!enCours && minuterie) { clearInterval(minuterie); minuterie = null; }
}

function relireAvec(token) {
  if (!token) return Promise.resolve();
  derniereLecture = Date.now();
  return api('/orders/mine', { token })
    // Une réponse arrivée après une déconnexion ou un changement de compte ne doit pas montrer les commandes de l'autre.
    .then((liste) => { if (token === jeton && Array.isArray(liste)) publier(liste); })
    .catch(() => {});
}

function sAbonner(f) {
  abonnes.add(f);
  return () => abonnes.delete(f);
}
const lire = () => etat;

// `chemin` : l'écran courant. Mes commandes compris : l'app ouverte par une notification arrive directement dessus, et la
// bande doit y lire le refus pour le noter vu (SuiviCommande), sinon elle le remontrerait en rouge à l'écran suivant.
export default function useCommandeEnCours(chemin) {
  const { token, role, user } = useAuth();
  const actif = !!token && role === 'client' && !user?.isAdmin;
  const courant = useSyncExternalStore(sAbonner, lire, lire);

  // Un autre compte (ou plus de compte) repart de zéro.
  useEffect(() => {
    if (!actif) return undefined;
    jeton = token;
    return () => {
      jeton = null;
      clearInterval(minuterie);
      minuterie = null;
      etat = VIDE;
      abonnes.forEach((f) => f());
    };
  }, [actif, token]);

  // À chaque changement d'écran, au plus une fois toutes les 10 s.
  useEffect(() => {
    if (!actif) return;
    if (Date.now() - derniereLecture > 10000) relireAvec(token);
  }, [actif, token, chemin]);

  useRevalidation(() => relireAvec(token), { actif });

  return actif ? courant.commandes : VIDE.commandes;
}
