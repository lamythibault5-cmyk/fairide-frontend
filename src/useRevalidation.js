import { useEffect, useRef } from 'react';

// Rafraîchit des données en arrière-plan, sans rien d'apparent : quand l'onglet redevient visible après une
// absence, quand la fenêtre reprend le focus, quand la connexion revient. Les pages qui l'utilisent gardent
// leur affichage et remplacent simplement les données — pas de squelette, pas de rechargement visible.
// Complète les rafraîchissements périodiques (toutes les 15 s) déjà en place sur les pages « vivantes ».
const ABSENCE_MIN_MS = 20000;

export default function useRevalidation(rafraichir, { actif = true } = {}) {
  const fn = useRef(rafraichir);
  fn.current = rafraichir;
  useEffect(() => {
    if (!actif) return undefined;
    let cacheDepuis = document.visibilityState === 'hidden' ? Date.now() : null;
    let dernier = Date.now();
    const lancer = () => { if (Date.now() - dernier < 3000) return; dernier = Date.now(); try { const r = fn.current?.(); if (r && typeof r.catch === 'function') r.catch(() => {}); } catch { /* best effort */ } };
    const onVisibilite = () => {
      if (document.visibilityState === 'hidden') { cacheDepuis = Date.now(); return; }
      if (cacheDepuis && Date.now() - cacheDepuis >= ABSENCE_MIN_MS) lancer();
      cacheDepuis = null;
    };
    const onFocus = () => { if (Date.now() - dernier >= ABSENCE_MIN_MS) lancer(); };
    document.addEventListener('visibilitychange', onVisibilite);
    window.addEventListener('focus', onFocus);
    window.addEventListener('online', lancer);
    return () => {
      document.removeEventListener('visibilitychange', onVisibilite);
      window.removeEventListener('focus', onFocus);
      window.removeEventListener('online', lancer);
    };
  }, [actif]);
}
