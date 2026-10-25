// VÉRIFICATION DES BARRES DU BAS — `npm run check:barres` (fondateur, 2026-10-21, décision 11 : sur l'Android de son père, la
// barre du bas de la console flottait au-dessus du bord, avec un vide dessous ; elle doit toujours être collée au bas).
//
// La barre d'onglets du bas (.dashboard-sidebar sous 900 px) est la même pour les quatre espaces : console admin, client,
// commerce, livreur. Ce script démarre Vite, ouvre Chrome au format d'un téléphone Android (360×740 puis 412×915, tactile),
// avec un serveur simulé (aucun appel au vrai serveur), et pour chaque espace, sur le site ET en mode application (site
// ajouté à l'écran d'accueil), vérifie que :
//   - le bord bas de la barre (son conteneur fixé) est exactement le bas de l'écran (innerHeight, et le bas du visualViewport) ;
//   - la pilule des onglets se pose à max(6 px, marge du système − 12 px) de ce bord, jamais plus haut (elle mord de 12 px
//     dans la zone du système depuis le 2026-10-25 : --bas-ecran, styles.css) ;
//   - c'est encore vrai quand la barre d'adresse se replie (simulé : la fenêtre gagne 56 px de haut, puis les reperd),
//     après un défilement (la barre se réduit aux icônes), et quand le visualViewport change (simulé : sa hauteur et son
//     décalage sont modifiés puis ses événements resize et scroll envoyés — aucun code ne doit alors déplacer la barre) ;
//   - aucun ancêtre de la barre ne crée de bloc conteneur pour position: fixed (transform, filter, contain, perspective,
//     backdrop-filter, will-change) : la barre serait alors calée sur cet élément et non sur l'écran ;
//   - avec une marge du système simulée de 48 px (barre de navigation d'Android à trois boutons) quand ce Chrome sait
//     l'émuler (Emulation.setSafeAreaInsetsOverride), la pilule s'y pose à 36 px du bas (48 − 12), toujours sans vide.
//
// Ce qu'un navigateur de bureau NE PEUT PAS prouver : la vraie barre d'adresse de Chrome Android, son mode bord à bord,
// Safari sur iPhone et la coque native. Ce sont les points à revoir sur un vrai téléphone.
// Il faut Chrome (ou Edge) installé : le pilote (playwright-core) ne télécharge aucun navigateur.
import { createServer } from 'vite';
import { readFileSync } from 'node:fs';
import { chromium } from 'playwright-core';

const REELLES = JSON.parse(readFileSync(new URL('./verifier-appli-donnees.json', import.meta.url), 'utf8'));
const TELEPHONES = [{ width: 360, height: 740 }, { width: 412, height: 915 }];
// Barre d'adresse de Chrome Android : environ 56 px qui disparaissent au défilement.
const BARRE_ADRESSE = 56;
const TOLERANCE = 1;

const UTILISATEURS = {
  admin: { id: 14, name: 'Équipe Fairride', firstName: 'Équipe', lastName: 'Fairride', email: 'contact@fairride.be', role: 'client', roles: ['client'], isAdmin: true },
  client: { id: 11, name: 'Cléa Client', firstName: 'Cléa', lastName: 'Client', email: 'client@exemple.be', role: 'client', roles: ['client'] },
  restaurant: { id: 13, name: 'Rémi Resto', firstName: 'Rémi', lastName: 'Resto', email: 'resto@exemple.be', role: 'restaurant', roles: ['restaurant'], restaurantId: 1 },
  driver: { id: 12, name: 'Lou Livreur', firstName: 'Lou', lastName: 'Livreur', email: 'livreur@exemple.be', role: 'driver', roles: ['driver'], adminStatus: 'approved', stripeConnectStatus: 'active' }
};
// La console n'existe que sur le site (dans l'app, /admin montre AdminSurLeSite, sans sa barre).
const CAS = [
  { profil: 'admin', chemin: '/admin', appli: false },
  { profil: 'client', chemin: '/restaurants', appli: false },
  { profil: 'client', chemin: '/restaurants', appli: true },
  { profil: 'restaurant', chemin: '/dashboard', appli: false },
  { profil: 'restaurant', chemin: '/dashboard', appli: true },
  { profil: 'driver', chemin: '/driver', appli: false },
  { profil: 'driver', chemin: '/driver', appli: true }
];

