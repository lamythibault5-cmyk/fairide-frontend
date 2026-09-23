/* Constructeurs de données structurées schema.org, au format JSON-LD.

   Fonctions pures, sans React et sans DOM : c'est ce qui permettra de les réutiliser telles
   quelles depuis une fonction serveur plus tard, pour poser le JSON-LD dès le premier octet
   plutôt qu'après hydratation.

   Ce que Google en fait : le bloc Restaurant rend la fiche éligible aux résultats enrichis
   (cuisine, adresse, horaires, fourchette de prix), et le bloc Menu permet aux plats et à leurs
   prix de remonter. C'est le gain le moins cher du plan, puisque toute la donnée existe déjà. */

export const SITE_URL = 'https://fairide.be';
const LOGO_URL = `${SITE_URL}/icons/icon-512.png`;
const OG_IMAGE_URL = `${SITE_URL}/og-image.png`;

/* Les clés de `hours` côté base sont des abréviations anglaises ({mon: [{open, close}], ...}),
   un jour absent ou à tableau vide valant fermé. schema.org attend les noms complets. */
const DAY_SCHEMA = {
  mon: 'Monday', tue: 'Tuesday', wed: 'Wednesday', thu: 'Thursday',
  fri: 'Friday', sat: 'Saturday', sun: 'Sunday'
};

function clean(node) {
  // schema.org ignore les propriétés nulles, mais un validateur les signale, et elles gonflent
  // le document pour rien. On ne garde que ce qui a une valeur.
  if (Array.isArray(node)) return node.map(clean).filter((v) => v !== undefined);
  if (node && typeof node === 'object') {
    const out = {};
    Object.entries(node).forEach(([k, v]) => {
      const c = clean(v);
      if (c !== undefined && c !== null && c !== '' && !(Array.isArray(c) && c.length === 0)) out[k] = c;
    });
    return Object.keys(out).length ? out : undefined;
  }
  return node;
}

export function organizationJsonLd() {
  return clean({
    '@context': 'https://schema.org',
    '@type': 'Organization',
    name: 'Fairide',
    url: SITE_URL,
    logo: LOGO_URL,
    image: OG_IMAGE_URL,
    description: "Plateforme de livraison bruxelloise à commission plafonnée à 10 %, pour les restaurants et commerces locaux.",
    areaServed: { '@type': 'City', name: 'Bruxelles', addressCountry: 'BE' },
    contactPoint: {
      '@type': 'ContactPoint',
      contactType: 'customer support',
      email: 'contact@fairide.be',
      telephone: '+32474200713',
      areaServed: 'BE',
      availableLanguage: ['fr', 'nl', 'en']
    }
  });
}

function postalAddress(r) {
  return clean({
    '@type': 'PostalAddress',
    streetAddress: [r.addressStreet, r.addressNumber].filter(Boolean).join(' ') || r.address,
    postalCode: r.addressPostalCode,
    addressLocality: r.addressCity || r.commune,
    addressRegion: 'Bruxelles-Capitale',
    addressCountry: 'BE'
  });
}

function openingHours(hours) {
  if (!hours || typeof hours !== 'object') return undefined;
  const spec = [];
  Object.entries(DAY_SCHEMA).forEach(([key, dayName]) => {
    const shifts = Array.isArray(hours[key]) ? hours[key] : [];
    shifts.forEach((s) => {
      if (!s?.open || !s?.close) return;
      spec.push({
        '@type': 'OpeningHoursSpecification',
        dayOfWeek: `https://schema.org/${dayName}`,
        opens: s.open,
        closes: s.close
      });
    });
  });
  return spec.length ? spec : undefined;
}

function menuJsonLd(restaurant) {
  const items = (restaurant.menu || []).filter((i) => i.available !== false);
  if (!items.length) return undefined;

  // Regroupé par section quand la carte en déclare, sinon par catégorie : hasMenuSection attend
  // des groupes, et une carte à plat de soixante plats ne se lit pas.
  const groups = new Map();
  items.forEach((i) => {
    const key = i.subsection || i.category || 'Carte';
    if (!groups.has(key)) groups.set(key, []);
    groups.get(key).push(i);
  });

  return clean({
    '@type': 'Menu',
    name: `Carte de ${restaurant.name}`,
    hasMenuSection: [...groups.entries()].map(([name, list]) => ({
      '@type': 'MenuSection',
      name,
      hasMenuItem: list.map((i) => clean({
        '@type': 'MenuItem',
        name: i.name,
        description: i.desc || undefined,
        image: i.imageUrl || undefined,
        offers: {
          '@type': 'Offer',
          price: Number(i.price).toFixed(2),
          priceCurrency: 'EUR'
        }
      }))
    }))
  });
}

