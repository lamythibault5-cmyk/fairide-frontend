# CLAUDE.md

Guide for Claude Code working in this repository.

Every figure below was re-checked against the source on 2026-09-23. If you change something this
file describes, change this file too — a stale guide is worse than no guide, because it gets
believed.

## What this is

Fairide is a food-delivery / local-commerce platform for Brussels, positioned on a
10% share, with no VAT on it since Fairide is a VAT franchisé (vs. 22-32% commission on the big platforms), kept from the price paid
for the products, not added as a checkout line; menus show the business's own prices (see « Pricing model » below). **This repo is the front end
only.** The backend is a separate service.

- Production: `https://fairide.be`
- Backend API: `https://fairide-backend-production.up.railway.app/api` (Railway)
- Deploy: Vercel — SPA rewrite of all routes to `/index.html`, see [vercel.json](vercel.json)
- Backend repo: `https://github.com/lamythibault5-cmyk/fairide-backend`, checked out next door at
  `../fairide-backend`. Several things you will be asked about (menu import, price tooling) live
  there, not here.

## Stack

React 19 · Vite 8 · react-router-dom 7 · oxlint · plain CSS.

**No TypeScript. No test framework. No CSS framework.** Don't introduce any of the three
without asking — their absence is the current state of the project, not an oversight to fix
in passing.

Other dependencies: `@sentry/react` (error reporting, opt-in via env), `leaflet` (maps,
no react-leaflet wrapper), `@dnd-kit/*` (drag-and-drop for menu ordering).
`@capacitor/*` wraps the same `dist/` into the iOS and Android apps (`npm run app:sync`, `app:android`,
`app:ios`); everything native goes through `src/natif.js` and `src/pushNatif.js` — see
[docs/application-mobile.md](docs/application-mobile.md) for what is in place and what still needs store accounts.
**Releasing the Android app**: never bump `versionCode` by hand — see « Mettre à jour l'application » in that file
(Fairide Test builds itself on every merge to `main`; the Play Store app is GitHub › Actions › *App Android Play
Store* › *Run workflow*, which uploads to Internal testing itself).
`@capacitor/geolocation` and `@capgo/capacitor-social-login` (Apple / Google sheet — the site's Google button is refused
inside a WebView) are loaded with `import()` from `natif.js` only, so the website never downloads them.

**The app has its own first-launch screens** (2026-10-11, [src/pages/app/Bienvenue.jsx](src/pages/app/Bienvenue.jsx),
route `/bienvenue`, outside `<Layout>`; designed with the founder on [mockups/app-onboarding.html](mockups/app-onboarding.html)).
**Look since 2026-10-16** (version D of [mockups/onboarding-chaleur.html](mockups/onboarding-chaleur.html)): every white screen of the
welcome flow, the in-app sign-up and the in-app login has an **iris header** (back, progress, title) and the rest in a white
**sheet** with rounded top corners — a screen puts what follows its title in `<Feuille>` (EcransBienvenue.jsx), the container
carries `.bv-bandeau`. Progress is a dashed road the brand bicycle rides along (`Route`); main buttons are lime; ticked
options show a lime check. Outside a `.bv-bandeau` screen (notifications primer, courier dossier) `.bv-feuille` is `display: contents`.
**Same family, client screens (2026-10-16, versions picked on [mockups/autres-idees.html](mockups/autres-idees.html))**: an order in
progress opens on an iris header with a big friendly status (`titreSuivi`) and a road where the lime bike rolls stop to stop
(`RouteSuivi`, orderStatus.jsx; past orders keep the compact card) — 1C; in the app the cart is a full-width glass bar with the
total in an iris chip whose digits roll (FloatingCart, `ChiffresRoulants`) — 2C; a dish's « + » opens into « − n + » with the
number in a lime circle and folds back to a circle that keeps the count (`PasPlat`, MenuCategorySections), and the dish sheet's
quantity and « Ajouter » are one lime block — 3C; full-page empty screens (orders, favourites, cart) show the bike waiting on its
road (`EtatVide scene=…`) — 4B. Buttons inside these need `min-height` overrides: the global 44 px touch rule has specificity (0,3,1).
**Every main screen in that style (2026-10-16, « Proposition » phones of [mockups/tous-les-ecrans.html](mockups/tous-les-ecrans.html))**:
restaurant list (address on an iris band with the riding bike, glass cuisine strip with a draggable lens: TeteListe.jsx,
lentillePuces.js), map, favourites, restaurant page (sheet over the cover, glass sections strip, floating round buttons in solid iris
with a white ring — white-on-glass was unreadable), cart / checkout / order confirmed (EcranCommande.jsx), Mon compte (EnteteCompte.jsx),
business dashboard / orders / menu / stats (BandeauCommerce.jsx, CarteCommerce.jsx), courier dashboard / job in progress / earnings
(RouteVelo.jsx). **Each family's CSS lives in its own file imported by its pages**: `src/ecran-liste.css`, `ecran-fiche.css`,
`ecran-commande.css`, `ecran-compte.css`, `ecran-commerce.css`, `ecran-livreur.css` — look there before styles.css. Glass, blur and soft
shadows are scoped to `html.appli`; the website keeps iris bands and white sheets without glass. `.page-fade` animates with
`backwards`, not `both`: an opacity held after the animation disables `backdrop-filter` for everything inside the page.
In the app, `/` never shows the marketing landing: first launch → `/bienvenue`, afterwards → `/restaurants` (Home.jsx).
On the web `/bienvenue` redirects home unless `?apercu` is set (that is how to review it with `npm run dev`). Its copy
is in the `appli` i18n namespace. **Sign-up happens inside it** (2026-10-15, [InscriptionAppli.jsx](src/pages/app/InscriptionAppli.jsx)):
« Continuer avec mon e-mail », and Apple / Google for an account that does not exist yet, no longer go to `/login` — one question
per screen, no scrolling at 375×667, same data and routes as Auth.jsx (change a field rule in both, and in the backend). Only
**The app has no website chrome** (2026-10-15, [Layout.jsx](src/components/Layout.jsx), `APPLI`): when `experienceApp()`,
no page shows the site header, footer, legal-links row or cookie card. Signed in, every page — help, legal, « C'est bon » —
stays in the tab shell with a « ← Retour »; legal links live at the bottom of Mon compte. Signed
out, a slim app bar (brand or back, « Se connecter »). `/login` is [ConnexionAppli.jsx](src/pages/app/ConnexionAppli.jsx)
(2FA, unconfirmed e-mail, forgotten password, Apple/Google). **Crash reports (Sentry) are ON BY DEFAULT in the app, never behind a
blocking screen** (founder, 2026-10-16, risk accepted: the research on Belgian art. 10/2 loi 30-07-2018 / APD 85/2022 found it
unclear, question for the lawyer in AVANT-PRODUCTION.md). The rule lives in `rapportsPanneActifs` (consent.js): accepted, or no answer
and `experienceApp()`. Off switches: a pre-ticked box in its own card at the end of the in-app sign-up (never next to the
opposite-direction « no news » box) and an Activer / Couper row in Mon compte (`RapportsPanne`, Account.jsx). Someone who turned them
off is offered « Envoyer le rapport » on the crash screen ([AppErrorBoundary](src/components/AppErrorBoundary.jsx), one report only).
Sentry is set to errors only, no sessions, no console breadcrumbs, URLs without parameters, no user identity (sentry.js). The
privacy policy (CONF-2026-10-16) says so. On the website nothing changes: Sentry only after « Accepter » on the cookie banner. Stripe
(Connect, Identity, billing portal) always opens through `allerAuPaiement` (in-app browser, return path) — never
`window.location.href`, which left the app.
**First-day flows are app screens too** (phase 2, 2026-10-15), opened full-screen through [EcranPlein](src/components/EcranPlein.jsx)
(a portal into `<body>` — inside the shell, `.page-fade` broke `position: fixed`): a business's « Envoyer ma carte »
([EnvoiCarteAppli](src/components/commerce/EnvoiCarteAppli.jsx)), the courier's draft dossier
([DossierAppli](src/pages/driver/DossierAppli.jsx), one topic or one document per screen; rules shared with Onboarding.jsx in
[dossierCommun.js](src/pages/driver/dossierCommun.js)); once sent, validated or suspended the app shows
[DossierSuivi](src/pages/driver/DossierSuivi.jsx) instead of the website page (2026-10-19, second design audit: band « Dossier
envoyé » / « C'est bon, tu peux rouler », one lime « Voir les courses », counters as white tiles, rows opening sheets; the blocks
both versions share live in [dossierBlocs.jsx](src/pages/driver/dossierBlocs.jsx)), and in checkout the codes, allergy request and the age / T&Cs boxes
as sheets (the last one opened by the pay button). In the app, the T&Cs link opens a sheet ([CgvEnFeuille](src/components/CgvEnFeuille.jsx)),
never a tab. The website keeps its pages unchanged.
**App-wide rules (final phase, 2026-10-15)**: a folding [LigneCompte](src/components/LigneCompte.jsx) row opens its content
in a sheet in the app (every Mon compte section at once); any `target="_blank"` link is caught by `garderLesLiensDansLApp`
(natif.js) — a Fairide page opens in the app, another site in the in-app browser, maps/Waze/tel unchanged; `apiDownload` hands
files to the share sheet in the native app; « Imprimer » is hidden in the app; `html.appli` marks app mode for CSS (wide tables
scroll sideways). Orders put the delivery code under the progress bar and open the review and « Signaler » in sheets;
new promotions open in a sheet. Local backend on a Neon dev database: see `../fairide-backend/.env` (port 5173 for CORS).
**`npm run check:app` before every push** ([scripts/verifier-appli.mjs](scripts/verifier-appli.mjs)): opens every app page at
375×667 in app mode for four profiles against a mocked backend (real captured responses in `scripts/verifier-appli-donnees.json`)
and fails on any website chrome, a crashed page, or a full-screen screen that scrolls. Needs Chrome or Edge installed. A new
app page goes into its `PAGES`; a page crashing for lack of data gets a better mock, it is never removed from the list. The onboarding copy makes **no claim the code does not back** — never « moins cher » (it depends on the
business), only the 10 % vs 22-32 % commission gap; and notifications are only promised where the server sends them.

