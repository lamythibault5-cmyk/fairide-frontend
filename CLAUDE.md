# CLAUDE.md

Guide for Claude Code working in this repository.

Every figure below was re-checked against the source on 2026-09-23. If you change something this
file describes, change this file too — a stale guide is worse than no guide, because it gets
believed.

## What this is

Fairide is a food-delivery / local-commerce platform for Brussels, positioned on a
commission capped at 10% (vs. 22-32% on the big platforms). **This repo is the front end
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

```
npm install       # node_modules is not checked in and may be absent — run this first
npm run dev       # vite dev server
npm run build     # production build
npm run lint      # oxlint — the only automated check that exists
npm run preview   # serve the build locally
```

`npm run lint` is the whole verification story **in this repo**, and it currently reports ~168
pre-existing warnings across the codebase. Don't read a clean-looking tail as success: check that
*your* files are absent from the output. There is nothing else to run here, so read your changes
carefully and, where behaviour matters, check them in the browser with `npm run dev`.

The backend does have tests (`npm test`, 71 of them, `node --test`). If your change touches
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

Every route lives in [src/App.jsx](src/App.jsx) (224 lines) — the full route map, read it first when
orienting. Access is gated by `<ProtectedRoute role="...">`.

**Routes are code-split by role.** Only the public entry path (home, login, restaurant list, restaurant
menu) is statically imported; everything else is `React.lazy` behind `<Suspense>` — 70 lazy imports as
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
"fix" this by wrapping them.

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

Both throw `ApiError` (an `Error` with a `status` field) carrying a French, user-facing message.
Callers catch and pass to `useToast()`. Don't call `fetch` directly in a component.

**401 handling is centralised.** A 401 on a request that *sent a token* means an expired session:
`api()` clears the session through the handler `AuthContext` registers via `setSessionExpiredHandler`,
and `ProtectedRoute` does the redirect. A 401 on a request with *no* token is a login failure and is
thrown to the caller as normal. Don't add per-call 401 checks.

### Error handling

[AppErrorBoundary](src/components/AppErrorBoundary.jsx) wraps the whole router in
[main.jsx](src/main.jsx) and reports to Sentry. Without it a single render error blanks the page.

### Styling

**One file: [src/styles.css](src/styles.css)** (4,589 lines), imported once in `main.jsx`.
Global class names, no CSS modules, no Tailwind. Inline `style={{}}` is used freely for
one-off spacing and is an accepted pattern here.

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
| `--red` `--blue` `--orange` `--purple` | | Status colours only, never brand |
| `--radius` / `--radius-chip` | `20px` / `6px` | Cards / chips and controls |
| `--shadow` | `none` | Kept as a token so old call sites resolve to nothing |

**Three rules that are not negotiable, all inherited from the spec:**

1. **Lime only ever sits on iris, or as a filled block with `--ink` text on it.** Lime as text,
   as a 1px border or as a thin rule on a white page fails contrast and is invisible. Wherever
   you need "the accent, but on a light surface", the token is `--gold-deep` — which is iris.
2. **Backgrounds are white or iris. No third background colour**, and no gradients, no blurred
   halos, no drop shadows. Elevation is expressed by a hairline border.
3. **One lime accent per view.** If a screen already has a `btn-gold`, its active tab / badge /
   nav item uses white or iris instead.

The old names survive as aliases so ~100 call sites keep working: `--gold` = lime, `--gold-deep`
= iris, `--teal` / `--teal-deep` = iris. Prefer `--iris` / `--lime` in new code.

Fonts: **Space Grotesk** for the whole interface (400/500/700), `@import` at the top of
`styles.css`. Fraunces was removed — the personality comes from scale and tracking, not from a
serif/sans pair. Headings are `-0.02em`.

The one exception is the word `fairide` itself, which is set in **Bricolage Grotesque** (700–800,
optical sizing on) via the `.wordmark` class — lowercase, `-0.03em`. It is a *logotype* face, loaded
from a `<link>` in [index.html](index.html) rather than the `@import`, because the splash screen
paints before `styles.css` exists. Seven call sites carry the class; `.wordmark` sets the family and
nothing else. **Don't extend it to headings** — that would re-open the two-font pairing the design
direction closed when it dropped Fraunces.

Buttons: `.btn-gold` (lime) is **the** decisive action of a screen — pay, confirm, sign in.
`.btn-teal` (iris) is the ordinary primary action, and the default in dashboards. `.btn-outline`
is secondary, `.btn-hero-ghost` is the secondary button on an iris ground.

Confirmation modals use [ConfirmDialog](src/components/ConfirmDialog.jsx) — never `window.confirm`,
which is suppressed in installed PWAs and webviews. The five `window.confirm` hits you'll find in
`src/` are all inside comments explaining this; there are no live calls. `window.prompt` has the
same problem and the same replacement, [ReasonDialog](src/components/admin/ReasonDialog.jsx).

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

The empty frame **survives in [MenuItemRow.jsx](src/components/MenuItemRow.jsx)**, the restaurateur's
editor, and that is deliberate: there it isn't filling a hole, it's prompting for a photo. Don't
"unify" the two.

### Internationalisation

[src/i18n/translations.js](src/i18n/translations.js) holds `fr` / `en` / `nl` tables; default `fr`.
**203 of the 238 `.jsx` files** call `useLanguage()` — this is now broad coverage, not the partial state
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

An imported card is written but **not online**: the business stays `pending` until someone clicks
Approve and Publish in the admin console. Don't describe an import as "live".

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
- **Merchant**: card signature, allergen attestation and professional declaration in
  [ConformiteCarte](src/components/conformite/ConformiteCarte.jsx) (menu page); allergens / VAT / alcohol
  per dish in the dish editor; allergy confirmation and ID check at the counter in the orders page.
- **Courier**: notices to accept before the first ride, biometric consent before Stripe Identity,
  nationality and residence permit (onboarding); ID check at the door (dashboard).
- **Admin**: suspending anyone goes through [DecisionDialog](src/components/admin/DecisionDialog.jsx)
  (facts + contractual basis) — the API refuses a bare `{ status: 'blocked' }`. New compliance tabs
  (decisions, DSA reports, breaches, processors, prohibited products, parameters) are in
  [pages/admin/compliance/](src/pages/admin/compliance/).
- **T&Cs text**: changing `terms.*` in the i18n files changes the text clients accept. Bump the date in
  `terms.draftWarning` and register the new version and hash in the backend (`scripts/empreinte-cgu.js`,
  `cgu.js`) — the backend test fails until you do.

## Conventions

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

## Known gaps

Real, verified as absent on 2026-09-22 — not speculation.

1. **No background geolocation.** Driver tracking uses `watchPosition`
   ([driver/Dashboard.jsx](src/pages/driver/Dashboard.jsx),
   [driver/MapPage.jsx](src/pages/driver/MapPage.jsx)), which survives a backgrounded tab far better
   than the old `setInterval` but still stops when the phone locks. There is no web fix — it needs a
   native or Capacitor build. The customer-facing map shows a staleness warning after two minutes so
   a frozen map is at least legible
   ([DeliveryTrackingMap](src/components/DeliveryTrackingMap.jsx)).
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
   against Snack Bodrum's counter prices. The Fairide contract commits to no more than +10% over the
   in-store price, so an imported card is not contract-compliant until its prices are corrected.
   `../fairide-backend/scripts/prix.js` does the correction; the real prices have to come from the
   merchant.
6. See the numbered TODO in `GuidePage.jsx` for the restaurateur-side feature backlog
   (prep-time on accept, refusal reason, WhatsApp order tickets, auto-cancel delay).

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
