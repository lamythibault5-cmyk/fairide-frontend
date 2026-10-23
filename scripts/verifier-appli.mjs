// VÉRIFICATION DE L'APPLICATION — `npm run check:app`, à lancer avant chaque push (fondateur, 2026-10-15 : « je ne veux
// même pas avoir en tête qu'un bouton puisse mener à la vue du site »).
//
// Le site et l'application partagent le même code ; c'est experienceApp() (src/natif.js) qui retire, dans l'app, tout le
// cadre du site (Layout.jsx, APPLI). Ce script le prouve page par page : il démarre Vite, ouvre Chrome au format téléphone
// (375×667) EN MODE APPLICATION (le site ajouté à l'écran d'accueil : display-mode standalone), avec une session de chacun
// des profils — sans compte, client, livreur, commerce — et un serveur simulé (aucun appel au vrai serveur, aucun compte
// créé). Sur chaque page, il échoue si :
//   - l'en-tête du site, son pied de page, la rangée des liens légaux ou la carte des cookies apparaît ;
//   - la page a planté (AppErrorBoundary) — une page plantée ne montrerait aucun cadre, ce serait un faux « bon » ;
//   - la coquille de l'app manque (barre d'onglets connecté, barre d'app ou écran plein sans compte) ;
//   - un écran plein de l'app (.bv : accueil, connexion, consentement) dépasse l'écran et oblige à défiler.
// Il vérifie aussi la page /login DU SITE, hors mode app, pour s'assurer qu'elle n'a pas été touchée.
//
// Ajouter une page à l'application, c'est l'ajouter dans PAGES ci-dessous. Une page qui plante faute de données simulées
// se corrige dans `simuler()` (réponse plus réaliste), pas en la retirant de la liste.
//
// Il faut Chrome (ou Edge) installé : le pilote (playwright-core) ne télécharge aucun navigateur.
//
// LE MODE SOMBRE — `npm run check:sombre` (= ce script avec --sombre, 2026-10-23) : les mêmes pages, l'app réglée en sombre
// (theme.js). En plus des contrôles ci-dessus, il échoue sur ce qui reste clair dans la nuit : un fond clair (blanc, gris
// clair) d'au moins 300 px², une bande iris de toute la largeur (en version C, les bandes prennent la nuit), un filet clair,
// un texte à moins de 3:1 sur son fond. Les photos, cartes (plans) et le lime n'entrent pas en compte. À la fin, la liste
// des éléments fautifs regroupés (classe CSS, nombre de pages) : c'est là qu'on trouve le sélecteur à corriger dans
// src/theme-sombre.css.
import { createServer } from 'vite';
import { readFileSync } from 'node:fs';
import { chromium } from 'playwright-core';

// Réponses réelles capturées sur le serveur (dossier livreur, Mes documents) : les pages qui en lisent beaucoup de champs.
const REELLES = JSON.parse(readFileSync(new URL('./verifier-appli-donnees.json', import.meta.url), 'utf8'));

const LARGEUR = 375;
const HAUTEUR = 667;
const SOMBRE = process.argv.includes('--sombre');

const COMMERCE = {
  id: 1, name: 'Chez Simone', cuisine: 'Pizza', commune: 'Ixelles', status: 'approved', lat: 50.83, lng: 4.37, deliveryRadiusKm: 6,
  address: 'Rue du Midi 12, 1000 Bruxelles', hours: { mon: [{ open: '11:00', close: '22:00' }] }, menu: [], sections: [], offersDelivery: true, offersPickup: true
};
// ASSEZ DE COMMERCES POUR DES RANGÉES QUI DÉFILENT DE CÔTÉ (2026-10-23). Avec un seul commerce, la liste n'avait aucune rangée :
// le texte caché du badge « Prix du comptoir » qui, sorti de sa carte, rendait la page trois fois plus large que l'écran (PR
// #213, corrigé par position: relative sur .rest-card.rc) passait inaperçu. Huit commerces, la moitié au prix du comptoir.
const LISTE_COMMERCES = [COMMERCE, ...Array.from({ length: 7 }, (_, i) => ({
  ...COMMERCE, id: 100 + i, name: `Commerce ${i + 1}`, slug: `commerce-${i + 1}-ixelles`, prixComptoir: i % 2 === 0, hours: null, menu: []
}))];
// LE PAIEMENT AVEC UN PANIER (audit du 19/10, checkout-26) : /checkout sans panier renvoyait vers la liste, et le paiement de
// l'app (feuilles Codes, Allergie, Avant de commander, barre de verre) n'était jamais dessiné. Un second commerce, avec un plat,
// sert au panier posé plus bas ; le premier garde sa carte vide pour les autres pages.
const COMMERCE_PANIER = {
  ...COMMERCE, id: 2, name: 'Chez Simone 2', hours: null,
  menu: [{ id: 'p1', name: 'Margherita', price: 11, category: 'Pizzas', available: true, allergens: [], optionGroups: [] }]
};
const UTILISATEURS = {
  client: { id: 11, name: 'Cléa Client', firstName: 'Cléa', lastName: 'Client', email: 'client@exemple.be', role: 'client', roles: ['client'], phone: '+32 470 00 00 01' },
  driver: { id: 12, name: 'Lou Livreur', firstName: 'Lou', lastName: 'Livreur', email: 'livreur@exemple.be', role: 'driver', roles: ['driver'], phone: '+32 470 00 00 02' },
  restaurant: { id: 13, name: 'Rémi Resto', firstName: 'Rémi', lastName: 'Resto', email: 'resto@exemple.be', role: 'restaurant', roles: ['restaurant'], phone: '+32 470 00 00 03', restaurantId: 1 },
  // Compte de l'équipe : la console n'existe pas dans l'application (Owen, 2026-10-20), /admin… y montre AdminSurLeSite.
  admin: { id: 14, name: 'Équipe Fairide', firstName: 'Équipe', lastName: 'Fairide', email: 'contact@fairide.be', role: 'client', roles: ['client'], isAdmin: true, phone: '+32 470 00 00 04' }
};

