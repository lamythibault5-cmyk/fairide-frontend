import { useEffect } from 'react';
import { useLanguage } from '../context/LanguageContext';
import { SITE_URL } from '../seo/jsonLd';

const DEFAULT_TITLES = {
  fr: 'Fairide — Livraison de repas et commerces locaux à Bruxelles, commission réduite',
  en: 'Fairide — Meal delivery and local businesses in Brussels, reduced commission',
  nl: 'Fairide — Maaltijdbezorging en lokale zaken in Brussel, verlaagde commissie'
};
const DEFAULT_IMAGE = `${SITE_URL}/og-image.png`;
const OG_LOCALE = { fr: 'fr_BE', nl: 'nl_BE', en: 'en_GB' };
const MAX_DESCRIPTION = 160;

// index.html ne sert qu'un seul document statique (SPA) : sa balise <link rel="canonical"> pointe donc
// en dur vers "/" sur TOUTES les routes, y compris /mentions-legales, /cgv et /confidentialite — Google
// lisait ça comme "cette page n'est qu'un doublon de la page d'accueil, indexe l'accueil à la place" et
// n'indexait jamais les pages légales (voir Search Console : "Autre page avec balise canonique correcte"
// sur des pages qu'on veut pourtant voir indexées séparément).
//
// Le même raisonnement vaut, en pire, pour la description et les balises og:* : elles restaient elles
// aussi celles de l'accueil sur toutes les routes, si bien que TOUT lien partagé sur WhatsApp, Slack ou
// Facebook — y compris une fiche de commerce précise — affichait la même vignette générique. Ce hook
// réécrit donc l'ensemble une fois la page montée, puis restaure l'état précédent au démontage.
//
// Limite connue, et c'est l'objet de la Phase E du plan : la réécriture a lieu APRÈS hydratation.
// Google exécute le JavaScript et voit les bonnes valeurs, mais les robots d'aperçu social n'en
// exécutent jamais et continueront de lire le document statique. Seule une injection côté serveur
// règle ce cas.

function truncate(text) {
  if (!text) return undefined;
  const flat = String(text).replace(/\s+/g, ' ').trim();
  if (flat.length <= MAX_DESCRIPTION) return flat;
  // Coupé au dernier mot entier : un extrait Google qui s'arrête au milieu d'un mot se voit.
  const cut = flat.slice(0, MAX_DESCRIPTION - 1);
  return `${cut.slice(0, cut.lastIndexOf(' ')).trimEnd()}…`;
}

// Crée la balise si elle manque plutôt que d'abandonner : index.html ne porte pas toutes celles
// qu'on veut piloter (og:locale, twitter:url), et une balise absente ne doit pas faire retomber
// silencieusement la page sur les métadonnées de l'accueil.
function setMeta(selector, value, createAttrs) {
  let el = document.head.querySelector(selector);
  if (!el && createAttrs) {
    el = document.createElement('meta');
    Object.entries(createAttrs).forEach(([k, v]) => el.setAttribute(k, v));
    document.head.appendChild(el);
  }
  if (!el) return null;
  const prev = el.getAttribute('content');
  el.setAttribute('content', value);
  return () => { if (prev !== null) el.setAttribute('content', prev); };
}

export default function usePageMeta({ title, description, path, image, type = 'website' }) {
  const { language } = useLanguage();
  useEffect(() => {
    const restorers = [];
    const url = `${SITE_URL}${path || '/'}`;
    const finalTitle = title || DEFAULT_TITLES[language] || DEFAULT_TITLES.fr;
    const finalDescription = truncate(description);
    const finalImage = image || DEFAULT_IMAGE;
    const push = (r) => { if (r) restorers.push(r); };

    const prevTitle = document.title;
    document.title = finalTitle;
    restorers.push(() => { document.title = prevTitle; });

    const canonical = document.head.querySelector('link[rel="canonical"]');
    if (canonical) {
      const prevHref = canonical.href;
      canonical.href = url;
      restorers.push(() => { canonical.href = prevHref; });
    }

    // <html lang> était figé sur "fr" dans index.html : une page en néerlandais s'annonçait comme
    // française, ce que les lecteurs d'écran comme les moteurs prennent au mot.
    const prevLang = document.documentElement.lang;
    document.documentElement.lang = language;
    restorers.push(() => { document.documentElement.lang = prevLang; });

    if (finalDescription) {
      push(setMeta('meta[name="description"]', finalDescription, { name: 'description' }));
      push(setMeta('meta[property="og:description"]', finalDescription, { property: 'og:description' }));
      push(setMeta('meta[name="twitter:description"]', finalDescription, { name: 'twitter:description' }));
    }
    push(setMeta('meta[property="og:title"]', finalTitle, { property: 'og:title' }));
    push(setMeta('meta[name="twitter:title"]', finalTitle, { name: 'twitter:title' }));
    push(setMeta('meta[property="og:url"]', url, { property: 'og:url' }));
    push(setMeta('meta[property="og:image"]', finalImage, { property: 'og:image' }));
    push(setMeta('meta[name="twitter:image"]', finalImage, { name: 'twitter:image' }));
    push(setMeta('meta[property="og:type"]', type, { property: 'og:type' }));
    push(setMeta('meta[property="og:locale"]', OG_LOCALE[language] || 'fr_BE', { property: 'og:locale' }));

    return () => restorers.forEach((r) => r());
  }, [title, description, path, image, type, language]);
}
