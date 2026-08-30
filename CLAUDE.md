# CLAUDE.md

Guide for Claude Code working in this repository.

## What this is

Fairide is a food-delivery / local-commerce platform for Brussels, positioned on a
commission capped at 10% (vs. 22-32% on the big platforms). **This repo is the front end
only.** The backend is a separate service.

- Production: `https://fairide.be`
- Backend API: `https://fairide-backend-production.up.railway.app/api` (Railway)
- Deploy: Vercel — SPA rewrite of all routes to `/index.html`, see [vercel.json](vercel.json)

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

`npm run lint` is the whole verification story. There is nothing else to run, so read your
changes carefully and, where behaviour matters, check them in the browser with `npm run dev`.

### Environment variables

Copy [.env.example](.env.example) to `.env.local` before working. All are optional in the sense that
each has a fallback — but **the `VITE_API_BASE` fallback is the production Railway backend**, so
without a `.env.local` your dev server edits live data.

| Variable | Purpose |
|---|---|
| `VITE_API_BASE` | Overrides the Railway backend URL in [src/api.js](src/api.js) |
| `VITE_GOOGLE_CLIENT_ID` | Google Sign-In (script loaded in [index.html](index.html)) |
| `VITE_SENTRY_DSN` | Enables Sentry — but only *after* cookie consent, see [src/main.jsx](src/main.jsx) |
| `VITE_STOCK_DISH_PHOTOS` | `on` (default) fills photo-less dishes from a stock-image table; `off` disables it. Must be `off` before real restaurants go live — see [src/menuCategories.js](src/menuCategories.js) |

## Architecture

### Four roles, one SPA

Every route lives in [src/App.jsx](src/App.jsx) — the full route map, read it first when orienting.
Access is gated by `<ProtectedRoute role="...">`.

**Routes are code-split by role.** Only the public entry path (home, login, restaurant list, restaurant
menu) is statically imported; everything else is `React.lazy` behind one `<Suspense>`. Keep it that way
when adding a route — a static import of a dashboard page pulls it into every customer's first load.

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

**One file: [src/styles.css](src/styles.css)** (~1,280 lines), imported once in `main.jsx`.
Global class names, no CSS modules, no Tailwind. Inline `style={{}}` is used freely for
one-off spacing and is an accepted pattern here.

Design tokens are CSS custom properties in `:root` at the top of the file. **Change colours
there, not at call sites.**

| Token | Value | Role |
|---|---|---|
| `--ink` / `--ink-soft` | `#16233A` / `#3A4A63` | Primary navy, body text |
| `--gold` / `--gold-deep` | `#D9A441` / `#B5822B` | Accent |
| `--cream` / `--cream-dim` | `#FBF8F2` / `#F0EBDD` | Page background |
| `--line` | `#E1D9C4` | Borders |
| `--red` `--blue` `--orange` `--purple` | | Status / category colours |
| `--radius` `--shadow` | `14px` | Shape |

Recent commits removed teal/green from the identity in favour of the navy-and-gold palette —
check `git log` before reintroducing a green.

Fonts: **Fraunces** (serif, headings) and **Space Grotesk** (body), pulled from Google Fonts
by an `@import` at the top of `styles.css`.

There is no `button.btn-teal` rule — only `a.btn-teal`. Teal was removed from the identity; use
`btn-gold` for primary actions and `btn-outline` for secondary.

Confirmation modals use [ConfirmDialog](src/components/ConfirmDialog.jsx) — never `window.confirm`,
which is suppressed in installed PWAs and webviews.

Note the two heavily-commented rules near the top of the file — `overflow-x: clip` on
`html`/`body` and `-webkit-tap-highlight-color: transparent`. Both encode a bug that was
already fixed once (`clip` rather than `hidden`, because `hidden` silently breaks
`position: sticky`). Read the comments before touching them.

### Internationalisation — partial

[src/i18n/translations.js](src/i18n/translations.js) holds `fr` / `en` / `nl` tables;
default `fr`. But only **30 of 94** components use `useLanguage()`. Roughly: public and
client-facing surfaces are translated, the restaurant/driver/admin dashboards are hardcoded
French.

So when you touch a component, check which kind it is. Adding a key means adding it to all
three locales.

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

**Watch file size.** `Account.jsx` (902), `MenuPage.jsx` (696) and `AdminAccountingPage.jsx`
(690) are already large. Extract a component rather than growing them further.
`menuCategories.js` (3,316) is a data table, not logic — that one is fine.

## Known gaps

Real, verified as absent — not speculation:

1. **No Web Push.** Restaurants now get a sound, a tab-title counter and a system notification via
   [useNewOrderAlert](src/hooks/useNewOrderAlert.js), but all three require the tab to still be open.
   Closed tab or sleeping device needs a service worker + VAPID keys + subscription storage on the
   backend. This is also what customer-facing promo notifications would need.
2. **No background geolocation.** Driver tracking uses `watchPosition`, which survives a backgrounded
   tab far better than the old `setInterval` but still stops when the phone locks. There is no web fix
   — it needs a native or Capacitor build. The customer-facing map shows a staleness warning after two
   minutes so a frozen map is at least legible ([DeliveryTrackingMap](src/components/DeliveryTrackingMap.jsx)).
3. **PWA is half-built.** [public/manifest.json](public/manifest.json) exists with
   `display: standalone`, but there is no service worker and the only icon is an SVG — Android
   install prompts want PNG 192/512.
4. **No SSR or prerendering, and the sitemap can't list restaurants.** The public restaurant pages are
   indexable by intent only; see the comment in [public/sitemap.xml](public/sitemap.xml).
5. **i18n covers ~30 of 94 components.** Public and client surfaces are translated; the restaurant,
   driver and admin dashboards are hardcoded French.
6. **Form labels are associated only on Auth and Checkout.** The other pages still have visible
   `<label>` elements with no `htmlFor`. Follow the `htmlFor`/`id` pattern when you touch a form.
7. See the numbered TODO in `GuidePage.jsx` for the restaurateur-side feature backlog
   (prep-time on accept, refusal reason, WhatsApp order tickets, auto-cancel delay).

## Git

Remote is `https://github.com/lamythibault5-cmyk/fairide-frontend`. The `gh` CLI is **not
installed** — use plain `git`. Work on a feature branch and let the owner merge; don't commit
straight to `main` unless asked.
