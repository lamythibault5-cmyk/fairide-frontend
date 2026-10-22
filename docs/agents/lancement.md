# Launch switch: the GO button

Moved out of `CLAUDE.md` on 2026-10-22, word for word, so the guide every session loads stays short. Read it before touching delivery, online payment or anything that depends on the opening.
The always-on rules are still in `CLAUDE.md` › « Rules that are never broken ». If you change what this file
describes, change this file in the same commit: a stale guide gets believed.

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
- **Button**: Admin › Aujourd'hui ([BoutonGo.jsx](../../src/components/admin/BoutonGo.jsx)), backed by
  `routes/adminLancement.js` (`GET/POST /api/admin/launch`). Pressing it needs typing GO; only `owner` and `admin` roles
  (`ROLE_PREFIXES_METHODE` in `middleware/auth.js`); every press is written to `platform_audit_log`. `launch_go` is
  deliberately skipped by the generic `PATCH /admin/flags`. The card shows couriers/businesses ready (same checks as
  `pretLancement.js`) and couriers free right now, which is what the decision rests on.
- **First GO only**: an e-mail to approved real businesses and couriers (`annoncerOuverture`; the contract says the
  date is « announced by e-mail »), and every subscription still on trial gets its trial end pushed back by the time
  between activation and GO (`prolongerEssais`: the free month counts from the opening). A Stripe failure opens an
  admin task instead of blocking.
- **After GO, no courier = no delivery.** `lancement.livreursDisponibles` counts couriers who could take the job now:
  approved, Stripe active, status verified, not paused, not test, no job in hand, no selfie check past its 60-min deadline, right pool
  (`delivery_mode` own/fairide), bikes only within `VELO_MAX_KM`. Zero → order and quote refused with
  `NO_COURIER_AVAILABLE` (409). It only COUNTS couriers: never add ratings, rankings or acceptance history to it
  (employment-presumption rule, see `notifLivreurs.js`). Scheduled orders are judged like immediate ones.
- **Website** ([src/launch.js](../../src/launch.js)): reads `GET /orders/launch` (`go`, `goAt`) at start, every minute while
  visible and on return to the tab; the last answer is kept in `localStorage` (`fairide_lancement`). Components that depend
  on it call `useLancement()` to re-render. `livraisonDisponible(id)` reads `GET /orders/delivery-available/:id`
  (yes/no only, never the courier count); [Checkout](../../src/pages/client/Checkout.jsx) and
  [RestaurantMenu](../../src/pages/client/RestaurantMenu.jsx) switch to takeaway and show `noCourierNow` / `noCourierBanner`.
  Texts say « bientôt » with no date; `datePremierPrelevement()` returns null before GO (`*AvantGo` texts).
- **Contract** `RESTO-2026.20` (`restaurantContract.js`): « à la date que Fairide annonce au Commerce par e-mail »
  instead of 10 November. Calendar set to published 20/10/2026, in force 05/11/2026 (15-day P2B notice); `notifier`
  is false, so the founders send it themselves, and both dates move if it goes out later.
- Tests: `../fairide-backend/tests/bouton-go.test.js`; `scripts/simuler-parcours-client.js` presses GO itself.