**Push notifications (2026-10-11), what exists:** order-status pushes for all three roles come from a DB trigger
(backend migration 029 → `push_queue`, sent every 5 s by `pushFile.js`, fr/nl/en): client — accepted, declined, courier
found, on the way, delivered, ready for pickup, cancelled; business — order cancelled after receipt, courier waiting,
order still waiting for acceptance; courier — his job ready, cancelled before pickup, withdrawn by the client. Plus, sent
directly: new order to the business (payment), courier at the door to the client, and **new job to every courier who
would see it** (`notifLivreurs.js`, same eligibility as `GET /orders/available`, everyone at once, no rating read; a scheduled
delivery reaches couriers, and this push, only at its slot minus prep, travel and 15 min: `ouvertureLivreurs.js`). Nobody
is notified of their own action (`oublierPush` in the routes). Toggles: `ReglageNotifications.jsx` (client in Mes
commandes, courier via `NotifCourses.jsx`), `NewOrderAlertBar` (business), and once after sign-up in the app
(`AmorceNotifications.jsx`). A new status worth a push goes in the trigger and in `pushFile.js` texts, not in a route.
**Sign in with Apple** exists for the iPhone app only (App Store rule 4.8): `POST /auth/apple` in the backend shares
one code path with `/auth/google` (`connexionFederee` in `routes/auth.js`) — fix a rule there, not in a copy.

```
npm install       # node_modules is not checked in and may be absent — run this first
npm run dev       # vite dev server
npm run build     # production build
npm run lint      # oxlint — the only automated check that exists
npm run preview   # serve the build locally
```

`npm run lint` (plus `npm run check:app`, see above, for anything the app shows) is the whole verification story **in this repo**, and it currently reports ~168
pre-existing warnings across the codebase. Don't read a clean-looking tail as success: check that
*your* files are absent from the output. There is nothing else to run here, so read your changes
carefully and, where behaviour matters, check them in the browser with `npm run dev`.

The backend does have tests (`npm test`, 332 of them on 2026-10-12 — 4 already failing on `main` that day, unrelated: D8 privacy hash, terminal disconnect, admin and courier simulations — `node --test`; the `plan-de-test-*` files replay the end-to-end test plan,
[docs/fairide-tests-e2e-standalone.html](docs/fairide-tests-e2e-standalone.html), against an in-memory database). If your change touches
anything the backend also reads — page parsing, menu shape — run them there.

### Environment variables

Copy [.env.example](.env.example) to `.env.local` before working. All are optional in the sense that
each has a fallback — but **the `VITE_API_BASE` fallback is the production Railway backend**, so
without a `.env.local` your dev server edits live data.

| Variable | Purpose |
|---|---|
| `VITE_API_BASE` | Overrides the Railway backend URL in [src/api.js](src/api.js) |
| `VITE_GOOGLE_CLIENT_ID` | Google Sign-In (script loaded in [index.html](index.html)) |
| `VITE_SENTRY_DSN` | Enables Sentry — but only *after* cookie consent, see [src/main.jsx](src/main.jsx) |
| `VITE_STOCK_DISH_PHOTOS` | `on` (default) fills photo-less dishes from a stock-image table; `off` disables it. **Still `on`.** Must be `off` before real restaurants go live — see [src/menuCategories.js](src/menuCategories.js) |
| `VITE_MAP_TILE_URL` / `VITE_MAP_TILE_ATTRIBUTION` | Map tiles for all five Leaflet maps ([src/carte.js](src/carte.js)). Empty = public OpenStreetMap tiles, whose usage policy excludes heavy commercial use — **set before launch** |
| `VITE_PLAUSIBLE_DOMAIN` | Cookieless analytics. Empty = [src/analytics.js](src/analytics.js) loads nothing at all. Was missing from `.env.example` while the code already read it, so analytics was silently off in production — set it in the Vercel variables |

## Architecture

### Four roles, one SPA

Every route lives in [src/App.jsx](src/App.jsx) (265 lines) — the full route map, read it first when
orienting. Access is gated by `<ProtectedRoute role="...">`.

**Routes are code-split by role.** Only the public entry path (home, login, restaurant list, restaurant
menu) is statically imported; everything else is `React.lazy` behind `<Suspense>` — 73 lazy imports as
of today. Keep it that way when adding a route: a static import of a dashboard page pulls it into
every customer's first load.

| Role | Route prefix | Pages |
|---|---|---|
| Client | `/home`, `/restaurants`, `/checkout`, `/orders`, … | [src/pages/client/](src/pages/client/) |
| Restaurant | `/dashboard/*` | [src/pages/restaurant/](src/pages/restaurant/) |
| Driver | `/driver/*` | [src/pages/driver/](src/pages/driver/) |
| Admin | `/admin/*` | [src/pages/admin/](src/pages/admin/) |

`/restaurants` and `/restaurants/:id` are **deliberately public** — no `ProtectedRoute` — so
they stay indexable and shareable. Only actions (order, favourite) require login. Don't
"fix" this by wrapping them. One click is gated on purpose (2026-09-27): a logged-out visitor who opens
a business **from the list** (`RestaurantCard` in RestaurantList.jsx) goes to login first, and
Auth.jsx brings them back to that business after sign-in or client sign-up. The route itself stays
public — shared links, search engines and prerendered pages still land on it directly.

The landing page's main action is an address bar ([HeroAdresse](src/components/landing/HeroAdresse.jsx)):
it maps the postal code to one of the 19 communes and opens `/restaurants` with it as `communeProche` —
all businesses shown, that commune's first, then its neighbours (not a filter) — without saving anything.

Restaurant and admin sections use nested routes under a shared layout
(`DashboardLayout` / `AdminLayout`) with `<Outlet />`.

### Context providers

Nesting order is fixed in [src/main.jsx](src/main.jsx):
`Language → Toast → Auth → PreviewMode → Cart`. A provider can only consume the ones
outside it, so adding a dependency between two of them may mean reordering here.

- `AuthContext` — session in `localStorage`, exposes the bearer token used by `api()`
- `CartContext` — client cart state
- `ToastContext` — `useToast()('message')`, a single 3.2s toast at the bottom
- `LanguageContext` — active locale, backed by the translations table
- `PreviewModeContext` — lets a restaurateur preview their own storefront as a client sees it

### API layer

Two functions in [src/api.js](src/api.js) — everything goes through them:

- `api(path, { method, body, token })` — JSON
- `apiUpload(path, { file, token, fieldName, fields })` — multipart; deliberately sets no
  `Content-Type` so the browser writes its own FormData boundary

Both throw `ApiError` (an `Error` with a `status` field) carrying a user-facing message: the server's own text, or for
network failure / expired session / unknown error a translated one (`traduire()` from LanguageContext, usable outside
components). The server translates its error messages for EN / NL users at the exit (`../fairide-backend/traductionErreurs.js`,
keyed on the exact French text; a test fails if a listed text disappears from the routes) — reword an error there too. Callers catch and pass to `useToast()`. Don't call `fetch` directly in a component.

**401 handling is centralised.** A 401 on a request that *sent a token* means an expired session:
`api()` clears the session through the handler `AuthContext` registers via `setSessionExpiredHandler`,
and `ProtectedRoute` does the redirect. A 401 on a request with *no* token is a login failure and is
thrown to the caller as normal. Don't add per-call 401 checks.

### Error handling

[AppErrorBoundary](src/components/AppErrorBoundary.jsx) wraps the whole router in
[main.jsx](src/main.jsx) and reports to Sentry. Without it a single render error blanks the page.

### Styling

**One file: [src/styles.css](src/styles.css)** (4,635 lines), imported once in `main.jsx`.
Global class names, no CSS modules, no Tailwind. Inline `style={{}}` is used freely for
one-off spacing and is an accepted pattern here.

