import { useEffect } from 'react';

const SITE_URL = 'https://fairide.be';
const DEFAULT_TITLE = 'Fairide — Livraison de repas et commerces locaux à Bruxelles, commission réduite';

// index.html ne sert qu'un seul document statique (SPA) : sa balise <link rel="canonical"> pointe donc
// en dur vers "/" sur TOUTES les routes, y compris /mentions-legales, /cgv et /confidentialite — Google
// lisait ça comme "cette page n'est qu'un doublon de la page d'accueil, indexe l'accueil à la place" et
// n'indexait jamais les pages légales (voir Search Console : "Autre page avec balise canonique correcte"
// sur des pages qu'on veut pourtant voir indexées séparément). Ce hook met à jour le titre et le canonical
// une fois la page montée, pour chaque route qui doit être indexable pour elle-même.
export default function usePageMeta({ title, path }) {
  useEffect(() => {
    const prevTitle = document.title;
    document.title = title || DEFAULT_TITLE;
    const canonical = document.querySelector('link[rel="canonical"]');
    const prevHref = canonical?.href;
    if (canonical) canonical.href = `${SITE_URL}${path || '/'}`;
    return () => {
      document.title = prevTitle;
      if (canonical && prevHref) canonical.href = prevHref;
    };
  }, [title, path]);
}