// Pages ouvertes pour chaque profil. Les pages du site (aide, légales, « C'est bon »…) y sont exprès : dans l'app, elles
// doivent s'afficher dans la coquille de l'app, pas dans celle du site.
const COMMUNES = ['/aide', '/cgv', '/confidentialite', '/mentions-legales', '/cookies', '/classement', '/signaler', '/accessibilite', '/notre-histoire', '/une-page-qui-n-existe-pas'];
const PAGES = {
  visiteur: ['/', '/restaurants', '/restaurants/1', '/recherche', '/login', '/login?oubli=1', '/reset-password?token=essai', '/carte/valider/essai', '/equipe/essai', ...COMMUNES],
  client: ['/', '/restaurants', '/restaurants/1', '/recherche', '/panier', '/checkout', '/orders', '/favorites', '/map', '/invoices', '/account', '/order-success', '/login', '/carte/valider/essai', '/groupe/essai1234', '/equipe/essai', ...COMMUNES],
  // ?dossier= : le même dossier simulé, envoyé ou validé (DossierSuivi.jsx) ; sans lui, le brouillon réel (DossierAppli.jsx).
  driver: ['/', '/driver', '/driver/onboarding', '/driver/onboarding?dossier=pending_review', '/driver/onboarding?dossier=approved', '/driver/map', '/driver/earnings', '/driver/invoices', '/documents', '/account', ...COMMUNES],
  admin: ['/', '/admin', '/admin/cartes', '/admin/restaurants', '/account'],
  restaurant: ['/', '/dashboard', '/dashboard/menu', '/dashboard/questions', '/dashboard/orders', '/dashboard/preview', '/dashboard/promotions', '/dashboard/stats', '/dashboard/invoices', '/dashboard/guide', '/sales', '/account', '/carte/valider/essai', ...COMMUNES]
};