/* La fiche d'un commerce.

   RÈGLE DURE sur aggregateRating : la colonne `rating` vaut 4.5 par défaut en base
   (schema.sql), et l'API retombe dessus quand il n'y a aucun avis. Publier une note construite
   là-dessus reviendrait à inventer des avis : c'est une action manuelle côté Google, et une
   pratique commerciale trompeuse au sens de la directive Omnibus, appliquée en Belgique. On
   n'émet donc la note QUE si reviewCount est strictement positif. Ne pas assouplir. */
export function restaurantJsonLd(restaurant, { url }) {
  if (!restaurant) return null;
  const hasRealRating = Number(restaurant.reviewCount) > 0;

  return clean({
    '@context': 'https://schema.org',
    '@type': 'Restaurant',
    '@id': url,
    name: restaurant.name,
    url,
    description: restaurant.desc || undefined,
    image: [restaurant.coverImageUrl, restaurant.logoImageUrl].filter(Boolean),
    servesCuisine: restaurant.cuisine || undefined,
    priceRange: '€€',
    currenciesAccepted: 'EUR',
    address: postalAddress(restaurant),
    geo: (restaurant.lat && restaurant.lng)
      ? { '@type': 'GeoCoordinates', latitude: restaurant.lat, longitude: restaurant.lng }
      : undefined,
    openingHoursSpecification: openingHours(restaurant.hours),
    hasMenu: menuJsonLd(restaurant),
    aggregateRating: hasRealRating
      ? {
        '@type': 'AggregateRating',
        ratingValue: Number(restaurant.rating).toFixed(1),
        reviewCount: Number(restaurant.reviewCount),
        bestRating: '5',
        worstRating: '1'
      }
      : undefined,
    potentialAction: {
      '@type': 'OrderAction',
      target: { '@type': 'EntryPoint', urlTemplate: url, actionPlatform: 'https://schema.org/DesktopWebPlatform' },
      deliveryMethod: 'https://schema.org/OnSitePickup'
    }
  });
}

/* La liste. ItemList décrit un catalogue paginé : elle aide Google à comprendre que
   /restaurants est un index, et à suivre les liens vers chaque fiche. */
export function restaurantListJsonLd(restaurants, { url }) {
  const list = (restaurants || []).slice(0, 50);
  if (!list.length) return null;
  return clean({
    '@context': 'https://schema.org',
    '@type': 'ItemList',
    '@id': url,
    name: 'Restaurants et commerces à Bruxelles',
    numberOfItems: list.length,
    itemListElement: list.map((r, i) => ({
      '@type': 'ListItem',
      position: i + 1,
      url: `${SITE_URL}/restaurants/${r.id}`,
      name: r.name
    }))
  });
}

/* FAQPage : c'est le seul type de données structurées qui peut faire apparaître les questions
   elles-mêmes sous le résultat, et ce sont ces questions qui correspondent mot pour mot à ce que
   les gens tapent (« quelle alternative à Uber Eats à Bruxelles »).

   Google exige que chaque question et chaque réponse soient VISIBLES sur la page : une FAQ
   présente dans le balisage mais absente de l'écran vaut une action manuelle. Les paires passées
   ici sont donc exactement celles que rend OurStory.jsx, lues des mêmes clés de traduction. */
export function faqJsonLd(pairs) {
  const items = (pairs || []).filter((p) => p?.question && p?.answer);
  if (!items.length) return null;
  return clean({
    '@context': 'https://schema.org',
    '@type': 'FAQPage',
    mainEntity: items.map((p) => ({
      '@type': 'Question',
      name: p.question,
      acceptedAnswer: { '@type': 'Answer', text: p.answer }
    }))
  });
}

export function breadcrumbJsonLd(trail) {
  const items = (trail || []).filter((t) => t?.name && t?.path);
  if (items.length < 2) return null;
  return clean({
    '@context': 'https://schema.org',
    '@type': 'BreadcrumbList',
    itemListElement: items.map((t, i) => ({
      '@type': 'ListItem',
      position: i + 1,
      name: t.name,
      item: `${SITE_URL}${t.path}`
    }))
  });
}
