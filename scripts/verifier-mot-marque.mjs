// VÉRIFICATION DU MOT-LOGO — `npm run check:marque` (fondateur, 2026-10-27 : « fairride doit toujours ressembler à celui de la
// page d'accueil, même taille, deux couleurs »). Dans la barre latérale du site, une règle sur les span de son conteneur
// passait « ride » à 19 px et à l'encre, à côté d'un « fair » de 26 px.
//
// Ce script démarre Vite, ouvre Chrome avec un serveur simulé (aucun appel au vrai serveur), sur le site (ordinateur 1280 px
// et téléphone 390 px) et en mode application, sans compte puis en client, livreur et commerce, et mesure chaque mot-logo
// visible (.wordmark, MotMarque.jsx). Il échoue si :
//   - un .wordmark n'a pas son « ride » à part (une seule couleur : le mot a été écrit à la main) ;
//   - « ride » n'a pas la police, la taille, la graisse ou l'interlettrage de « fair » ;
//   - « ride » a la couleur de « fair », ou une autre que l'iris (sur fond clair) ou le lime (sur l'iris).
// L'écran de chargement (#splash, index.html) et public/404.html écrivent le mot à la main : hors de ce script.
//
// Il faut Chrome (ou Edge) installé : le pilote (playwright-core) ne télécharge aucun navigateur.
import { createServer } from 'vite';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import path from 'node:path';
import { chromium } from 'playwright-core';

const front = path.join(path.dirname(fileURLToPath(import.meta.url)), '..');
const REELLES = JSON.parse(readFileSync(new URL('./verifier-appli-donnees.json', import.meta.url), 'utf8'));

const U = {
  client: { id: 11, name: 'Cléa Client', firstName: 'Cléa', lastName: 'Client', email: 'client@exemple.be', role: 'client', roles: ['client'], phone: '+32 470 00 00 01', phoneVerified: true, emailVerified: true },
  driver: { id: 12, name: 'Lou Livreur', firstName: 'Lou', lastName: 'Livreur', email: 'livreur@exemple.be', role: 'driver', roles: ['driver'], phone: '+32 470 00 00 02', phoneVerified: true, emailVerified: true },
  restaurant: { id: 13, name: 'Rémi Resto', firstName: 'Rémi', lastName: 'Resto', email: 'resto@exemple.be', role: 'restaurant', roles: ['restaurant'], phone: '+32 470 00 00 03', restaurantId: 1, phoneVerified: true, emailVerified: true }
};
const COMMERCE = { id: 1, name: 'Chez Simone', cuisine: 'Pizza', commune: 'Ixelles', status: 'approved', lat: 50.83, lng: 4.37, address: 'Rue du Midi 12', menu: [], sections: [], offersDelivery: true, offersPickup: true };
const LANCEMENT = { go: true, pickupOpen: true, deliveryOpen: true, onlinePaymentOpen: true, ordersOpen: true };
function simuler(chemin, methode, profil) {
  const u = U[profil];
  if (chemin === '/auth/me' && u) return methode === 'GET' ? u : { ...u, user: u };
  if (chemin === '/auth/terms/current') return { version: '2026-10-12' };
  if (chemin === '/orders/launch') return LANCEMENT;
  if (chemin === '/restaurants') return [COMMERCE];
  if (/^\/restaurants\/(mine|1)$/.test(chemin)) return COMMERCE;
  if (REELLES[chemin]) return REELLES[chemin];
  if (methode !== 'GET') return {};
  return [];
}

const SITE = {
  visiteur: ['/', '/restaurants', '/aide', '/cgv', '/notre-histoire', '/login', '/classement', '/une-page-qui-n-existe-pas'],
  client: ['/restaurants', '/account', '/orders', '/aide', '/cgv'],
  driver: ['/driver', '/account'],
  restaurant: ['/dashboard', '/account']
};
const APPLI = { visiteur: ['/', '/restaurants', '/login'], client: ['/restaurants', '/account', '/aide'], driver: ['/driver'], restaurant: ['/dashboard'] };
const CAS = [];
for (const [p, l] of Object.entries(SITE)) for (const c of l) for (const largeur of [1280, 390]) CAS.push({ profil: p, chemin: c, largeur, appli: false });
for (const [p, l] of Object.entries(APPLI)) for (const c of l) CAS.push({ profil: p, chemin: c, largeur: 390, appli: true });