// Le serveur simulé. Par défaut une liste vide (sans danger : .map, .length, .filter marchent ; une propriété lue
// donne undefined comme sur un objet vide). Les réponses qui doivent être un objet sont écrites ici.
// État du dossier livreur simulé pour la page en cours (paramètre ?dossier= de PAGES), lu par simuler().
let etatDossier = null;
// Scénario du consentement biométrique (plus bas) : Stripe Identity proposé, et le consentement déjà donné ou non.
let identiteStripe = null;
function simuler(chemin, methode, profil) {
  const u = UTILISATEURS[profil];
  if (methode === 'GET' && chemin === '/couriers/me' && identiteStripe) {
    const d = structuredClone(REELLES['/couriers/me']);
    d.identityProviders = { ...d.identityProviders, stripe_identity: true };
    d.biometricConsent = identiteStripe === 'consenti';
    return d;
  }
  if (methode === 'GET' && chemin === '/couriers/me' && etatDossier) {
    const d = structuredClone(REELLES['/couriers/me']);
    Object.assign(d.courier, { lifecycleStatus: etatDossier, submittedAt: '2026-10-23T08:00:00Z', reviewedAt: etatDossier === 'approved' ? '2026-10-24T09:00:00Z' : null, statusVerifiedAt: etatDossier === 'approved' ? '2026-10-24T09:00:00Z' : null });
    d.missing = []; d.thresholds = { year: 2026, grossTotal: 214.6, withholdingTotal: 0, netTotal: 214.6, deliveries: 38 };
    return d;
  }
  // Gains (backend gainsLivreur.js) : semaines et courses, pourboire replié.
  if (methode === 'GET' && chemin === '/couriers/me/earnings') return {
    year: 2026, totals: { gross: 12.9, withholding: 0, net: 12.9, deliveries: 2 }, byMonth: [], ceiling: null,
    byWeek: [{ week: '2026-10-05', gross: 5.6, withholding: 0, net: 5.6, deliveries: 1 }, { week: '2026-10-12', gross: 0, withholding: 0, net: 0, deliveries: 0 }, { week: '2026-10-19', gross: 7.3, withholding: 0, net: 7.3, deliveries: 1 }],
    lines: [], rides: [{ id: 'e1', orderId: 'o1', kind: 'delivery', earnedAt: '2026-10-20T18:05:00Z', gross: 5.8, withholding: 0, net: 5.8, tip: 1.5, restaurantName: COMMERCE.name, commune: 'Ixelles', distanceKm: 1.2 }, { id: 'e2', orderId: 'o2', kind: 'delivery', earnedAt: '2026-10-06T19:10:00Z', gross: 5.6, withholding: 0, net: 5.6, tip: 0, restaurantName: COMMERCE.name, commune: 'Etterbeek', distanceKm: 2.1 }]
  };
  if (/^\/auth\/me$/.test(chemin)) return methode === 'GET' ? u : { ...u, user: u };
  if (/^\/auth\/terms\/current$/.test(chemin)) return { version: '2026-10-12' };
  if (methode === 'GET' && REELLES[chemin]) return REELLES[chemin];
  // Le tableau de bord du commerce (réponse réelle, identifiants UUID) : chaque page du commerce lit ensuite /restaurants/<id>/…
  if (methode === 'GET' && /^\/restaurants\/[^/]+\/compliance$/.test(chemin)) return REELLES['/restaurants/:id/compliance'];
  if (/^\/restaurants$/.test(chemin)) return LISTE_COMMERCES;
  if (/^\/restaurants\/[^/]+\/capacity$/.test(chemin)) return { full: false };
  // Statistiques du commerce (backend analytiqueCommerce.js) : 30 jours d'une petite pizzeria, forme exacte de la réponse.
  if (methode === 'GET' && /^\/restaurants\/[^/]+\/analytics$/.test(chemin)) {
    const parJour = Array.from({ length: 30 }, (_, i) => ({ jour: new Date(Date.UTC(2026, 8, 16 + i)).toISOString().slice(0, 10), commandes: (i * 7) % 5, chiffre: ((i * 7) % 5) * 21.5 }));
    return {
      jours: 30, debut: '2026-09-15T22:00:00.000Z', fin: '2026-10-15T22:00:00.000Z', commandes: 58, chiffreAffaires: 1247, panierMoyen: 21.5,
      livraison: 41, emporter: 17, refusees: 2, expirees: 1, annulees: 1, tauxAcceptation: 0.951, acceptationMedianeMin: 1.8, preparationMedianeMin: 16,
      clients: 39, clientsRevenus: 12, precedent: { commandes: 47, chiffreAffaires: 998, panierMoyen: 21.2 },
      parJour, parHeure: Array.from({ length: 24 }, (_, h) => (h >= 11 && h <= 14 ? 6 : h >= 18 && h <= 21 ? 8 : 0)),
      parJourSemaine: [6, 5, 7, 8, 11, 13, 8], topPlats: [{ nom: 'Margherita', quantite: 22, chiffre: 264 }, { nom: 'Quatre fromages', quantite: 14, chiffre: 210 }]
    };
  }
  // Mises en avant payantes : un objet ; commune pas encore ouverte à la vente, comme pour un commerce qui démarre.
  if (methode === 'GET' && /^\/restaurants\/[^/]+\/placements$/.test(chemin)) return { enabled: false, commune: 'Ixelles', sections: [], bookings: [] };
  if (chemin === '/restaurants/2') return COMMERCE_PANIER;
  // Devis du paiement (POST /orders/devis) : le total exact d'un panier de deux Margherita à emporter.
  if (methode === 'POST' && chemin === '/orders/devis') return { total: 22, subtotal: 22, promoDiscount: 0, deliveryFee: 0, deliveryDiscount: 0, balanceUsed: 0, serviceFee: 0 };
  if (/^\/restaurants\/[^/]+$/.test(chemin) && !/^\/restaurants\/(favorites|lookup)/.test(chemin)) return profil === 'restaurant' ? REELLES['/restaurants/mine/dashboard'][0] : COMMERCE;
  // Commande groupée (backend routes/commandesGroupees.js) : un groupe ouvert, vu par son hôte, avec deux parts.
  if (methode === 'GET' && /^\/group-orders\/[^/]+$/.test(chemin)) return {
    code: 'essai1234', status: 'open', isHost: true, hostFirstName: 'Cléa', restaurant: { id: 1, name: COMMERCE.name }, participants: 2, total: 27,
    lines: [{ id: 'l1', guestName: 'Cléa', mine: true, itemId: 'p1', name: 'Margherita', qty: 1, optionItemIds: [], optionsSnapshot: [], unitPrice: 9, note: null },
      { id: 'l2', guestName: 'Igor', mine: false, itemId: 'p1', name: 'Margherita', qty: 2, optionItemIds: [], optionsSnapshot: [], unitPrice: 9, note: null }]
  };
  // Invitation dans l'équipe d'un commerce (backend equipeCommerce.js).
  if (methode === 'GET' && /^\/restaurants\/team\/invitation\/[^/]+$/.test(chemin)) return { restaurantName: COMMERCE.name, emailHint: 'sa…@exemple.be', expired: false };
  // « C'est bon » (backend routes/validationCarte.js) : une petite carte aux prix magasin, avec le choix du taux offert.
  if (/^\/menu-validation\/[^/]+$/.test(chemin)) return methode === 'GET' ? {
    restaurant: { name: COMMERCE.name, responsibleName: 'Rémi Resto' }, sha256: 'essai', alreadyValidated: false,
    fairideRateChoice: { offered: true, rate: 0.1, markup: 11.1 },
    items: [
      { id: 'p1', category: 'Pizzas', name: 'Margherita', desc: 'Tomate, mozzarella, basilic', price: 11, priceWithFairideRate: 12.2, vatRate: 6 },
      { id: 'p2', category: 'Pizzas', name: 'Diavola', desc: null, price: 13, priceWithFairideRate: 14.4, vatRate: null },
      { id: 'b1', category: 'Boissons', name: 'Eau pétillante 50 cl', desc: null, price: 2.5, priceWithFairideRate: 2.8, vatRate: 21 }
    ]
  } : { version: 1 };
  if (/^\/couriers\/options$/.test(chemin)) return { statuses: ['independent', 'student_independent'], vehicles: ['velo', 'velo_electrique', 'scooter', 'voiture'], bikeMaxKm: 4, legal: {} };
  if (methode !== 'GET') return {};
  return [];
}

