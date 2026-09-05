import { useEffect } from 'react';
import { useLanguage } from '../context/LanguageContext';

const SITE_URL = 'https://fairide.be';
const DEFAULT_TITLES = {
  fr: 'Fairide — Livraison de repas et commerces locaux à Bruxelles, commission réduite',
  en: 'Fairide — Meal delivery and local businesses in Brussels, reduced commission',
  nl: 'Fairide — Maaltijdbezorging en lokale zaken in Brussel, verlaagde commissie'
};

// index.html ne sert qu'un seul document statique (SPA) : sa balise <link rel="canonical"> pointe donc
// en dur vers "/" sur TOUTES les routes, y compris /mentions-legales, /cgv et /confidentialite — Google
// lisait ça comme "cette page n'est qu'un doublon de la page d'accueil, indexe l'accueil à la place" et
// n'indexait jamais les pages légales (voir Search Console : "Autre page avec balise canonique correcte"
// sur des pages qu'on veut pourtant voir indexées séparément). Ce hook met à jour le titre et le canonical
// une fois la page montée, pour chaque route qui doit être indexable pour elle-même.
export default function usePageMeta({ title, path }) {
  const { language } = useLanguage();
  useEffect(() => {
    const prevTitle = document.title;
    document.title = title || DEFAULT_TITLES[language] || DEFAULT_TITLES.fr;
    const canonical = document.querySelector('link[rel="canonical"]');
    const prevHref = canonical?.href;
    if (canonical) canonical.href = `${SITE_URL}${path || '/'}`;
    return () => {
      document.title = prevTitle;
      if (canonical && prevHref) canonical.href = prevHref;
    };
  }, [title, path, language]);
}
