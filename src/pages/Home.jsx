import { Navigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { experienceApp } from '../natif';
import { lireBienvenue, lireReprise } from '../bienvenue';
import Landing from './Landing';

export default function Home() {
  const { user, role } = useAuth();
  if (!user) {
    // DANS L'APPLICATION, pas de page vitrine : elle est faite pour convaincre un visiteur du site, pas quelqu'un
    // qui a déjà installé l'app. Premier lancement → l'accueil de l'application ; ensuite → directement la liste
    // des commerces, rangée autour de la commune donnée à l'accueil (communeProche, comme HeroAdresse sur le site).
    if (experienceApp()) {
      const b = lireBienvenue();
      // Un accueil commencé et laissé avant le compte se reprend là où il s'était arrêté (bienvenue.js, lireReprise).
      if (!b.vu || lireReprise()) return <Navigate to="/bienvenue" replace />;
      return <Navigate to="/restaurants" replace state={b.commune ? { communeProche: b.commune } : undefined} />;
    }
    return <Landing />;
  }
  // Pas de console dans l'application (Owen, 2026-10-20) : un compte admin y est traité selon son rôle, comme les autres.
  if (user.isAdmin && !experienceApp()) return <Navigate to="/admin" replace />;
  // Commandes est l'accueil du commerce (fondateur, 2026-10-27 ; DashboardSidebar.jsx).
  if (role === 'restaurant') return <Navigate to="/dashboard/orders" replace />;
  if (role === 'driver') return <Navigate to="/driver" replace />;
  // Un client atterrit directement sur la liste des restaurants. Il passait auparavant par /home,
  // qui n'affichait qu'un titre de bienvenue et un bouton « Parcourir les restaurants » — donc une
  // page entière dont la seule fonction était d'en proposer une autre. Son suivi de commande était
  // par ailleurs un sous-ensemble strict de /orders (même badge, même barre de progression, même
  // carte de suivi, même code de livraison), qui reste accessible depuis la navigation. Page
  // supprimée, pas seulement contournée.
  return <Navigate to="/restaurants" replace />;
}
