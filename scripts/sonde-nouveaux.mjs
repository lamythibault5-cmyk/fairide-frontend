// SONDE DES NOUVEAUX COMPTES — `npm run sonde` (2026-11-06 ; Owen : « beaucoup de bugs avec les nouveaux utilisateurs »).
//
// check:app regarde chaque page avec un serveur simulé ; cette sonde TOUCHE. Elle ouvre des comptes neufs sur le vrai backend
// LOCAL (base de dev, jamais la production) — client, livreur en brouillon, livreur au dossier envoyé, commerce, visiteur —,
// ouvre leurs écrans au format téléphone en mode application, et touche chaque bouton là où tomberait le doigt
// (document.elementFromPoint, pas le sélecteur), puis chaque bouton de ce qui vient de s'ouvrir. Elle signale :
//   - couvert          : le doigt tombe sur autre chose que le bouton ;
//   - fenêtre cachée   : la dernière fenêtre ouverte ne reçoit pas le doigt (le bug du 05/11 : « Changer de statut ? » sous
//                        la feuille du dossier livreur — sur le code d'avant la correction, la sonde le trouve, et rien d'autre) ;
//   - plantage, erreur JavaScript, erreur serveur (5xx) ;
//   - avertissements : refus du serveur (4xx, souvent une validation normale) et « rien ne se passe » (ni écran, ni
//     requête, ni curseur ne bougent — le partage natif, absent du navigateur de test, en fait partie).
// Elle ne remplit pas de formulaire, ne paie pas, ne reçoit pas de notification, et c'est le site en mode application, pas
// l'appli native. Une passe complète : 10 à 20 minutes. À lancer avant une grosse fusion, pas à chaque envoi.
//
// Prérequis : le backend local tourne sur la base de dev (fairide-backend : `npm start`, son .env pointe la base Neon de
// dev), Chrome ou Edge installé. La sonde écrit un peu dans la base de dev, comme le ferait la personne : le numéro prouvé
// des commerces et livreurs (sinon on ne verrait que le mur du numéro, MurTelephone.jsx, testé à part par le rôle « mur »),
// le dossier envoyé du livreur « driver-envoye ». Elle prend la connexion dans le .env du backend (FAIRIDE_BACKEND, sinon
// ../fairide-backend ou ../../fairide-backend) et refuse toute base qui n'est pas Neon ; sans elle, ces rôles sont sautés.
// Chaque nuit, GitHub la lance contre un backend et une base jetables (.github/workflows/sonde-nuit.yml) ; /fairride en lit
// le résultat (scan.js › depuisSondeNuit).
//
//   npm run sonde                         tous les rôles
//   npm run sonde -- --roles client,driver
//   npm run sonde -- --max 10             moins de boutons par page (passe rapide)
// Résultats : un dossier dans le répertoire temporaire (chemin affiché) : constats.json + une capture par constat.
// Sortie 1 s'il reste un constat qui n'est pas un avertissement.
import { build, preview } from 'vite';
import { chromium } from 'playwright-core';
import { createRequire } from 'node:module';
import { appendFileSync, existsSync, mkdirSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const RACINE = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const arg = (n, d) => { const i = process.argv.indexOf(`--${n}`); return i > 0 ? process.argv[i + 1] : d; };
const API = 'http://localhost:3000/api';
const MAX = Number(arg('max', 25));
const PROF = Number(arg('prof', 8));
const EN_MEME_TEMPS = 2;
const ROLES = (arg('roles', 'client,driver,driver-envoye,restaurant,mur,visiteur')).split(',');
const PAGES = {
  visiteur: ['/', '/restaurants', '/login', '/bienvenue', '/aide'],
  client: ['/', '/restaurants', '/recherche', '/panier', '/orders', '/favorites', '/account', '/demandes'],
  driver: ['/driver', '/driver/onboarding', '/driver/earnings', '/documents', '/account'],
  'driver-envoye': ['/driver', '/driver/onboarding', '/account'],
  // Un livreur qui n'a pas encore prouvé son numéro : le mur devant son espace.
  mur: ['/driver'],
  restaurant: ['/dashboard', '/dashboard/menu', '/dashboard/orders', '/dashboard/engagements', '/dashboard/guide', '/account']
};
// Ce qu'on ne touche pas : sortir du compte, le supprimer, changer de langue (les textes changeraient sous la sonde).
const SAUTER = /d[ée]connect|log ?out|uitlog|supprimer (mon|ton|le) compte|delete (my )?account|^(fr|nl|en)( ⌄)?$|nederlands|english|^français$/i;
const AVERTISSEMENTS = ['refus-serveur', 'rien-ne-se-passe'];

// ---------- Le backend local, sur la base de dev ----------
let sante;
try { sante = await (await fetch(`${API}/health`)).json(); } catch { /* plus bas */ }
if (!sante?.ok) { console.error(`Backend local introuvable sur ${API} : lance « npm start » dans fairide-backend (base de dev).`); process.exit(2); }
if (sante.services?.stripeLive) { console.error('Ce backend a des clés Stripe réelles : la sonde ne tourne que sur la base de dev.'); process.exit(2); }

const dossierBackend = [process.env.FAIRIDE_BACKEND, path.resolve(RACINE, '../fairide-backend'), path.resolve(RACINE, '../../fairide-backend')]
  .find((d) => d && existsSync(path.join(d, 'node_modules/pg')));
// Écrit dans la base de DEV seulement : Neon (poste d'Owen, .env du backend) ou un Postgres local jetable (sonde de nuit,
// SONDE_DATABASE_URL) ; jamais Railway. false si elle n'est pas joignable.
async function ecrireBaseDev(sql, params) {
  if (!dossierBackend) return false;
  const req = createRequire(path.join(dossierBackend, 'package.json'));
  const fichierEnv = path.join(dossierBackend, '.env');
  const env = existsSync(fichierEnv) ? req('dotenv').config({ path: fichierEnv, processEnv: {} }).parsed || {} : {};
  const url = process.env.SONDE_DATABASE_URL || env.DATABASE_URL || '';
  const locale = /@(localhost|127\.0\.0\.1)[:/]/.test(url);
  if (/railway/.test(url) || !(locale || /neon\.tech/.test(url))) return false;
  const { Pool } = req('pg');
  const p = new Pool({ connectionString: url, ssl: locale ? false : { rejectUnauthorized: false } });
  try {
    const r = await p.query(sql, params);
    return r.rowCount === 1;
  } finally { await p.end(); }
}

// ---------- Le site, construit pour ce backend ----------
const SORTIE = process.env.SONDE_SORTIE || path.join(tmpdir(), 'fairride-sonde', new Date().toISOString().slice(0, 16).replace(/[:T]/g, '-'));
mkdirSync(SORTIE, { recursive: true });
const outDir = path.join(SORTIE, 'site');
process.env.VITE_API_BASE = `${API}`;
console.log('Construction du site pour le backend local…');
await build({ root: RACINE, logLevel: 'error', build: { outDir, emptyOutDir: true } });
// 5174 : un des deux ports que le CORS du backend accepte en local.
const serveurSite = await preview({ root: RACINE, logLevel: 'error', build: { outDir }, preview: { port: 5174, strictPort: true } });
const BASE = 'http://localhost:5174';

// ---------- Fonctions posées dans chaque page ----------
const OUTILS = () => {
  if (window.__s) return;
  const visible = (el) => { const r = el.getBoundingClientRect(); const cs = getComputedStyle(el); return r.width >= 4 && r.height >= 4 && cs.visibility !== 'hidden' && cs.display !== 'none' && Number(cs.opacity) > 0.05; };
  const decrire = (el) => { if (!el) return 'rien'; const c = typeof el.className === 'string' ? el.className.trim().split(/\s+/).slice(0, 3).join('.') : ''; return `${el.tagName.toLowerCase()}${c ? '.' + c : ''}${el.innerText ? ` « ${el.innerText.replace(/\s+/g, ' ').trim().slice(0, 40)} »` : ''}`; };
  const SEL = 'button, a[href], [role=button], [role=tab], [role=radio], [role=switch], [role=checkbox], summary, select, input[type=checkbox], input[type=radio]';
  const cle = (el) => `${el.tagName}|${(el.getAttribute('aria-label') || el.innerText || el.title || el.value || '').replace(/\s+/g, ' ').trim().slice(0, 60)}|${el.getAttribute('href') || ''}`;
  // Un écran plein ou une fenêtre ouverts exprès (intro, contrat à signer) : ce qui est dessous ne se touche pas, c'est voulu.
  const sousUnEcranVoulu = (h) => h.closest('[role=dialog],[aria-modal="true"],.modal-overlay') || (() => {
    for (let a = h; a && a !== document.body; a = a.parentElement) { const cs = getComputedStyle(a); const rr = a.getBoundingClientRect(); if (cs.position === 'fixed' && rr.width >= innerWidth * 0.9 && rr.height >= innerHeight * 0.9) return a; }
    return null;
  })();
  const cles = (racine) => {
    const vus = new Map(); const out = [];
    for (const el of racine.querySelectorAll(SEL)) {
      if (!visible(el) || el.disabled || el.closest('[aria-hidden="true"],[inert]')) continue;
      if (racine === document) { const r = el.getClientRects()[0] || el.getBoundingClientRect(); const h = document.elementFromPoint(r.left + r.width / 2, r.top + r.height / 2); if (h && !el.contains(h) && sousUnEcranVoulu(h)) continue; }
      const k = cle(el); const n = vus.get(k) || 0; vus.set(k, n + 1);
      out.push({ cle: k, n, texte: k.split('|')[1], href: el.getAttribute('href'), blank: el.getAttribute('target') === '_blank', nav: !!el.closest('nav, [role=tablist], footer') });
    }
    return out;
  };
  const trouver = (k, n, dans) => [...(dans || document).querySelectorAll(SEL)].filter((el) => visible(el) && cle(el) === k)[n];
  const rang = (el) => [...document.querySelectorAll(SEL)].filter((e) => visible(e) && cle(e) === cle(el)).indexOf(el);
  const fenetres = () => [...document.querySelectorAll('[role=dialog], [role=alertdialog], [aria-modal="true"]')].filter(visible);
  const etat = () => ({
    url: location.pathname + location.search,
    texte: document.body.innerText.length + ':' + document.body.innerText.slice(0, 4000),
    fen: fenetres().length,
    focus: document.activeElement && document.activeElement !== document.body ? (document.activeElement.id || document.activeElement.tagName + (document.activeElement.getAttribute('aria-label') || document.activeElement.placeholder || '')) : '',
    aria: [...document.querySelectorAll('[aria-pressed],[aria-checked],[aria-expanded],[aria-selected],details,select,input')].map((e) => `${e.getAttribute('aria-pressed')}${e.getAttribute('aria-checked')}${e.getAttribute('aria-expanded')}${e.getAttribute('aria-selected')}${e.open ?? ''}${e.value ?? ''}${e.checked ?? ''}`).join(',')
  });
  // La dernière fenêtre ouverte (les portails s'ajoutent en fin de page) doit recevoir le doigt sur ses commandes.
  const derniereCachee = () => {
    const f = fenetres(); const d = f[f.length - 1]; if (!d) return null;
    const cmds = [...d.querySelectorAll('button, a[href], input, select, textarea')].filter((e) => { if (!visible(e)) return false; const r = e.getBoundingClientRect(); return r.top >= 0 && r.left >= 0 && r.bottom <= innerHeight && r.right <= innerWidth; });
    if (!cmds.length) return null;
    let par = null;
    for (const e of cmds.slice(0, 4)) { const r = e.getBoundingClientRect(); const h = document.elementFromPoint(r.left + r.width / 2, r.top + r.height / 2); if (d.contains(h)) return null; par = h; }
    return { fenetre: (d.getAttribute('aria-label') || d.innerText || '').replace(/\s+/g, ' ').slice(0, 60), sous: decrire(par) };
  };
  window.__s = { cles, trouver, rang, etat, fenetres, derniereCachee, decrire };
};

// ---------- Un rôle ----------
async function sonderRole(navigateur, role) {
  const constats = []; let touchers = 0; let nonTestes = 0;
  const dossier = path.join(SORTIE, role); mkdirSync(dossier, { recursive: true });
  const stamp = `${Date.now()}${ROLES.indexOf(role)}`;
  let session = null;
  if (role !== 'visiteur') {
    const typeCompte = role.startsWith('driver') || role === 'mur' ? 'driver' : role;
    const corps = { firstName: 'Sonde', lastName: role, email: `sonde.${role}.${stamp}@example.test`, password: 'Velo-Bruxelles-2026!', role: typeCompte, phone: `+3247${stamp.slice(-7)}` };
    if (typeCompte === 'client') Object.assign(corps, { addressStreet: 'Rue de la Loi', addressNumber: '16', addressPostalCode: '1000', addressCity: 'Bruxelles', acceptTerms: true });
    if (typeCompte === 'driver') corps.vehicleType = 'velo';
    if (typeCompte === 'restaurant') Object.assign(corps, { legalName: 'Sonde Pizza', responsibleName: 'Sonde Resto', cuisine: 'Pizza' });
    const r = await fetch(`${API}/auth/register`, { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify(corps) });
    session = await r.json();
    if (!session.token) { console.log(`[${role}] inscription refusée (${r.status}) : ${session.error || ''} — rôle sauté`); return { role, constats, touchers, nonTestes, saute: true }; }
    const sansBase = () => { console.log(`[${role}] pas d'accès à la base de dev (.env du backend) — rôle sauté`); return { role, constats, touchers, nonTestes, saute: true }; };
    if (['driver', 'driver-envoye', 'restaurant'].includes(role) && !(await ecrireBaseDev('UPDATE users SET phone_verified = true WHERE email = $1', [corps.email]))) return sansBase();
    if (role === 'driver-envoye' && !(await ecrireBaseDev(`UPDATE couriers SET lifecycle_status = 'pending_review', submitted_at = now() WHERE user_id = (SELECT id FROM users WHERE email = $1)`, [corps.email]))) return sansBase();
    // Le compte tel que le serveur le voit maintenant (numéro prouvé).
    session.user = await (await fetch(`${API}/auth/me`, { headers: { authorization: `Bearer ${session.token}` } })).json();
  }
  const ctx = await navigateur.newContext({ viewport: { width: 375, height: 667 }, isMobile: true, hasTouch: true, locale: 'fr-BE' });
  await ctx.addInitScript(({ session, role }) => {
    const original = window.matchMedia.bind(window);
    window.matchMedia = (q) => (String(q).includes('display-mode: standalone') ? { matches: true, media: q, addEventListener() {}, removeEventListener() {}, addListener() {}, removeListener() {} } : original(q));
    window.__erreurs = [];
    const ce = console.error.bind(console);
    console.error = (...a) => { window.__erreurs.push(a.map((x) => (x instanceof Error ? x.message : String(x))).join(' ').slice(0, 300)); ce(...a); };
    // « Ton contrat a changé » (FeuilleTextesLivreur) : fermé par « Plus tard », comme le ferait le livreur ; sinon il
    // arrive un instant après la page et couvre ce qu'on allait toucher. Par onglet : chaque page de la sonde en est un.
    try { sessionStorage.setItem('fairide_textes_livreur_plus_tard', '1'); } catch { /* sans stockage */ }
    if (localStorage.getItem('__sonde')) return;
    localStorage.setItem('__sonde', '1');
    localStorage.setItem('fairide_bienvenue', JSON.stringify({ vu: true, role: role || 'client', commune: 'Ixelles' }));
    localStorage.setItem('fairide_cookie_consent', 'refused'); localStorage.setItem('fairide_cookie_consent_at', String(Date.now()));
    // L'écran « Prix du comptoir » se voit une fois : comme un client qui a touché « Compris », sinon il couvre chaque page.
    localStorage.setItem('fairide_badge_explique', 'vu');
    if (session) localStorage.setItem('fairide_session', JSON.stringify(session));
  }, { session, role: role.startsWith('driver') || role === 'mur' ? 'driver' : role === 'visiteur' ? null : role });

  const constat = async (page, type, details) => {
    const img = `c${String(constats.length + 1).padStart(3, '0')}-${type}.png`;
    await page.screenshot({ path: path.join(dossier, img) }).catch(() => {});
    constats.push({ role, type, ...details, capture: path.join(dossier, img) });
    console.log(`[${role}] ${type} : ${details.page} › ${details.chemin.join(' › ')}${details.detail ? ' — ' + details.detail : ''}`);
  };

  async function ouvrirPage(url) {
    const page = await ctx.newPage();
    const suivi = { erreurs: [], api: [], requetes: 0 };
    page.on('pageerror', (e) => suivi.erreurs.push(e.message.slice(0, 300)));
    page.on('request', (q) => { if (q.url().includes('/api/')) suivi.requetes++; });
    page.on('response', async (r) => {
      if (!r.url().includes('/api/') || r.status() < 400) return;
      let corps = ''; try { corps = (await r.text()).slice(0, 200); } catch { /* corps illisible */ }
      suivi.api.push({ statut: r.status(), methode: r.request().method(), url: r.url().replace(/^.*\/api/, ''), corps });
    });
    page.on('popup', (p) => p.close().catch(() => {}));
    try { await page.goto(BASE + url, { waitUntil: 'domcontentloaded', timeout: 30000 }); } catch { await page.waitForTimeout(3000); await page.goto(BASE + url, { waitUntil: 'domcontentloaded', timeout: 45000 }); }
    await page.waitForLoadState('networkidle', { timeout: 4000 }).catch(() => {});
    // Les squelettes de chargement d'abord : sinon la sonde ne verrait que les onglets.
    await page.waitForFunction(() => !document.querySelector('.skeleton, #splash:not(.splash-fin)'), null, { timeout: 8000 }).catch(() => {});
    await page.waitForTimeout(400);
    await page.evaluate(OUTILS);
    return { page, suivi };
  }

  async function toucher(page, suivi, cible) {
    const ok = await page.evaluate(({ cle, n }) => { const el = window.__s.trouver(cle, n); if (!el) return false; el.scrollIntoView({ block: 'center', inline: 'center', behavior: 'instant' }); return true; }, cible);
    if (!ok) return { introuvable: true };
    await page.waitForTimeout(250);
    const avant = await page.evaluate(({ cle, n }) => {
      const el = window.__s.trouver(cle, n); if (!el) return null;
      // Première ligne d'un lien replié sur deux lignes : le centre de sa boîte tomberait sur le texte d'à côté.
      const r = el.getClientRects()[0] || el.getBoundingClientRect(); const x = r.left + r.width / 2; const y = r.top + r.height / 2;
      if (x < 0 || y < 0 || x > innerWidth || y > innerHeight) return { horsEcran: true };
      const h = document.elementFromPoint(x, y);
      const couvert = !h ? 'rien' : (el === h || el.contains(h) || (h.tagName === 'LABEL' && h.contains(el)) || (el.labels && [...el.labels].some((l) => l.contains(h)))) ? null : window.__s.decrire(h);
      return { x, y, couvert, etat: window.__s.etat() };
    }, cible);
    if (!avant || avant.horsEcran) return { introuvable: true, horsEcran: !!avant?.horsEcran };
    const req0 = suivi.requetes; const err0 = suivi.erreurs.length; const api0 = suivi.api.length; const url0 = page.url();
    await page.mouse.click(avant.x, avant.y);
    await page.waitForTimeout(900);
    await page.waitForLoadState('networkidle', { timeout: 2500 }).catch(() => {});
    if (page.url() !== url0) await page.waitForTimeout(500);
    await page.evaluate(OUTILS).catch(() => {});
    const apres = await page.evaluate(() => ({ etat: window.__s.etat(), cachee: window.__s.derniereCachee(), plantee: !!document.querySelector('[data-page-plantee]'), erreurs: window.__erreurs.slice(-3) })).catch(() => null);
    return {
      couvert: avant.couvert,
      change: !apres || page.url() !== url0 || suivi.requetes > req0 || JSON.stringify(apres.etat) !== JSON.stringify(avant.etat),
      nouvelleFenetre: !!apres && apres.etat.fen > avant.etat.fen,
      cachee: apres?.cachee, plantee: apres?.plantee, erreursConsole: apres?.erreurs || [],
      erreurs: suivi.erreurs.slice(err0), api: suivi.api.slice(api0)
    };
  }

  async function juger(page, url, chemin, r) {
    const base = { page: url, chemin: chemin.map((c) => c.texte || c.cle) };
    if (r.introuvable) { if (r.horsEcran) nonTestes++; return; }
    if (r.couvert) await constat(page, 'couvert', { ...base, detail: `le doigt tombe sur ${r.couvert}` });
    if (r.cachee) await constat(page, 'fenetre-cachee', { ...base, detail: `« ${r.cachee.fenetre} » sous ${r.cachee.sous}` });
    if (r.plantee) await constat(page, 'plantage', { ...base, detail: r.erreursConsole.join(' | ') });
    for (const e of r.erreurs) await constat(page, 'erreur-js', { ...base, detail: e });
    // Stripe n'a pas de clé sur la base de dev : son refus n'est pas un défaut de l'appli.
    for (const a of r.api.filter((x) => !/Paiement indisponible|connect\/onboard/.test(x.corps + x.url))) await constat(page, a.statut >= 500 ? 'erreur-serveur' : 'refus-serveur', { ...base, detail: `${a.methode} ${a.url} ${a.statut} ${a.corps}` });
    const derniere = chemin[chemin.length - 1];
    const memePage = derniere.href && derniere.href.split('?')[0] === url.split('?')[0];
    if (!r.couvert && !r.change && !derniere.cle.startsWith('SELECT|') && !memePage) await constat(page, 'rien-ne-se-passe', base);
  }

  const dejaNav = new Set();
  for (const url of PAGES[role]) {
    let page; let suivi;
    try { ({ page, suivi } = await ouvrirPage(url)); } catch (e) { console.log(`[${role}] ${url} ne s'ouvre pas : ${e.message.split('\n')[0]}`); continue; }
    for (const e of suivi.erreurs) await constat(page, 'erreur-js', { page: url, chemin: ['(ouverture)'], detail: e });
    for (const a of suivi.api) await constat(page, a.statut >= 500 ? 'erreur-serveur' : 'refus-serveur', { page: url, chemin: ['(ouverture)'], detail: `${a.methode} ${a.url} ${a.statut} ${a.corps}` });
    if (await page.locator('[data-page-plantee]').count()) await constat(page, 'plantage', { page: url, chemin: ['(ouverture)'] });
    const cibles = (await page.evaluate(() => window.__s.cles(document)))
      .filter((c) => !SAUTER.test(c.texte) && !c.blank && !/^(https?:|tel:|mailto:|sms:|whatsapp:)/.test(c.href || '') && !(c.nav && dejaNav.has(c.cle)))
      .slice(0, MAX);
    for (const c of cibles) if (c.nav) dejaNav.add(c.cle);
    await page.close();
    console.log(`[${role}] ${url} : ${cibles.length} boutons`);
    for (const c of cibles) {
      try {
        ({ page, suivi } = await ouvrirPage(url));
        const r = await toucher(page, suivi, c); touchers++;
        await juger(page, url, [c], r);
        if (!r.nouvelleFenetre || r.couvert) { await page.close(); continue; }
        // Ce qui vient de s'ouvrir (feuille, fenêtre) : chacun de ses boutons, depuis le même départ.
        const dedans = (await page.evaluate(() => { const f = window.__s.fenetres(); return window.__s.cles(f[f.length - 1]); }))
          .filter((x) => !SAUTER.test(x.texte) && !x.blank && !/^(https?:|tel:|mailto:)/.test(x.href || '')).slice(0, PROF);
        await page.close();
        for (const d of dedans) {
          ({ page, suivi } = await ouvrirPage(url));
          const r1 = await toucher(page, suivi, c);
          if (r1.introuvable || !r1.nouvelleFenetre) { await page.close(); continue; }
          const n = await page.evaluate((d) => { const f = window.__s.fenetres(); const el = window.__s.trouver(d.cle, d.n, f[f.length - 1]); return el ? window.__s.rang(el) : -1; }, d);
          if (n < 0) { await page.close(); continue; }
          const r2 = await toucher(page, suivi, { ...d, n }); touchers++;
          await juger(page, url, [c, d], r2);
          await page.close();
        }
      } catch (e) {
        // Un chargement raté (réseau, base de dev qui coupe) : ce bouton n'est pas testé, la sonde continue.
        nonTestes++;
        console.log(`[${role}] non testé : ${url} › ${c.texte} (${e.message.split('\n')[0].slice(0, 80)})`);
        await page?.close().catch(() => {});
      }
    }
  }
  await ctx.close();
  return { role, constats, touchers, nonTestes };
}

// ---------- Tous les rôles, deux à la fois ----------
let navigateur;
for (const channel of ['chrome', 'msedge']) { try { navigateur = await chromium.launch({ channel, headless: true }); break; } catch { /* essai suivant */ } }
if (!navigateur) { console.error('Ni Chrome ni Edge trouvé.'); process.exit(2); }
const debut = Date.now();
const resultats = [];
const file = ROLES.filter((r) => PAGES[r]);
await Promise.all(Array.from({ length: EN_MEME_TEMPS }, async () => { while (file.length) resultats.push(await sonderRole(navigateur, file.shift())); }));
await navigateur.close();
await new Promise((r) => serveurSite.httpServer.close(r));

const tous = resultats.flatMap((r) => r.constats);
writeFileSync(path.join(SORTIE, 'constats.json'), JSON.stringify(tous, null, 1));
console.log(`\nSonde : ${Math.round((Date.now() - debut) / 60000)} min, résultats dans ${SORTIE}`);
for (const r of resultats) {
  const parType = {}; for (const c of r.constats) parType[c.type] = (parType[c.type] || 0) + 1;
  console.log(`  ${r.role.padEnd(14)} ${r.saute ? 'sauté' : `${r.touchers} touchers, ${r.nonTestes} non testés`}  ${Object.entries(parType).map(([t, n]) => `${t} ${n}`).join(', ') || 'rien à signaler'}`);
}
const graves = tous.filter((c) => !AVERTISSEMENTS.includes(c.type));
// Sur GitHub (sonde de nuit) : le résumé sur la page du run ; /fairride lit, lui, constats.json dans l'artifact.
if (process.env.GITHUB_STEP_SUMMARY) {
  const lignes = ['## Sonde des nouveaux comptes', '', ...resultats.map((r) => `- **${r.role}** : ${r.saute ? 'sauté' : `${r.touchers} touchers`}, ${r.constats.length} constat(s)`), ''];
  if (graves.length) lignes.push('### À corriger', '', ...graves.map((c) => `- ${c.role} · ${c.type} · ${c.page} › ${c.chemin.join(' › ')}${c.detail ? ` — ${c.detail}` : ''}`));
  else lignes.push('Aucun constat grave.');
  appendFileSync(process.env.GITHUB_STEP_SUMMARY, lignes.join('\n') + '\n');
}
console.log(graves.length ? `\n${graves.length} constat(s) à regarder (captures dans le dossier ci-dessus).` : '\nAucun constat grave.');
// Sur GitHub, un rôle sauté (base injoignable) rend la nuit rouge : sinon elle serait verte sans avoir tout testé.
const sautes = resultats.filter((r) => r.saute).map((r) => r.role);
if (process.env.CI && sautes.length) console.log(`Rôles sautés (${sautes.join(', ')}) : la sonde n'a pas tout testé.`);
process.exit(graves.length || (process.env.CI && sautes.length) ? 1 : 0);