async function lancerNavigateur() {
  for (const channel of ['chrome', 'msedge']) {
    try { return await chromium.launch({ channel, headless: true }); } catch { /* essai suivant */ }
  }
  throw new Error('Ni Chrome ni Edge trouvé : installe Google Chrome pour lancer cette vérification.');
}

// theme : le choix clair / sombre déjà fait (sinon l'écran « Clair ou sombre ? » couvre les accueils) ; null = pas encore choisi.
async function ouvrir(navigateur, base, { profil, appli = true, consentement = 'refused', theme = SOMBRE ? 'sombre' : 'clair' }) {
  const ctx = await navigateur.newContext({ viewport: { width: LARGEUR, height: HAUTEUR }, isMobile: true, hasTouch: true, locale: 'fr-BE' });
  await ctx.addInitScript(({ appli, consentement, session, role, theme }) => {
    if (appli) {
      const original = window.matchMedia.bind(window);
      window.matchMedia = (q) => (String(q).includes('display-mode: standalone')
        ? { matches: true, media: q, addEventListener() {}, removeEventListener() {}, addListener() {}, removeListener() {} }
        : original(q));
    }
    // Erreurs de rendu (React les passe à console.error) : la dernière est citée quand une page plante.
    window.__erreurs = [];
    const consoleErreur = console.error.bind(console);
    console.error = (...a) => {
      const e = a.find((x) => x instanceof Error);
      if (e) window.__erreurs.push(`${e.message} (${(e.stack || '').split(String.fromCharCode(10))[1]?.trim().replace(/https?:\/\/[^/]+/, '') || ''})`);
      consoleErreur(...a);
    };
    // LE FLASH (fondateur, 2026-10-15 : « je vois parfois le site une fraction de seconde au chargement »). La vérification
    // regarde la page une fois posée ; ce guetteur, posé avant le premier octet, note TOUT instant où un morceau du site est
    // visible pendant le chargement — même une seule image — sauf s'il est encore caché sous l'écran de lancement (#splash).
    if (appli) {
      window.__siteVu = [];
      const guetter = () => {
        const splash = document.getElementById('splash');
        if (splash && !splash.classList.contains('splash-fin')) return;
        const visible = (sel) => [...document.querySelectorAll(sel)].some((el) => { const r = el.getBoundingClientRect(); return r.width > 0 && r.height > 0 && getComputedStyle(el).visibility !== 'hidden'; });
        for (const [nom, sel] of [['en-tête du site', '.hero .header-row'], ['pied de page du site', 'footer.site-footer'], ['liens légaux du site', '.dashboard-footer-links'], ['carte cookies du site', '[role="dialog"] a[href$="/cookies"]']]) {
          if (visible(sel) && !window.__siteVu.includes(nom)) window.__siteVu.push(nom);
        }
      };
      new MutationObserver(guetter).observe(document, { childList: true, subtree: true, attributes: true, attributeFilter: ['class', 'style'] });
    }
    if (sessionStorage.getItem('verif-init')) return;
    sessionStorage.setItem('verif-init', '1');
    localStorage.clear();
    localStorage.setItem('fairide_bienvenue', JSON.stringify({ vu: true, role: role || 'client', commune: 'Ixelles' }));
    if (consentement) { localStorage.setItem('fairide_cookie_consent', consentement); localStorage.setItem('fairide_cookie_consent_at', String(Date.now())); }
    if (session) localStorage.setItem('fairide_session', JSON.stringify(session));
    if (theme) localStorage.setItem('fairide_theme', theme);
  }, { appli, consentement, session: profil === 'visiteur' ? null : { token: `jeton-${profil}`, user: UTILISATEURS[profil] }, role: profil === 'visiteur' ? null : profil, theme });
  const page = await ctx.newPage();
  const origine = new URL(base).origin;
  await page.route('**/*', (route) => {
    const url = new URL(route.request().url());
    if (url.origin === origine) return route.continue();
    if (url.pathname.includes('/api/')) {
      const chemin = url.pathname.replace(/^.*\/api/, '');
      return route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify(simuler(chemin, route.request().method(), profil)) });
    }
    return route.abort(); // images, cartes, polices externes : inutiles ici
  });
  return { ctx, page };
}

