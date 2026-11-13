# Launch switch: the GO button

Moved out of `CLAUDE.md` on 2026-10-22, word for word, so the guide every session loads stays short. Read it before touching delivery, online payment or anything that depends on the opening.
The always-on rules are still in `CLAUDE.md` › « Rules that are never broken ». If you change what this file
describes, change this file in the same commit: a stale guide gets believed.

## Launch switch: the GO button (founder, 2026-10-18)

**Delivery and online payment open when the team presses GO, not on a date.** A date opens by itself even with 4 couriers,
and customers would pay for deliveries nobody can do.

**Takeaway paid at the shop has its own button too (founder, 2026-10-31): « Ouvrir l'à emporter ».** It kept a date
(1 November) and was about to open by itself while the team was not ready. Now nothing opens on a date: the team presses
« Ouvrir l'à emporter » first (no courier, no Stripe needed), then GO when couriers are ready. GO also opens takeaway
(and writes it open, so closing GO later leaves takeaway open); takeaway can't be closed alone while GO is open
(`GO_OUVERT`). Texts say « bientôt » with no date. Do not reintroduce `FAIRIDE_PICKUP_OPEN_AT` /
`FAIRIDE_DELIVERY_OPEN_AT` / `FAIRIDE_ONLINE_PAYMENT_OPEN_AT` (no longer read, so a leftover Railway variable can't reopen
anything) or any `VITE_*_OPEN_AT` (the app copies `src/launch.js` into its package: a date there stayed in every installed
app). On 2026-10-31 evening `FAIRIDE_PICKUP_OPEN_AT=2099-…` was set on Railway as a stopgap until the button shipped; it is
ignored since, and can be deleted.

- **Server** (`../fairide-backend/lancement.js`): state = `platform_flags.launch_go` + `platform_parameters.launch_go_at`
  (time of the FIRST GO, kept if the team closes and reopens); takeaway: `platform_flags.pickup_go` +
  `platform_parameters.pickup_go_at`, same rules. Read on every order, never cached; a failed read means closed, but is
  told apart (`etat().illisible`, G99, 2026-11-06): `GET /orders/launch` answers 503 (clients keep the last known state)
  and orders get `LANCEMENT_ILLISIBLE` (503, « réessaie dans un instant ») instead of « bientôt ».
  `FAIRIDE_GO=on` forces everything open (staging, simulation scripts); `FAIRIDE_EMPORTER=on` forces takeaway only (tests).
  `routes/orders.js` gates takeaway paid at the shop (`PICKUP_NOT_OPEN`), delivery (`DELIVERY_NOT_OPEN`) and online-paid
  takeaway (`ONLINE_PAYMENT_NOT_OPEN`), with `opensAt: null`: no date is promised.
  Admins and accounts the team marked test (`compteExempte`) still pass, so the whole live flow can be tested before GO.
