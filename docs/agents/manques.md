# Known gaps

Moved out of `CLAUDE.md` on 2026-10-22, word for word, so the guide every session loads stays short. Read it before claiming a feature exists or promising one.
The always-on rules are still in `CLAUDE.md` › « Rules that are never broken ». If you change what this file
describes, change this file in the same commit: a stale guide gets believed.

## Known gaps

**Pre-launch cleanup (2026-10-17).** Demo shops no longer come back on deploy: every demo seed in the backend's `server.js` runs only
with `FAIRIDE_SEED_DEMO=on` (absent in production). SMS codes go through GatewayAPI, only to +32/+31/+33/+49/+352, the rest by
e-mail. Stripe is in live mode (`/api/health` › `stripeLive: true`, re-checked 2026-10-24); the reset of the test IDs is
described in `../fairide-backend/docs/nettoyage-pre-lancement-2026-10-17.md`.


Real, verified as absent on 2026-09-22 — not speculation.

1. **Background geolocation exists in the app only** (2026-10-15). Driver tracking goes through `suivrePositionCourse`
   ([natif.js](../../src/natif.js)), used by [driver/Dashboard.jsx](../../src/pages/driver/Dashboard.jsx) and
   [driver/MapPage.jsx](../../src/pages/driver/MapPage.jsx): in the native app, while an order is « livraison », the
   `@capacitor-community/background-geolocation` plugin runs a foreground service (notification « Fairide : livraison en
   cours ») that keeps sending when the phone locks; otherwise, and on the website, `watchPosition`, which stops when the
   phone locks — there is no web fix. Not yet tried on a real phone; iOS needs the Info.plist / Background Modes steps in
   [docs/application-mobile.md](../../docs/application-mobile.md). The customer-facing map still shows a staleness warning after
   two minutes so a frozen map is at least legible ([DeliveryTrackingMap](../../src/components/DeliveryTrackingMap.jsx)).
2. **No SSR.** `npm run build` runs a prerender ([scripts/prerender.mjs](../../scripts/prerender.mjs)) that writes
   static HTML for the public pages (three languages) and the restaurant pages, and a `dist/sitemap.xml`
   (138 addresses on 2026-09-23). Pages added after the build list are not prerendered.
3. **Stock dish photos: off in production, on by default in the code.** `VITE_STOCK_DISH_PHOTOS` defaults to `on`
   (`menuCategories.js`), which fills a photo-less dish with a stock image when its name matches the table exactly.
   Production sets it `off` (Vercel variable since 2026-10-20, and `app-android-store.yml` for the Play build). Showing a
   stock photo as a real merchant's dish is a misleading commercial practice: keep it `off` wherever real shops are shown.
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
7. **Closing a business for the evening: the admin can** (this item said the opposite until 2026-10-24; DEC-15 of 2026-10-06 added it). Admin ›
   Commerces › « Fermer jusqu'à demain » (`PATCH /admin/restaurants/:id/close-until-tomorrow`, `BoutonFermerSoir` in
   [AdminRestaurantsPage](../../src/pages/admin/AdminRestaurantsPage.jsx)) pauses the business until 6:00 the next day, and
   « Fairide s'en occupe » (`POST /admin/restaurants/:id/act-as`) opens its dashboard to accept an order for it. See
   [docs/procedures-incidents.md](../../docs/procedures-incidents.md), case 3. What the team still cannot do from the console
   (audit 2026-10-24): push a message to offline couriers (broadcast is inbox + e-mail), change a delivery address, or be
   alerted before an unaccepted order is cancelled at 15 min.