// Ce qui reste clair dans l'app réglée en sombre (--sombre). Rend des défauts { quoi, ou } ; `ou` décrit l'élément
// (balise, deux premières classes) pour les regrouper d'une page à l'autre.
function controlerSombre() {
  const rgb = (s) => { const m = s && s.match(/rgba?\(([^)]+)\)/); if (!m) return null; const p = m[1].split(/[\s,/]+/).filter(Boolean).map(parseFloat); return { r: p[0], g: p[1], b: p[2], a: p.length > 3 ? p[3] : 1 }; };
  const canal = (v) => { v /= 255; return v <= 0.03928 ? v / 12.92 : ((v + 0.055) / 1.055) ** 2.4; };
  const lum = (c) => 0.2126 * canal(c.r) + 0.7152 * canal(c.g) + 0.0722 * canal(c.b);
  const sat = (c) => { const max = Math.max(c.r, c.g, c.b), min = Math.min(c.r, c.g, c.b); return max ? (max - min) / max : 0; };
  const clair = (c) => c && c.a > 0.5 && lum(c) > 0.45 && sat(c) < 0.3;
  const iris = (c) => c && c.a > 0.9 && Math.abs(c.r - 59) < 8 && Math.abs(c.g - 47) < 8 && Math.abs(c.b - 181) < 8;
  const melange = (c, d) => ({ r: c.r * c.a + d.r * (1 - c.a), g: c.g * c.a + d.g * (1 - c.a), b: c.b * c.a + d.b * (1 - c.a), a: 1 });
  const nom = (e) => `${e.tagName.toLowerCase()}${[...e.classList].slice(0, 2).map((c) => `.${c}`).join('')}`;
  // Un élément sans classe se décrit par le premier parent qui en a une : « div.fiche-meta > span ».
  const decrire = (e) => { if (e.classList.length) return nom(e); const p = e.parentElement?.closest('[class]'); return p ? `${nom(p)} > ${nom(e)}` : nom(e); };
  // Le fond réellement peint sous l'élément : on remonte en mélangeant les voiles ; une photo ou une carte arrête tout (null).
  const fondDe = (e) => {
    const couches = [];
    for (let x = e; x; x = x.parentElement) {
      const s = getComputedStyle(x);
      if (/url\(/.test(s.backgroundImage) || x.matches('img, video, canvas, .leaflet-container')) return null;
      const c = rgb(s.backgroundColor);
      if (c && c.a > 0) { couches.push(c); if (c.a >= 0.95) break; }
    }
    let fond = rgb(getComputedStyle(document.documentElement).backgroundColor) || { r: 255, g: 255, b: 255, a: 1 };
    if (fond.a < 1) fond = rgb(getComputedStyle(document.body).backgroundColor) || fond;
    for (const c of couches.reverse()) fond = melange(c, fond);
    return fond;
  };
  const defauts = [];
  const vus = new Set();
  const texteDe = (e) => (e.textContent || '').trim().replace(/\s+/g, ' ').slice(0, 30);
  const noter = (quoi, e, detail = '') => { const ou = decrire(e); const cle = `${quoi}|${ou}`; if (vus.has(cle)) return; vus.add(cle); defauts.push({ quoi, ou, detail: `« ${texteDe(e)} »${detail ? ` ${detail}` : ''}` }); };
  const ecrire = (c) => `rgb(${Math.round(c.r)},${Math.round(c.g)},${Math.round(c.b)})`;
  for (const e of document.querySelectorAll('body *')) {
    if (e.closest('img, svg, video, canvas, picture, .leaflet-container, #splash, [aria-hidden="true"]')) continue;
    if (!e.getClientRects().length) continue;
    const s = getComputedStyle(e);
    if (s.visibility === 'hidden' || Number(s.opacity) === 0) continue;
    const r = e.getBoundingClientRect();
    const bg = rgb(s.backgroundColor);
    // Du blanc posé sur un bouton iris (une case cochée, un rond) reste voulu.
    if (clair(bg) && r.width * r.height >= 300 && !iris(e.parentElement && fondDe(e.parentElement))) noter('fond clair', e);
    if (iris(bg) && r.width >= window.innerWidth - 8 && r.height > 40) noter('bande iris', e);
    for (const cote of ['Top', 'Bottom', 'Left', 'Right']) {
      if (parseFloat(s[`border${cote}Width`]) > 0 && s[`border${cote}Style`] !== 'none' && clair(rgb(s[`border${cote}Color`])) && !iris(e.parentElement && fondDe(e.parentElement))) { noter('filet clair', e); break; }
    }
    for (const ps of ['::before', '::after']) {
      const p = getComputedStyle(e, ps);
      if (p.content === 'none' || p.content === 'normal') continue;
      // Le bouton blanc d'un interrupteur, un point : blancs voulus, même dans la nuit.
      if (clair(rgb(p.backgroundColor)) && parseFloat(p.width) * parseFloat(p.height) >= 1100) noter(`fond clair (${ps})`, e);
    }
    const texte = [...e.childNodes].some((n) => n.nodeType === 3 && n.textContent.trim());
    if (texte) {
      const fond = fondDe(e);
      const c = rgb(s.color);
      if (fond && c && c.a > 0.3) {
        const t = melange(c, fond);
        const [a, b] = [lum(t), lum(fond)].sort((x, y) => y - x);
        if ((a + 0.05) / (b + 0.05) < 3) noter('texte peu lisible', e, `${ecrire(t)} sur ${ecrire(fond)}`);
      }
    }
  }
  return defauts;
}

