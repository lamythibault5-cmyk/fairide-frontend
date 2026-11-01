# Money: pricing, commission, fees, subscription, three sellers

Moved out of `CLAUDE.md` on 2026-10-22, word for word, so the guide every session loads stays short. Read it before touching a price, a fee, a share, a promo code, invoicing or dispatch.
The always-on rules are still in `CLAUDE.md` › « Rules that are never broken ». If you change what this file
describes, change this file in the same commit: a stale guide gets believed.

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
applied by the team) **up to `hausseMaxPourcent` = 10 %** (founder, 2026-10-16, whatever the VAT regime: €10 → €11.00 → €9.90 for
it; it was r / (1 − r) = 11.1 % from 10-13 to 10-16); never more. One function applies it everywhere (`appliquerHausse` in
`../fairide-backend/prixMagasin.js`): own price kept in `price_base`/`delta_base`, paid add-ons follow, rounded DOWN to €0.10 (`pricing.js`, `prixMagasin.js`; the team's « adjust all prices » tool rounds the same way, audit admin-31).
The « C'est bon » page offers the max increase in one tap, only on cards with checked in-store prices.
**Offers on a raised card (founder, 2026-10-26):** on a business with `price_markup_percent > 0` only, the price after a
« −X % » or « −X € » offer (Avantage Fairride included) is rounded DOWN to €0.10 (€11.10 − 15 % = €9.435 → €9.40); the
discount is the difference. Down, never up: the discount given is never less than the one shown (rounding up gave €9.50,
only −14.4 % under a « −15 % » label: a misleading price-reduction announcement, Owen refused that risk). Businesses without an increase (« Prix du comptoir » badge included) keep the cent rounding;
« 1 + 1 » and « X € dès Y € » are not affected. Server `prixMagasin.prixOffreArrondi` (order) and site `prixPlat.js`
(`activePromo.roundTenths`, set by `routes/restaurants.js`). The Stripe split does not change: 10 % of the price paid.
The customer additionally pays the **delivery fee only — nothing is added on top** (model of 2026-10-08 evening):
€5 excl. VAT for the first km, then €0.80 excl. VAT per started km, 21% VAT added (€6.05 incl. VAT minimum). **10% of it
is Fairide's system fee, included** (`fraisService`, stored as `service_fee` + `service_fee_vat`); the courier receives
**90% of the fee the customer paid**, whatever the vehicle (founder, 2026-10-14: `tauxKmLivreur` in `pricing.js` returns the
customer's per-km rate; the old bike €0.60 / motorised €0.80 grid, with the bike difference kept by Fairide, is gone). A courier's
minimum (CODE-13) applies to their share: the client fee is raised to minimum / 0.9 when no courier accepts the grid
(`routes/orders.js`, `troisVendeurs.prixAvecMinimum`). Takeaway paid on site: no commission, no fee.
**Tips go 100% to the courier** (`tipFairideRate` 0 — founder, 2026-10-13: « tips go 100 percent to driver »; this
reverses the 90/10 rule of 2026-10-09. Backend migration 026 had put 10% in the database, migration 032 resets it to 0).
The courier and restaurant contracts, the T&Cs and the courier texts promise it. **Since 2026-10-21 it is a fixed rule, not a
setting** (founder): `REGLES_FIXES` in `../fairide-backend/pricing.js` forces `tipFairideRate` 0 and `deliveryFairideRate` 0.10 (the
courier's 90 %) whatever `platform_settings` says, Admin › Paramètres no longer shows either field, and `PATCH /admin/settings`
refuses another value (`FIXED_RULE`).
**Delivery distance: 6 km by default**, or what the business sets (1–15 km since 2026-10-21, founder: 30 km was ~1 h 50 by bike and
~28 € of delivery fee; 15 km covers the whole Brussels region) in « Commandes et capacité » (`../fairide-backend/rayonLivraison.js`;
NULL used to mean « no limit » and accepted Antwerp). Backend migration 080 clamped settings above 15 km (one `admin_actions` row
each). The business contract `RESTO-2026.20` still prints « de 1 à 30 km » (`RAYON_MAX_KM_CONTRAT`) until its next version.
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
**Grace period (founder, 2026-10-21)**: turning billing on for a shop without an active subscription keeps its orders open for
14 days (`DELAI_GRACE_ABONNEMENT_JOURS`, `formules.enDelaiGrace`, `restaurants.subscription_grace_*`): an e-mail with the date at
the start, reminders on day 7 and day 12 (`delaiGraceAbonnement.js`, every 6 h), and a dashboard band « Tes commandes continuent
jusqu'au … » (DashboardLayout, `subscriptionGraceUntil`; on the website it says where to subscribe, in the app only the date).
Orders stop at the deadline. The front texts say « 14 jours » in full: change them with the constant.

- server: `commissionFairide` and `fraisService` in `../fairide-backend/pricing.js`, called by `routes/orders.js`;
  `service_fee` stores the system fee excl. VAT, `service_fee_vat` its VAT (0 under the franchise) — both already inside
  `delivery_fee`;
- client estimate: [src/fraisService.js](../../src/fraisService.js);
- cards are built at the business's in-store prices (`../fairide-backend/scripts/prix.js` corrects platform-priced cards);
  no ×1.10 any more. Since 2026-10-01 the business can no longer edit dishes or prices itself
  (`MENU_LOCKED`) — it asks, and the team applies;
- legal texts: contract `RESTO-2026.19` (in force 1 Nov 2026; 2026.18 widens the subscription guarantee, 2026.19 says Fairide charges no VAT and, revised before publication on 2026-10-13, the own-prices model; courier contracts `*-2026.8`), T&Cs `CGU-2026-10-13-b` (commission = 10 % of the price paid; says the subscription is 20 € with no VAT and that Fairide's system fee carries none), privacy
  `CONF-2026-10-17` (since 10-15: door-drop photo 30 days, courier position with the screen locked, courier SOS; 10-16-b: business staff
  accounts and group orders; 10-17: GatewayAPI as the SMS processor; they tell customers prices may be higher than on site). Never write « le prix du commerce » or « 100 % au
  restaurant » in customer-facing copy, and never « majoration » — it is « la commission de Fairide » (CODE-3).

## Changing the address after ordering (founder, 2026-10-27)

A customer who orders from somewhere else often forgets to change the address the checkout carried over from the last order.
From the order tracking (« Changer » next to the address, [ChangerAdresse](../../src/components/client/ChangerAdresse.jsx)) they
can change it **until the courier has picked the order up** (status `livraison`), at most 3 times, within the shop's delivery
radius. Uber Eats' rule, picked by Owen: **same price or cheaper → the address changes at once and the price paid stays** (no
small refund; when no courier has taken it yet, the gap stays with Fairride like the bike gap); **further → the customer pays
the difference** on a separate Stripe page (like the tip) and the address changes when the payment arrives. The supplement is
added to `delivery_fee` and `total` and kept in `orders.delivery_adjustment` (the first card charge is `total − delivery_adjustment`);
the shop's delivery discount does not grow; 10 % goes to the system fee, the rest to the courier. An assigned courier keeps at least
the price they accepted, and gets their own grid for the new trip if higher (bonus frozen at claim); a bike courier's order refuses a
new address beyond `VELO_MAX_KM`. A cancelled order refunds each supplement separately. Backend: `changementAdresse.js`, migration
096, `POST /orders/:id/address/quote` and `POST /orders/:id/address`. The checkout also warns « Tu n'es pas à cette adresse ? » when
the phone, with location already allowed (never asked for this), is more than 1 km from the address (`useLoinDeLAdresse`).

## Shop cancels after a courier took the job; payouts list (founder, 2026-10-31)

- A shop that cancels an accepted order (`PATCH /orders/:id/refuse` from `preparation`/`pret`) while a courier holds it:
  the customer is refunded in full as before, and the courier gets the share of a 1 km trip (base fee × 90 % = 4,50 €)
  for the trip (`annulationLivreur.js`, backend). Fairride pays it from its Stripe balance as a `virements_complements`
  row of nature `annulation` (never twice, retried when the balance is empty), books it 613-ANNULATION → 441-LIVREUR,
  and writes a `courier_earnings` line of kind `cancellation` (Gains: « Annulée par le commerce »). The courier's push
  says « 4,50 € pour toi quand même ». Charging it back to the shop needs a clause in the next shop contract version
  (30 days' notice): not done yet. The customer still can't cancel once the shop accepted (unchanged).
- Courier contract 2026.9 (`courierContracts.js`): prices are final, VAT included (the « hors TVA » left from 8-14/10 is
  gone), the courier's share in euros (4,50 € up to 1 km, 0,72 € per started km), straight-line distance, and the
  cancellation pay above. Couriers sign again (a 2026.8 signature leaves « contrat » missing in their dossier).
- Shops see their payouts: Factures › « Virements » and a « Prochain virement » tile on the home screen
  (`GET /restaurants/:id/payouts`, `virementsCommerce.js`): the next Monday's amount (Stripe balance), and each Stripe
  payout with its orders and deductions, read from the payout's balance transactions. Counter-paid orders are listed
  apart: already in the till, never in a payout.
- Courier offers show the shop → customer leg « ≈ x km » by the streets (× 1,3, like the first leg); the price still
  uses the straight line.

## Delivery grid, missing items, contracts to sign (founder, 2026-10-31, second round)

- **Delivery grid** (migration 101, `pricing.js` DEFAULTS): 5,80 € up to 3 km, then 0,50 € per started km, final price.
  Benchmarked on what Brussels customers pay elsewhere (Deliveroo 4,99 € + service fee, Takeaway ~4,49 € + 1,29 €). The
  courier keeps 90 %: at least 5,22 €, 5 % above Uber Eats' reported flat 4,95 € per order. Fairride never tops it up.
  The courier's cancellation pay (above) is the same 5,22 €.
- **Missing or wrong item** (`reclamationsPlats.js`): the customer ticks the dishes within 24 h of delivery, adds a photo
  of what arrived and confirms on honour. The shop gets a push and taps « Rembourser » or « Contester » (no photo asked of
  the shop). No answer within 2 h = refunded at the shop's charge (`rembourserCommande`, responsibility `restaurant`).
  Contested = no refund; the customer can « maintenir » (a ticket). Silence does NOT count as yes above 15 € or for a
  customer with 2 contested claims in 90 days (still allowed to claim; the team gets a task, nothing is closed
  automatically). A shop contesting 5+ claims from 3+ customers in 90 days gives a task.
- **Contracts must be signed before working**: couriers need courier contract 2026.9 to see or take any job
  (`courierContracts.contratAJour`); shops need RESTO-2026.21 from its date in force (2 December 2026, 30 days after the
  2 November notice the founders send), with no grace period after it (`GRACE_COMMANDES_JOURS = 0`).

## Three sellers per order (decided 2026-09-23)

The customer buys the food from the business, the **delivery from the independent courier** who accepts
the job, and the system fee (inside the delivery fee) from Fairide. The backend records a seller per line (`order_lines`, see
`../fairide-backend/troisVendeurs.js`). What the front end shows because of it:

- checkout recap labels each line with its seller (`conformite.seller*`);
- [VendeurLivraison](../../src/components/conformite/VendeurLivraison.jsx) on the client's orders — the
  courier's "Prénom N.", company number and VAT regime once known (the free "decline this courier" was closed by the
  founder on 2026-10-19: `PATCH /orders/:id/decline-courier` answers that it no longer exists);
- driver offers show the price, any Fairide-paid increase and a **Refuse** button, and an approximate
  destination (the server strips the client's name, phone and house number before the job is taken);
- [EspaceVendeurLivreur](../../src/components/conformite/EspaceVendeurLivreur.jsx) — minimum fee and the
  courier's sale documents (self-billing mandate, accepted in the notices step);
- admin › Conformité › *Attribution des courses* ([DispatchTab](../../src/pages/admin/compliance/DispatchTab.jsx)): delivery settings, and the
  evidence that refusing costs nothing as **aggregates only** — couriers grouped by refusal-rate band, average offers
  received per band, shown only when a band has at least 5 couriers (backend `statsAttribution.js`). No per-courier row,
  no « # » rank, on screen or in the CRT ZIP (founder, 2026-10-21: « if it's a driver classement let's not have any »).

Never add anything that ranks, rates or penalises couriers for refusing: the backend's
`tests/trois-vendeurs.test.js` fails if dispatch starts reading such data, and the courier notice promises it.
