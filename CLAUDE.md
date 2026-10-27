# CLAUDE.md

Guide for Claude Code working in this repository, and the entry point to `docs/agents/`. If you change something this
file or those docs describe, change them in the same commit: a stale guide is worse than no guide, because it gets
believed. Figures re-checked against the code on 2026-10-22.

## What this is

Fairide is a food-delivery / local-commerce platform for Brussels. Menus show the business's own prices; on an order paid
online Fairide keeps 10 % of the price paid (no VAT on it: Fairide is a VAT franchisé), versus 22-32 % commission on the big
platforms. The customer pays the delivery fee on top, nothing else. **This repo is the front end only**: the website
<https://fairide.be> (Vercel, SPA rewrite in [vercel.json](vercel.json)) and the Android / iOS apps, which wrap the same
`dist/` with Capacitor.

- Backend API: `https://fairide-backend-production.up.railway.app/api` (Railway), repo
  `https://github.com/lamythibault5-cmyk/fairide-backend`, checked out in the workspace at `fairide-backend/` (its own
  `CLAUDE.md`). Menu import, price tooling, e-mails, money and legal rules are enforced there.
- The workspace `CLAUDE.md` (one folder up from the main checkouts) says where worktrees, mockups and menus go, and how
  to check that a merge really reached production.

## How to work here

- **Branch from `origin/main` in a worktree** (`worktrees/front-<topic>`, see the workspace `CLAUDE.md`), never in the
  shared `fairide-frontend/` checkout: other sessions work at the same time. Stage only your own files.
- **Never commit or push without the founder's (Owen's) go.** When asked to push: open the PR on `main` (never on another
  feature branch: stacked PRs got lost), give its link, and say in plain words what a CI / build / signing change does.
  When a change needs the backend too, say which PR to merge first (usually the backend).
- **A big design change starts as an HTML mockup** in the workspace `maquettes/<topic>/`, with a questionnaire, and is
  built only after Owen picks (workspace `CLAUDE.md`). Fixes don't need one.
- **Never describe a feature as existing without verifying it in the code**, and never trust a number in a doc without
  re-checking it (several in this file were wrong until 2026-10-22).

## Commands and checks

```
npm install            # node_modules is not checked in; in a worktree, junction it to the main checkout's instead
npm run dev            # vite dev server (needs .env.local, see below)
npm run build          # production build + prerender of the public pages (scripts/prerender.mjs: head, readable body
                       # text for crawlers without JavaScript in contenuStatique.mjs, sitemap, IndexNow ping on Vercel production)
npm run lint           # oxlint: 0 errors, ~150 pre-existing warnings on 2026-10-22
npm run check:i18n     # fr / nl / en have the same keys
npm run check:app      # every app page in app mode, four profiles: fails on any website chrome, crash, scrolling full screen
npm run check:barres   # the bottom tab bar stays on the bottom edge at Android sizes
npm run preview        # serve the build locally
```

**Before every push: `lint`, `check:i18n`, `build`, and `check:app` for anything the app shows** (it needs Chrome or Edge).
CI ([.github/workflows/ci.yml](.github/workflows/ci.yml)) runs lint, check:i18n, build and `npm audit` on every PR, but
**not** check:app nor check:barres: run them yourself. Lint warnings are mostly old: check that *your* files are absent
from the output. There is no test framework in this repo; where behaviour matters, check it in the browser.

The backend has the tests (`npm test` there: `node --test`, 156 files, an in-memory Postgres, no database needed). Run
them when your change touches anything the backend also reads (legal texts, page parsing, menu shape): some of them hash
this repo's i18n files (see « Legal texts » below).

Other workflows: `app-android-test.yml` builds the Fairide Test APK on every merge to `main`; `app-android-store.yml`
(by hand: Actions › *App Android Play Store* › *Run workflow*) builds the signed Play bundle and uploads it to Internal
testing itself — never bump `versionCode` by hand; `staging-miroir.yml` copies `main` to the `staging` branch
(staging.fairide.be).

### Environment variables

Copy [.env.example](.env.example) to `.env.local` before working. All are optional in the sense that
each has a fallback — but **the `VITE_API_BASE` fallback is the production Railway backend**, so
without a `.env.local` your dev server edits live data. Local backend on a Neon dev database: see
`fairide-backend/.env` (port 5173 for CORS).