function simuler(chemin, methode, profil) {
  const u = UTILISATEURS[profil];
  if (/^\/auth\/me$/.test(chemin)) return methode === 'GET' ? u : { ...u, user: u };
  if (methode === 'GET' && REELLES[chemin]) return REELLES[chemin];
  if (methode === 'GET' && /^\/restaurants\/[^/]+\/compliance$/.test(chemin)) return REELLES['/restaurants/:id/compliance'];
  if (methode === 'GET' && /^\/restaurants\/[^/]+$/.test(chemin) && profil === 'restaurant') return REELLES['/restaurants/mine/dashboard'][0];
  if (methode !== 'GET') return {};
  return [];
}

async function lancerNavigateur() {
  for (const channel of ['chrome', 'msedge']) {
    try { return await chromium.launch({ channel, headless: true }); } catch { /* essai suivant */ }
  }
  throw new Error('Ni Chrome ni Edge trouvé : installe Google Chrome pour lancer cette vérification.');
}

async function ouvrir(navigateur, base, { profil, appli, viewport }) {
  const ctx = await navigateur.newContext({ viewport, isMobile: true, hasTouch: true, deviceScaleFactor: 2.625, locale: 'fr-BE' });
  await ctx.addInitScript(({ appli, session }) => {
    if (appli) {
      const original = window.matchMedia.bind(window);
      window.matchMedia = (q) => (String(q).includes('display-mode: standalone')
        ? { matches: true, media: q, addEventListener() {}, removeEventListener() {}, addListener() {}, removeListener() {} }
        : original(q));
    }
    if (sessionStorage.getItem('verif-init')) return;
    sessionStorage.setItem('verif-init', '1');
    localStorage.clear();
    localStorage.setItem('fairide_bienvenue', JSON.stringify({ vu: true, role: session.user.role }));
    localStorage.setItem('fairide_cookie_consent', 'refused');
    localStorage.setItem('fairide_cookie_consent_at', String(Date.now()));
    localStorage.setItem('fairide_session', JSON.stringify(session));
  }, { appli, session: { token: `jeton-${profil}`, user: UTILISATEURS[profil] } });
  const page = await ctx.newPage();
  const origine = new URL(base).origin;
  await page.route('**/*', (route) => {
    const url = new URL(route.request().url());
    if (url.origin === origine) return route.continue();
    if (url.pathname.includes('/api/')) {
      const chemin = url.pathname.replace(/^.*\/api/, '');
      return route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify(simuler(chemin, route.request().method(), profil)) });
    }
    return route.abort();
  });
  return { ctx, page };
}

// Mesure la barre : bord bas du conteneur, bord bas de la pilule, marge attendue, ancêtres qui captureraient position: fixed.
async function mesurer(page) {
  await page.waitForTimeout(350); // transitions de la barre (.14 s) et de la pilule
  return page.evaluate(() => {
    const barre = document.querySelector('.dashboard-shell:not(.dashboard-shell--flux) > .dashboard-sidebar');
    if (!barre || !barre.getClientRects().length) return { absente: true };
    const pilule = barre.querySelector('.dashboard-nav');
    // La marge du système telle que le CSS la lit : un témoin fixé, rembourré de env(safe-area-inset-bottom).
    const temoin = document.createElement('div');
    temoin.style.cssText = 'position:fixed;bottom:0;left:0;width:1px;height:0;padding-bottom:env(safe-area-inset-bottom);visibility:hidden';
    document.body.appendChild(temoin);
    const marge = temoin.getBoundingClientRect().height;
    temoin.remove();
    const capteurs = [];
    for (let el = barre.parentElement; el && el !== document.documentElement.parentNode; el = el.parentElement) {
      const s = getComputedStyle(el);
      if (s.transform !== 'none' || s.filter !== 'none' || s.perspective !== 'none' || /paint|layout|strict|content/.test(s.contain)
        || (s.backdropFilter && s.backdropFilter !== 'none') || /transform|filter|perspective/.test(s.willChange)) capteurs.push(el.tagName.toLowerCase() + (el.className ? `.${String(el.className).split(' ')[0]}` : ''));
    }
    const vv = window.visualViewport;
    return {
      hauteur: window.innerHeight,
      basVisuel: vv ? vv.offsetTop + vv.height : window.innerHeight,
      basBarre: barre.getBoundingClientRect().bottom,
      basPilule: pilule.getBoundingClientRect().bottom,
      marge,
      capteurs
    };
  });
}