const serveur = await createServer({ root: front, configFile: path.join(front, 'vite.config.js'), server: { port: 0, strictPort: false }, logLevel: 'silent' });
await serveur.listen();
const base = serveur.resolvedUrls.local[0].replace(/\/$/, '');
let nav;
for (const channel of ['chrome', 'msedge']) { try { nav = await chromium.launch({ channel, headless: true }); break; } catch { /* next */ } }

let fautes = 0;
const vus = new Set();
for (const { profil, chemin, largeur, appli } of CAS) {
  const ctx = await nav.newContext({ viewport: { width: largeur, height: 900 }, deviceScaleFactor: 2, isMobile: largeur < 900, hasTouch: largeur < 900, locale: 'fr-BE' });
  await ctx.addInitScript(({ session, appli, role }) => {
    if (appli) {
      const original = window.matchMedia.bind(window);
      window.matchMedia = (q) => (String(q).includes('display-mode: standalone')
        ? { matches: true, media: q, addEventListener() {}, removeEventListener() {}, addListener() {}, removeListener() {} } : original(q));
    }
    if (sessionStorage.getItem('init')) return;
    sessionStorage.setItem('init', '1');
    localStorage.clear();
    if (session || role === 'restaurant') localStorage.setItem('fairide_bienvenue', JSON.stringify({ vu: true, role: role === 'visiteur' ? 'client' : role, commune: 'Ixelles' }));
    localStorage.setItem('fairide_cookie_consent', 'refused'); localStorage.setItem('fairide_cookie_consent_at', String(Date.now()));
    if (session) localStorage.setItem('fairide_session', JSON.stringify(session));
  }, { session: U[profil] ? { token: 'jeton', user: U[profil] } : null, appli, role: profil });
  const page = await ctx.newPage();
  const origine = new URL(base).origin;
  await page.route('**/*', (route) => {
    const url = new URL(route.request().url());
    if (url.origin === origine) return route.continue();
    if (url.pathname.includes('/api/')) return route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify(simuler(url.pathname.replace(/^.*\/api/, ''), route.request().method(), profil)) });
    return route.abort();
  });
  await page.goto(base + chemin, { waitUntil: 'networkidle' });
  await page.waitForTimeout(1800);
  const mots = await page.evaluate(() => {
    const vis = (e) => e.getClientRects().length && getComputedStyle(e).visibility !== 'hidden';
    const out = [];
    for (const m of document.querySelectorAll('.wordmark')) {
      if (!vis(m) || m.closest('#splash')) continue;
      const r = m.querySelector('.wordmark-ride');
      const a = getComputedStyle(m);
      const lieu = (m.parentElement?.className || m.parentElement?.tagName || '') + ' > ' + m.className;
      if (!r) { out.push({ lieu, faute: 'pas de « ride » à part (une seule couleur)', texte: m.textContent }); continue; }
      const b = getComputedStyle(r);
      const fautes = [];
      if (a.fontSize !== b.fontSize) fautes.push(`taille ${a.fontSize} / ride ${b.fontSize}`);
      if (a.fontWeight !== b.fontWeight) fautes.push(`graisse ${a.fontWeight} / ride ${b.fontWeight}`);
      if (a.fontFamily !== b.fontFamily) fautes.push('police différente');
      if (a.letterSpacing !== b.letterSpacing) fautes.push(`interlettrage ${a.letterSpacing} / ride ${b.letterSpacing}`);
      if (a.color === b.color) fautes.push(`une seule couleur ${a.color}`);
      if (!['rgb(59, 47, 181)', 'rgb(200, 240, 60)'].includes(b.color)) fautes.push(`ride en ${b.color}`);
      out.push({ lieu, taille: a.fontSize, fair: a.color, ride: b.color, faute: fautes.join(', ') });
    }
    return out;
  });
  const nom = `${appli ? 'appli' : 'site'}-${largeur}-${profil}${chemin.replace(/\//g, '-')}`;
  for (const m of mots) {
    const cle = `${appli ? 'appli' : 'site'} ${largeur} ${m.lieu}`;
    if (m.faute) { fautes++; console.log('FAUTE', nom, '|', m.lieu, '|', m.faute); }
    else if (!vus.has(cle)) { vus.add(cle); console.log('ok   ', nom, '|', m.lieu, '|', m.taille, m.fair, '/', m.ride); }
  }
  await ctx.close();
}
await nav.close();
await serveur.close();
console.log(fautes ? `${fautes} mot(s)-logo faux` : 'tous les mots-logos : même taille, deux couleurs');
process.exit(fautes ? 1 : 0);