async function examiner(page, { profil, appli }) {
  await page.waitForTimeout(900);
  const sombre = SOMBRE && appli ? await page.evaluate(controlerSombre) : [];
  return page.evaluate(({ profil, appli, LARGEUR_ECRAN, sombre }) => {
    const voit = (sel) => [...document.querySelectorAll(sel)].some((el) => el.getClientRects().length > 0);
    const problemes = [];
    if (voit('[data-page-plantee]')) problemes.push(`page plantée : ${(window.__erreurs || []).pop() || 'cause inconnue'}`);
    if (appli) {
      if (voit('.hero .header-row')) problemes.push('en-tête du site');
      if (voit('footer.site-footer')) problemes.push('pied de page du site');
      if (voit('.dashboard-footer-links')) problemes.push('liens légaux du site');
      if (voit('[role="dialog"] a[href="/cookies"]')) problemes.push('carte cookies du site');
      // Vu un instant pendant le chargement, puis disparu : un flash, que l'utilisateur voit quand même.
      for (const nom of window.__siteVu || []) if (!problemes.includes(nom)) problemes.push(`${nom} (flash au chargement)`);
      // Connecté : la coquille à onglets (les onglets eux-mêmes s'effacent exprès dans le parcours de commande).
      const coquille = profil === 'visiteur' ? voit('.appli-barre') || voit('.bv') : !!document.querySelector('.dashboard-shell') || voit('.bv');
      if (!coquille && !problemes.length) problemes.push("coquille de l'app absente");
      const plein = [...document.querySelectorAll('.bv')].filter((el) => el.getClientRects().length > 0).pop();
      if (plein && plein.scrollHeight > plein.clientHeight + 1) problemes.push(`écran plein trop haut (${plein.scrollHeight} px pour ${plein.clientHeight})`);
      // LA PAGE NE DÉPASSE JAMAIS L'ÉCRAN DE CÔTÉ (2026-10-23) : un élément qui sort de son cadre élargit la page entière, et le
      // téléphone la dézoome (1 080 px au lieu de 390 après la PR #213). Les rangées qui défilent de côté restent dans leur cadre.
      const largeur = document.documentElement.scrollWidth;
      if (largeur > window.innerWidth + 1 || window.innerWidth > LARGEUR_ECRAN + 1) problemes.push(`page plus large que l'écran (${Math.max(largeur, window.innerWidth)} px pour ${LARGEUR_ECRAN})`);
      if (sombre.length) problemes.push(`sombre : ${sombre.length} défaut${sombre.length > 1 ? 's' : ''}`);
    }
    return { arrivee: location.pathname + location.search, problemes, sombre };
  }, { profil, appli, LARGEUR_ECRAN: LARGEUR, sombre });
}