| Variable | Purpose |
|---|---|
| `VITE_API_BASE` | Overrides the Railway backend URL in [src/api.js](src/api.js) |
| `VITE_GOOGLE_CLIENT_ID` | Google Sign-In (script loaded in [index.html](index.html)) |
| `VITE_SENTRY_DSN` | Enables Sentry — on the website only *after* cookie consent, see [src/main.jsx](src/main.jsx); in the app on by default (`docs/agents/appli.md`) |
| `VITE_STOCK_DISH_PHOTOS` | `on` (code default) fills photo-less dishes from a stock-image table; `off` disables it. **Production is `off`** (Vercel since 2026-10-20, and the Play build): keep it off wherever real shops are shown — see [src/menuCategories.js](src/menuCategories.js) |
| `VITE_MAP_TILE_URL` / `VITE_MAP_TILE_ATTRIBUTION` | Map tiles for all five Leaflet maps ([src/carte.js](src/carte.js)). Empty = public OpenStreetMap tiles, whose usage policy excludes heavy commercial use — **set before launch** |
| `VITE_PLAUSIBLE_DOMAIN` | Cookieless analytics. Empty = [src/analytics.js](src/analytics.js) loads nothing at all — set it in the Vercel variables |

## Rules that are never broken

Founder decisions and legal constraints. Each one has its reasons and details in the doc named at the end of its line;
read that doc before working near it.

**The app**
- The app never shows website chrome (header, footer, legal row, cookie card): `npm run check:app` must pass before any
  push, and a new app page goes into its `PAGES` list, never removed from it. *(appli.md)*
- The bottom tab bar sits on the bottom edge (`bottom: 0` + padding `max(6px, var(--bas-ecran))`, the system inset minus 12 px),
  never a fixed offset. *(appli.md)*
- Stripe pages open through `allerAuPaiement`, never `window.location.href` (it leaves the app). *(appli.md)*

**Look and feel**
- Two brand colours: iris `#3B2FB5` and lime `#C8F03C`. Lime only on iris, or as a filled block with ink text; backgrounds
  are white or iris, no gradients, no shadows (glass exists in the app only, `html.appli`); one lime accent per view, and
  that lime is the screen's next click: one obvious action, saying what and how much, never greyed out.
  Change colours in the `:root` tokens, never at call sites. *(design.md)*
- A tap never lands mid-text: every screen opens at the top or on the exact thing to do, never on an anchor halfway down a
  long page; a tab comes back to what was on screen when it was left, never to a mere pixel height; when the action is below
  the fold, a floating lime button goes down to it. *(design.md, rule 5)*
- Fonts: Inter (interface) and Inter Tight (`h1`–`h3`), served by Fairide — never `fonts.googleapis.com`. Bricolage
  Grotesque is for the word `fairride` only, always through `MotMarque.jsx` (« ride » in the accent). The brand is
  « Fairride » (two r, 2026-10-25); the company stays « Fairide SRL ». The logo is the bicycle « 5a » and is never a link. *(design.md)*
- No emojis anywhere, admin included: icons are [Icone.jsx](src/components/Icone.jsx). Don't add struck-through text to
  customer screens (founder, 2026-10-16: state a figure plainly, e.g. « 22-32 % »). *(design.md)*
- `ConfirmDialog` / `ReasonDialog`, never `window.confirm` / `window.prompt`. Scroll locks go on `<html>`, never `<body>`.
  *(design.md)*

**Money and wording** *(argent.md, cartes.md)*
- Fairide keeps 10 % of the price paid; a business may raise its prices by 10 % at most; the courier gets 90 % of the
  delivery fee and 100 % of the tip. These are fixed rules in the backend (`REGLES_FIXES`), never settings.
- Never multiply prices at import: shop prices go in as they are (`--prix-magasin`).
- Customer-facing copy never says « moins cher » / « cheaper than », « le prix du commerce », « 100 % au restaurant »,
  « majoration » (it is « la commission de Fairide ») or that the restaurant « gagne plus ». Write « restaurant », never
  « resto ». The argument is « le restaurant ne doit plus gonfler ses prix ».
- Inside the app, customers never see the commission or the courier's 90 %: the 10 % pitch lives only in onboarding and
  on the website front page, next to a clear comparison with the ~30 % of the big platforms.

**People and the law** *(conformite.md)*
- Never rate, rank, score or penalise couriers — no customer rating, no refusal-based ranking, no hidden throttle, no
  per-courier table: it would create a presumption of employment. Backend tests fail if dispatch reads such data.
- No customer reviews, stars or ratings anywhere: the founder removed reviews on 2026-10-22 (too few users yet, a shop with
  few stars would look bad). They may come back later; until then never show a star, a rating or a « note » sort. *(conformite.md)*