- **Button**: Admin › Aujourd'hui ([BoutonGo.jsx](../../src/components/admin/BoutonGo.jsx)), backed by
  `routes/adminLancement.js` (`GET/POST /api/admin/launch`). Pressing it needs typing GO; only `owner` and `admin` roles
  (`ROLE_PREFIXES_METHODE` in `middleware/auth.js`); every press is written to `platform_audit_log`. `launch_go` and
  `pickup_go` are deliberately refused by the generic `PATCH /admin/flags`. Above it, the « À emporter payé sur place »
  card (`CarteEmporter`, same file) calls `POST /api/admin/launch/pickup` (`{ open, confirmation: 'EMPORTER' }`), same
  roles and audit (`pickup_go` / `pickup_closed`); its first opening e-mails the shops that can sell takeaway paid at the
  shop (`lancement.annoncerEmporter`, report in a task), not couriers. The card shows couriers/businesses ready (same checks as
  `pretLancement.js`) and couriers free right now, which is what the decision rests on. It also shows, in red, what does
  not block GO but must be seen (founder, 2026-11-06, G3): courier insurance references still empty
  (`courier_insurance_policy`, Admin › Conformité: **GO stays possible without it**) and ready couriers with no push
  device. The card re-reads itself every minute; a press answers from what was written even when the readiness reading
  fails (`bilanIllisible`, G72).
  GO is refused (409 `DELAI_SANS_LIVREUR_VIDE`) while `delivery_no_courier_cancel_min` (Admin › Conformité › Dispatch) is
  empty: without it a paid delivery nobody takes never closes (pre-GO bug hunt, 2026-11-06, G4). The card says so in red
  (`bilan().annulationSansLivreurMin` null). Closing stays possible. After GO the delay can no longer be emptied either.
  This automatic cancel counts from the time the job is offered **plus the time a courier held it before releasing it**
  (`orders.held_ms`, Owen 2026-11-13, F19), so the other couriers always get the full delay; the customer's own « aucun
  livreur » button keeps its 20 minutes, and since 2026-11-13 also opens from « en préparation » when the courier who claimed
  never came and the shop never tapped « Prête » (20 minutes after the expected ready time, F5; outcome in argent.md ›
  « Money and order review of 2026-11-13 »).
- **GO announcement (G12, founder 2026-11-06)**: no longer to every approved shop and courier. `lancement.destinatairesAnnonce`
  (from `pretLancement`): shops that can sell everything (ready, Stripe active, delivery or online payment offered) get
  « c'est parti »; shops that can only sell takeaway paid at the shop get a takeaway text; the others nothing; only ready
  couriers get the courier mail. The card shows the counts before GO. Each successful send is noted
  (`annonces_ouverture`), failed addresses are listed in the report task, and after the first GO « Renvoyer l'annonce »
  (`POST /api/admin/launch/announce`) sends it to those who are ready and have not received it (send failed, ready since).
  The contract says the date is « announced by e-mail ». It used to push back the trial end of every shop subscription
  (`prolongerEssais`): gone with the subscription on 2026-11-04.