**The website shell (2026-10-16, sections 1–2 of [mockups/site-ordinateur.html](mockups/site-ordinateur.html), white sidebar and
solid-white sticky bars chosen by the founder) lives in [src/site-cadre.css](src/site-cadre.css)**, imported by Layout.jsx; its header
lists the shared utilities — use them instead of re-writing a width or a band per page: `.site-col` (centred, 1,120 px max:
lists, grids, tables) and `.site-col--lecture` (760 px: forms, text); `.site-bande` (iris band, edge to edge of the content
area — it cancels `.dashboard-main`'s padding, notch included on phones) with `.site-bande-ctx` / `-titre` / `-sous`, then
`.site-feuille` (white sheet with rounded top corners rising over it; put a `.site-col` inside both); `.site-collant` (sticky bar:
solid white + hairline, never glass); `.site-survol` (clickable card: border turns iris, lifts 3 px, no shadow) and
`.site-ligne-survol` (row: grey tint); `.sur-iris` (focus ring turns lime — the default ring is 2 px iris offset 2 px, invisible
on iris). On the website, **every signed-in page is in the sidebar shell** except `/login` and `/reset-password` (Layout.jsx,
`HORS_COQUILLE`): help, legal pages, notre-histoire, « C'est bon », 404 no longer show the iris site header; pages outside the
role spaces get `.site-page-generique` (760 px, centred). Sidebar ≥ 900 px, website only (`html:not(.appli)` — the app's sidebar
and glass tab bar are untouched): brand tile, nav whose active tab is an iris pill sliding between links (the same `.nav-curseur`
/ useCurseurOnglets.js as the bottom bar), pale-iris counters (white on the active pill), and at the bottom FR · NL · EN, the legal
links (the `.dashboard-footer-links` row is now phone-only) and the user block. The cookie card is iris with « Accepter » and
« Refuser » as the same white button (APD: refusing as easy as accepting); it takes focus itself so no ring favours one choice.
The website `/login` (Auth.jsx, `CadreConnexion`) is two halves under the unchanged visitor header: iris left (title, the bike
waiting on its road, or during sign-up the step road `RouteEtapes`), the form on a white sheet right, Connexion / Inscription as
a sliding iris segment, one lime action; on phones the iris band on top and the sheet rising under it. Strings: `siteCadre` i18n
namespace.
**The rest of the website (same day, sections 3–9 of that mockup)**: each family has its own website CSS file, imported by its
pages and scoped to `html:not(.appli)`: `src/site-liste.css` (list with a left filter column ≥ 1,100 px, search, map with a side
list, favourites), `site-fiche.css` (restaurant page: menu in two columns, sticky cart column `PanierColonne.jsx`, dish as a
centred dialog ≥ 900 px, bottom sheet below), `site-commande.css` (cart / checkout in two columns, past orders as a table),
`site-compte.css` (Mon compte in two columns ≥ 1,100 px: `RubriquesCompte.jsx`), `site-pro.css` (business: orders board with three
columns, Mon commerce overview, `CadreSite.jsx`), `site-livreur.css` (courier: jobs list + `CarteCourse.jsx` map and detail,
`PageLivreur.jsx` for secondary pages). **On a laptop every iris band runs edge to edge of the content area** — one rule at the
end of site-cadre.css for the business, courier and account bands (cancel `.dashboard-main`'s 24 / 28 px, centre the content with
padding); change `.dashboard-main`'s padding and those rules change with it. **Scroll locks go on `<html>`, never `<body>`**
(useDialogue, EcranPlein, CarteSuivi): html has `overflow-x: clip`, so a body in `overflow: hidden` became its own scroller, jumped
to the top and dragged the sticky sidebar with it. The signed-out home page (`/`) and its visitor header are deliberately untouched.
**Group orders and the business team in the same family (2026-10-16, [src/ecran-equipe-groupe.css](src/ecran-equipe-groupe.css), `eg-`
classes, app and website rules in one file).** `/groupe/:code` (CommandeGroupee.jsx) reuses the cart's `BandeauCommande` /
`FeuilleCommande` / `BarreCommande` (`ec-page sc-page`): iris band (back to the menu, restaurant, « Commande groupée », who pays ·
participants, bike on its road), then Inviter (link field + iris share pill), Ma part, Toutes les parts grouped by person
(initial, name, person total; hairline rows `qty× · dish · price · ×`), total estimé. Exactly one lime action, in the bottom bar
(glass in the app, iris bar on the phone website, sticky recap column on a laptop): host « Fermer le groupe et commander », else
« Envoyer mon panier au groupe », else « Choisir mes plats »; reopen / cancel stay quiet at the bottom. `/groupe` is in Layout's
`DASHBOARD_PATHS` and `FLUX_COMMANDE` (no tabs, no floating cart there). `BandeauGroupe` is an iris-outlined notice (`.eg-note`)
with an iris pill and a text « Quitter » — never lime; the restaurant page's « Commande groupée » is an iris-outline pill
(`.eg-bouton-iris .eg-depart`), hidden while a group for that restaurant is being composed. Team: `EquipeCommerce` is a hairline
list (initial, name, e-mail, status pill: green member / iris invited / orange expired, × to remove) and « Inviter quelqu'un » with
one iris button; `/equipe/:token` (EquipeInvitation.jsx) is a centred band + sheet card (« {commerce} t'invite dans son équipe »,
three ticks of what the member can do, one padlock line for what they can't, one lime action). A member's Mon compte has a
« Mon équipe » group (restaurant + `team.memberCard` + the Commandes row) and calls `definirModeEquipe` itself, so the tab bar
is right even before the orders page has loaded; on the orders page a member sees neither the « next step » nor terminal links.
**The admin console in the same family (2026-10-17, [src/admin-cadre.css](src/admin-cadre.css), imported by AdminLayout).** Every
app's [AdminPageHeader](src/components/admin/AdminPageHeader.jsx) is the iris band (`.admin-bande`): context line (hub icon,
« Console Fairide », tab name), the hub as title, the screen's actions as light pills on the right (view switcher = light segment,
`btn-teal` = white pill), the hub's apps as pill tabs (active one white), « En savoir plus »; its `::after` draws the top edge of the
white sheet, so no page had to be re-wrapped. « Aujourd'hui » puts the greeting, shortcuts and live figures on the band (the pulsing
« en direct » dot is the only lime). On the sheet, under `div.admin-console` (one notch above the per-app CSS files, which load
later): white stat tiles with a hairline (`.highlight` = iris tile), white pill search with a magnifier, pill chips, sentence-case
table headers and status badges, kanban columns on a light tint, an iris bulk-action bar. RecordDrawer: iris head, pill tabs, white
body rising over it. Width 1,280 px max, centred with container units (`cqi`) so the band still cancels the page padding. A
clickable stat tile must not set `border: 0` inline (white tile without its hairline is invisible).

At this size, **find the neighbouring rule before adding one.** Selectors of equal specificity are
resolved by order, and several blocks near the bottom (the 520px media query especially) override
rules written hundreds of lines earlier. A rule that "doesn't apply" is usually a rule that applies
and is then overridden.

Design tokens are CSS custom properties in `:root` at the top of the file. **Change colours
there, not at call sites.**

The identity is **"The frame"**: two brand colours and nothing else — iris `#3B2FB5` (the chrome)
and lime `#C8F03C` (the spotlight). See [FairRide-5a-spec.md](FairRide-5a-spec.md) for the
source spec and [mockups/landing-iris.html](mockups/landing-iris.html) for the reference page.

| Token | Value | Role |
|---|---|---|
| `--iris` / `--iris-deep` | `#3B2FB5` / `#2A2185` | Brand. Headers, primary buttons, app icon |
| `--lime` | `#C8F03C` | Accent. Badges, active states, one CTA per view |
| `--ink` / `--ink-soft` / `--ink-faint` | `#14121F` / `#6B655D` / `#8A8377` | Text |
| `--line` | `#DCD8D0` | 1px hairlines — the only separator, there are no shadows |
| `--chip` | `#1E1A17` | Dark badge background, white text |
| `--cream` / `--cream-dim` | `#FFFFFF` / `#F4F2ED` | Page background / surface tint |
| `--red` `--blue` `--orange` `--purple` `--green` | | Status colours only, never brand (`--green` since 2026-10-13: « validé », « signé ») |
| `--radius` / `--radius-field` / `--radius-pill` | `16px` / `8px` / `999px` | Cards / small containers (`--radius-chip` is an alias of `--radius-field`) / everything clickable. Re-checked against styles.css on 2026-10-13 — this row said 20px / 6px, which the code no longer used |
| `--radius-saisie` / `--iris-tint` / `--anneau-champ` | `16px` / `#EFEDFB` / iris 1.5 px + 4 px halo | Text fields (style B, 2026-10-19, below). `--anneau-champ-erreur` is the red twin |
| `--shadow` | `none` | Kept as a token so old call sites resolve to nothing |

**Three rules that are not negotiable, all inherited from the spec:**

1. **Lime only ever sits on iris, or as a filled block with `--ink` text on it.** Lime as text,
   as a 1px border or as a thin rule on a white page fails contrast and is invisible. Wherever
   you need "the accent, but on a light surface", the token is `--gold-deep` — which is iris.
2. **Backgrounds are white or iris. No third background colour**, and no gradients, no blurred
   halos, no drop shadows. Elevation is expressed by a hairline border.
   *One exception (asked for):* in the **app only** (`html.appli`: native app and home-screen site), the bottom tab bar is
   **liquid glass** since 2026-10-16 (version 2 of [mockups/barre-onglets-verre.html](mockups/barre-onglets-verre.html), after
   WhatsApp): near-transparent, short blur, highlights and a soft shadow; the active tab is a glass lens with iridescent edges
   that grows when pressed and follows the finger ([src/barreVerre.js](src/barreVerre.js), loaded with `import()` in the app only;
   on desktop Chromium it also refracts what passes under its edges; not on Android since 2026-10-20, too heavy on a mid-range
   phone). On the website it stays solid white.