- Legal texts are hashed: changing `terms.*` or `privacy.*` means registering a new version in the backend (`cgu.js`).
- Marketing to customers needs an unticked opt-in box; never opt-out. No alcohol is sold (`ALCOHOL_ENABLED` stays off).
- French UI says « tu » everywhere; the legal pages keep « vous ». Onboarding makes no claim the code does not back.

**The launch** *(lancement.md)*
- Delivery and online payment open when the team presses GO, never on a date; after GO, no free courier means no
  delivery. Never reintroduce `*_DELIVERY_OPEN_AT` / `*_ONLINE_PAYMENT_OPEN_AT`.

## Read before touching

| You are about to touch… | Read first |
|---|---|
| Anything the app shows: `src/pages/app/`, `experienceApp()`, `html.appli`, natif.js, push, sign-up in the app | [docs/agents/appli.md](docs/agents/appli.md), then [docs/application-mobile.md](docs/application-mobile.md) for builds and stores |
| CSS, a screen's look, buttons, fields, icons, fonts, the website shell, the admin console | [docs/agents/design.md](docs/agents/design.md) |
| A price, a fee, a share, a promo code, the subscription, invoicing, the three sellers, dispatch | [docs/agents/argent.md](docs/agents/argent.md) |
| Checkout, signup, the courier dossier, admin decisions, DSA reports, DAC7, any legal text | [docs/agents/conformite.md](docs/agents/conformite.md) |
| A restaurant's menu: import, prices, « C'est bon », dishes without photos | [docs/agents/cartes.md](docs/agents/cartes.md) and the workspace skill `fairide-menu` |
| Delivery or online payment opening, the GO button | [docs/agents/lancement.md](docs/agents/lancement.md) |
| Something in orders, e-mails, couriers, alcohol or accounting that looks odd and you want to « fix » | [docs/agents/acquis.md](docs/agents/acquis.md) — decisions already made |
| A claim that a feature exists, or a promise of one | [docs/agents/manques.md](docs/agents/manques.md) — known gaps |
| A text people read first: front page, « Notre histoire », onboarding, sign-up, welcome e-mails, newsletter, store listing, flyers | [docs/agents/voix.md](docs/agents/voix.md) — why first, the reader's own gain, the inflated-price villain |
| Going live | [AVANT-PRODUCTION.md](AVANT-PRODUCTION.md) (the one go-live list) and [docs/procedures-incidents.md](docs/procedures-incidents.md) |

`docs/archives/` holds outdated documents (the Uber design analysis, the old bowl logo, a September legal audit): never
follow them. [FairRide-5a-spec.md](FairRide-5a-spec.md) is the brand source for the palette and the logo only.

## Stack

React 19 · Vite 8 · react-router-dom 7 · oxlint · plain CSS.

**No TypeScript. No test framework. No CSS framework.** Don't introduce any of the three
without asking — their absence is the current state of the project, not an oversight to fix
in passing.

Other dependencies: `@sentry/react` (error reporting), `leaflet` (maps, no react-leaflet wrapper), `@dnd-kit/*`
(drag-and-drop for menu ordering). `@capacitor/*` wraps the same `dist/` into the iOS and Android apps (`npm run app:sync`,
`app:android`, `app:ios`); everything native goes through `src/natif.js` and `src/pushNatif.js`, and native-only plugins
are loaded with `import()` from `natif.js` so the website never downloads them.

## Architecture

### Four roles, one SPA

Every route lives in [src/App.jsx](src/App.jsx) (311 lines) — the full route map, read it first when
orienting. Access is gated by `<ProtectedRoute role="...">`.

**Routes are code-split by role.** Only the public entry path (home, login, restaurant list, restaurant
menu) is statically imported; everything else is lazy behind `<Suspense>` — 79 lazy pages on 2026-10-22 (after the reviews pages went), through the `lazyPage()` wrapper
([src/lazyPage.js](src/lazyPage.js)). Keep it that way when adding a route: a static import of a dashboard page pulls it into
every customer's first load.

| Role | Route prefix | Pages |
|---|---|---|
| Client | `/home`, `/restaurants`, `/checkout`, `/orders`, … | [src/pages/client/](src/pages/client/) |
| Restaurant | `/dashboard/*` | [src/pages/restaurant/](src/pages/restaurant/) |
| Driver | `/driver/*` | [src/pages/driver/](src/pages/driver/) |
| Admin | `/admin/*` | [src/pages/admin/](src/pages/admin/) |