const serveur = await createServer({ server: { port: 0, strictPort: false }, logLevel: 'silent' });
await serveur.listen();
const base = serveur.resolvedUrls.local[0].replace(/\/$/, '');
const navigateur = await lancerNavigateur();
const resultats = [];
try {
  for (const [profil, chemins] of Object.entries(PAGES)) {
    const { ctx, page } = await ouvrir(navigateur, base, { profil });
    for (const chemin of chemins) {
      etatDossier = new URL(base + chemin).searchParams.get('dossier');
      await page.goto(base + chemin);
      resultats.push({ profil, page: chemin, ...(await examiner(page, { profil, appli: true })) });
    }
    await ctx.close();
  }
  // Le panier et le paiement AVEC un panier (checkout-26) : posé dans le stockage comme CartContext l'écrit, puis relu.
  {
    const { ctx, page } = await ouvrir(navigateur, base, { profil: 'client' });
    // La page doit avoir fini d'écrire son propre panier (vide) avant qu'on pose le nôtre, sinon elle l'écrase.
    await page.goto(`${base}/restaurants`);
    await page.waitForTimeout(1500);
    await page.evaluate(() => localStorage.setItem('fairide_cart', JSON.stringify({
      restaurantId: 2, restaurantName: 'Chez Simone 2', requestId: 'verif-panier', at: Date.now(), userId: 11,
      lines: { 'p1::': { itemId: 'p1', name: 'Margherita', imageUrl: null, optionItemIds: [], optionsSnapshot: [], unitPrice: 11, qty: 2 } }
    })));
    for (const chemin of ['/panier', '/checkout']) {
      await page.goto(base + chemin);
      resultats.push({ profil: 'client', page: `${chemin} (avec panier)`, ...(await examiner(page, { profil: 'client', appli: true })) });
    }
    await ctx.close();
  }
  // LES FENÊTRES OUVERTES DEPUIS UN ÉCRAN PLEIN (2026-10-21) : dans le dossier livreur (EcranPlein), une fenêtre s'ouvrait SOUS
  // le dossier, invisible. « Retirer mon consentement biométrique » (ConfirmDialog, pour qui l'a donné avant le 2026-10-22) doit
  // être visible ET au-dessus de tout : le point au centre de sa boîte appartient à la boîte (elementFromPoint), pas au dossier.
  // Le consentement à demander avant Stripe n'existe plus (inscription express : la pièce seule, sans selfie).
  {
    const dessus = (page, nom) => page.evaluate((nom) => {
      const boite = [...document.querySelectorAll('.modal-overlay .modal-box')].filter((el) => el.getClientRects().length > 0).pop();
      if (!boite) return [`${nom} : fenêtre absente`];
      const r = boite.getBoundingClientRect();
      const x = r.left + r.width / 2;
      const y = Math.max(0, r.top) + Math.min(r.height, window.innerHeight - Math.max(0, r.top)) / 2;
      return boite.contains(document.elementFromPoint(x, y)) ? [] : [`${nom} : fenêtre cachée sous l'écran plein`];
    }, nom);
    for (const [etat, nom, bouton] of [['consenti', 'retrait du consentement', 'Retirer mon consentement biométrique']]) {
      identiteStripe = etat;
      const { ctx, page } = await ouvrir(navigateur, base, { profil: 'driver' });
      await page.goto(`${base}/driver/onboarding`);
      const r = await examiner(page, { profil: 'driver', appli: true });
      try {
        await page.locator('.ecl-etape', { hasText: 'Pièce d’identité' }).click({ timeout: 5000 });
        await page.getByRole('button', { name: bouton }).click({ timeout: 5000 });
        await page.waitForTimeout(500);
        r.problemes.push(...(await dessus(page, nom)));
      } catch (e) { r.problemes.push(`${nom} : parcours impossible (${e.message.split('\n')[0]})`); }
      resultats.push({ profil: 'driver', page: `/driver/onboarding (${nom})`, ...r });
      await ctx.close();
    }
    identiteStripe = null;
  }
  // « CLAIR OU SOMBRE ? » À L'ARRIVÉE (2026-10-23, ChoixApparenceArrivee.jsx) : sans choix enregistré, l'écran couvre
  // l'accueil de chaque profil, tient sans défiler, « Sombre » assombrit tout l'écran, « Continuer » l'enregistre, et il ne
  // revient pas. Examiné après « Sombre » : en --sombre, il passe aussi le contrôle des couleurs.
  for (const [profil, accueil] of [['client', '/restaurants'], ['driver', '/driver'], ['restaurant', '/dashboard']]) {
    const { ctx, page } = await ouvrir(navigateur, base, { profil, theme: null });
    await page.goto(base + accueil);
    const nom = `${accueil} (clair ou sombre ? à l'arrivée)`;
    try {
      await page.locator('.ap-ecran').waitFor({ timeout: 6000 });
      await page.locator('.ap-choix').nth(1).click();
      const r = await examiner(page, { profil, appli: true });
      if (!(await page.evaluate(() => document.documentElement.classList.contains('sombre')))) r.problemes.push('« Sombre » n\'assombrit pas l\'écran');
      await page.getByRole('button', { name: 'Continuer' }).click();
      await page.waitForTimeout(400);
      if (await page.locator('.ap-ecran').count()) r.problemes.push('l\'écran reste après « Continuer »');
      if ((await page.evaluate(() => localStorage.getItem('fairide_theme'))) !== 'sombre') r.problemes.push('le choix n\'est pas enregistré');
      await page.reload(); await page.waitForTimeout(1200);
      if (await page.locator('.ap-ecran').count()) r.problemes.push('l\'écran revient après un choix');
      resultats.push({ profil, page: nom, ...r });
    } catch (e) { resultats.push({ profil, page: nom, problemes: [`écran absent ou parcours impossible (${e.message.split('\n')[0]})`] }); }
    await ctx.close();
  }
  // Premier lancement sans réponse sur les rapports de panne : ni la carte cookies du site, ni un écran plein qui bloque
  // (fondateur, 2026-10-16 : la question se pose par une case à l'inscription, au moment d'une panne et dans Mon compte).
  {
    const { ctx, page } = await ouvrir(navigateur, base, { profil: 'visiteur', consentement: null });
    await page.goto(`${base}/bienvenue`);
    resultats.push({ profil: 'visiteur', page: '/bienvenue', ...(await examiner(page, { profil: 'visiteur', appli: true })) });
    await page.goto(`${base}/restaurants`);
    const r = await examiner(page, { profil: 'visiteur', appli: true });
    if (await page.locator('#consentement-titre').count()) r.problemes.push("écran plein de consentement revenu (il a été retiré le 2026-10-16)");
    resultats.push({ profil: 'visiteur', page: '/restaurants (sans consentement)', ...r });
    await ctx.close();
  }
  // Le site, lui, garde son cadre : /login hors mode app doit être la page du site.
  {
    const { ctx, page } = await ouvrir(navigateur, base, { profil: 'visiteur', appli: false });
    await page.goto(`${base}/login`);
    const r = await examiner(page, { profil: 'visiteur', appli: false });
    if (!(await page.locator('.hero .header-row').count())) r.problemes.push("le site a perdu son en-tête sur /login");
    resultats.push({ profil: 'site', page: '/login', ...r });
    await ctx.close();
  }
} finally {
  await navigateur.close();
  await serveur.close();
}