- **After GO, no courier = no delivery.** `lancement.livreursDisponibles` counts couriers who could take the job now:
  approved, Stripe active, status verified, not test, no job in hand, no selfie check past its 60-min deadline
  and bikes only within `VELO_MAX_KM`, and **free** (`couriers.sqlLivreurLibre`, founder 2026-11-06, G1/G2/G30): not paused,
  seen in the app within `courier_presence_min` minutes (15; `users.driver_seen_at`, written at most once a minute by the
  courier screen's `GET /orders/available` — one timestamp, never a history), at least one push device, location sharing
  not off, current contract version signed. **Phone in pocket (Owen, 2026-11-08):** « seen » also counts within the courier's
  session (`courier_session_h`, 3 h) as long as he is not « silent »: a « Nouvelle course » sent 10 min ago or more
  (`users.driver_offer_pushed_at`, the first offer since his last visit, overwritten) with no visit to the app since. Then no
  more offers until he comes back; no effect on pay or account (`couriers.sqlVuRecemment`, backend `docs/dispatch.md`). Approved or reinstated couriers start paused; logging out, or turning location
  off, pauses them. Each free courier covers `delivery_orders_per_free_courier` (1) delivery already sold and still waiting
  for a courier (`lancement.livreurPourUneLivraison`, G6; a scheduled one counts from 60 min before its time, or from when it is offered to couriers if earlier: review of 11-13, F21). An open
  Stripe page reserves nothing: the rule runs again when the payment lands (`fermeALArriveeDuPaiement`, reason `livreur`,
  one delivery payment at a time via `verrouPaiementLivraison`); the first paid keeps the courier, the next is refunded at
  once and never reaches the shop (2026-11-07). The same rule
  picks who gets « Nouvelle course » (`notifLivreurs.livreursAPrevenir`, e-mail reminder included) and feeds the admin
  counts. Zero → order and quote refused with
  `NO_COURIER_AVAILABLE` (409), except for a shop that delivers with its own employees (`livraisonCommerce.livreParCommerce`,
  `lancement.livraisonPossible`, 2026-11-02): it waits for no courier, but still only after GO. It only COUNTS couriers: never add ratings, rankings or acceptance history to it
  (employment-presumption rule, see `notifLivreurs.js`). Scheduled orders are judged like immediate ones.
- **Takeaway payment: « Au choix du client » before GO, « En ligne uniquement » after (founder, 2026-11-04), only with
  Stripe (founder, 2026-11-06, G7).** The fear: a customer orders, never comes and never pays. Before GO online payment
  does not exist, so « En ligne uniquement » would sell nothing: shops stay on `both` (8 shops left on the database default
  `online` were switched to `both` on 04/11). Without active Stripe, `online` sells nothing either (pay-at-shop and online
  are both refused, the shop vanishes from the list), so it is refused while `stripe_connect_status` is not `active`
  (`PATCH /api/:id/services` → `EN_LIGNE_SANS_PAIEMENTS`; Mon compte greys it out). Sign-up always starts `both`
  (`modeEmporterParDefaut()` in [src/launch.js](../../src/launch.js), and the server turns a sign-up `online` into `both`);
  the sign-up forms no longer offer `online`. A shop on `both` without Stripe shows `on_site` on its public page
  (`pourLePublic`), so checkout offers pay-at-shop only. **At GO** the team switches to `online` only the shops whose
  Stripe is `active` (`PATCH /api/:id/services`, the morning digest lists who is left); the others stay on `both` until their
  Stripe is live. The team tells each one; the contract lets the shop change it back in Mon compte (« Formules et calendrier »). A shop that chose
  « Sur place uniquement » itself (Café Joyeux, La Signare on 04/11) is asked first, with the reason. Until then the
  existing guard holds: one « Client pas venu » closes pay-at-shop to that customer at every shop (`routes/orders.js`).
- **Closing GO (« Refermer ») also shuts takeaway at shops on `online`** (it is only paid online, and online payment closes
  with GO; G35). The card counts them (`commercesEnLigneSeulement`) in the closed state and in the close confirmation. For a
  courier or delivery incident, cut delivery per shop (Admin › Restaurants, `fairide_delivery_disabled`) or per zone
  (Admin › Logistique): keep « Refermer » for a payment incident.
- **Website** ([src/launch.js](../../src/launch.js)): reads `GET /orders/launch` (`go`, `goAt`, `pickupOpen`) at start, every
  minute while visible, on return to the tab and right after any `*_NOT_OPEN` refusal (G100; through `api()`, so the app
  falls back to the relay); the last answer is kept in `localStorage` (`fairide_lancement`). Components that depend
  on it call `useLancement()` to re-render. `livraisonDisponible(id)` reads `GET /orders/delivery-available/:id`
  (yes/no only, never the courier count); [Checkout](../../src/pages/client/Checkout.jsx) and
  [RestaurantMenu](../../src/pages/client/RestaurantMenu.jsx) switch to takeaway and show `noCourierNow` / `noCourierBanner`.
  Texts say « bientôt » with no date; `datePremierPrelevement()` returns null before GO (`*AvantGo` texts).
- **Contract** `RESTO-2026.20` (`restaurantContract.js`): « à la date que Fairide annonce au Commerce par e-mail »
  instead of 10 November. Calendar set to published 20/10/2026, in force 05/11/2026 (15-day P2B notice); `notifier`
  is false, so the founders send it themselves, and both dates move if it goes out later.
  The contract text still says takeaway opens « dès le 1er novembre 2026 » (`OUVERTURE_EMPORTER` in
  `restaurantContract.js`, left as accepted): the next version should say « à la date annoncée par e-mail » like delivery
  (founder's decision pending, 15-day P2B notice).
- Tests: `../fairide-backend/tests/bouton-go.test.js`, `bouton-emporter.test.js`; `scripts/simuler-parcours-client.js`
  presses both buttons itself.