function juger(m, etape, { visuel = true } = {}) {
  if (m.absente) return [`${etape} : barre du bas absente`];
  const p = [];
  const attendu = Math.max(6, m.marge - 12);
  if (Math.abs(m.basBarre - m.hauteur) > TOLERANCE) p.push(`${etape} : bas de la barre à ${Math.round(m.basBarre)} px pour un écran de ${m.hauteur} px`);
  if (visuel && Math.abs(m.basBarre - m.basVisuel) > TOLERANCE) p.push(`${etape} : bas de la barre à ${Math.round(m.basBarre)} px, bas du visualViewport à ${Math.round(m.basVisuel)} px`);
  if (Math.abs((m.hauteur - m.basPilule) - attendu) > TOLERANCE) p.push(`${etape} : pilule à ${Math.round(m.hauteur - m.basPilule)} px du bas (attendu ${attendu})`);
  if (m.capteurs.length) p.push(`${etape} : ancêtre qui capture position: fixed (${m.capteurs.join(', ')})`);
  return p;
}

const serveur = await createServer({ server: { port: 0, strictPort: false }, logLevel: 'silent' });
await serveur.listen();
const base = serveur.resolvedUrls.local[0].replace(/\/$/, '');
const navigateur = await lancerNavigateur();
const resultats = [];
let margeEmulee = null;
try {
  for (const viewport of TELEPHONES) {
    for (const cas of CAS) {
      const { ctx, page } = await ouvrir(navigateur, base, { ...cas, viewport });
      const problemes = [];
      await page.goto(base + cas.chemin);
      await page.waitForTimeout(1500);
      problemes.push(...juger(await mesurer(page), 'ouverture'));
      // La barre d'adresse se replie (la fenêtre grandit), puis revient.
      await page.setViewportSize({ width: viewport.width, height: viewport.height + BARRE_ADRESSE });
      problemes.push(...juger(await mesurer(page), 'barre d\'adresse repliée'));
      await page.setViewportSize(viewport);
      problemes.push(...juger(await mesurer(page), 'barre d\'adresse revenue'));
      // Défilement : la barre se réduit aux icônes, elle doit rester posée au même endroit.
      await page.evaluate(() => { document.body.style.minHeight = '3000px'; window.scrollTo(0, 400); });
      problemes.push(...juger(await mesurer(page), 'après défilement'));
      // Le visualViewport change (zoom, clavier, barre d'adresse) : aucun code ne doit déplacer la barre pour autant.
      await page.evaluate(() => {
        const vv = window.visualViewport;
        if (!vv) return;
        Object.defineProperty(vv, 'height', { configurable: true, get: () => window.innerHeight - 120 });
        Object.defineProperty(vv, 'offsetTop', { configurable: true, get: () => 30 });
        vv.dispatchEvent(new Event('resize'));
        vv.dispatchEvent(new Event('scroll'));
        window.dispatchEvent(new Event('resize'));
      });
      problemes.push(...juger(await mesurer(page), 'visualViewport modifié', { visuel: false }));
      // Marge du système de 48 px (barre de navigation Android à trois boutons), si ce Chrome sait l'émuler.
      try {
        const cdp = await ctx.newCDPSession(page);
        await cdp.send('Emulation.setSafeAreaInsetsOverride', { insets: { top: 0, left: 0, right: 0, bottom: 48 } });
        const m = await mesurer(page);
        if (m.marge === 48) { margeEmulee = true; problemes.push(...juger(m, 'marge du système 48 px', { visuel: false })); } else if (margeEmulee === null) margeEmulee = false;
      } catch { if (margeEmulee === null) margeEmulee = false; }
      resultats.push({ nom: `${cas.profil.padEnd(10)} ${(cas.appli ? 'app' : 'site').padEnd(4)} ${viewport.width}×${viewport.height} ${cas.chemin}`, problemes });
      await ctx.close();
    }
  }
} finally {
  await navigateur.close();
  await serveur.close();
}

const echecs = resultats.filter((r) => r.problemes.length);
for (const r of resultats) console.log(`${r.nom.padEnd(48)} ${r.problemes.length ? `ÉCHEC  ${r.problemes.join(' · ')}` : 'ok'}`);
console.log(margeEmulee ? '\nMarge du système (48 px) émulée et vérifiée.' : '\nMarge du système non émulable dans ce Chrome : vérifiée à 0 px seulement.');
console.log(`${resultats.length} barres vérifiées, ${echecs.length} en échec.`);
process.exit(echecs.length ? 1 : 0);