`/restaurants` and `/restaurants/:id` are **deliberately public** — no `ProtectedRoute` — so
they stay indexable and shareable. Since 2026-10-22 a business page's address is its readable slug
(`/restaurants/delispice-woluwe-saint-pierre`, set by the backend, migration 083): build links with `cheminFiche(r)`
([src/adresseFiche.js](src/adresseFiche.js)), never `/restaurants/${r.id}` when you have the object. Old id links still
work: [FicheCommerce.jsx](src/pages/client/FicheCommerce.jsx) turns the address into the id that `RestaurantMenu` always
works with, and the page then swaps in the slug address; the prerender writes a redirect page at each old id address. Only actions (order, favourite) require login. Don't
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
components). The server translates its error messages for EN / NL users at the exit (backend `traductionErreurs.js`,
keyed on the exact French text; a test fails if a listed text disappears from the routes) — reword an error there too. Callers catch and pass to `useToast()`. Don't call `fetch` directly in a component.

**401 handling is centralised.** A 401 on a request that *sent a token* means an expired session:
`api()` clears the session through the handler `AuthContext` registers via `setSessionExpiredHandler`,
and `ProtectedRoute` does the redirect. A 401 on a request with *no* token is a login failure and is
thrown to the caller as normal. Don't add per-call 401 checks.

### Error handling

[AppErrorBoundary](src/components/AppErrorBoundary.jsx) wraps the whole router in
[main.jsx](src/main.jsx) and reports to Sentry. Without it a single render error blanks the page.

### Internationalisation

[src/i18n/translations.js](src/i18n/translations.js) holds `fr` / `en` / `nl` tables; default `fr`.
**The build splits each table in two** ([scripts/vite-decoupe-traductions.mjs](scripts/vite-decoupe-traductions.mjs),
2026-10-27): the sections read by the first-load pages ship first, the rest (consoles, legal texts) arrives after the page
shows, and every `lazyPage` waits for it. Keep loading pages through `lazyPage()`; a plain `lazy()` reached from a
first-load page has its sections kept in the first part automatically. `fr.js`, `nl.js`, `en.js` stay the sources.
**312 of the 359 `.jsx` files** call `useLanguage()` (2026-10-22). Adding a key means adding it to all three locales;
`npm run check:i18n` (also in CI) fails otherwise. **`fr.js` and `nl.js` are committed with CRLF line endings**: a
`sed -i` from Git Bash rewrites them to LF and the diff shows ~8,500 changed lines — edit them with the Edit tool or Node,
and check `git diff --numstat` before committing.

The remaining untranslated surfaces are mostly deep admin screens. Check which kind of component you
are in before hardcoding a string.

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

**Mockups are not in this repo (since 2026-10-22).** They live in the workspace folder `maquettes/<topic>/`, next to
this repo, never committed. A comment such as « version B of maquettes/accueil-site/accueil-site.html » names that
folder; the rules for making one are in the workspace `CLAUDE.md`. Never recreate a `mockups/` folder here: the repo is public.

**Never describe a feature as existing without verifying it in the code.** The repo already
practises this — see the header of
[src/pages/restaurant/GuidePage.jsx](src/pages/restaurant/GuidePage.jsx), which states that
its contents were checked against the source before being written, and keeps a numbered TODO
of absent features precisely so nobody re-invents or over-claims them.

**Commit messages are in French**, present tense, describing the user-visible change
("Ajoute l'impression d'un bon de livraison par commande, côté restaurateur").

**Watch file size.** [Auth.jsx](src/pages/Auth.jsx) (1,932 on 2026-10-25, down from 2,049: the courier sign-up fields moved to the dossier), [Account.jsx](src/pages/Account.jsx) (1,382, up from
1,173 on 2026-10-22) and [MenuPage.jsx](src/pages/restaurant/MenuPage.jsx) (910) are the ones to stop growing (counted
2026-10-24) — extract a component rather than adding to them. `AdminAccountingPage.jsx` (491) is no longer a
concern. `menuCategories.js` (3,978) is a data table, not logic — that one is fine.

## Git

Remotes are `https://github.com/lamythibault5-cmyk/fairide-frontend` and, for the backend,
`https://github.com/lamythibault5-cmyk/fairide-backend`. The `gh` CLI is installed and logged in: `gh pr create --base main`.

Work on a feature branch in a worktree and let the owner merge; never commit straight to `main`, and **never push
without being asked to**. When you are asked to push, give the PR link in the same reply. After a merge, check that
production really serves it (workspace `CLAUDE.md`, « After a merge ») before saying it is live.