3. **One lime accent per view.** If a screen already has a `btn-gold`, its active tab / badge /
   nav item uses white or iris instead. *Exception (founder, 2026-10-16):* the app's welcome/sign-up screens pair the lime
   button with the lime check of ticked options and the « Salut ! » chip.

The old names survive as aliases so ~100 call sites keep working: `--gold` = lime, `--gold-deep`
= iris, `--teal` / `--teal-deep` = iris. Prefer `--iris` / `--lime` in new code.

Fonts (since 2026-10-13, founder's choice on the Revolut model): **Inter** for the interface (`--font-ui`, 400–700) and
**Inter Tight** for `h1`–`h3` (`--font-titre`, 500–700) — one family, two cuts, not a font pairing. Both are **served by
Fairide** from [public/fonts/polices.css](public/fonts/polices.css) (since 2026-10-02 — Google Fonts loaded before cookie
consent and sent visitors' IP addresses to Google). Never re-add `fonts.googleapis.com`. Use the two tokens, never a
family name, at call sites. Aeonik Pro (Revolut's display face) was considered and set aside: it is a paid licence.
Headings keep `letter-spacing: 0` (Inter Tight is already tight); the `-0.02em` some older call sites carry is legacy.

**The logo is the bicycle « 5a »** (two wheels, top tube, seat tube; lime on an iris tile) — back since
2026-09-27 after nine days as the « Swept plume » bowl. Geometry lives in [BrandMark.jsx](src/components/BrandMark.jsx)
and is repeated in `public/icons/icon.svg`, `public/favicon.svg`, the splash in [index.html](index.html) and the
Belgian-colours version [BelgianMark.jsx](src/components/BelgianMark.jsx). The PNG icons and `og-image.png` are
renders of it: change the drawing, re-render them. `FairRide-logo-spec.md` and `brand/` describe the bowl and are
out of date.

The one exception is the word `fairide` itself, which is set in **Bricolage Grotesque** (700–800,
optical sizing on) via the `.wordmark` class — lowercase, `-0.03em`. It is a *logotype* face, loaded
from a `<link>` in [index.html](index.html) rather than the `@import`, because the splash screen
paints before `styles.css` exists. Seven call sites carry the class; `.wordmark` sets the family and
nothing else. Inside a heading, the *word* « Fairide » alone is shown as the wordmark through
[AvecMarque](src/components/AvecMarque.jsx) (2026-10-13). **Don't extend it to whole headings** — that would re-open the two-font pairing the design
direction closed when it dropped Fraunces.

Buttons: `.btn-gold` (lime) is **the** decisive action of a screen — pay, confirm, sign in.
`.btn-teal` (iris) is the ordinary primary action, and the default in dashboards. `.btn-outline`
is secondary, `.btn-hero-ghost` is the secondary button on an iris ground.

**Champs de saisie (B, étiquette flottante) — founder, 2026-10-19** (option B of the « champs » mockup). Every text field,
website and app: **white**, 1 px `--line` hairline, `--radius-saisie` (16 px), 16 px text, 52 px high (56 with a floating
label); focus = iris edge 1.5 px + pale-iris 4 px halo (`--anneau-champ`, the extra half pixel is an inset shadow so nothing
moves); error = red edge, red label, red `.field-error` line under; disabled / read-only = still white, dashed hairline, soft
ink. Never give a field the grey `--surface-soft` again. All of it is CSS in styles.css (« CHAMPS DE SAISIE, STYLE B » and
« L'ÉTIQUETTE FLOTTANTE » right after `.field`), no per-page work:
- **The floating label is automatic**: in `.field`, `.bv-champ` (app onboarding `Champ`) or `.address-search`, a `<label>`
  that is the **first child** and is **directly followed** by the control (input, select, textarea, `.password-input`,
  `.phone-input`) sits inside the field. Empty and unfocused, it shows like a placeholder (16 px, faint) and the real
  placeholder is hidden; on focus or with a value it slides to the top-left (12 px semibold, iris while focused). « Empty »
  is read by `:placeholder-shown`, or `[value=""]` (React mirrors a controlled input's value into the attribute) — a field
  CSS can't read stays floated, so a label never covers a value. Selects, dates/times, textareas and the phone field
  (country prefix) are always floated.
- **To write a new field**: `<div className="field"><label htmlFor="x">Label</label><input id="x" value={v} onChange={…} /></div>`
  — controlled, label first, nothing between label and control, keep `htmlFor` (accessibility). Error: `className="input-invalid"`
  on the control + `<p className="field-error">`. A placeholder is an example (« Ex : Rue du Midi »), never the label repeated.
- **Labels that stay above** (the field keeps the B look): a label holding a link/button/input (`.field-label-row`,
  « Mot de passe oublié ? », help bubbles), a label that isn't the first child, `.sr-only` labels, the whole admin console
  (`.admin-console`, `.record-drawer`: dense forms), and labels too long for one line — add `className="etiquette-dessus"`
  (the `Champ` components of InscriptionAppli.jsx and driver/Onboarding.jsx do it themselves above 45 characters). Put
  side-by-side fields either both inside or both above, or the row goes out of line.
- Search bars (`.recherche-champ`), the code boxes (`.bv-saisie`) and pills on iris keep their own shapes; only their focus
  moved to the halo.

Confirmation modals use [ConfirmDialog](src/components/ConfirmDialog.jsx) — never `window.confirm`,
which is suppressed in installed PWAs and webviews. The five `window.confirm` hits you'll find in
`src/` are all inside comments explaining this; there are no live calls. `window.prompt` has the
same problem and the same replacement, [ReasonDialog](src/components/admin/ReasonDialog.jsx).

**No emojis anywhere, admin included (founder, 2026-10-13).** Icons are the line drawings of
[Icone.jsx](src/components/Icone.jsx) (`<Icone nom="…" taille={16} className="icone-texte" />` inside text); a data table
holds icon *names*, not emoji (`RESTAURANT_TYPES[].icone`, `ORDER_STAGES[].icon`). Leaflet markers take HTML: use
[iconeHtml](src/iconeHtml.jsx). Strings that can only be text (CSV, `<option>`, `title`) get no icon at all, or a
monochrome glyph (✓ ✗). Message reactions are still *stored* as emoji (server values) and *shown* as icons
([reactions.jsx](src/reactions.jsx)).

**Gestures are app-only (since 2026-10-13).** Physical motion — springs with velocity hand-off, momentum projection,
rubber-banding ([src/ressort.js](src/ressort.js)) — runs only when `estNatif()`, loaded with `import()`, so the website
downloads nothing extra (founder: the site must not get slower). What uses it: sheets pulled down to close
([useFeuilleGlissable](src/hooks/useFeuilleGlissable.js), FichePlat and SousEcran — on the site they keep the plain
threshold + CSS transition), edge swipe back on iPhone ([RetourParGlissement](src/components/RetourParGlissement.jsx);
Android has it in the system), and swipe-to-confirm for the courier's « récupérée » / « livrée »
([GlisserPourConfirmer](src/components/livreur/GlisserPourConfirmer.jsx); the site keeps the buttons). An animation with
`fill-mode: both` overrides inline transforms — the sheet's entry animation is `backwards` for that reason.

**App polish (founder, 2026-10-19, audit « Look and feel »).** Reuse these instead of re-inventing them:
- **Haptics** — `vibrer('succes' | 'erreur' | 'selection' | 'moyen')` in [gestes.js](src/gestes.js) (named phone feelings; a
  number still means a light tap). Success = payment confirmed / order accepted; error = every `toast(…, 'erreur')`
  (wired in ToastContext); selection = a lens sliding over items; medium = a lens landing, pull-to-refresh threshold.
- **Loading** — [Skeleton.jsx](src/components/Skeleton.jsx): `SkeletonCards` are row-shaped light-iris skeletons;
  `SqueletteEcran` is a whole loading screen in band + sheet (`titre` when the screen is known, shimmer bars otherwise,
  `photo` for the restaurant page). App only at call sites (`experienceApp()`); the bike rides while a skeleton shows.
- **Maps** — markers and route styles live in [marqueursCarte.js](src/marqueursCarte.js) (courier iris + lime bike,
  home lime, shop ringed iris; ridden route solid iris with a white edge, the rest iris dots). Map buttons are
  `.tracking-map-rond` (solid iris, white ring). Never reintroduce the near-black courier or the lime trail. The courier's
  `/driver/map` keeps the class `.carte-page`, so the customer map's glass / hairline zoom rules reached it: ecran-livreur.css
  puts its Leaflet zoom back to iris rounds with a higher specificity.
- **Courier earnings** (2026-10-19) — `/driver/earnings` reads `byWeek` and `rides` (backend `gainsLivreur.js`: one bar per
  week since the first week earned, one row per ride « shop → commune » with its tip folded in); the status text, the 90 % /
  100 % rules, DAC7 and statements sit behind « Ta fiscalité ». In the app, the website alert card (`AlerteLivreurBar`) is
  gone from the rides screen; the alert sound is a row in Mon compte ([SonAlertesLivreur](src/components/livreur/SonAlertesLivreur.jsx)).
- **Pull to refresh** — `<TirerPourActualiser onActualiser={promise} />` ([component](src/components/TirerPourActualiser.jsx)),
  native only, on Mes commandes, the restaurant list, the courier's Courses and the shop's Commandes.
- **Status bar** follows the band in the app ([barreEtat.js](src/barreEtat.js)): iris over an iris band, white otherwise.
- **Photo transition** card → restaurant page with the View Transitions API ([transitionPhoto.js](src/transitionPhoto.js)).
- **Data already read stays in memory** (2026-10-20, [cacheDonnees.js](src/cacheDonnees.js)): the restaurant list and pages show
  what was read during the visit at once and re-read in the background (same answer = same object, no re-render); a card
  prefetches its page on touch. A plain Map, never localStorage (nothing to declare), emptied on logout, keyed by token.
- **Light only**: `color-scheme: light only` (index.html + styles.css) and a Light Android theme. No dark mode until one is
  designed; iOS needs `UIUserInterfaceStyle = Light` (docs/application-mobile.md).

**Shop screens, design audit 2 (founder, 2026-10-19).** The new-order sheet ([NouvelleCommandeModale](src/components/NouvelleCommandeModale.jsx))
accepts in one tap (prep time + lime « Accepter · prête vers HH:MM », Refuser with reason, Imprimer, Plus tard; no « Tu gardes »); the home's
« 1 commande à traiter » opens it (`onOuvrir`, state in DashboardLayout). Customer line, ready time and the shop's share are computed from the
orders already loaded ([clientCommande.js](src/components/commerce/clientCommande.js); `order.commune` is the SHOP's commune, the customer's
comes from the postal code). App orders screen: alarm as one band line ([LigneAlarme](src/components/commerce/LigneAlarme.jsx), white
« Couper », never lime), sections À traiter / En préparation / Prêtes, glass « Accepter #058 » bar above the tabs (portal; the website board keeps
Accepter on the card), courier as a person ([LivreurCommande](src/components/commerce/LivreurCommande.jsx): no ETA, no vehicle — neither reaches the
shop). Shop home: « Ce soir chez … » band and four tool tiles ([CeSoir.jsx](src/components/commerce/CeSoir.jsx)) once setup is done; the setup pill says
« Visible · paiement au comptoir » while Stripe is not active; « Supprimer ce restaurant » lives in Infos légales. Review replies are signed with a
first name (backend migration 051, `PATCH /restaurants/:id/review-signature`; shown via [AvisSignes](src/components/AvisSignes.jsx)).

Note the two heavily-commented rules near the top of the file — `overflow-x: clip` on
`html`/`body` and `-webkit-tap-highlight-color: transparent`. Both encode a bug that was
already fixed once (`clip` rather than `hidden`, because `hidden` silently breaks
`position: sticky`). Read the comments before touching them.

#### Dishes without a photo

On the **client** menu ([MenuCategorySections.jsx](src/components/MenuCategorySections.jsx)), a dish
with no image renders as a compact text-only card — name, description, price, and the `+` moved down
onto the price row. No placeholder frame.

This matters more than it sounds: cards imported from a platform are often photo-less in bulk
(248 of Punjab Tandoori's 249 dishes), and the old category-emoji frame filled whole sections with
identical 🍽️ blocks.

The restaurateur's editor ([MenuItemRow.jsx](src/components/MenuItemRow.jsx)) does the same since
2026-09-25: its dish tiles reuse `menu-item-card-sans-photo`. It used to keep the empty emoji frame on
purpose, as a prompt to add a photo, but a whole imported card of them (Le Laakam: 156 dishes, no photo)
looked like a broken page. The prompt now lives only in the edit form, next to the photo field
(`dish-thumb-empty`). Don't bring the frame back to the grid.

### Internationalisation

[src/i18n/translations.js](src/i18n/translations.js) holds `fr` / `en` / `nl` tables; default `fr`.
**249 of the 285 `.jsx` files** call `useLanguage()` — this is now broad coverage, not the partial state
earlier versions of this file described. Adding a key means adding it to all three locales.

The remaining untranslated surfaces are mostly deep admin screens. Check which kind of component you
are in before hardcoding a string.

## Menu import (lives in the backend repo)

Restaurant cards are not typed in by hand. They are imported from a saved platform page by
`../fairide-backend/scripts/importer-carte.js`, which writes straight to the database — no HTTP, no
token to forge. Read its header before using or changing it; it documents how to capture a page and
why each option exists.

What the front end has to know:

- **Section order comes from `restaurant_sections.sort_order`**, not from `menu_items`. The importer
  gets it right by sorting dishes into the platform's own display order before writing, because
  `bulkReplaceMenuItems` creates the sections in the order the items arrive.
- **Uber Eats pages carry their menu in the HTML. Deliveroo pages do not** — Deliveroo renders it
  client-side, so a Ctrl+U capture is an empty shell and the importer reads a DOM capture instead.
- Companion scripts, same directory: `prix.js` (bulk price edit, by factor or by Excel CSV),
  `sauvegarde-carte.js` (snapshot before any `--remplacer`), `apercu-carte.js` (renders a card to a
  standalone HTML page for review, without publishing anything).
- **Importing a ready `<shop>-menu.json` into production**: follow « Chemin rapide » in
  `../fairide-backend/docs/importer-une-carte.md` — commands, which option for which kind of file, and the traps.
  `scripts/tunnel-railway.js` opens the database tunnel (`ssh -L` does not work on Railway) and exports the production
  credentials; `scripts/preparer-carte.js --sans-generiques` strips stock photos. **Never multiply prices at import**
  (neither × 1.121 nor × 1.10): shop prices go in as they are with `--prix-magasin`, and the business itself chooses to add
  the commission. Run the scripts from `origin/main` — an older branch has an importer without `--prix-magasin`.
- **Which businesses are real**: `restaurants.is_demo = false`. Of those, the ones with `in_store_prices_checked_at` are the
  only cards whose prices have been checked (5 on 2026-10-15: Hill's Burger, L'arbre à pain, Snack Turko, Pitaki, DIJII SHOP).

An imported card is written but **not online**: the business stays `pending` until someone clicks
Approve and Publish in the admin console. Don't describe an import as "live".

**In-store prices (2026-10-13).** `restaurants.in_store_prices_checked_at` marks a card whose prices were read in the shop
(printed menu, chalkboard), not on a platform — set by `importer-carte.js --prix-magasin` or the admin drawer toggle
(`PATCH /admin/restaurants/:id/in-store-prices`); the admin list shows « Prix magasin ✓ » / « Prix à vérifier ». Only a
marked card offers the business, on the « C'est bon » page ([ValiderCarte.jsx](src/pages/ValiderCarte.jsx)), one choice:
keep its prices, or raise the whole card by the maximum increase (+11.1 %, `hausseMaxPourcent`), rounded **down** to €0.10
(since 2026-10-14 — rounding up broke the cap: €10.00 → €11.20 is +12 %), paid
add-ons too. Choice, prices and signature go in one transaction, once (`fairide_rate_choice`). Structured `*-menu.json`
imports no longer get name-guessed option groups (`optionsExact`): the file's choices, including « none », are final. A
choice inside a choice (Habebe's « Formule + soft » → Spa/Pales) is flattened into the parent list (`aplatirChoix`): the
model has one level of options. The admin list's menu pill comes from the menu itself, not the « Fairide s'en occupe »
request: 0 dishes → « Carte à importer » (filter of the same name, counted server-side), otherwise the price state.
The importer closes an open request and its task, without e-mailing the business.

## Compliance (backlog of 2026-09-23)

Legal requirements are enforced by the **backend** (see its README, « Conformité » section); the front end
shows them and collects what the law requires. All strings are in the `conformite` i18n namespace; the
components live in [src/components/conformite/](src/components/conformite/), shared helpers in
[src/conformite.js](src/conformite.js). What exists, verified:

- **Checkout** ([CheckoutConformite](src/components/conformite/CheckoutConformite.jsx)): allergy request
  (the business must confirm before preparing), age declaration when the cart holds alcohol, T&Cs
  acceptance when the account hasn't accepted the current version. The pay button reads « Commander et
  payer » on purpose (CDE VI.46 §2) — don't rename it.
- **Restaurant page**: seller block visible without a click ([FicheVendeur](src/components/conformite/FicheVendeur.jsx)),
  allergens and an 18+ badge on each dish, a « Signaler » link to [/signaler](src/pages/legal/ReportPage.jsx).
  [/classement](src/pages/legal/RankingPage.jsx) describes the ranking **as the code does it** — if you
  change the sort in RestaurantList.jsx, change that page's text in the same commit.
- **Stars need reviews.** `restaurants.rating` defaults to 4.5 in the database: never render
  `StarsDisplay` or sort by rating without `reviewCount > 0` — that would show a rating nobody gave.
- **Signup is checkboxes only** (founder, 2026-10-12). Business: one box at the end of signup signs the partnership
  contract, the professional declaration and the allergen procedure ([EngagementsInscription](src/components/commerce/EngagementsInscription.jsx),
  texts from `GET /restaurants/engagements` and `/restaurants/contract-terms`). Courier: one « Mes engagements » step in
  onboarding (`POST /couriers/me/engagements`) accepts the pre-ride notices, the self-billing mandate, the
  `declaration_honneur` (replaces every status and vehicle document) and the contract. **No drawn signature anywhere**
  (typed name + box = simple e-signature, eIDAS art. 25); a drawing sent anyway must be a valid PNG. Still required,
  because the law targets Fairide itself: courier ID check, non-EEA residence permit + professional card (CPS 175/1),
  biometric consent as its own box (GDPR art. 9), business number before publication, the menu's « C'est bon ».
  Signup shape (2026-10-13): no « confirm password »; the business gives its **company number at signup** (legal name and
  VAT derived; representative = the person signing up, one line), so « Configurer mes paiements » goes straight to Stripe;
  the services screen ends with one « offert pendant le lancement » note (no formulas box, no terminal). Courier screen 2
  is status + company number + vehicle only; bag and « another platform? » are in the profile's Infos step, the
  municipality comes from the address. The courier profile opens on a « Prochaine étape » card.
  **Since 2026-10-15 (UX audit)** courier signup is three screens (account, identity, address): the company number is
  optional there (the dossier still requires it before submission, missing item `bce`), there is no ID / selfie step (the
  dossier's identity step does it), and no location prompt (PositionRequise asks above the job list). The selfie document
  is not required once Stripe Identity or an in-person check verified the face (`couriers.documentsRequis`). A non-EEA
  courier can *claim* the professional-card exemption (`self_employment_claimed_at`): it unblocks submission only; approval
  and rides still need the team's `self_employment_by_residence`, granted or withdrawn with a reason in Admin › Livreurs ›
  dossier › Documents (audit 2026-10-19, admin-08). The signup draft is kept 48 h in localStorage (declared
  in `cookies.technical`).
- **Merchant**: card signature, allergen attestation and professional declaration in
  [ConformiteCarte](src/components/conformite/ConformiteCarte.jsx) (menu page); allergens / VAT / alcohol
  per dish in the dish editor; allergy confirmation and ID check at the counter in the orders page.
  Everything left before going live is **one list with one next button**,
  [MiseEnLigne](src/components/commerce/MiseEnLigne.jsx) (2026-10-15): full on « Mon commerce », a « Prochaine étape » row
  on the other dashboard pages, read-only in « agir pour ». It replaced the status card, the CarteAValider banner and
  MenuReadiness's merchant list — add a new go-live step there, not in a new banner. Signing the menu now also confirms a
  menu handed over by the team (`carteSignee.signer` sets `menu_confirmed_at`; backend migration 037 repaired shops left hidden).
- **Courier**: notices to accept before the first ride, biometric consent before Stripe Identity,
  nationality and residence permit (onboarding); ID check at the door (dashboard).
- **Admin**: suspending anyone goes through [DecisionDialog](src/components/admin/DecisionDialog.jsx)
  (facts + contractual basis) — the API refuses a bare `{ status: 'blocked' }`. New compliance tabs
  (decisions, DSA reports, breaches, processors, prohibited products, parameters) are in
  [pages/admin/compliance/](src/pages/admin/compliance/).
- **Filings** (admin › Conformité › *Déclarations*, [DeclarationsTab](src/pages/admin/compliance/DeclarationsTab.jsx)):
  DAC7 for both couriers and businesses, CSV exports, the yearly copy sent to each seller, and the art. 17
  platform-work register. Sellers download their own DAC7 copy ([CopieDac7](src/components/conformite/CopieDac7.jsx))
  from the courier documents card and the restaurant invoices › statements tab.
- **Privacy policy text** is versioned like the T&Cs: changing `privacy.*` (or the `SECTIONS` order in
  Privacy.jsx) changes its hash — register a new version in the backend's `cgu.js`
  (`VERSIONS_CONFIDENTIALITE`), or its test fails.
- **T&Cs text**: changing `terms.*` in the i18n files changes the text clients accept. The backend tests hash the
  front at `../fairide-frontend` — from a worktree that is the main checkout, not yours: check with
  `node scripts/empreinte-cgu.js <your front path>`. Bump the date in
  `terms.draftWarning` and register the new version and hash in the backend (`scripts/empreinte-cgu.js`,
  `cgu.js`) — the backend test fails until you do.

## Pricing model (2026-09-23 evening; Fairide a VAT franchisé since 2026-10-12)

**Fairide SRL is under the Belgian small-business VAT franchise** (art. 56bis CTVA — SPF Finances letter of 2026-10-12,
effective 2026-09-07): it charges **no VAT** on anything it sells (commission, system fee, subscription, placements), files
no periodic VAT return and deducts nothing. Switch: `FAIRIDE_VAT_REGIME` on the backend (`franchise` by default, `assujetti`
to leave it), read by `fairideCompanyInfo.js`; `getPricing()` then returns `vatRateCommission` / `vatRateServiceFee` = 0 and
keeps the saved rates under `*Assujetti`. The franchise ends **with the transaction that takes Fairide's yearly turnover over
€25,000 excl. VAT** — Admin › Comptabilité › Obligations shows the counter (`seuilFranchise.js`, prorated in 2026).
Invoices carry « Régime particulier de franchise des petites entreprises » and Peppol category `E`; the business's dish VAT
and the courier's delivery VAT are **not** affected.

**Model of 2026-10-13 (founder), replacing « in-store price + 10 % »:** menus show **the business's own prices** by default.
On an order paid online Fairide keeps **10% of the price paid** (`commissionFairide(subtotal, pricing)` = subtotal × r, plus
Fairide's VAT if it ever becomes VAT-registered; `commission_vat` = 0 under the franchise): a €10 burger gives €1.00 to Fairide,
€9.00 to the business. The business may raise its prices (`restaurants.price_markup_percent`, requested by the business,
applied by the team) **up to `hausseMaxPourcent` = r / (1 − r) = 11.1%**, the increase that gives it its full in-store price
back (€10 → €11.10 → €9.99 for it); never more. One function applies it everywhere (`appliquerHausse` in
`../fairide-backend/prixMagasin.js`): own price kept in `price_base`/`delta_base`, paid add-ons follow, rounded up to €0.10.
The « C'est bon » page offers the max increase in one tap, only on cards with checked in-store prices.
The customer additionally pays the **delivery fee only — nothing is added on top** (model of 2026-10-08 evening):
€5 excl. VAT for the first km, then €0.80 excl. VAT per started km, 21% VAT added (€6.05 incl. VAT minimum). **10% of it
is Fairide's system fee, included** (`fraisService`, stored as `service_fee` + `service_fee_vat`); the courier receives
**90% of their own grid** (bike €0.60/km, motorised €0.80/km), and the bike difference stays with Fairide. A courier's
minimum (CODE-13) applies to their share: the client fee is raised to minimum / 0.9 when no courier accepts the grid
(`routes/orders.js`, `troisVendeurs.prixAvecMinimum`). Takeaway paid on site: no commission, no fee.
**Tips go 100% to the courier** (`tipFairideRate` 0 — founder, 2026-10-13: « tips go 100 percent to driver »; this
reverses the 90/10 rule of 2026-10-09. Backend migration 026 had put 10% in the database, migration 032 resets it to 0).
The courier and restaurant contracts, the T&Cs and the courier texts promise it, so the admin setting must not move
without them.
**Delivery distance: 6 km by default**, or what the business sets (1–30 km) in « Commandes et capacité »
(`../fairide-backend/rayonLivraison.js`; NULL used to mean « no limit » and accepted Antwerp).
**Order promo codes** (`order_percent`, `order_amount`, `order_free_delivery`, `../fairide-backend/codesPromo.js`) are
paid by Fairide like the balance: they lower `orders.total`, never the business's or the courier's share; online
payment only.
Subscription: €20/month, first month free, with the « petit mois = pas d'abonnement » guarantee: a month whose orders
do not exceed **€50** of products (VAT incl., no delivery or tips) is not charged, or refunded
(`../fairide-backend/garantieAbonnement.js`; threshold `SEUIL_GARANTIE_EUROS` in `formules.js`, read by the contract and the
emails — since 2026-10-11, contract `RESTO-2026.18`; it was « zéro commande » from 2026-10-02). The front texts say « 50 € » in
full (i18n): change them with the constant. Paid **mises en avant** have their own, separate « zero orders = refunded » rule.
**Offered by default during the launch (founder, 2026-10-07)**: the only automatic charge is the 10% commission on orders paid online.
A business sells without any subscription until the team turns billing on for it (Admin › Commerces › « Facturer
l'abonnement », `restaurants.subscription_billing_enabled`, false by default — see `formules.abonnementOffert`). Its
account page then shows « offert pendant le lancement » and the Stripe checkout refuses (`SUBSCRIPTION_WAIVED`).

- server: `commissionFairide` and `fraisService` in `../fairide-backend/pricing.js`, called by `routes/orders.js`;
  `service_fee` stores the system fee excl. VAT, `service_fee_vat` its VAT (0 under the franchise) — both already inside
  `delivery_fee`;
- client estimate: [src/fraisService.js](src/fraisService.js);
- cards are built at the business's in-store prices (`../fairide-backend/scripts/prix.js` corrects platform-priced cards);
  no ×1.10 any more. Since 2026-10-01 the business can no longer edit dishes or prices itself
  (`MENU_LOCKED`) — it asks, and the team applies;
- legal texts: contract `RESTO-2026.19` (in force 1 Nov 2026; 2026.18 widens the subscription guarantee, 2026.19 says Fairide charges no VAT and, revised before publication on 2026-10-13, the own-prices model; courier contracts `*-2026.8`), T&Cs `CGU-2026-10-13-b` (commission = 10 % of the price paid; says the subscription is 20 € with no VAT and that Fairide's system fee carries none), privacy
  `CONF-2026-10-17` (since 10-15: door-drop photo 30 days, courier position with the screen locked, courier SOS; 10-16-b: business staff
  accounts and group orders; 10-17: GatewayAPI as the SMS processor; they tell customers prices may be higher than on site). Never write « le prix du commerce » or « 100 % au
  restaurant » in customer-facing copy, and never « majoration » — it is « la commission de Fairide » (CODE-3).

## Corrections of 8 October 2026 (`docs/fairide-a-coder-2026-10-08.md`)

Each one has a test in `../fairide-backend/tests/correctifs-08-10.test.js`. What changed, so nobody undoes it:

- **The business is the only seller** (DEC-25/26). Fairide collects on its behalf and issues the customer **receipt**
  (`recuClient.js`, `GET /orders/:id/receipt`, three seller blocks); Stripe no longer creates invoices for customers. A
  company that needs an invoice asks the business.
- **Menus are proposed, then validated** by the business (« C'est bon », `/carte/valider/:token`, single-use hashed link);
  publishing refuses an unvalidated menu. Every price or VAT change is logged with who asked (`menu_item_history`).
- **VAT per dish belongs to the business**: proposed from the dish's nature (`tvaPlats.js`, no hard-coded 6 %), editable by
  the business despite `MENU_LOCKED`; a rate change for everyone gives 7 days to refuse (Admin › Commerces).
- **Alcohol is closed** until `ALCOHOL_ENABLED=true` on the server. Insurance, the AFSCA document and the alcohol licence are
  **alerts**, no longer blockers (business number, AFSCA number, contract, validated menu, allergens still block).
  Since 2026-10-10 the business no longer has to give its AFSCA number if it signs the professional declaration
  (now **`PRO-2026.3`**, 2026-10-11: adds the DSA art. 30(e) self-certification that it only sells law-compliant
  products; `declarationsCommerce.js`). **Signed with one checkbox at signup** (2026-10-12,
  [EngagementsInscription](src/components/commerce/EngagementsInscription.jsx) → `business.engagements` →
  `signerEngagementsInscription`), together with the allergen procedure; no AFSCA number or document is asked. The
  team's AFSCA check (Admin › Commerces › Conformité, [VerificationAfsca](src/components/admin/VerificationAfsca.jsx):
  four points on the establishment unit + screenshot) is an **optional spot check** — alerts only, never blocks
  publication, except a « Introuvable » result (no override; it also blocks auto-publication and new orders, and takes an
  online business off the site with an e-mail). Procedure: `../fairide-backend/docs/verification-afsca.md`.
- **Dedicated couriers need their consent** (audit 2026-10-19, shop-301): Mon commerce › Livraison sends an invitation; the
  courier accepts or declines it on his dashboard ([LivreurDedie](src/components/livreur/LivreurDedie.jsx), backend
  `livreurDedie.js`) and can leave at any time. Nothing changes for him, and the business sees no name or phone, until he accepts.
- **Pickup without a restaurant click** (2026-10-10): the restaurant sees the pickup code and compares it by eye; the
  **courier** confirms (`PATCH /orders/:id/picked-up`, accepted from `preparation` too). `/confirm-pickup` still exists.
  « Ma carte et mes engagements » ([ConformiteCarte](src/components/conformite/ConformiteCarte.jsx)) is one checkbox,
  one name, one button that posts each pending signature to its own route — each keeps its own version and hash.
- **Client absent at the door** (2026-10-10): the courier taps « Je suis à la porte », the client gets an e-mail, a push
  and a banner ([LivreurALaPorte](src/components/client/LivreurALaPorte.jsx)); closing needs **10 min and 2 calls** made
  through « Appeler le client » (`PATCH /orders/:id/call-client`, counted). Outcome: client not refunded (T&Cs, article
  Annulation: « reste due »), business keeps its share, courier paid and keeps the food, no admin task.
  `ATTENTE_PORTE_MIN` / `APPELS_CLIENT_MIN` in [src/conformite.js](src/conformite.js) mirror the backend constants.
- **E-mails** go through one branded wrapper (`../fairide-backend/emailEnveloppe.js`); team e-mails carry a subject tag
  (`[Commerces]`, `[Cartes]`, `[Livreurs]`, `[Messages]`, `[Comptes]`, `[Compta]`, `[Équipe]`) for Outlook rules.
  Preview them all with `node scripts/apercu-emails.js` in the backend. **No em dash in any e-mail** (founder, 2026-10-13):
  texts were rewritten, and `envoyer()` runs `sansTiretsCadratins` on subject and body as a safety net; subjects end « | Fairide ».
- **Couriers**: two statuses only (P2P removed); they set their minimum per ride and per km and only see offers above it
  (the customer's delivery fee rises to the cheapest courier's minimum, capped); **no delivery rating**; suspension only for
  fraud, serious misconduct or legal obligation; random check selfie at shift start (`controleSelfie.js`); grid of the 8
  criteria of art. 337/3 in Admin › Conformité. Never add a rating, ranking or penalty — that is criterion 6°/7°.
- **Accounting**: monthly export (`comptaMensuelle.js`) separates Fairide sales from third-party funds and is emailed once to
  the archive address; subscription invoices are Fairide's own (`FAIRIDE-ABO-…`) and go through Peppol.

## Three sellers per order (decided 2026-09-23)

The customer buys the food from the business, the **delivery from the independent courier** who accepts
the job, and the system fee (inside the delivery fee) from Fairide. The backend records a seller per line (`order_lines`, see
`../fairide-backend/troisVendeurs.js`). What the front end shows because of it:

- checkout recap labels each line with its seller (`conformite.seller*`);
- [VendeurLivraison](src/components/conformite/VendeurLivraison.jsx) on the client's orders — the
  courier's "Prénom N.", company number and VAT regime once known, and a free "decline this courier"
  while the order hasn't left;
- driver offers show the price, any Fairide-paid increase and a **Refuse** button, and an approximate
  destination (the server strips the client's name, phone and house number before the job is taken);
- [EspaceVendeurLivreur](src/components/conformite/EspaceVendeurLivreur.jsx) — minimum fee and the
  courier's sale documents (self-billing mandate, accepted in the notices step);
- admin › Conformité › *Attribution des courses* ([DispatchTab](src/pages/admin/compliance/DispatchTab.jsx)).

Never add anything that ranks, rates or penalises couriers for refusing: the backend's
`tests/trois-vendeurs.test.js` fails if dispatch starts reading such data, and the courier notice promises it.

## Conventions

**French UI copy says « tu », everywhere (founder decision, 2026-10-15)** — clients, businesses and couriers alike. The
exceptions are deliberate: the legal pages (`terms.*` and `privacy.*` are hashed and versioned, `cookiesPolicy.*`,
`accessibilite.*`, the ranking and DSA-report texts in `conformite.ranking_*`) keep « vous », and so does a business speaking
*to* Fairide (« je vous envoie ma carte »). Scroll calls take `behavior: defilement()` from [src/gestes.js](src/gestes.js),
never a hard-coded `'smooth'` (it ignores reduced motion). The cart is kept 24 h in localStorage (declared in
`cookiesPolicy.technical`); scheduled-order slots follow the business's hours and closures (`scheduleUtils.js`).

**Code comments are in French, and they are unusually substantive** — they explain *why*, cite
the file that motivated a decision, and record what was tried and rejected. This is the
strongest convention in the repo. Match it: write French comments, and explain reasoning
rather than restating the code.

**Never describe a feature as existing without verifying it in the code.** The repo already
practises this — see the header of
[src/pages/restaurant/GuidePage.jsx](src/pages/restaurant/GuidePage.jsx), which states that
its contents were checked against the source before being written, and keeps a numbered TODO
of absent features precisely so nobody re-invents or over-claims them.

**Commit messages are in French**, present tense, describing the user-visible change
("Ajoute l'impression d'un bon de livraison par commande, côté restaurateur").

**Watch file size.** [Account.jsx](src/pages/Account.jsx) (1,173) and
[MenuPage.jsx](src/pages/restaurant/MenuPage.jsx) (929) are the two to stop growing — extract a
component rather than adding to them. `AdminAccountingPage.jsx` is down to 488 and is no longer a
concern. `menuCategories.js` (3,978) is a data table, not logic — that one is fine.

## End-to-end test plan fixes (2026-10-02)

The browser run of [docs/fairide-tests-e2e-standalone.html](docs/fairide-tests-e2e-standalone.html) led to these, all
covered by `../fairide-backend/tests/correctifs-e2e.test.js`:

- **Times always in Brussels time**: [src/fuseauBruxelles.js](src/fuseauBruxelles.js), imported first in `main.jsx`,
  defaults every `toLocale*String` to Europe/Brussels. Amounts go through `euros()` ([src/prixPlat.js](src/prixPlat.js)),
  never `` `${x.toFixed(2)}€` ``.
- **Cart = idempotency key**: the cart carries `requestId` (sent as `clientRequestId`); the same cart in two tabs gives
  one order, the second gets `ORDER_ALREADY_PLACED`. Explicit logout empties the cart; an expired session keeps it.
- **Alcohol** is detected by dish name, and a section only counts when it is alcohol-only (« Bières & boissons » no
  longer makes Coca 18+; migration 011 fixed existing rows). « Déposer devant la porte » is refused with alcohol.
- **Simulation orders** never enter admin money figures (`sqlCommandeReelle` in every finance/KPI query).
- **New features**: client data export and « log out everywhere » ([MesDonnees](src/components/MesDonnees.jsx)), order
  again ([src/recommander.js](src/recommander.js)), report a problem ([SignalerProbleme](src/components/client/SignalerProbleme.jsx)
  → support ticket), notification bell ([ClocheNotifications](src/components/client/ClocheNotifications.jsx), fed by a DB
  trigger), promo code at checkout; business pause 15/30/60 min ([InterrupteurService](src/components/commerce/InterrupteurService.jsx)),
  extra prep time on accept, minimum order, per-dish client note (printed on the ticket); courier incidents
  ([IncidentsCourse](src/components/livreur/IncidentsCourse.jsx): hand back a job, waiting at the business, client absent)
  and the client's « no courier after 20 min → cancel, refunded » ([SansLivreur](src/components/client/SansLivreur.jsx)).
- Commitments signed in « Ma carte » show an EN/NL translation; **the French text stays the one that is hashed and signed**.

## Launch switch: the GO button (founder, 2026-10-18)

**Delivery and online payment open when the team presses GO, not on a date.** A date opens by itself even with 4 couriers,
and customers would pay for deliveries nobody can do. Takeaway paid at the shop keeps its date (1 November,
`FAIRIDE_PICKUP_OPEN_AT` / `VITE_PICKUP_OPEN_AT`): it needs no courier and no Stripe. Do not reintroduce
`FAIRIDE_DELIVERY_OPEN_AT` / `FAIRIDE_ONLINE_PAYMENT_OPEN_AT` (no longer read, so a leftover Railway variable can't reopen
delivery) or `VITE_DELIVERY_OPEN_AT` / `VITE_ONLINE_PAYMENT_OPEN_AT` (unused; still listed in `app-android-test.yml`, harmless).

- **Server** (`../fairide-backend/lancement.js`): state = `platform_flags.launch_go` + `platform_parameters.launch_go_at`
  (time of the FIRST GO, kept if the team closes and reopens). Read on every order, never cached; a failed read means
  closed. `FAIRIDE_GO=on` forces it open (staging, simulation scripts). `routes/orders.js` gates delivery
  (`DELIVERY_NOT_OPEN`) and online-paid takeaway (`ONLINE_PAYMENT_NOT_OPEN`), with `opensAt: null`: no date is promised.
  Admins and accounts the team marked test (`compteExempte`) still pass, so the whole live flow can be tested before GO.
- **Button**: Admin › Aujourd'hui ([BoutonGo.jsx](src/components/admin/BoutonGo.jsx)), backed by
  `routes/adminLancement.js` (`GET/POST /api/admin/launch`). Pressing it needs typing GO; only `owner` and `admin` roles
  (`ROLE_PREFIXES_METHODE` in `middleware/auth.js`); every press is written to `platform_audit_log`. `launch_go` is
  deliberately skipped by the generic `PATCH /admin/flags`. The card shows couriers/businesses ready (same checks as
  `pretLancement.js`) and couriers free right now, which is what the decision rests on.
- **First GO only**: an e-mail to approved real businesses and couriers (`annoncerOuverture`; the contract says the
  date is « announced by e-mail »), and every subscription still on trial gets its trial end pushed back by the time
  between activation and GO (`prolongerEssais`: the free month counts from the opening). A Stripe failure opens an
  admin task instead of blocking.
- **After GO, no courier = no delivery.** `lancement.livreursDisponibles` counts couriers who could take the job now:
  approved, Stripe active, status verified, not paused, not test, no job in hand, no pending selfie check, right pool
  (`delivery_mode` own/fairide), bikes only within `VELO_MAX_KM`. Zero → order and quote refused with
  `NO_COURIER_AVAILABLE` (409). It only COUNTS couriers: never add ratings, rankings or acceptance history to it
  (employment-presumption rule, see `notifLivreurs.js`). Scheduled orders are judged like immediate ones.
- **Website** ([src/launch.js](src/launch.js)): reads `GET /orders/launch` (`go`, `goAt`) at start, every minute while
  visible and on return to the tab; the last answer is kept in `localStorage` (`fairide_lancement`). Components that depend
  on it call `useLancement()` to re-render. `livraisonDisponible(id)` reads `GET /orders/delivery-available/:id`
  (yes/no only, never the courier count); [Checkout](src/pages/client/Checkout.jsx) and
  [RestaurantMenu](src/pages/client/RestaurantMenu.jsx) switch to takeaway and show `noCourierNow` / `noCourierBanner`.
  Texts say « bientôt » with no date; `datePremierPrelevement()` returns null before GO (`*AvantGo` texts).
- **Contract** `RESTO-2026.20` (`restaurantContract.js`): « à la date que Fairide annonce au Commerce par e-mail »
  instead of 10 November. Calendar set to published 20/10/2026, in force 05/11/2026 (15-day P2B notice); `notifier`
  is false, so the founders send it themselves, and both dates move if it goes out later.
- Tests: `../fairide-backend/tests/bouton-go.test.js`; `scripts/simuler-parcours-client.js` presses GO itself.

## Known gaps

**Pre-launch cleanup (2026-10-17).** Demo shops no longer come back on deploy: every demo seed in the backend's `server.js` runs only
with `FAIRIDE_SEED_DEMO=on` (absent in production). SMS codes go through GatewayAPI, only to +32/+31/+33/+49/+352, the rest by
e-mail. Stripe is still in test mode until Fairide SRL is verified live — see `../fairide-backend/docs/nettoyage-pre-lancement-2026-10-17.md`.


Real, verified as absent on 2026-09-22 — not speculation.

1. **Background geolocation exists in the app only** (2026-10-15). Driver tracking goes through `suivrePositionCourse`
   ([natif.js](src/natif.js)), used by [driver/Dashboard.jsx](src/pages/driver/Dashboard.jsx) and
   [driver/MapPage.jsx](src/pages/driver/MapPage.jsx): in the native app, while an order is « livraison », the
   `@capacitor-community/background-geolocation` plugin runs a foreground service (notification « Fairide : livraison en
   cours ») that keeps sending when the phone locks; otherwise, and on the website, `watchPosition`, which stops when the
   phone locks — there is no web fix. Not yet tried on a real phone; iOS needs the Info.plist / Background Modes steps in
   [docs/application-mobile.md](docs/application-mobile.md). The customer-facing map still shows a staleness warning after
   two minutes so a frozen map is at least legible ([DeliveryTrackingMap](src/components/DeliveryTrackingMap.jsx)).
2. **No SSR.** `npm run build` runs a prerender ([scripts/prerender.mjs](scripts/prerender.mjs)) that writes
   static HTML for the public pages (three languages) and the restaurant pages, and a `dist/sitemap.xml`
   (138 addresses on 2026-09-23). Pages added after the build list are not prerendered.
3. **Stock dish photos are still on.** `VITE_STOCK_DISH_PHOTOS` defaults to `on`, which fills a
   photo-less dish with a stock image when its name matches the table exactly. Showing a stock photo
   as a real merchant's dish is a misleading commercial practice — this must be `off` before the
   first real restaurant goes live.
4. **Form labels are associated on most, not all, forms** — 64 of the 77 files containing a
   `<label>` also use `htmlFor`. Follow the `htmlFor`/`id` pattern when you touch a form.
5. **Imported prices are platform prices.** Cards imported from Uber Eats or Deliveroo carry the
   marked-up prices merchants set there to absorb a 30% commission — measured at **+39% on average**
   against Snack Bodrum's counter prices. Fairide builds cards at the merchant's **in-store prices** (model of 2026-10-13), so an
   imported card is wrong until its prices are corrected. `../fairide-backend/scripts/prix.js` does the correction; the real prices have to come from
   the merchant. The contract deliberately does *not* oblige in-store prices — that would be a parity
   clause, see the header of `../fairide-backend/restaurantContract.js`.
6. See the numbered TODO in `GuidePage.jsx` for the restaurateur-side feature backlog. Of the five items, only
   WhatsApp order tickets is still absent (re-checked 2026-10-06). The guide text itself was rewritten against the
   code that day — keep it in step when a delay or a button changes.
7. **The admin cannot close a business for the evening.** Only the business closes or pauses itself
   (InterrupteurService); the admin's one lever is « Retirer du site » (unpublish). See
   [docs/procedures-incidents.md](docs/procedures-incidents.md), case 3.

### Resolved since earlier versions of this file

Listed so nobody re-implements them: **Web Push exists** ([public/sw.js](public/sw.js) handles `push`
and `notificationclick`, with [src/push.js](src/push.js) and
[usePushNotifications.js](src/hooks/usePushNotifications.js); VAPID keys live in the backend env).
**The PWA is complete** — `manifest.json` ships PNG icons at 192, 512 and maskable-512. The service
worker **caches nothing, on purpose**; read its header before adding a cache.

## Git

Remotes are `https://github.com/lamythibault5-cmyk/fairide-frontend` and, for the backend,
`https://github.com/lamythibault5-cmyk/fairide-backend`. The `gh` CLI is **not installed** — use
plain `git`, and build pull-request links by hand:
`https://github.com/<owner>/<repo>/compare/main...<branch>?expand=1`.

Work on a feature branch and let the owner merge; don't commit straight to `main` unless asked, and
**never push without being asked to.** When you are asked to push, give the compare link in the same
reply.