const echecs = resultats.filter((r) => r.problemes.length);
for (const r of resultats) {
  const etat = r.problemes.length ? `ÉCHEC  ${r.problemes.join(' · ')}` : 'ok';
  const arrivee = r.arrivee && r.arrivee !== r.page ? ` → ${r.arrivee}` : '';
  console.log(`${r.profil.padEnd(10)} ${(r.page + arrivee).padEnd(52)} ${etat}`);
}
if (SOMBRE) {
  // Les défauts regroupés par élément : le même sélecteur fautif sur dix pages ne se corrige qu'une fois.
  const groupes = new Map();
  for (const r of resultats) for (const d of r.sombre || []) {
    const cle = `${d.quoi.padEnd(24)} ${d.ou}`;
    if (!groupes.has(cle)) groupes.set(cle, { pages: [], detail: d.detail });
    groupes.get(cle).pages.push(`${r.profil} ${r.page}`);
  }
  console.log(`\nMode sombre : ${groupes.size} éléments à corriger`);
  for (const [cle, { pages, detail }] of [...groupes].sort((a, b) => b[1].pages.length - a[1].pages.length)) {
    console.log(`  ${cle}   (${pages.length} page${pages.length > 1 ? 's' : ''}, ex. ${pages[0]})\n      ${detail}`);
  }
}
console.log(`\n${resultats.length} pages vérifiées en mode application${SOMBRE ? ', réglée en sombre' : ''}, ${echecs.length} en échec.`);
process.exit(echecs.length ? 1 : 0);
